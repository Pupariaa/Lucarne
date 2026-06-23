#ifndef LUCARNE_COLOR_H
#define LUCARNE_COLOR_H

#include <stdint.h>

namespace lucarne {

inline uint16_t color565(uint8_t r, uint8_t g, uint8_t b) {
    return (uint16_t)(((r & 0xF8) << 8) | ((g & 0xFC) << 3) | (b >> 3));
}

inline uint16_t color565(uint32_t rgb) {
    return color565((uint8_t)(rgb >> 16), (uint8_t)(rgb >> 8), (uint8_t)rgb);
}

inline uint16_t colorBlend(uint16_t a, uint16_t b, uint8_t t) {
    uint16_t ar = (a >> 11) & 0x1F, ag = (a >> 5) & 0x3F, ab = a & 0x1F;
    uint16_t br = (b >> 11) & 0x1F, bg = (b >> 5) & 0x3F, bb = b & 0x1F;
    uint16_t rr = (uint16_t)(ar + (((int16_t)(br - ar) * t) >> 8));
    uint16_t rg = (uint16_t)(ag + (((int16_t)(bg - ag) * t) >> 8));
    uint16_t rb = (uint16_t)(ab + (((int16_t)(bb - ab) * t) >> 8));
    return (uint16_t)((rr << 11) | (rg << 5) | rb);
}

namespace Color {
static const uint16_t Black = 0x0000;
static const uint16_t White = 0xFFFF;
static const uint16_t Red = 0xF800;
static const uint16_t Green = 0x07E0;
static const uint16_t Blue = 0x001F;
static const uint16_t Cyan = 0x07FF;
static const uint16_t Magenta = 0xF81F;
static const uint16_t Yellow = 0xFFE0;
static const uint16_t Orange = 0xFD20;
static const uint16_t Gray = 0x8410;
static const uint16_t DarkGray = 0x4208;
static const uint16_t LightGray = 0xC618;
}

}

#endif
