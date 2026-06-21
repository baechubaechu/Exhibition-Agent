/**
 * Plan A 전체모형 — WiFi + HTTP POST /light/scene
 *
 * 64 LED (2×32 직렬). DIN → GPIO12 (회로에 맞게 수정).
 *
 * 1) WIFI_SSID / WIFI_PASSWORD 수정
 * 2) 업로드 후 시리얼(115200) IP 확인
 * 3) 노트북 .env:
 *    EXHIBITION_LIGHT_HTTP_URL=http://(이 ESP IP)
 */

#include <WiFi.h>
#include <WebServer.h>
#include <Adafruit_NeoPixel.h>

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
// Matrix B(.50)와 겹치지 않게 .51 사용. 재부팅/DHCP 와 무관하게 항상 같은 주소.
static const IPAddress STATIC_IP(192, 168, 137, 51);
static const IPAddress STATIC_GW(192, 168, 137, 1);
static const IPAddress STATIC_MASK(255, 255, 255, 0);
static const IPAddress STATIC_DNS(192, 168, 137, 1);

#define LED_PIN 12
#define NUM_LEDS 64
#define LINE_LEDS 32
#define FLOW_WINDOW_SIZE 12
#define DEFAULT_BRIGHTNESS_PCT 100

static int neoBrightnessFromPct(int pct) {
  pct = constrain(pct, 0, 100);
  if (pct <= 0) return 0;
  return (pct * 255 + 50) / 100;
}

Adafruit_NeoPixel strip(NUM_LEDS, LED_PIN, NEO_GRB + NEO_KHZ800);

WebServer server(80);

int segmentStart[12] = {0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55};
int segmentEnd[12] = {4, 9, 14, 19, 24, 29, 34, 39, 44, 49, 54, 59};

int segmentFromSceneId(const String &id) {
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

uint32_t colorForSegment(int segmentIndex) {
  segmentIndex = constrain(segmentIndex, 0, 11);
  return strip.Color(80 + segmentIndex * 15, 200 - segmentIndex * 10, 40 + segmentIndex * 5);
}

uint32_t inviteColor() {
  return strip.Color(255, 220, 160);
}

void allOff() {
  strip.clear();
  strip.show();
}

void showSegment(int segmentIndex) {
  segmentIndex = constrain(segmentIndex, 0, 11);
  strip.clear();
  const int start = segmentStart[segmentIndex];
  const int end = min(segmentEnd[segmentIndex], NUM_LEDS - 1);
  const uint32_t color = colorForSegment(segmentIndex);
  for (int i = start; i <= end; i++) {
    strip.setPixelColor(i, color);
  }
  strip.show();
}

/** approaching_invite — 12칸 창이 1~64 구간을 훑음 */
void runFastInviteSequence(int bri) {
  strip.setBrightness(neoBrightnessFromPct(bri));
  const uint32_t color = inviteColor();
  for (int start = 0; start <= NUM_LEDS - FLOW_WINDOW_SIZE; start += 4) {
    strip.clear();
    for (int i = 0; i < FLOW_WINDOW_SIZE; i++) {
      strip.setPixelColor(start + i, color);
    }
    strip.show();
    delay(45);
  }
}

void applyZoneScene(const String &sceneId, const String &zone, int bri) {
  if (sceneId == "approaching_invite") {
    runFastInviteSequence(bri);
    return;
  }

  strip.setBrightness(neoBrightnessFromPct(bri));
  const int seg = segmentFromSceneId(sceneId);
  const uint32_t color = colorForSegment(seg);

  if (zone == "zoneA" || zone == "zoneB") {
    strip.clear();
    const int startLed = (zone == "zoneB") ? LINE_LEDS : 0;
    const int endLed = (zone == "zoneB") ? (NUM_LEDS - 1) : (LINE_LEDS - 1);
    for (int i = startLed; i <= endLed; i++) {
      strip.setPixelColor(i, color);
    }
    strip.show();
    return;
  }

  showSegment(seg);
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
  strip.begin();
  strip.setBrightness(neoBrightnessFromPct(DEFAULT_BRIGHTNESS_PCT));
  allOff();

  WiFi.mode(WIFI_STA);
  if (!WiFi.config(STATIC_IP, STATIC_GW, STATIC_MASK, STATIC_DNS)) {
    Serial.println("WiFi.config FAILED — DHCP 로 진행");
  } else {
    Serial.print("Static IP set: ");
    Serial.println(STATIC_IP);
  }
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Plan A WiFi connecting");
  while (WiFi.status() != WL_CONNECTED) {
    delay(400);
    Serial.print(".");
  }
  Serial.println();
  Serial.print("Plan A IP: ");
  Serial.println(WiFi.localIP());

  server.on("/light/scene", HTTP_POST, handleLightScene);
  server.on("/health", HTTP_GET, handleHealth);
  server.begin();
  Serial.println("HTTP /light/scene ready (64 LED, pin 12)");
}

void loop() {
  server.handleClient();
}
