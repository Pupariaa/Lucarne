#include "LucarneInput.h"
#include <Arduino.h>

namespace lucarne {

ButtonInput::ButtonInput()
    : _ui(nullptr), _activeLow(true), _repeatDelay(420), _repeatRate(120) {
    for (uint8_t i = 0; i < 4; i++) {
        _pin[i] = -1;
        _state[i] = false;
        _tDown[i] = 0;
        _tRepeat[i] = 0;
    }
}

void ButtonInput::begin(int up, int down, int ok, int back, bool activeLow, bool usePullup) {
    _pin[0] = up;
    _pin[1] = down;
    _pin[2] = ok;
    _pin[3] = back;
    _activeLow = activeLow;
    for (uint8_t i = 0; i < 4; i++) {
        if (_pin[i] >= 0) {
            pinMode(_pin[i], usePullup ? INPUT_PULLUP : INPUT);
        }
    }
}

void ButtonInput::setRepeat(uint16_t delayMs, uint16_t rateMs) {
    _repeatDelay = delayMs;
    _repeatRate = rateMs;
}

bool ButtonInput::read(uint8_t idx) {
    if (_pin[idx] < 0) return false;
    int v = digitalRead(_pin[idx]);
    return _activeLow ? (v == LOW) : (v == HIGH);
}

void ButtonInput::fire(uint8_t idx) {
    if (!_ui) return;
    if (idx == 0) _ui->prev();
    else if (idx == 1) _ui->next();
    else if (idx == 2) _ui->select();
    else if (idx == 3) _ui->back();
}

void ButtonInput::update() {
    uint32_t now = millis();
    for (uint8_t i = 0; i < 4; i++) {
        if (_pin[i] < 0) continue;
        bool down = read(i);
        if (down && !_state[i]) {
            _state[i] = true;
            _tDown[i] = now;
            _tRepeat[i] = now;
            fire(i);
        } else if (down && _state[i]) {
            if (i <= 1) {
                if (now - _tDown[i] >= _repeatDelay && now - _tRepeat[i] >= _repeatRate) {
                    _tRepeat[i] = now;
                    fire(i);
                }
            }
        } else if (!down && _state[i]) {
            _state[i] = false;
        }
    }
}

EncoderInput::EncoderInput()
    : _ui(nullptr), _a(-1), _b(-1), _btn(-1), _activeLow(true), _lastAB(0), _accum(0),
      _stepsPerDetent(4), _btnState(false), _btnDown(0), _btnHandled(false) {}

void EncoderInput::begin(int pinA, int pinB, int pinBtn, bool activeLow, bool usePullup) {
    _a = pinA;
    _b = pinB;
    _btn = pinBtn;
    _activeLow = activeLow;
    if (_a >= 0) pinMode(_a, usePullup ? INPUT_PULLUP : INPUT);
    if (_b >= 0) pinMode(_b, usePullup ? INPUT_PULLUP : INPUT);
    if (_btn >= 0) pinMode(_btn, usePullup ? INPUT_PULLUP : INPUT);
    uint8_t a = (_a >= 0) ? (digitalRead(_a) ? 1 : 0) : 0;
    uint8_t b = (_b >= 0) ? (digitalRead(_b) ? 1 : 0) : 0;
    _lastAB = (uint8_t)((a << 1) | b);
}

void EncoderInput::update() {
    if (!_ui) return;
    if (_a >= 0 && _b >= 0) {
        uint8_t a = digitalRead(_a) ? 1 : 0;
        uint8_t b = digitalRead(_b) ? 1 : 0;
        uint8_t ab = (uint8_t)((a << 1) | b);
        static const int8_t TABLE[16] = {0, -1, 1, 0, 1, 0, 0, -1, -1, 0, 0, 1, 0, 1, -1, 0};
        int8_t dir = TABLE[(_lastAB << 2) | ab];
        _lastAB = ab;
        if (dir != 0) {
            _accum += dir;
            while (_accum >= _stepsPerDetent) {
                _accum -= _stepsPerDetent;
                _ui->next();
            }
            while (_accum <= -_stepsPerDetent) {
                _accum += _stepsPerDetent;
                _ui->prev();
            }
        }
    }

    if (_btn >= 0) {
        int v = digitalRead(_btn);
        bool down = _activeLow ? (v == LOW) : (v == HIGH);
        uint32_t now = millis();
        if (down && !_btnState) {
            _btnState = true;
            _btnDown = now;
            _btnHandled = false;
        } else if (down && _btnState && !_btnHandled) {
            if (now - _btnDown >= 500) {
                _btnHandled = true;
                _ui->back();
            }
        } else if (!down && _btnState) {
            _btnState = false;
            if (!_btnHandled) _ui->select();
        }
    }
}

TouchInput::TouchInput() : _ui(nullptr), _last(false) {}

void TouchInput::feed(int16_t x, int16_t y, bool pressed) {
    if (!_ui) return;
    if (pressed && !_last) {
        _last = true;
        Menu *menu = _ui->activeMenu();
        if (menu && x >= menu->x && x <= menu->x + menu->w && y >= menu->y &&
            y <= menu->y + menu->h) {
            int16_t rowH = _ui->theme().rowHeight;
            if (rowH < 16) rowH = 16;
            int row = (y - menu->y) / rowH;
            int idx = menu->scrollOffset() + row;
            if (idx >= 0 && idx < menu->itemCount()) {
                menu->setSelected(idx);
                _ui->invalidate();
                _ui->select();
            }
        }
    } else if (!pressed && _last) {
        _last = false;
    }
}

}
