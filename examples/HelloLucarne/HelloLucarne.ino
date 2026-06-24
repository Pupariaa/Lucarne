#include <Lucarne.h>

using namespace lucarne;

ST7789 display;

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

    display.fillScreen(color565(8, 12, 20));

    display.fillRoundRect(10, 10, display.width() - 20, 52, 10, color565(20, 28, 40));
    display.drawRoundRect(10, 10, display.width() - 20, 52, 10, color565(80, 120, 200));

    display.setFont(nullptr);
    display.setTextSize(3);
    display.setTextColor(color565(230, 240, 255));
    display.setCursor(26, 26);
    display.print("Lucarne");

    display.setTextSize(1);
    display.setTextColor(color565(150, 170, 200));
    display.setCursor(20, 78);
    display.print("ST7789 240x280 SDK");

    display.drawLine(20, 98, display.width() - 20, 98, color565(60, 80, 110));

    display.fillCircle(54, 150, 28, color565(94, 232, 140));
    display.fillTriangle(120, 178, 150, 122, 180, 178, color565(246, 183, 55));

    display.fillRoundRect(20, 210, display.width() - 40, 48, 8, color565(20, 28, 40));
    display.setTextColor(color565(123, 187, 255));
    display.setTextSize(2);
    display.setCursor(36, 226);
    display.print("Hello !");

    display.display();

    Serial.println("Lucarne hello ready");
}

void loop() {
}
