/**
 * Matrix B 실험 — 12 단면 모형, 모형당 LED 8개 (총 96)
 *
 * 배선: 4개 + 100mm + 4개 + 100mm + 4개 + 100mm + 4개 = 한 줄 16개
 *       작은 모형 하나 = 위 줄 4 + 아래 줄 4 (체인 번호는 모형마다 위·아래가 떨어져 있음)
 *
 * 시리얼 115200:
 *   1~12  — 해당 모형만
 *   0     — 전부 끔
 *   99    — 전부 켬
 *   100   — 모형↔LED 번호표 출력
 *
 * LED_PIN = 12 (D0)
 * NUM_LEDS = 96
 */
#include <Adafruit_NeoPixel.h>

#include "../matrix_b_layout.h"

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
  switch (modelIndex % 6) {
    case 0:
      return strip.Color(255, 40, 20);
    case 1:
      return strip.Color(255, 120, 0);
    case 2:
      return strip.Color(255, 220, 0);
    case 3:
      return strip.Color(80, 255, 0);
    case 4:
      return strip.Color(0, 120, 255);
    default:
      return strip.Color(220, 0, 255);
  }
}

void showAll(uint8_t r, uint8_t g, uint8_t b) {
  for (int i = 0; i < MATRIX_B_NUM_LEDS; i++) {
    strip.setPixelColor(i, strip.Color(r, g, b));
  }
  strip.show();
}

void setup() {
  Serial.begin(115200);
  strip.begin();
  strip.setBrightness(25);
  strip.clear();
  strip.show();

  Serial.println("Matrix B test ready.");
  Serial.println("1~4 = model (4-model prototype), 0 = off, 99 = all on, 100 = print LED map");
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
    showAll(200, 200, 200);
    Serial.println("All ON");
  } else if (input == 100) {
    matrixBPrintModelMap();
  } else {
    Serial.println("Use 1~4, 0, 99, or 100");
  }
}
