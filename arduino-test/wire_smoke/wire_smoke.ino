/**
 * 배선 스모크 — LED 1개만, 핀·전원·DIN 확인용
 *
 * 업로드 → 13번 핀 LED 0 이 빨강↔초록 1초마다 깜빡임 (시리얼 명령 없음)
 *
 * 배선 (첫 LED 칩만 연결해도 됨):
 *   ESP GND ── 스트립 GND
 *   ESP 5V(VIN) 또는 USB 허브 5V ── 스트립 5V  (첫 1~3칸 테스트만)
 *   ESP GPIO13 ── [330Ω 선택] ── 스트립 DIN (화살표 들어가는 쪽)
 *
 * 안 되면 아래 LED_PIN 을 12, 14, 27 로 바꿔 DIN 옮기며 재업로드
 */
#include <Adafruit_NeoPixel.h>

#define LED_PIN 13
#define NUM_LEDS 3

Adafruit_NeoPixel strip(NUM_LEDS, LED_PIN, NEO_GRB + NEO_KHZ800);

void setup() {
  Serial.begin(115200);
  delay(400);
  Serial.println();
  Serial.println("=== wire_smoke ===");
  Serial.print("PIN GPIO");
  Serial.println(LED_PIN);
  Serial.println("Expect: first 1-3 pixels blink RED/GREEN forever");
  Serial.println("No light = wrong pin, no 5V/GND, or DIN direction");

  strip.begin();
  strip.setBrightness(255);
  strip.clear();
  strip.show();
}

void loop() {
  strip.fill(strip.Color(255, 0, 0));
  strip.show();
  Serial.println("RED");
  delay(800);
  strip.fill(strip.Color(0, 255, 0));
  strip.show();
  Serial.println("GREEN");
  delay(800);
}
