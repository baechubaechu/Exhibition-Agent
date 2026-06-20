/**
 * Plan A — 동선 64 (2줄 × 32 직렬)
 *
 * 모드 1: 1→32 쭈르륵 (반복)
 * 모드 2: 33→64 쭈르륵 (반복, 1~32 꺼진 상태)
 * 모드 3: 1→12 채운 뒤 12개 블록이 1~64 구간을 이동 (반복)
 *
 * LED_PIN 12, 시리얼 115200: 1/2/3=모드, 0=정지, 99=전부 켬, 100=정보
 */
#include <Adafruit_NeoPixel.h>

#define LED_PIN 12
#define NUM_LEDS 64
#define LINE_LEDS 32
#define FLOW_WINDOW_SIZE 12

#define FLOW_STEP_MS 30
#define FLOW_END_HOLD_MS 500
#define FLOW_PAUSE_MS 400
/** NeoPixel 0~255 — 전시용 전체모형은 최대 */
#define LED_BRIGHTNESS 255

Adafruit_NeoPixel strip(NUM_LEDS, LED_PIN, NEO_GRB + NEO_KHZ800);

enum FlowState {
  FLOW_IDLE,
  FLOW_FILLING,
  FLOW_SLIDING,
  FLOW_HOLD,
  FLOW_CLEARING,
};

FlowState flowState = FLOW_IDLE;
int flowMode = 0;
int flowIndex = 0;
int flowWindowStart = 0;
int flowStart = 0;
int flowEnd = 0;
uint32_t flowLastMs = 0;

uint32_t flowColor() {
  return strip.Color(255, 220, 160);
}

void allOff() {
  strip.clear();
  strip.show();
}

void showWindow(int start, int count, uint32_t color) {
  strip.clear();
  for (int i = start; i < start + count; i++) {
    strip.setPixelColor(i, color);
  }
  strip.show();
}

void setModeRange(int mode) {
  switch (mode) {
    case 1:
      flowStart = 0;
      flowEnd = LINE_LEDS;
      break;
    case 2:
      flowStart = LINE_LEDS;
      flowEnd = NUM_LEDS;
      break;
    default:
      flowStart = 0;
      flowEnd = 0;
      break;
  }
}

void startMode(int mode) {
  if (mode < 1 || mode > 3) {
    return;
  }
  flowMode = mode;
  setModeRange(mode);
  flowState = FLOW_FILLING;
  flowIndex = (mode == 3) ? 0 : flowStart;
  flowWindowStart = 0;
  flowLastMs = millis();
  allOff();
  if (mode == 1) {
    Serial.println("Mode 1: 1-32 flow");
  } else if (mode == 2) {
    Serial.println("Mode 2: 33-64 flow");
  } else {
    Serial.println("Mode 3: fill 12, then slide 12-block");
  }
}

void stopFlow() {
  flowState = FLOW_IDLE;
  flowMode = 0;
  allOff();
  Serial.println("Flow stopped.");
}

void tickFlow() {
  const uint32_t now = millis();
  const uint32_t color = flowColor();

  switch (flowState) {
    case FLOW_IDLE:
      return;

    case FLOW_FILLING:
      if (now - flowLastMs < FLOW_STEP_MS) {
        return;
      }
      flowLastMs = now;

      if (flowMode == 3) {
        strip.setPixelColor(flowIndex, color);
        strip.show();
        flowIndex++;
        if (flowIndex >= FLOW_WINDOW_SIZE) {
          flowState = FLOW_SLIDING;
          flowWindowStart = 0;
          flowLastMs = now;
        }
      } else {
        strip.setPixelColor(flowIndex, color);
        strip.show();
        flowIndex++;
        if (flowIndex >= flowEnd) {
          flowState = FLOW_HOLD;
          flowLastMs = now;
        }
      }
      break;

    case FLOW_SLIDING:
      if (now - flowLastMs < FLOW_STEP_MS) {
        return;
      }
      flowLastMs = now;
      showWindow(flowWindowStart, FLOW_WINDOW_SIZE, color);
      flowWindowStart++;
      if (flowWindowStart > NUM_LEDS - FLOW_WINDOW_SIZE) {
        flowState = FLOW_HOLD;
        flowLastMs = now;
      }
      break;

    case FLOW_HOLD:
      if (now - flowLastMs < FLOW_END_HOLD_MS) {
        return;
      }
      flowLastMs = now;
      flowState = FLOW_CLEARING;
      break;

    case FLOW_CLEARING:
      if (now - flowLastMs < FLOW_PAUSE_MS) {
        return;
      }
      flowLastMs = now;
      allOff();
      flowState = FLOW_FILLING;
      flowIndex = (flowMode == 3) ? 0 : flowStart;
      flowWindowStart = 0;
      break;
  }
}

void printInfo() {
  Serial.println("Plan A — 64 LED flow (2 x 32 lines)");
  Serial.println("  Mode 1: 1-32 sequential");
  Serial.println("  Mode 2: 33-64 sequential (1-32 off)");
  Serial.println("  Mode 3: fill 1-12, then 12-LED block slides to 53-64");
  Serial.print("  step=");
  Serial.print(FLOW_STEP_MS);
  Serial.println("ms");
  Serial.println("Commands: 1/2/3=mode, 0=stop, 99=all on, 100=info");
}

void setup() {
  Serial.begin(115200);
  strip.begin();
  strip.setBrightness(LED_BRIGHTNESS);
  allOff();

  Serial.println("Plan A — 64 circulation flow ready.");
  printInfo();
  startMode(1);
}

void loop() {
  tickFlow();

  if (Serial.available() <= 0) {
    return;
  }

  const int input = Serial.parseInt();
  while (Serial.available() > 0) {
    Serial.read();
  }

  if (input == 0) {
    stopFlow();
  } else if (input >= 1 && input <= 3) {
    startMode(input);
  } else if (input == 99) {
    stopFlow();
    for (int i = 0; i < NUM_LEDS; i++) {
      strip.setPixelColor(i, flowColor());
    }
    strip.show();
    Serial.println("All ON");
  } else if (input == 100) {
    printInfo();
  }
}
