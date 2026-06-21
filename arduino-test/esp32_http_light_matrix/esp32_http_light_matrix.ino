/**
 * Matrix B 전시 연동 — WiFi + HTTP POST /light/scene
 *
 * 96 LED / 12 모형 (matrix_b_layout.h). DIN → GPIO13.
 *
 * 1) WIFI_SSID / WIFI_PASSWORD 수정
 * 2) 업로드 후 시리얼(115200) IP 확인
 * 3) 노트북 .env:
 *    EXHIBITION_LIGHT_MATRIX_HTTP_URL=http://(이 ESP IP)
 *    (전체모형 ESP 는 esp32_http_light_plan_a + EXHIBITION_LIGHT_HTTP_URL)
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
// 재부팅/DHCP 재배정과 무관하게 항상 같은 주소 → .env 한 번만 맞추면 됨.
// 노트북 핫스팟이 아닌 다른 공유기를 쓰면 STATIC_GW/STATIC_IP 대역을 그 망에 맞게 수정.
static const IPAddress STATIC_IP(192, 168, 137, 50);
static const IPAddress STATIC_GW(192, 168, 137, 1);
static const IPAddress STATIC_MASK(255, 255, 255, 0);
static const IPAddress STATIC_DNS(192, 168, 137, 1);

#define DEFAULT_BRIGHTNESS_PCT 100

static int neoBrightnessFromPct(int pct) {
  pct = constrain(pct, 0, 100);
  if (pct <= 0) return 0;
  return (pct * 255 + 50) / 100;
}

Adafruit_NeoPixel strip(MATRIX_B_NUM_LEDS, MATRIX_B_LED_PIN, NEO_GRB + NEO_KHZ800);

WebServer server(80);

/** scenes.yaml scene_id → 모형 index 0~11 */
int modelFromSceneId(const String &id) {
  if (id == "calm_gallery") return 0;
  if (id == "dense_flux") return 1;
  if (id == "critical_focus") return 2;
  if (id == "night_reflect") return 3;
  if (id == "safe_neutral") return 4;
  if (id == "floor_pin_1") return 6;
  if (id == "floor_pin_2") return 7;
  if (id == "floor_pin_3") return 8;
  if (id == "floor_pin_4") return 9;
  if (id == "floor_pin_5") return 10;
  if (id == "floor_pin_6") return 11;
  return 0;
}

/** 색온도(K) → 화이트밸런스 RGB (Tanner Helland 근사). 초록 등 없이 따뜻↔차가운 백색만. */
uint32_t kelvinToColor(int kelvin) {
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
  r = constrain(r, 0.0f, 255.0f);
  g = constrain(g, 0.0f, 255.0f);
  b = constrain(b, 0.0f, 255.0f);
  return strip.Color((uint8_t)r, (uint8_t)g, (uint8_t)b);
}

/** 사용자 모형 번호(1~12, 1=왼쪽 위 … 12=오른쪽 아래) 점등.
 *  matrixBLedIndex 는 내부에서 (12 - modelIndex) = 사용자번호 로 환산하므로 여기서 역으로 넣는다. */
void setUserModel(int userModel, uint32_t color) {
  if (userModel < 1 || userModel > MATRIX_B_NUM_MODELS) return;
  const int modelIndex = MATRIX_B_NUM_MODELS - userModel;
  for (int i = 0; i < 8; i++) {
    strip.setPixelColor(matrixBLedIndex(modelIndex, i), color);
  }
}

/** 도면 핀 — 핀별 지정 모형 세트만, 흰색·최대 밝기 고정. 매칭되면 true. */
bool showFloorPinModels(const String &sceneId) {
  static const int XTRA[]     = {1, 4, 6, 7};    // floor_pin_2 (X-tra Space)
  static const int TRANSFER[] = {2, 5, 8, 12};   // floor_pin_1 (환승동선)
  static const int WALK[]     = {3, 9, 10, 11};  // floor_pin_3 (산책동선)
  const int *set = nullptr;
  if (sceneId == "floor_pin_2") set = XTRA;
  else if (sceneId == "floor_pin_1") set = TRANSFER;
  else if (sceneId == "floor_pin_3") set = WALK;
  else return false;

  strip.setBrightness(255);  // 최대 고정
  strip.clear();
  const uint32_t white = strip.Color(255, 255, 255);
  for (int i = 0; i < 4; i++) setUserModel(set[i], white);
  strip.show();
  return true;
}

void allOff() {
  strip.clear();
  strip.show();
}

void showModel(int modelIndex, uint32_t color) {
  if (modelIndex < 0 || modelIndex >= MATRIX_B_NUM_MODELS) {
    return;
  }
  strip.clear();
  for (int i = 0; i < 8; i++) {
    strip.setPixelColor(matrixBLedIndex(modelIndex, i), color);
  }
  strip.show();
}

void showModelRange(int startModel, int endModel, uint32_t color) {
  startModel = constrain(startModel, 0, MATRIX_B_NUM_MODELS - 1);
  endModel = constrain(endModel, 0, MATRIX_B_NUM_MODELS - 1);
  if (startModel > endModel) {
    const int t = startModel;
    startModel = endModel;
    endModel = t;
  }
  strip.clear();
  for (int m = startModel; m <= endModel; m++) {
    for (int i = 0; i < 8; i++) {
      strip.setPixelColor(matrixBLedIndex(m, i), color);
    }
  }
  strip.show();
}

/** approaching_invite — 12모형 순차 (~1.1s) */
void runFastInviteSequence(int bri, uint32_t color) {
  strip.setBrightness(neoBrightnessFromPct(bri));
  for (int m = 0; m < MATRIX_B_NUM_MODELS; m++) {
    showModel(m, color);
    delay(90);
  }
}

void applyZoneScene(const String &sceneId, const String &zone, int bri, uint32_t color) {
  if (sceneId == "approaching_invite") {
    runFastInviteSequence(bri, color);
    return;
  }

  strip.setBrightness(neoBrightnessFromPct(bri));
  const int model = modelFromSceneId(sceneId);

  if (zone == "zoneA") {
    showModelRange(0, 5, color);
    return;
  }
  if (zone == "zoneB") {
    showModelRange(6, 11, color);
    return;
  }

  showModel(model, color);
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

  int bri = jsonGetInt(body, "brightness", DEFAULT_BRIGHTNESS_PCT);
  bri = constrain(bri, 0, 100);

  if (bri <= 0) {
    strip.setBrightness(0);
    allOff();
    server.send(200, "application/json", "{\"ok\":true}");
    return;
  }

  String zone = jsonGetString(body, "zone");
  if (zone.length() == 0) {
    zone = "all";
  }

  // 도면 핀: 핀별 지정 모형만 흰색·최대 밝기 고정 (color_temp 무시)
  if (showFloorPinModels(sceneId)) {
    server.send(200, "application/json", "{\"ok\":true}");
    return;
  }

  // 그 외 씬: color_temp 로 따뜻↔차가운 백색 색감만 반영
  const int colorTemp = jsonGetInt(body, "color_temp", 4000);
  const uint32_t color = kelvinToColor(colorTemp);
  applyZoneScene(sceneId, zone, bri, color);

  server.send(200, "application/json", "{\"ok\":true}");
}

void setup() {
  Serial.begin(115200);
  delay(800);
  Serial.println();
  Serial.println("=== Matrix B HTTP boot ===");

  strip.begin();
  strip.setBrightness(neoBrightnessFromPct(DEFAULT_BRIGHTNESS_PCT));
  allOff();
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
}
