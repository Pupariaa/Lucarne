#define LUCARNE_LIVE_MAX_FRAME 49152
#include "lucarne_preview_config.h"
#include <Lucarne.h>
#include <tools/LucarneLivePreview.h>

#ifdef LUCARNE_LIVE_SD
#include <SPI.h>
#include <SD.h>
#include <tools/LucarneLiveSD.h>
#endif

using namespace lucarne;

#if LUCARNE_PREVIEW_DRIVER == LUCARNE_PREVIEW_DRIVER_ST7796
ST7796 display;
#elif LUCARNE_PREVIEW_DRIVER == LUCARNE_PREVIEW_DRIVER_ST7735
ST7735S display;
#elif LUCARNE_PREVIEW_DRIVER == LUCARNE_PREVIEW_DRIVER_ILI9342
ILI9342 display;
#else
ST7789 display;
#endif

LivePreview preview(display, Serial, LUCARNE_LIVE_DRIVER_ID);

#ifdef LUCARNE_LIVE_SD
void onLiveLoad(const char *path, LivePreview *self) {
    liveLoadFromSd(path, self);
}
#endif

static BufferOptions bufferOptions() {
    BufferOptions buffer;
    buffer.mode = BufferMode::Full;
    buffer.memory = BufferMemory::Auto;
    buffer.maxBytes = 0;
    return buffer;
}

bool onReconfigure(const DisplayPins &pins, const DisplayOptions &options, LivePreview *self) {
    return display.begin(pins, options, bufferOptions(), &SPI);
}

void setup() {
#if defined(ARDUINO_USB_CDC_ON_BOOT) && ARDUINO_USB_CDC_ON_BOOT
    Serial.setRxBufferSize(16384);
#ifndef CONFIG_IDF_TARGET_ESP32P4
    Serial.setTxBufferSize(2048);
#endif
    Serial.setTxTimeoutMs(20);
#endif
    Serial.begin(LUCARNE_LIVE_BAUD);

    DisplayPins pins;
    pins.cs = LUCARNE_PREVIEW_PIN_CS;
    pins.dc = LUCARNE_PREVIEW_PIN_DC;
    pins.rst = LUCARNE_PREVIEW_PIN_RST;
    pins.mosi = LUCARNE_PREVIEW_PIN_MOSI;
    pins.sclk = LUCARNE_PREVIEW_PIN_SCLK;
    pins.bl = LUCARNE_PREVIEW_PIN_BL;

    DisplayOptions options;
    options.panelWidth = LUCARNE_PREVIEW_PANEL_W;
    options.panelHeight = LUCARNE_PREVIEW_PANEL_H;
    options.rotation = 0;
    options.spiHz = LUCARNE_PREVIEW_SPI_HZ;
    options.spiMode = LUCARNE_PREVIEW_SPI_MODE;
    options.colorOrder = ColorOrder::RGB;
    options.invert = LUCARNE_PREVIEW_INVERT;

    display.begin(pins, options, bufferOptions());

#ifdef LUCARNE_LIVE_SD
    SPI.begin(12, 13, 11, 10);
    if (SD.begin(10)) preview.setLoadHandler(onLiveLoad);
#endif

    preview.setReconfigureHandler(onReconfigure);
    preview.begin();
}

void loop() {
    preview.update();
}
