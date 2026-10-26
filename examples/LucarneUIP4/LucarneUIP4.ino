// ESP32-P4 + MIPI-DSI display (Waveshare 5-DSI-TOUCH-A / HX8394 panel) with
// GT911 touch input. See examples/LucarneUIP4MultiPanel for the other panel
// ICs and touch controllers Lucarne supports (ILI9881C, JD9365, EK79007 /
// FT6336, GT9271, GT928) - see docs/HARDWARE.md for the full matrix.
//
// Board: "ESP32P4 Dev Module" (esp32 core >= 3.1), PSRAM enabled (the
// framebuffer lives in PSRAM), USB CDC on boot enabled for Serial logs.
#include <Lucarne.h>

using namespace lucarne;

#if !(defined(SOC_MIPI_DSI_SUPPORTED) && SOC_MIPI_DSI_SUPPORTED)
#error "LucarneUIP4 needs an ESP32-P4 target (MIPI-DSI peripheral)"
#endif
#ifndef BOARD_HAS_PSRAM
#error "Enable PSRAM in Tools > PSRAM before compiling this example"
#endif

MipiDisplay display;
UI ui(display);

GT911Touch touch;
TouchInput touchInput;
bool touchReady = false;

Screen home("Home");
Screen settings("Settings");

Label homeTitle(0, 40, "LUCARNE P4", TextAlign::Center);
Label homeHint(0, 80, "Tap a tile to navigate", TextAlign::Center);
Button openSettings(260, 560, 200, 64, "Settings");

Label settingsTitle(0, 40, "Settings", TextAlign::Center);
Switch backlightSwitch(260, 160, 200, 48, "Backlight", "backlight");
Label touchStatus(0, 240, "", TextAlign::Center);
Button backButton(260, 560, 200, 64, "Back");

void setup() {
    Serial.begin(115200);
    delay(300);

    MipiDisplayConfig panel;
    // Defaults already target the Waveshare 5-DSI-TOUCH-A (720x1280, HX8394).
    BufferOptions buffer;
    buffer.mode = BufferMode::Full;
    buffer.memory = BufferMemory::Psram;

    if (!display.begin(panel, buffer, 0)) {
        Serial.println("Lucarne: MIPI display init failed");
        while (true) delay(1000);
    }

    Theme theme;
    theme.font = &LucarneFontBody;
    theme.fontTitle = &LucarneFontTitle;
    ui.setTheme(theme);
    ui.setTransition(Transition::SlideLeft, 220);

    homeTitle.setBounds(0, 40, panel.panelWidth, 48);
    homeTitle.setFont(&LucarneFontTitle);
    homeHint.setBounds(0, 90, panel.panelWidth, 28);
    homeHint.setColor(color565(150, 170, 200));

    settingsTitle.setBounds(0, 40, panel.panelWidth, 48);
    settingsTitle.setFont(&LucarneFontTitle);
    touchStatus.setBounds(0, 240, panel.panelWidth, 28);
    touchStatus.setColor(color565(150, 170, 200));

    openSettings.setNavigate(&settings, Transition::SlideLeft);
    backButton.setNavigate(&home, Transition::SlideRight);

    home.add(&homeTitle);
    home.add(&homeHint);
    home.add(&openSettings);

    settings.add(&settingsTitle);
    settings.add(&backlightSwitch);
    settings.add(&touchStatus);
    settings.add(&backButton);

    ui.setBool("backlight", true);

    TouchConfig touchCfg;
    touchCfg.bus = TouchBus::I2c;
    touchReady = touch.begin(touchCfg, panel.panelWidth, panel.panelHeight, panel.i2cSda,
                              panel.i2cScl, display.i2cBus());
    if (touchReady) {
        Serial.println("Lucarne: GT911 touch ready");
        touchInput.attach(&ui);
        touchStatus.setText("Touch: ready");
    } else {
        Serial.println("Lucarne: GT911 touch init failed");
        touchStatus.setText("Touch: not detected");
    }

    ui.show(&home);
    ui.begin();
}

void loop() {
    if (touchReady) {
        int16_t x = 0, y = 0;
        bool pressed = false;
        if (touch.poll(x, y, pressed)) {
            touchInput.feed(x, y, pressed);
        }
    }

    display.backlight(ui.store().getBool("backlight", true));

    ui.update();
}
