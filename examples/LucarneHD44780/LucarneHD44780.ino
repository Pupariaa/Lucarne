#include <Lucarne.h>
#include <math.h>

using namespace lucarne;

HD44780 display;
UI ui(display);

Screen dashboard("dashboard");

Label tempLabel(0, 0, "");
Bar loadBar(64, 0, 64, 8, "load", 0.0f, 1.0f);
Label statusLabel(0, 8, "");

void setup() {
    Serial.begin(115200);

    HalProfile hal;
    hal.backend = HalBackend::Arduino;
    hal.uiProfile = UiProfile::Tiny;
    hal.allowRichTransitions = false;
    hal.preferRichTransitions = false;
    ui.setHalProfile(hal);

    MatrixDisplayPins pins;
    pins.rs = 12;
    pins.en = 11;
    pins.d4 = 5;
    pins.d5 = 4;
    pins.d6 = 3;
    pins.d7 = 2;
    pins.rw = -1;
    pins.bl = -1;

    MatrixDisplayOptions options;
    options.cols = 16;
    options.rows = 2;
    options.charWidth = 8;
    options.charHeight = 8;

    if (!display.begin(pins, options)) {
        Serial.println("HD44780 init failed");
        while (true) delay(1000);
    }

    Theme theme;
    theme.background = 0x0000;
    theme.surface = 0x0000;
    theme.text = 0xFFFF;
    theme.textDim = 0xFFFF;
    theme.primary = 0xFFFF;
    theme.radius = 0;
    theme.padding = 0;
    ui.setTheme(theme);
    ui.setTransition(Transition::None, 0);

    dashboard.add(&tempLabel);
    dashboard.add(&loadBar);
    dashboard.add(&statusLabel);

    ui.bindValue("temp", &tempLabel, nullptr, 1, "C");
    ui.bindValue("status", &statusLabel);

    ui.setFloat("temp", 23.4f);
    ui.setFloat("load", 0.3f);
    ui.setString("status", "Starting");

    ui.show(&dashboard);
    ui.begin();

    Serial.println("Lucarne HD44780 ready");
}

void loop() {
    float t = millis() / 1000.0f;
    float load = 0.5f + 0.45f * sinf(t);

    ui.setFloat("temp", 23.0f + 2.0f * sinf(t * 0.5f));
    ui.setFloat("load", load);
    ui.setString("status", load > 0.8f ? "High load" : "Normal");

    ui.update();
    delay(100);
}
