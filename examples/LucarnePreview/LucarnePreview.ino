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

#include <Lucarne.h>
#include <tools/LucarneLivePreview.h>

using namespace lucarne;

ST7789 display;
LivePreview preview(display, Serial);

void setup() {
    Serial.begin(115200);

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

    preview.begin();
}

void loop() {
    preview.update();
}
