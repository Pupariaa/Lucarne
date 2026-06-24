#ifndef LUCARNE_INPUT_H
#define LUCARNE_INPUT_H

#include <stdint.h>
#include "LucarneUI.h"

namespace lucarne {

class ButtonInput {
  public:
    ButtonInput();

    void begin(int up, int down, int ok, int back, bool activeLow = true, bool usePullup = true);
    void attach(UI *ui) { _ui = ui; }
    void setRepeat(uint16_t delayMs, uint16_t rateMs);
    void update();

  private:
    bool read(uint8_t idx);
    void fire(uint8_t idx);

    UI *_ui;
    int _pin[4];
    bool _activeLow;
    bool _state[4];
    uint32_t _tDown[4];
    uint32_t _tRepeat[4];
    uint16_t _repeatDelay;
    uint16_t _repeatRate;
};

class EncoderInput {
  public:
    EncoderInput();

    void begin(int pinA, int pinB, int pinBtn = -1, bool activeLow = true, bool usePullup = true);
    void attach(UI *ui) { _ui = ui; }
    void setStepsPerDetent(uint8_t steps) { _stepsPerDetent = steps ? steps : 1; }
    void update();

  private:
    UI *_ui;
    int _a;
    int _b;
    int _btn;
    bool _activeLow;
    uint8_t _lastAB;
    int8_t _accum;
    uint8_t _stepsPerDetent;
    bool _btnState;
    uint32_t _btnDown;
    bool _btnHandled;
};

class TouchInput {
  public:
    TouchInput();

    void attach(UI *ui) { _ui = ui; }
    void feed(int16_t x, int16_t y, bool pressed);

  private:
    UI *_ui;
    bool _last;
};

}

#endif
