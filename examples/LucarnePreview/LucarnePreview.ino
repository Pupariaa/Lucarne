// Lucarne live preview firmware.
//
// Flash this once, then open Lucarne Studio and click "Live" to connect to the
// board over USB. Whatever you design or navigate in the editor is streamed to
// this screen in real time. No interaction happens on the board side.
//
// ESP32-S3: in the Arduino IDE board options, set "USB CDC On Boot: Enabled"
// so that Serial is the native USB CDC port the editor connects to.
//
// Do not print to Serial in this sketch: the port carries the binary preview
// protocol and any extra bytes would corrupt the stream.

// Match Serial.begin() with the baud value in Lucarne Studio (toolbar, default 2000000).
//
// Optional SD load: define LUCARNE_LIVE_SD, wire your SD pins, call SD.begin().
// Host sends LOAD_REQ with a path; firmware streams the JSON back over serial.

#include <Lucarne.h>
#include <tools/LucarneLivePreview.h>

#ifdef LUCARNE_LIVE_SD
#include <SPI.h>
#include <SD.h>
#include <tools/LucarneLiveSD.h>
#endif

using namespace lucarne;

ST7789 display;
LivePreview preview(display, Serial);

#ifdef LUCARNE_LIVE_SD
void onLiveLoad(const char *path, LivePreview *self) {
    liveLoadFromSd(path, self);
}
#endif

void setup() {
    Serial.begin(2000000);

    DisplayPins pins;
    pins.cs = 1;
    pins.dc = 2;
    pins.rst = 3;
    pins.mosi = 4;
    pins.sclk = 5;
    pins.bl = -1;

    DisplayOptions options;
    options.panelWidth = 240;
    options.panelHeight = 280;
    options.rotation = 0;
    options.spiHz = 27000000;
    options.spiMode = 3;
    options.colorOrder = ColorOrder::RGB;
    options.invert = true;

    BufferOptions buffer;
    buffer.mode = BufferMode::Full;
    buffer.memory = BufferMemory::Auto;
    buffer.maxBytes = 0;

    display.begin(pins, options, buffer);

#ifdef LUCARNE_LIVE_SD
    SPI.begin(12, 13, 11, 10);
    if (SD.begin(10)) preview.setLoadHandler(onLiveLoad);
#endif

    preview.begin();
}

void loop() {
    preview.update();
}
