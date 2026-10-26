#include <Lucarne.h>
#include <math.h>

using namespace lucarne;

SSD1306 display;
UI ui(display);

Screen dashboard("dashboard");

Label title(0, 0, "LUCARNE OLED");
Label tempLabel(0, 20, "");
Bar loadBar(0, 44, 128, 12, "load", 0.0f, 1.0f);

void setup() {
    Serial.begin(115200);

    HalProfile hal;
    hal.backend = HalBackend::Arduino;
    hal.uiProfile = UiProfile::Tiny;
    hal.allowRichTransitions = false;
    hal.preferRichTransitions = false;
    ui.setHalProfile(hal);

    I2cDisplayPins pins;
    pins.sda = -1;
    pins.scl = -1;
    pins.rst = -1;
    pins.addr = 0x3C;

    OledOptions options;
    options.panelWidth = 128;
    options.panelHeight = 64;
    options.invert = false;
    options.flipVertical = false;

    if (!display.begin(pins, options)) {
        Serial.println("OLED not found");
        while (true) delay(1000);
    }

    Theme theme;
    theme.background = 0x0000;
    theme.surface = 0x0000;
    theme.surfaceEdge = 0xFFFF;
    theme.text = 0xFFFF;
    theme.textDim = 0xFFFF;
    theme.primary = 0xFFFF;
    theme.font = &LucarneFontBody;
    theme.fontTitle = &LucarneFontBody;
    theme.radius = 0;
    ui.setTheme(theme);
    ui.setTransition(Transition::None, 0);

    loadBar.setColor(0xFFFF);

    dashboard.add(&title);
    dashboard.add(&tempLabel);
    dashboard.add(&loadBar);

    ui.bindValue("temp", &tempLabel, nullptr, 1, "C");

    ui.setFloat("temp", 23.4f);
    ui.setFloat("load", 0.3f);

    ui.show(&dashboard);
    ui.begin();

    Serial.println("Lucarne OLED ready");
}

void loop() {
    float t = millis() / 1000.0f;

    ui.setFloat("temp", 23.0f + 2.0f * sinf(t * 0.5f));
    ui.setFloat("load", 0.5f + 0.45f * sinf(t));

    ui.update();
    delay(50);
}
