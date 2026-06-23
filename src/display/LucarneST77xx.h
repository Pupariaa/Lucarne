#ifndef LUCARNE_ST77XX_H
#define LUCARNE_ST77XX_H

#include <stdint.h>

namespace lucarne {

static const uint8_t ST77XX_NOP = 0x00;
static const uint8_t ST77XX_SWRESET = 0x01;
static const uint8_t ST77XX_SLPIN = 0x10;
static const uint8_t ST77XX_SLPOUT = 0x11;
static const uint8_t ST77XX_PTLON = 0x12;
static const uint8_t ST77XX_NORON = 0x13;
static const uint8_t ST77XX_INVOFF = 0x20;
static const uint8_t ST77XX_INVON = 0x21;
static const uint8_t ST77XX_DISPOFF = 0x28;
static const uint8_t ST77XX_DISPON = 0x29;
static const uint8_t ST77XX_CASET = 0x2A;
static const uint8_t ST77XX_RASET = 0x2B;
static const uint8_t ST77XX_RAMWR = 0x2C;
static const uint8_t ST77XX_COLMOD = 0x3A;
static const uint8_t ST77XX_MADCTL = 0x36;

static const uint8_t MADCTL_MY = 0x80;
static const uint8_t MADCTL_MX = 0x40;
static const uint8_t MADCTL_MV = 0x20;
static const uint8_t MADCTL_ML = 0x10;
static const uint8_t MADCTL_RGB = 0x00;
static const uint8_t MADCTL_BGR = 0x08;
static const uint8_t MADCTL_MH = 0x04;

}

#endif
