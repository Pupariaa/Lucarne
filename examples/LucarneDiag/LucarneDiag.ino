#include <Lucarne.h>

using namespace lucarne;

ST7789 display;

void setup() {
    Serial.begin(115200);
    delay(300);
    Serial.println("Lucarne diag start");

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
    options.spiHz = 10000000;
    options.spiMode = 3;
    options.colorOrder = ColorOrder::RGB;
    options.invert = true;

    BufferOptions buffer;
    buffer.mode = BufferMode::None;

    display.begin(pins, options, buffer);
    Serial.println("Lucarne diag begin done");
}

void loop() {
    Serial.println("RED");
    display.fillScreen(color565(255, 0, 0));
    delay(1500);

    Serial.println("GREEN");
    display.fillScreen(color565(0, 255, 0));
    delay(1500);

    Serial.println("BLUE");
    display.fillScreen(color565(0, 0, 255));
    delay(1500);

    Serial.println("WHITE");
    display.fillScreen(color565(255, 255, 255));
    delay(1500);

    Serial.println("BLACK");
    display.fillScreen(color565(0, 0, 0));
    delay(1500);
}
