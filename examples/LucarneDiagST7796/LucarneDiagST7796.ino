#include <Lucarne.h>

using namespace lucarne;

ST7796 display;

void setup() {
    Serial.begin(115200);
    delay(300);
    Serial.println("Lucarne ST7796 diag start");

    DisplayPins pins;
    pins.cs = 10;
    pins.dc = 9;
    pins.rst = 8;
    pins.mosi = 11;
    pins.sclk = 12;
    pins.bl = -1;

    DisplayOptions options;
    options.panelWidth = 320;
    options.panelHeight = 480;
    options.rotation = 0;
    options.spiHz = 27000000;
    options.spiMode = 3;
    options.colorOrder = ColorOrder::BGR;
    options.invert = false;

    BufferOptions buffer;
    buffer.mode = BufferMode::Full;
    buffer.memory = BufferMemory::Auto;

    display.begin(pins, options, buffer);
    Serial.println("Lucarne ST7796 diag begin done");
}

void loop() {
    Serial.println("RED");
    display.fillScreen(color565(255, 0, 0));
    display.display();
    delay(1500);

    Serial.println("GREEN");
    display.fillScreen(color565(0, 255, 0));
    display.display();
    delay(1500);

    Serial.println("BLUE");
    display.fillScreen(color565(0, 0, 255));
    display.display();
    delay(1500);

    Serial.println("WHITE");
    display.fillScreen(color565(255, 255, 255));
    display.display();
    delay(1500);

    Serial.println("BLACK");
    display.fillScreen(color565(0, 0, 0));
    display.display();
    delay(1500);
}
