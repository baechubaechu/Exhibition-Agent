#pragma once

/** Matrix B — 4×3 단면, 모형당 LED 8개
 *  모형 1=왼쪽 위, 12=오른쪽 아래
 */#define MATRIX_B_NUM_LEDS 96
#define MATRIX_B_NUM_MODELS 12
#define MATRIX_B_LED_PIN 13

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

inline int matrixBChainModelIndex(int userModelIndex) {
  userModelIndex = constrain(userModelIndex, 0, MATRIX_B_NUM_MODELS - 1);
  return (MATRIX_B_NUM_MODELS - 1) - userModelIndex;
}

/** 모형 index 0~11, outIdx 0~7 → LED index 0~95 */
inline int matrixBLedIndex(int modelIndex, int outIdx) {
  const int model1 = matrixBChainModelIndex(modelIndex) + 1;  const int top = matrixBTopStart1(model1) - 1;
  const int bottom = matrixBBottomStart1(model1) - 1;
  if (outIdx < 4) {
    return top + outIdx;
  }
  return bottom + (outIdx - 4);
}
