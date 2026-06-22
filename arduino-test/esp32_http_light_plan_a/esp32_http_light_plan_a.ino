/**
 * Plan A 전체모형 — WiFi + HTTP POST /light/scene
 *
 * 2단 레이아웃: [산책 레이어 35칸] → (점프) → [환승 레이어 32칸] 직렬.
 *  DIN → GPIO12.
 *
 * 동작 요약:
 *  - 산책동선 핀(floor_pin_3): 산책 레이어만 흰색·최대.
 *  - 환승동선 핀(floor_pin_1): 환승 레이어만 흰색·최대.
 *  - X-tra Space 핀(floor_pin_2): 두 레이어 모두 흰색·최대.
 *  - 그 외 씬: 두 레이어 전체를 color_temp 색감으로 은은하게(씬별 강약).
 *  - approaching_invite: 흐름 쓸기(유지).
 *  - 모든 점등은 transition_ms 동안 부드럽게 페이드.
 *
 * 배선이 바뀌면 WALK_COUNT, TRANSFER_COUNT, GAP_LEDS 만 실제 칸수에 맞게 수정.
 * 고정 IP는 192.168.137.51 — .env EXHIBITION_LIGHT_HTTP_URL=http://192.168.137.51
 */

#include <WiFi.h>
#include <WebServer.h>
#include <Adafruit_NeoPixel.h>
#include <math.h>

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

// 고정 IP — 노트북 윈도우 모바일 핫스팟(게이트웨이 192.168.137.1) 기준. Matrix B(.50)와 구분.
static const IPAddress STATIC_IP(192, 168, 137, 51);
static const IPAddress STATIC_GW(192, 168, 137, 1);
static const IPAddress STATIC_MASK(255, 255, 255, 0);
static const IPAddress STATIC_DNS(192, 168, 137, 1);

#define LED_PIN 12

// ===== 2단 레이아웃 (실제 배선에 맞게 칸수만 조정) =====
#define WALK_START 0       // 산책 레이어 시작 LED
#define WALK_COUNT 35      // 산책 레이어 칸수
#define GAP_LEDS 0         // 점프 구간에 물리적으로 비는(죽은) LED 수 — 없으면 0
#define TRANSFER_START (WALK_START + WALK_COUNT + GAP_LEDS)  // 환승 레이어 시작
#define TRANSFER_COUNT 32  // 환승 레이어 칸수
#define NUM_LEDS (TRANSFER_START + TRANSFER_COUNT)           // 총 LED (기본 67)

#define FLOW_WINDOW_SIZE 10
#define FADE_FRAME_MS 16
#define FADE_MIN_MS 80
#define FADE_MAX_MS 6000

Adafruit_NeoPixel strip(NUM_LEDS, LED_PIN, NEO_GRB + NEO_KHZ800);
WebServer server(80);

// ===== 페이드 프레임버퍼 (밝기는 RGB 값에 인코딩, 전역 brightness=255 고정) =====
static uint8_t curR[NUM_LEDS], curG[NUM_LEDS], curB[NUM_LEDS];
static uint8_t stR[NUM_LEDS], stG[NUM_LEDS], stB[NUM_LEDS];
static uint8_t tgR[NUM_LEDS], tgG[NUM_LEDS], tgB[NUM_LEDS];
static unsigned long fadeStartMs = 0, fadeDurMs = 0, lastFrameMs = 0;
static bool fading = false;

/** 씬별 은은한 밝기(강약) — 0~100. 핀은 별도(흰색 최대). */
int ambientPctForScene(const String &id) {
  if (id == "dense_flux") return 78;
  if (id == "critical_focus") return 62;
  if (id == "calm_gallery") return 42;
  if (id == "safe_neutral") return 40;
  if (id == "presence_cooldown") return 24;
  if (id == "night_reflect") return 28;
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
  for (int i = 0; i < NUM_LEDS; i++) {
    tgR[i] = tgG[i] = tgB[i] = 0;
  }
}

void tgtSeg(int start, int count, uint8_t r, uint8_t g, uint8_t b) {
  const int end = min(start + count, NUM_LEDS);
  for (int i = max(start, 0); i < end; i++) {
    tgR[i] = r;
    tgG[i] = g;
    tgB[i] = b;
  }
}

void beginFade(unsigned long durMs) {
  for (int i = 0; i < NUM_LEDS; i++) {
    stR[i] = curR[i];
    stG[i] = curG[i];
    stB[i] = curB[i];
  }
  fadeDurMs = constrain((long)durMs, (long)FADE_MIN_MS, (long)FADE_MAX_MS);
  fadeStartMs = millis();
  fading = true;
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
  const float e = t < 0.5f ? 2.0f * t * t : -1.0f + (4.0f - 2.0f * t) * t;
  for (int i = 0; i < NUM_LEDS; i++) {
    curR[i] = stR[i] + (int)(((int)tgR[i] - (int)stR[i]) * e);
    curG[i] = stG[i] + (int)(((int)tgG[i] - (int)stG[i]) * e);
    curB[i] = stB[i] + (int)(((int)tgB[i] - (int)stB[i]) * e);
    strip.setPixelColor(i, curR[i], curG[i], curB[i]);
  }
  strip.show();
}

/** approaching_invite — 흐름 쓸기(블로킹, 유지). 끝나면 페이드 버퍼 동기화. */
void runFastInviteSequence(uint8_t r, uint8_t g, uint8_t b) {
  fading = false;
  const uint32_t color = strip.Color(r, g, b);
  for (int start = 0; start <= NUM_LEDS - FLOW_WINDOW_SIZE; start += 3) {
    strip.clear();
    for (int i = 0; i < FLOW_WINDOW_SIZE; i++) {
      strip.setPixelColor(start + i, color);
    }
    strip.show();
    delay(45);
  }
  for (int i = 0; i < NUM_LEDS; i++) {
    const uint32_t c = strip.getPixelColor(i);
    curR[i] = (c >> 16) & 0xFF;
    curG[i] = (c >> 8) & 0xFF;
    curB[i] = c & 0xFF;
  }
}

/** 핀 → 레이어 흰색 최대. 매칭되면 true. */
bool buildFloorPinTarget(const String &sceneId) {
  if (sceneId == "floor_pin_3") {  // 산책동선
    tgtClear();
    tgtSeg(WALK_START, WALK_COUNT, 255, 255, 255);
    return true;
  }
  if (sceneId == "floor_pin_1") {  // 환승동선
    tgtClear();
    tgtSeg(TRANSFER_START, TRANSFER_COUNT, 255, 255, 255);
    return true;
  }
  if (sceneId == "floor_pin_2") {  // X-tra Space — 전체 모형 강조
    tgtClear();
    tgtSeg(WALK_START, WALK_COUNT, 255, 255, 255);
    tgtSeg(TRANSFER_START, TRANSFER_COUNT, 255, 255, 255);
    return true;
  }
  return false;
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

  if (buildFloorPinTarget(sceneId)) {
    beginFade(transitionMs);
    server.send(200, "application/json", "{\"ok\":true}");
    return;
  }

  const int colorTemp = jsonGetInt(body, "color_temp", 4000);
  uint8_t r, g, b;
  kelvinToRGB(colorTemp, r, g, b);

  if (sceneId == "approaching_invite") {
    runFastInviteSequence(r, g, b);
    server.send(200, "application/json", "{\"ok\":true}");
    return;
  }

  // 그 외 씬: 두 레이어 전체를 색온도 색감 + 씬별 강약으로
  int pct = ambientPctForScene(sceneId) * bri / 100;
  if (pct < 1) pct = 1;
  const uint8_t sr = (uint8_t)((int)r * pct / 100);
  const uint8_t sg = (uint8_t)((int)g * pct / 100);
  const uint8_t sb = (uint8_t)((int)b * pct / 100);
  tgtClear();
  tgtSeg(WALK_START, WALK_COUNT, sr, sg, sb);
  tgtSeg(TRANSFER_START, TRANSFER_COUNT, sr, sg, sb);
  beginFade(transitionMs);

  server.send(200, "application/json", "{\"ok\":true}");
}

void setup() {
  Serial.begin(115200);
  strip.begin();
  strip.setBrightness(255);  // 밝기는 RGB 값에 인코딩 — 전역은 최대 고정
  for (int i = 0; i < NUM_LEDS; i++) {
    curR[i] = curG[i] = curB[i] = 0;
  }
  strip.clear();
  strip.show();

  WiFi.mode(WIFI_STA);
  if (!WiFi.config(STATIC_IP, STATIC_GW, STATIC_MASK, STATIC_DNS)) {
    Serial.println("WiFi.config FAILED — DHCP 로 진행");
  } else {
    Serial.print("Static IP set: ");
    Serial.println(STATIC_IP);
  }
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Plan A WiFi connecting");
  int wifiWait = 0;
  while (WiFi.status() != WL_CONNECTED && wifiWait < 75) {
    delay(400);
    Serial.print(".");
    wifiWait++;
  }
  Serial.println();
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi FAILED — hotspot 0423 확인 후 EN 버튼");
  } else {
    Serial.print("Plan A IP: ");
    Serial.println(WiFi.localIP());
  }

  server.on("/light/scene", HTTP_POST, handleLightScene);
  server.on("/health", HTTP_GET, handleHealth);
  server.begin();
  Serial.print("HTTP /light/scene ready (walk ");
  Serial.print(WALK_COUNT);
  Serial.print(" + transfer ");
  Serial.print(TRANSFER_COUNT);
  Serial.print(", pin ");
  Serial.print(LED_PIN);
  Serial.println(")");
}

void loop() {
  server.handleClient();
  updateFade();
}
