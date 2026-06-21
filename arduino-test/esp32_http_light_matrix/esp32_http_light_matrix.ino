/**
 * Matrix B 전시 연동 — WiFi + HTTP POST /light/scene
 *
 * 96 LED / 12 모형 (matrix_b_layout.h). DIN → GPIO13.
 *
 * 동작 요약:
 *  - 도면 핀(floor_pin_1/2/3): 핀별 지정 모형만 흰색·최대 밝기로 하이라이트.
 *  - 그 외 씬: 전체 모형을 color_temp 색감으로 "은은하게", 씬별 강약(밝기) 차등.
 *  - approaching_invite: 12모형 순차 쓸기(유지).
 *  - 모든 점등은 transition_ms 동안 부드럽게 페이드.
 *
 * 1) WIFI_SSID / WIFI_PASSWORD 수정
 * 2) 업로드 후 시리얼(115200) IP 확인 (고정 IP 192.168.137.50)
 * 3) 노트북 .env: EXHIBITION_LIGHT_MATRIX_HTTP_URL=http://192.168.137.50
 */

#include <WiFi.h>
#include <WebServer.h>
#include <Adafruit_NeoPixel.h>
#include <math.h>

#include "matrix_b_layout.h"

static String jsonGetString(const String &json, const char *key) {
  String pat = String("\"") + key + "\":\"";
  int i = json.indexOf(pat);
  if (i < 0) return "";
  i += pat.length();
  int j = json.indexOf('"', i);
  if (j < 0) return "";
  return json.substring(i, j);
}

static int jsonGetInt(const String &json, const char *key, int defaultVal) {
  String pat = String("\"") + key + "\":";
  int i = json.indexOf(pat);
  if (i < 0) return defaultVal;
  i += pat.length();
  while (i < (int)json.length() && (json.charAt(i) == ' ' || json.charAt(i) == '\t')) i++;
  long v = 0;
  bool neg = false;
  if (i < (int)json.length() && json.charAt(i) == '-') {
    neg = true;
    i++;
  }
  bool any = false;
  while (i < (int)json.length() && json.charAt(i) >= '0' && json.charAt(i) <= '9') {
    any = true;
    v = v * 10 + (json.charAt(i) - '0');
    i++;
  }
  if (!any) return defaultVal;
  return neg ? -(int)v : (int)v;
}

#define WIFI_SSID "0423"
#define WIFI_PASSWORD "135792468"

// 고정 IP — 노트북 윈도우 모바일 핫스팟(게이트웨이 192.168.137.1) 기준.
static const IPAddress STATIC_IP(192, 168, 137, 50);
static const IPAddress STATIC_GW(192, 168, 137, 1);
static const IPAddress STATIC_MASK(255, 255, 255, 0);
static const IPAddress STATIC_DNS(192, 168, 137, 1);

#define FADE_FRAME_MS 16     // ~60fps 페이드 갱신
#define FADE_MIN_MS 80       // 너무 짧은 전환 방지
#define FADE_MAX_MS 6000

Adafruit_NeoPixel strip(MATRIX_B_NUM_LEDS, MATRIX_B_LED_PIN, NEO_GRB + NEO_KHZ800);
WebServer server(80);

// ===== 페이드 프레임버퍼 (밝기는 RGB 값에 인코딩, 전역 brightness=255 고정) =====
static uint8_t curR[MATRIX_B_NUM_LEDS], curG[MATRIX_B_NUM_LEDS], curB[MATRIX_B_NUM_LEDS];
static uint8_t stR[MATRIX_B_NUM_LEDS], stG[MATRIX_B_NUM_LEDS], stB[MATRIX_B_NUM_LEDS];
static uint8_t tgR[MATRIX_B_NUM_LEDS], tgG[MATRIX_B_NUM_LEDS], tgB[MATRIX_B_NUM_LEDS];
static unsigned long fadeStartMs = 0, fadeDurMs = 0, lastFrameMs = 0;
static bool fading = false;

/** scenes.yaml scene_id → 모형 index 0~11 (현재 일반 씬은 전체 점등이라 미사용, 참고용) */
int modelFromSceneId(const String &id) {
  if (id == "calm_gallery") return 0;
  if (id == "dense_flux") return 1;
  if (id == "critical_focus") return 2;
  if (id == "night_reflect") return 3;
  if (id == "safe_neutral") return 4;
  return 0;
}

/** 씬별 은은한 밝기(강약) — 0~100. 핀은 별도(흰색 최대). */
int ambientPctForScene(const String &id) {
  if (id == "dense_flux") return 78;        // 혼잡·시끄러움 — 강하게
  if (id == "critical_focus") return 62;    // 집중 — 약간 강
  if (id == "calm_gallery") return 42;      // 차분
  if (id == "safe_neutral") return 40;      // 기본
  if (id == "presence_cooldown") return 24; // 쿨다운 — 가장 어둑
  if (id == "night_reflect") return 28;     // 야간 성찰 — 어둑
  return 42;
}

/** 색온도(K) → 화이트밸런스 RGB (Tanner Helland 근사). 초록 등 없이 따뜻↔차가운 백색만. */
void kelvinToRGB(int kelvin, uint8_t &outR, uint8_t &outG, uint8_t &outB) {
  kelvin = constrain(kelvin, 1500, 9000);
  const float t = kelvin / 100.0f;
  float r, g, b;
  if (t <= 66.0f) {
    r = 255.0f;
    g = 99.4708025861f * logf(t) - 161.1195681661f;
  } else {
    r = 329.698727446f * powf(t - 60.0f, -0.1332047592f);
    g = 288.1221695283f * powf(t - 60.0f, -0.0755148492f);
  }
  if (t >= 66.0f) {
    b = 255.0f;
  } else if (t <= 19.0f) {
    b = 0.0f;
  } else {
    b = 138.5177312231f * logf(t - 10.0f) - 305.0447927307f;
  }
  outR = (uint8_t)constrain(r, 0.0f, 255.0f);
  outG = (uint8_t)constrain(g, 0.0f, 255.0f);
  outB = (uint8_t)constrain(b, 0.0f, 255.0f);
}

// ----- 타깃 프레임버퍼 빌더 -----
void tgtClear() {
  for (int i = 0; i < MATRIX_B_NUM_LEDS; i++) {
    tgR[i] = tgG[i] = tgB[i] = 0;
  }
}

void tgtAll(uint8_t r, uint8_t g, uint8_t b) {
  for (int i = 0; i < MATRIX_B_NUM_LEDS; i++) {
    tgR[i] = r;
    tgG[i] = g;
    tgB[i] = b;
  }
}

/** 사용자 모형 번호(1~12, 1=왼쪽 위 … 12=오른쪽 아래) 타깃에 칠하기.
 *  matrixBLedIndex 는 내부에서 (12 - modelIndex) = 사용자번호 로 환산하므로 역으로 넣는다. */
void tgtUserModel(int userModel, uint8_t r, uint8_t g, uint8_t b) {
  if (userModel < 1 || userModel > MATRIX_B_NUM_MODELS) return;
  const int modelIndex = MATRIX_B_NUM_MODELS - userModel;
  for (int k = 0; k < 8; k++) {
    const int idx = matrixBLedIndex(modelIndex, k);
    if (idx < 0 || idx >= MATRIX_B_NUM_LEDS) continue;
    tgR[idx] = r;
    tgG[idx] = g;
    tgB[idx] = b;
  }
}

/** 현재 타깃으로 durMs 동안 페이드 시작 */
void beginFade(unsigned long durMs) {
  for (int i = 0; i < MATRIX_B_NUM_LEDS; i++) {
    stR[i] = curR[i];
    stG[i] = curG[i];
    stB[i] = curB[i];
  }
  fadeDurMs = constrain((long)durMs, (long)FADE_MIN_MS, (long)FADE_MAX_MS);
  fadeStartMs = millis();
  fading = true;
}

void writeCurToStrip() {
  for (int i = 0; i < MATRIX_B_NUM_LEDS; i++) {
    strip.setPixelColor(i, curR[i], curG[i], curB[i]);
  }
  strip.show();
}

void updateFade() {
  if (!fading) return;
  const unsigned long now = millis();
  if (now - lastFrameMs < FADE_FRAME_MS) return;
  lastFrameMs = now;

  float t = (fadeDurMs == 0) ? 1.0f : (float)(now - fadeStartMs) / (float)fadeDurMs;
  if (t >= 1.0f) {
    t = 1.0f;
    fading = false;
  }
  // ease-in-out (부드러운 가감속)
  const float e = t < 0.5f ? 2.0f * t * t : -1.0f + (4.0f - 2.0f * t) * t;
  for (int i = 0; i < MATRIX_B_NUM_LEDS; i++) {
    curR[i] = stR[i] + (int)(((int)tgR[i] - (int)stR[i]) * e);
    curG[i] = stG[i] + (int)(((int)tgG[i] - (int)stG[i]) * e);
    curB[i] = stB[i] + (int)(((int)tgB[i] - (int)stB[i]) * e);
    strip.setPixelColor(i, curR[i], curG[i], curB[i]);
  }
  strip.show();
}

/** approaching_invite — 12모형 순차 쓸기(블로킹, 유지). 끝나면 페이드 버퍼 동기화. */
void runFastInviteSequence(uint8_t r, uint8_t g, uint8_t b) {
  fading = false;
  for (int m = 0; m < MATRIX_B_NUM_MODELS; m++) {
    strip.clear();
    for (int k = 0; k < 8; k++) {
      strip.setPixelColor(matrixBLedIndex(m, k), strip.Color(r, g, b));
    }
    strip.show();
    delay(90);
  }
  // 쓸기 종료 상태를 cur 에 반영 → 다음 씬이 여기서 페이드
  for (int i = 0; i < MATRIX_B_NUM_LEDS; i++) {
    const uint32_t c = strip.getPixelColor(i);
    curR[i] = (c >> 16) & 0xFF;
    curG[i] = (c >> 8) & 0xFF;
    curB[i] = c & 0xFF;
  }
}

/** 핀별 지정 모형 세트. 매칭되면 흰색·최대로 타깃 구성하고 true. */
bool buildFloorPinTarget(const String &sceneId) {
  static const int XTRA[]     = {1, 4, 6, 7};    // floor_pin_2 (X-tra Space)
  static const int TRANSFER[] = {2, 5, 8, 12};   // floor_pin_1 (환승동선)
  static const int WALK[]     = {3, 9, 10, 11};  // floor_pin_3 (산책동선)
  const int *set = nullptr;
  if (sceneId == "floor_pin_2") set = XTRA;
  else if (sceneId == "floor_pin_1") set = TRANSFER;
  else if (sceneId == "floor_pin_3") set = WALK;
  else return false;

  tgtClear();
  for (int i = 0; i < 4; i++) tgtUserModel(set[i], 255, 255, 255);  // 흰색 최대
  return true;
}

void handleHealth() {
  server.send(200, "text/plain", "ok");
}

void handleLightScene() {
  if (server.method() != HTTP_POST) {
    server.send(405, "text/plain", "Method Not Allowed");
    return;
  }

  String body = server.hasArg("plain") ? server.arg("plain") : "";
  if (body.length() == 0) {
    server.send(400, "application/json", "{\"error\":\"empty body\"}");
    return;
  }

  String sceneId = jsonGetString(body, "scene_id");
  if (sceneId.length() == 0) {
    server.send(400, "application/json", "{\"error\":\"missing scene_id\"}");
    return;
  }

  int bri = jsonGetInt(body, "brightness", 100);
  bri = constrain(bri, 0, 100);
  const int transitionMs = jsonGetInt(body, "transition_ms", 600);

  if (bri <= 0) {
    tgtClear();
    beginFade(transitionMs);
    server.send(200, "application/json", "{\"ok\":true}");
    return;
  }

  // 도면 핀: 핀별 지정 모형만 흰색·최대 (color_temp 무시)
  if (buildFloorPinTarget(sceneId)) {
    beginFade(transitionMs);
    server.send(200, "application/json", "{\"ok\":true}");
    return;
  }

  const int colorTemp = jsonGetInt(body, "color_temp", 4000);
  uint8_t r, g, b;
  kelvinToRGB(colorTemp, r, g, b);

  // approaching_invite: 순차 쓸기 유지
  if (sceneId == "approaching_invite") {
    runFastInviteSequence(r, g, b);
    server.send(200, "application/json", "{\"ok\":true}");
    return;
  }

  // 그 외 씬: 전체를 색온도 색감 + 씬별 강약(은은한 밝기)로
  int pct = ambientPctForScene(sceneId) * bri / 100;
  if (pct < 1) pct = 1;
  const uint8_t sr = (uint8_t)((int)r * pct / 100);
  const uint8_t sg = (uint8_t)((int)g * pct / 100);
  const uint8_t sb = (uint8_t)((int)b * pct / 100);
  tgtAll(sr, sg, sb);
  beginFade(transitionMs);

  server.send(200, "application/json", "{\"ok\":true}");
}

void setup() {
  Serial.begin(115200);
  delay(800);
  Serial.println();
  Serial.println("=== Matrix B HTTP boot ===");

  strip.begin();
  strip.setBrightness(255);  // 밝기는 RGB 값에 인코딩 — 전역은 최대 고정
  for (int i = 0; i < MATRIX_B_NUM_LEDS; i++) {
    curR[i] = curG[i] = curB[i] = 0;
  }
  strip.clear();
  strip.show();
  Serial.println("LED strip ready (96 / pin 13)");

  WiFi.mode(WIFI_STA);
  if (!WiFi.config(STATIC_IP, STATIC_GW, STATIC_MASK, STATIC_DNS)) {
    Serial.println("WiFi.config FAILED — DHCP 로 진행");
  } else {
    Serial.print("Static IP set: ");
    Serial.println(STATIC_IP);
  }
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("WiFi ssid=0423 connecting");
  int wifiWait = 0;
  while (WiFi.status() != WL_CONNECTED && wifiWait < 75) {
    delay(400);
    Serial.print(".");
    wifiWait++;
  }
  Serial.println();
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi FAILED — hotspot 0423 켜졌는지, SSID/비번 확인 후 EN 버튼");
  } else {
    Serial.print("Matrix B IP: ");
    Serial.println(WiFi.localIP());
  }

  server.on("/light/scene", HTTP_POST, handleLightScene);
  server.on("/health", HTTP_GET, handleHealth);
  server.begin();
  Serial.println("HTTP /light/scene ready");
}

void loop() {
  server.handleClient();
  updateFade();
}
