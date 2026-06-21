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

uint32_t colorForModel(int modelIndex) {
  (void)modelIndex;
  return strip.Color(255, 255, 255);
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
void runFastInviteSequence(int bri) {
  strip.setBrightness(neoBrightnessFromPct(bri));
  for (int m = 0; m < MATRIX_B_NUM_MODELS; m++) {
    showModel(m, colorForModel(m));
    delay(90);
  }
}

void applyZoneScene(const String &sceneId, const String &zone, int bri) {
  if (sceneId == "approaching_invite") {
    runFastInviteSequence(bri);
    return;
  }

  strip.setBrightness(neoBrightnessFromPct(bri));
  const int model = modelFromSceneId(sceneId);
  const uint32_t color = colorForModel(model);

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

  applyZoneScene(sceneId, zone, bri);

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
