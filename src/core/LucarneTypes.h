#ifndef LUCARNE_TYPES_H
#define LUCARNE_TYPES_H

#include <stdint.h>

namespace lucarne {

enum class ColorOrder : uint8_t { RGB, BGR };

enum class DisplayBus : uint8_t {
    SpiRgb565,
    OledMono,
    MatrixCharacter,
    MipiDsi,
};

enum class TouchBus : uint8_t {
    None,
    I2c,
    Dsi,
};

enum class BufferMode : uint8_t { None, Partial, Full };

enum class RenderStrategy : uint8_t { Auto, ForceFullRedraw };

enum class HalBackend : uint8_t { Auto, Arduino, EspIdf, Stm32Cube, Wch };

enum class UiProfile : uint8_t { Tiny, LowRam, Psram, MipiHighRes };

struct HalProfile {
    HalBackend backend = HalBackend::Auto;
    UiProfile uiProfile = UiProfile::LowRam;
    uint16_t stripeLines = 0;
    bool allowRichTransitions = true;
    bool preferRichTransitions = false;
    bool preferHwRotate = true;
    bool jpegDecodeHw = false;
    uint32_t capsOverride = 0;
};

// Named `Psram` (not `PSRAM`) because the Earle Philhower RP2040 Arduino core
// defines a conflicting `#define PSRAM __attribute__((section(".psram")))` in
// its Arduino.h - an all-caps `PSRAM` enumerator would fail to compile there.
enum class BufferMemory : uint8_t { Auto, Internal, Psram };

enum class ClockFormat : uint8_t { Hm, Hms, hm12 };

enum class DateFormat : uint8_t { DmySlash, YmdDash, MdySlash, DmyDot };

enum class ImageScaleMode : uint8_t { Fit, Native };

struct DisplayPins {
    int8_t cs = -1;
    int8_t dc = -1;
    int8_t rst = -1;
    int8_t mosi = -1;
    int8_t miso = -1;
    int8_t sclk = -1;
    int8_t bl = -1;
};

struct DisplayOptions {
    int16_t panelWidth = 0;
    int16_t panelHeight = 0;
    uint8_t rotation = 0;
    uint32_t spiHz = 27000000;
    uint8_t spiMode = 0;
    ColorOrder colorOrder = ColorOrder::RGB;
    bool invert = false;
    int16_t colStart = -1;
    int16_t rowStart = -1;
    int16_t colStart2 = -1;
    int16_t rowStart2 = -1;
    bool blActiveLow = false;
    bool debug = false;
    DisplayBus bus = DisplayBus::SpiRgb565;
};

struct I2cBusPins {
    int8_t sda = -1;
    int8_t scl = -1;
    uint32_t hz = 400000;
};

struct I2cDisplayPins {
    int8_t sda = -1;
    int8_t scl = -1;
    int8_t rst = -1;
    uint8_t addr = 0x3C;
};

struct OledOptions {
    int16_t panelWidth = 128;
    int16_t panelHeight = 64;
    bool invert = false;
    bool flipVertical = false;
};

struct MatrixDisplayPins {
    int8_t rs = -1;
    int8_t en = -1;
    int8_t d4 = -1;
    int8_t d5 = -1;
    int8_t d6 = -1;
    int8_t d7 = -1;
    int8_t rw = -1;
    int8_t bl = -1;
};

struct MatrixDisplayOptions {
    uint8_t cols = 16;
    uint8_t rows = 2;
    uint8_t charWidth = 8;
    uint8_t charHeight = 8;
};

enum class MipiPanelDriver : uint8_t {
    Ws5DsiTouchA_Hx8394,
    Ili9881c,
    Jd9365,
    Ek79007,
};

struct MipiDisplayConfig {
    int16_t panelWidth = 720;
    int16_t panelHeight = 1280;
    uint8_t laneCount = 2;
    uint16_t laneMbps = 700;
    uint16_t hsync = 20;
    uint16_t hbp = 20;
    uint16_t hfp = 40;
    uint16_t vsync = 4;
    uint16_t vbp = 10;
    uint16_t vfp = 24;
    uint8_t dpiClockMhz = 58;
    MipiPanelDriver driver = MipiPanelDriver::Ws5DsiTouchA_Hx8394;
    int8_t i2cSda = 7;
    int8_t i2cScl = 8;
    uint8_t blI2cAddr = 0x45;
    bool debug = false;
};

struct TouchConfig {
    TouchBus bus = TouchBus::None;
    uint8_t i2cAddr = 0x38;
    int8_t intPin = -1;
    int8_t rstPin = -1;
    bool swapXY = false;
    bool invertX = false;
    bool invertY = false;
};

enum class KeyboardLayout : uint8_t {
    Full,
    Compact,
    Minimal,
    FullAzerty,
    CompactAzerty,
    MinimalAzerty,
    Numeric,
    Hex,
};

struct VirtualKeyboardOptions {
    bool enabled = false;
    uint8_t dock = 0;
    KeyboardLayout layout = KeyboardLayout::Compact;
};

struct BufferOptions {
    BufferMode mode = BufferMode::Full;
    BufferMemory memory = BufferMemory::Auto;
    uint32_t maxBytes = 0;
    uint16_t partialLineCount = 0;
    HalProfile hal;
};

}

#endif
