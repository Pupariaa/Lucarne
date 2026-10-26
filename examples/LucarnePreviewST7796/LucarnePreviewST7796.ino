// Lucarne live preview firmware (ST7796 / PSRAM framebuffer).
//
// GPIO wiring is NOT baked in: as soon as Lucarne Studio connects, it sends
// a HWCONFIG packet with the pins configured in the project's Hardware tab,
// and onReconfigure() below re-runs display.begin() with them - so this same
// binary works with any wiring. DEFAULT_PINS below is only what the board
// shows before Studio connects (or if used stand-alone).
//
// Requires a board with PSRAM (e.g. ESP32-S3 with octal/quad PSRAM) since the
// ST7796 framebuffer at 320x480x16bpp does not fit in internal SRAM.

#define LUCARNE_LIVE_MAX_FRAME 65536
#include <Lucarne.h>
#include <tools/LucarneLivePreview.h>

using namespace lucarne;

ST7796 display;
LivePreview preview(display, Serial);

static BufferOptions bufferOptions() {
    BufferOptions buffer;
    buffer.mode = BufferMode::Full;
    buffer.memory = BufferMemory::Psram;
    return buffer;
}

bool onReconfigure(const DisplayPins &pins, const DisplayOptions &options, LivePreview *self) {
    return display.begin(pins, options, bufferOptions(), &SPI);
}

void setup() {
#if defined(ARDUINO_USB_CDC_ON_BOOT) && ARDUINO_USB_CDC_ON_BOOT
    Serial.setRxBufferSize(16384);
    Serial.setTxBufferSize(2048);
    Serial.setTxTimeoutMs(20);
#endif
    Serial.begin(3000000);

    DisplayPins pins;
    pins.cs = 2;
    pins.dc = 5;
    pins.rst = 4;
    pins.mosi = 21;
    pins.miso = 3;
    pins.sclk = 20;
    pins.bl = -1;

    DisplayOptions options;
    options.panelWidth = 320;
    options.panelHeight = 480;
    options.rotation = 0;
    options.spiHz = 27000000;
    options.spiMode = 3;
    options.colorOrder = ColorOrder::BGR;
    options.invert = false;

    display.begin(pins, options, bufferOptions());

    preview.setReconfigureHandler(onReconfigure);
    preview.begin();
}

void loop() {
    preview.update();
}
