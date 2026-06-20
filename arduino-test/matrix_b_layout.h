#pragma once

/** Matrix B — 4×3 단면, 모형당 LED 8개
 *  프로토타입(4모형): NUM_LEDS 32 / MODELS 4
 *  전체: 96 / 12 로 바꿔 업로드
 */
#define MATRIX_B_NUM_LEDS 32
#define MATRIX_B_NUM_MODELS 4
#define MATRIX_B_LED_PIN 12

/** 모형 m (1~12) → 체인 상 LED 번호 (1-indexed, 사용자 표기와 동일) */
inline int matrixBTopStart1(int model1Based) {
  const int m = model1Based - 1;
  const int row = m / 4;
  const int col = m % 4;
  return row * 32 + col * 4 + 1;
}

inline int matrixBBottomStart1(int model1Based) {
  const int m = model1Based - 1;
  const int row = m / 4;
  const int col = m % 4;
  return row * 32 + 16 + (3 - col) * 4 + 1;
}

/** 모형 index 0~11, outIdx 0~7 → LED index 0~95 */
inline int matrixBLedIndex(int modelIndex, int outIdx) {
  const int model1 = modelIndex + 1;
  const int top = matrixBTopStart1(model1) - 1;
  const int bottom = matrixBBottomStart1(model1) - 1;
  if (outIdx < 4) {
    return top + outIdx;
  }
  return bottom + (outIdx - 4);
}

/** 시리얼 출력용 — 모형별 LED 번호(1-indexed) */
inline void matrixBPrintModelMap() {
  Serial.println("Matrix B — model -> LED numbers (1-based chain):");
  for (int m = 1; m <= MATRIX_B_NUM_MODELS; m++) {
    Serial.print("  Model ");
    Serial.print(m);
    Serial.print(": ");
    for (int i = 0; i < 8; i++) {
      if (i > 0) {
        Serial.print(i == 4 ? " / " : ",");
      }
      Serial.print(matrixBLedIndex(m - 1, i) + 1);
    }
    Serial.println();
  }
}
