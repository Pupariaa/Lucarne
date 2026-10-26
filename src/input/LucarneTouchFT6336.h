#ifndef LUCARNE_TOUCH_FT6336_H
#define LUCARNE_TOUCH_FT6336_H

#include "../core/LucarneTypes.h"

namespace lucarne {

class FT6336Touch {
  public:
    FT6336Touch();
    ~FT6336Touch();

    bool begin(const TouchConfig &cfg, int16_t panelWidth, int16_t panelHeight,
               int8_t i2cSda = 7, int8_t i2cScl = 8, void *existingI2cBus = nullptr);
    bool poll(int16_t &x, int16_t &y, bool &pressed);
    void feedCalibrated(int16_t rawX, int16_t rawY, bool pressed, int16_t &x, int16_t &y);

  private:
    bool mapPoint(int16_t rawX, int16_t rawY, int16_t &x, int16_t &y);
    bool attachDevice(uint8_t addr);

    TouchConfig _cfg;
    int16_t _panelW;
    int16_t _panelH;
    int8_t _i2cSda;
    int8_t _i2cScl;
    void *_i2cBus;
    void *_i2cDev;
    bool _ownsBus;
};

}

#endif
