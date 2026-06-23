#ifndef LUCARNE_TYPES_H
#define LUCARNE_TYPES_H

#include <stdint.h>

namespace lucarne {

enum class ColorOrder : uint8_t { RGB, BGR };

enum class BufferMode : uint8_t { None, Full };

enum class BufferMemory : uint8_t { Auto, Internal, PSRAM };

struct DisplayPins {
    int8_t cs = -1;
    int8_t dc = -1;
    int8_t rst = -1;
    int8_t mosi = -1;
    int8_t sclk = -1;
    int8_t bl = -1;
};

struct DisplayOptions {
    int16_t panelWidth = 0;
    int16_t panelHeight = 0;
    uint8_t rotation = 0;
    uint32_t spiHz = 27000000;
    ColorOrder colorOrder = ColorOrder::RGB;
    bool invert = false;
    int16_t colStart = -1;
    int16_t rowStart = -1;
    int16_t colStart2 = -1;
    int16_t rowStart2 = -1;
    bool blActiveLow = false;
};

struct BufferOptions {
    BufferMode mode = BufferMode::Full;
    BufferMemory memory = BufferMemory::Auto;
    uint32_t maxBytes = 0;
};

}

#endif
