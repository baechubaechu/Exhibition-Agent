from __future__ import annotations

from typing import Any, Dict, List, Tuple

try:
    from google.cloud import vision  # type: ignore
except Exception:  # pragma: no cover
    vision = None


LIKELIHOOD_TO_SCORE = {
    0: 0,
    1: 1,
    2: 2,
    3: 3,
    4: 4,
    5: 5,
}

# 검증된 Emotional Space 백엔드와 동일 — 퍼센트 재분배용
EMOTION_ORDER = ["Joy", "Sorrow", "Anger", "Surprise", "Neutral"]


class VisionUnavailableError(RuntimeError):
    pass


class VisionApiError(RuntimeError):
    """Google Vision 호출 실패(잘못된 이미지, 할당량, 권한 등)."""


def validate_image_bytes(img_bytes: bytes) -> None:
    if not img_bytes or len(img_bytes) < 64:
        raise VisionApiError("프레임이 비어 있습니다. 웹캠이 준비된 뒤 다시 시도하세요.")
    if img_bytes[:3] == b"\xff\xd8\xff":
        return
    if img_bytes[:8] == b"\x89PNG\r\n\x1a\n":
        return
    raise VisionApiError("지원하지 않는 이미지 형식입니다(JPEG/PNG만 가능).")


def likelihood_score(value: Any) -> int:
    if value is None:
        return 0
    if isinstance(value, int):
        return LIKELIHOOD_TO_SCORE.get(value, 0)
    try:
        return LIKELIHOOD_TO_SCORE.get(int(value), 0)
    except (TypeError, ValueError):
        name = str(getattr(value, "name", value)).upper()
        by_name = {
            "UNKNOWN": 0,
            "VERY_UNLIKELY": 1,
            "UNLIKELY": 2,
            "POSSIBLE": 3,
            "LIKELY": 4,
            "VERY_LIKELY": 5,
        }
        return by_name.get(name, 0)


def get_face_box(face: Any) -> Tuple[int, int, int, int]:
    xs = [v.x for v in face.bounding_poly.vertices if v.x is not None]
    ys = [v.y for v in face.bounding_poly.vertices if v.y is not None]
    if not xs or not ys:
        return (0, 0, 0, 0)
    return min(xs), min(ys), max(xs), max(ys)


def bounding_area(face: Any) -> int:
    x1, y1, x2, y2 = get_face_box(face)
    return max(0, (x2 - x1) * (y2 - y1))


def compute_percentages_to_100(raw_scores: Dict[str, float]) -> Dict[str, int]:
    total = float(sum(max(v, 0.0) for v in raw_scores.values()))
    if total <= 0:
        return {name: (100 if name == "Neutral" else 0) for name in EMOTION_ORDER}

    exact = {name: (max(raw_scores.get(name, 0.0), 0.0) / total) * 100.0 for name in EMOTION_ORDER}
    floored = {name: int(exact[name]) for name in EMOTION_ORDER}
    remainder = 100 - sum(floored.values())

    if remainder > 0:
        ranked = sorted(EMOTION_ORDER, key=lambda n: (exact[n] - floored[n]), reverse=True)
        for i in range(remainder):
            floored[ranked[i % len(ranked)]] += 1

    return floored


def remap_face_percentages(scores: Dict[str, int]) -> Dict[str, int]:
    raw = {
        "Joy": float(max(scores.get("joy", 0), 0)),
        "Sorrow": float(max(scores.get("sorrow", 0), 0)),
        "Anger": float(max(scores.get("anger", 0), 0)),
        "Surprise": float(max(scores.get("surprise", 0), 0)),
    }
    raw["Neutral"] = float(max(0, 5 - max(raw.values(), default=0.0)))
    return compute_percentages_to_100(raw)


def get_vision_client() -> Any:
    if vision is None:
        raise VisionUnavailableError(
            "google-cloud-vision is not installed. Run: pip install -r requirements.txt"
        )
    from app.env_load import normalize_google_credentials

    cred_path = normalize_google_credentials()
    if cred_path is None:
        raise VisionUnavailableError(
            "GOOGLE_APPLICATION_CREDENTIALS 가 .env 에 없습니다. "
            "서비스 계정 JSON 경로를 설정하세요."
        )
    if not cred_path.is_file():
        raise VisionUnavailableError(
            f"서비스 계정 JSON을 찾을 수 없습니다: {cred_path} "
            "(노트북 이전 시 JSON 파일 복사·경로 확인, uvicorn 재시작)"
        )
    return vision.ImageAnnotatorClient()


def analyze_emotion_from_image_bytes(client: Any, img_bytes: bytes) -> dict[str, Any]:
    """
    Google Vision face_detection — 검증된 태블릿 파이프라인과 동일하게
    - 얼굴별 박스·퍼센트(리맵) `face_displays`
    - 전체 평균 `avg_scores` (컨트롤·하위 호환)
    - 가장 큰 얼굴 기준 `primary_avg_scores` → 감정 판정에 사용 (태블릿 UX에 맞춤)
    """
    if vision is None:
        raise VisionUnavailableError("google-cloud-vision is not available")

    validate_image_bytes(img_bytes)

    image = vision.Image(content=img_bytes)
    response = client.face_detection(image=image)
    if response.error.message:
        raise VisionApiError(f"Cloud Vision API: {response.error.message}")

    faces = response.face_annotations
    face_count = len(faces)
    if face_count == 0:
        z = {"joy": 0.0, "sorrow": 0.0, "anger": 0.0, "surprise": 0.0}
        return {
            "people_count": 0,
            "avg_scores": z,
            "primary_avg_scores": z,
            "face_displays": [],
        }

    totals = {"joy": 0.0, "sorrow": 0.0, "anger": 0.0, "surprise": 0.0}
    face_displays: List[dict[str, Any]] = []

    for face in faces:
        scores = {
            "joy": likelihood_score(face.joy_likelihood),
            "sorrow": likelihood_score(face.sorrow_likelihood),
            "anger": likelihood_score(face.anger_likelihood),
            "surprise": likelihood_score(face.surprise_likelihood),
        }
        for k in totals:
            totals[k] += float(scores[k])
        percentages = remap_face_percentages(scores)
        dominant_label = max(percentages, key=percentages.get)
        face_displays.append(
            {
                "box": list(get_face_box(face)),
                "scores": scores,
                "percentages": percentages,
                "dominant_label": dominant_label,
            }
        )

    avg_scores = {k: round(totals[k] / face_count, 3) for k in totals}

    primary_face = max(faces, key=bounding_area)
    primary_int = {
        "joy": likelihood_score(primary_face.joy_likelihood),
        "sorrow": likelihood_score(primary_face.sorrow_likelihood),
        "anger": likelihood_score(primary_face.anger_likelihood),
        "surprise": likelihood_score(primary_face.surprise_likelihood),
    }
    primary_avg_scores = {k: float(primary_int[k]) for k in primary_int}

    return {
        "people_count": face_count,
        "avg_scores": avg_scores,
        "primary_avg_scores": primary_avg_scores,
        "face_displays": face_displays,
    }
