/**
 * Matrix B 실험 — 12 단면 모형, 모형당 LED 8개 (총 96)
 *
 * 배선: 4개 + 100mm + 4개 + 100mm + 4개 + 100mm + 4개 = 한 줄 16개
 *       작은 모형 하나 = 위 줄 4 + 아래 줄 4 (체인 번호는 모형마다 위·아래가 떨어져 있음)
 *
 * 시리얼 115200 — 모형 1=왼쪽 위, 12=오른쪽 아래:
 *   1~12  — 해당 모형만
 *   0     — 전부 끔
 *   99    — 전부 켬
 *   100   — 모형↔LED 번호표 출력
 *   101   — 체인 1→96 순차 1칸씩 (끊긴 위치 찾기)
 *
 * LED_PIN = 13 (GPIO12 부팅·레벨 이슈 많음 — DIN을 13에 연결)
 * NUM_LEDS = 96
 */
#include <Adafruit_NeoPixel.h>

#include "matrix_b_layout.h"

#define BOOT_SELF_TEST 1
#define TEST_BRIGHTNESS 255

Adafruit_NeoPixel strip(MATRIX_B_NUM_LEDS, MATRIX_B_LED_PIN, NEO_GRB + NEO_KHZ800);

void showModel(int modelIndex, uint32_t color) {
  if (modelIndex < 0 || modelIndex >= MATRIX_B_NUM_MODELS) {
    return;
  }
  strip.clear();
  for (int i = 0; i < 8; i++) {
    const int idx = matrixBLedIndex(modelIndex, i);
    strip.setPixelColor(idx, color);
  }
  strip.show();
}

uint32_t colorForModel(int modelIndex) {
  (void)modelIndex;
  return strip.Color(255, 255, 255);
}

void showAll(uint8_t r, uint8_t g, uint8_t b) {
  for (int i = 0; i < MATRIX_B_NUM_LEDS; i++) {
    strip.setPixelColor(i, strip.Color(r, g, b));
  }
  strip.show();
}

void showOneLed(int ledIndex1Based, uint32_t color) {
  strip.clear();
  const int idx = constrain(ledIndex1Based - 1, 0, MATRIX_B_NUM_LEDS - 1);
  strip.setPixelColor(idx, color);
  strip.show();
}

/** 체인 순서대로 1칸씩 — 어디서 끊기는지 확인 */
void runChainWalk() {
  Serial.println("CHAIN WALK: LED 1..96 (200ms each, bright white)");
  strip.setBrightness(255);
  for (int n = 1; n <= MATRIX_B_NUM_LEDS; n++) {
    showOneLed(n, strip.Color(255, 255, 255));
    Serial.print("  LED ");
    Serial.println(n);
    delay(200);
  }
  strip.clear();
  strip.show();
  strip.setBrightness(TEST_BRIGHTNESS);
  Serial.println("CHAIN WALK done");
}

void runBootSelfTest() {
  Serial.println("BOOT: LED self-test start (pin 13, 96 LEDs)");
  strip.setBrightness(255);

  for (int n = 0; n < 3; n++) {
    strip.clear();
    for (int i = 0; i < 5; i++) {
      strip.setPixelColor(i, strip.Color(255, 0, 0));
    }
    strip.show();
    Serial.println("BOOT: red blink on LED 1-5");
    delay(500);
    strip.clear();
    strip.show();
    delay(300);
  }

  showAll(255, 255, 255);
  Serial.println("BOOT: all LEDs white");
  delay(1500);
  strip.clear();
  strip.show();
  strip.setBrightness(TEST_BRIGHTNESS);
  Serial.println("BOOT: self-test done -> off");
}

void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println();
  Serial.println("=== Matrix B setup() ===");

  strip.begin();
  strip.setBrightness(TEST_BRIGHTNESS);
  strip.clear();
  strip.show();

#if BOOT_SELF_TEST
  runBootSelfTest();
#endif

  Serial.println("Matrix B test ready (96 LED / 12 models).");
  Serial.println("1~12 = model, 0 = off, 99 = all on, 100 = map, 101 = chain walk");
  Serial.println("Serial monitor: 115200, line ending = Newline or Both NL & CR");
  matrixBPrintModelMap();
}

void loop() {
  if (Serial.available() <= 0) {
    return;
  }

  const int input = Serial.parseInt();
  while (Serial.available() > 0) {
    Serial.read();
  }

  if (input >= 1 && input <= MATRIX_B_NUM_MODELS) {
    showModel(input - 1, colorForModel(input - 1));
    Serial.print("Model ");
    Serial.print(input);
    Serial.println(" ON");
  } else if (input == 0) {
    strip.clear();
    strip.show();
    Serial.println("All OFF");
  } else if (input == 99) {
    showAll(255, 255, 255);
    Serial.println("All ON");
  } else if (input == 100) {
    matrixBPrintModelMap();
  } else if (input == 101) {
    runChainWalk();
  } else {
    Serial.println("Use 1~12, 0, 99, 100, or 101");
  }
}
