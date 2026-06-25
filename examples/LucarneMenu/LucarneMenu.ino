#include <Lucarne.h>

using namespace lucarne;

ST7789 display;
UI ui(display);

Screen home("Home");
Screen dash("Dashboard");

Label homeTitle(0, 16, "LUCARNE", TextAlign::Center);
Menu menu(12, 60, 216, 200);

Label dashTitle(0, 14, "Dashboard", TextAlign::Center);
Metric tempMetric(14, 56, 212, 34, "Temp", "temp", "C");
Metric humMetric(14, 96, 212, 34, "Humidity", "hum", "%");
Label loadLabel(16, 146, "CPU load");
Bar loadBar(14, 166, 212, 20, "load", 0.0f, 1.0f);

ButtonInput buttons;

static const uint8_t ACTION_OPEN_SETTINGS = 1;

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

    display.begin(pins, options, buffer);

    Theme theme;
    theme.font = &LucarneFontBody;
    theme.fontTitle = &LucarneFontTitle;
    ui.setTheme(theme);
    ui.setTransition(Transition::SlideLeft, 220);

    homeTitle.setBounds(0, 16, 240, 30);
    homeTitle.setFont(&LucarneFontTitle);
    dashTitle.setBounds(0, 14, 240, 28);
    dashTitle.setFont(&LucarneFontTitle);
    loadLabel.setColor(color565(150, 170, 200));
    tempMetric.setAccent(color565(246, 183, 55));
    humMetric.setAccent(color565(94, 150, 255));
    loadBar.setShowValue(true);

    menu.addItem("Dashboard", iconFromName("chart"), &dash, Transition::Inherit);
    menu.addItem("Sensors", iconFromName("thermo"), &dash, Transition::Fade);
    menu.addCallbackItem(
        "Settings",
        iconFromName("settings"),
        ACTION_OPEN_SETTINGS,
        MenuItemOpts{IconId::Power, false, 0, 0});

    home.add(&homeTitle);
    home.add(&menu);

    dash.add(&dashTitle);
    dash.add(&tempMetric);
    dash.add(&humMetric);
    dash.add(&loadLabel);
    dash.add(&loadBar);

    ui.setFloat("temp", 23.4f);
    ui.setFloat("hum", 48.0f);
    ui.setFloat("load", 0.32f);

    buttons.begin(25, 26, 27, 14, true);
    buttons.attach(&ui);

    ui.show(&home);
    ui.begin();
}

void loop() {
    buttons.update();

    switch (ui.pollMenuAction()) {
        case ACTION_OPEN_SETTINGS:
            Serial.println("Settings callback");
            break;
    }

    static uint32_t last = 0;
    if (millis() - last > 1000) {
        last = millis();
        float t = 22.0f + (millis() % 6000) / 1000.0f;
        ui.setFloat("temp", t);
        ui.setFloat("load", (millis() % 10000) / 10000.0f);
    }

    ui.update();
}
