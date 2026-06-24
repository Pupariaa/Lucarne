#include <Lucarne.h>
#include <math.h>

using namespace lucarne;

ST7789 display;
UI ui(display);

Screen dashboard("dashboard");

Label title(16, 12, "DASHBOARD");
Label subtitle(16, 36, "Lucarne UI runtime");

Metric tempMetric(16, 60, 208, 34, "Temp", "temp", " C");
Metric humMetric(16, 100, 208, 34, "Humidity", "hum", " %");
Metric statusMetric(16, 140, 208, 34, "Fan", "fan");

Label loadLabel(16, 186, "CPU load");
Bar loadBar(16, 206, 208, 18, "load", 0.0f, 1.0f);

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

    Theme theme;
    theme.font = &LucarneFontBody;
    theme.fontTitle = &LucarneFontTitle;
    ui.setTheme(theme);

    title.setFont(&LucarneFontTitle);
    subtitle.setColor(color565(150, 170, 200));
    loadLabel.setColor(color565(150, 170, 200));
    statusMetric.setAccent(color565(94, 232, 140));
    loadBar.setShowValue(true);

    dashboard.add(&title);
    dashboard.add(&subtitle);
    dashboard.add(&tempMetric);
    dashboard.add(&humMetric);
    dashboard.add(&statusMetric);
    dashboard.add(&loadLabel);
    dashboard.add(&loadBar);

    ui.show(&dashboard);

    ui.setFloat("temp", 23.4f);
    ui.setFloat("hum", 48.0f);
    ui.setBool("fan", true);
    ui.setFloat("load", 0.32f);

    ui.begin();

    Serial.println("Lucarne UI ready");
}

void loop() {
    float t = millis() / 1000.0f;

    ui.setFloat("temp", 23.0f + 2.0f * sinf(t * 0.5f));
    ui.setFloat("hum", 48.0f + 6.0f * sinf(t * 0.3f));
    ui.setFloat("load", 0.5f + 0.45f * sinf(t));
    ui.setBool("fan", sinf(t * 0.2f) > 0.0f);

    ui.update();
    delay(100);
}
