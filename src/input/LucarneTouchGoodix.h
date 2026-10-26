#ifndef LUCARNE_TOUCH_GOODIX_H
#define LUCARNE_TOUCH_GOODIX_H

#include "../core/LucarneTypes.h"

namespace lucarne {

// GT9271 and GT928 use the same Goodix "GTx1x/GTx2x" I2C register protocol as
// GT911 (product id at 0x8140, status+coordinates at 0x814E/0x814F, default
// addresses 0x5D/0x14) - see src/input/LucarneTouchGT911.cpp for GT911 itself.

class GT9271Touch {
  public:
    GT9271Touch();
    ~GT9271Touch();

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

class GT928Touch {
  public:
    GT928Touch();
    ~GT928Touch();

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
