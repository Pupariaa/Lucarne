// ESP32-P4 + MIPI-DSI reference sketch showing every panel IC and touch
// controller Lucarne currently drives, selectable below. This is a generic
// bring-up sketch: adjust panelWidth/panelHeight/timings/lane count for your
// exact panel datasheet before flashing a new (uncalibrated) module.
//
// Board: "ESP32P4 Dev Module" (esp32 core >= 3.1), PSRAM enabled (the
// framebuffer lives in PSRAM), USB CDC on boot enabled for Serial logs.
#include <Lucarne.h>

using namespace lucarne;

#if !(defined(SOC_MIPI_DSI_SUPPORTED) && SOC_MIPI_DSI_SUPPORTED)
#error "LucarneUIP4MultiPanel needs an ESP32-P4 target (MIPI-DSI peripheral)"
#endif
#ifndef BOARD_HAS_PSRAM
#error "Enable PSRAM in Tools > PSRAM before compiling this example"
#endif

// Pick one panel IC:
//   0 = HX8394   (Waveshare 5-DSI-TOUCH-A, 720x1280, 2 lanes)
//   1 = ILI9881C (Espressif reference init/timing, 800x1280, 2 lanes)
//   2 = JD9365   (10.1" panels, Espressif reference timing, 800x1280, 2 lanes)
//   3 = EK79007  (official ESP32-P4-Function-EV-Board panel, 1024x600, 2 lanes)
#define LUCARNE_PANEL_KIND 3

// Pick one touch controller (all I2C, sharing the panel's I2C bus):
//   0 = GT911
//   1 = GT9271
//   2 = GT928
//   3 = FT6336
//   4 = none
#define LUCARNE_TOUCH_KIND 0

MipiDisplay display;
UI ui(display);

#if LUCARNE_TOUCH_KIND == 0
GT911Touch touch;
#elif LUCARNE_TOUCH_KIND == 1
GT9271Touch touch;
#elif LUCARNE_TOUCH_KIND == 2
GT928Touch touch;
#elif LUCARNE_TOUCH_KIND == 3
FT6336Touch touch;
#endif
TouchInput touchInput;
bool touchReady = false;

Screen home("Home");
Label homeTitle(0, 40, "LUCARNE P4", TextAlign::Center);
Label homeHint(0, 90, "Tap to test touch", TextAlign::Center);
Label touchStatus(0, 240, "", TextAlign::Center);

void setup() {
    Serial.begin(115200);
    delay(300);

    MipiDisplayConfig panel;
#if LUCARNE_PANEL_KIND == 0
    panel.driver = MipiPanelDriver::Ws5DsiTouchA_Hx8394;
    panel.panelWidth = 720;
    panel.panelHeight = 1280;
    panel.laneCount = 2;
    panel.laneMbps = 700;
    panel.dpiClockMhz = 58;
    panel.hsync = 20; panel.hbp = 20; panel.hfp = 40;
    panel.vsync = 4; panel.vbp = 10; panel.vfp = 24;
#elif LUCARNE_PANEL_KIND == 1
    // Timings from Espressif's esp_lcd_ili9881c ILI9881C_800_1280_PANEL_60HZ_DPI_CONFIG
    // (esp-bsp, and the same values used by esp-idf's mipi_dsi example) — the
    // generic reference panel is 800x1280, not 720x1280.
    panel.driver = MipiPanelDriver::Ili9881c;
    panel.panelWidth = 800;
    panel.panelHeight = 1280;
    panel.laneCount = 2;
    panel.laneMbps = 1000;
    panel.dpiClockMhz = 80;
    panel.hsync = 40; panel.hbp = 140; panel.hfp = 40;
    panel.vsync = 4; panel.vbp = 16; panel.vfp = 16;
    panel.blI2cAddr = 0; // no NT-style I2C backlight controller on generic ILI9881C boards
#elif LUCARNE_PANEL_KIND == 2
    // Timings from Espressif's esp_lcd_jd9365 JD9365_800_1280_PANEL_60HZ_DPI_CONFIG.
    panel.driver = MipiPanelDriver::Jd9365;
    panel.panelWidth = 800;
    panel.panelHeight = 1280;
    panel.laneCount = 2;
    panel.laneMbps = 1500;
    panel.dpiClockMhz = 80;
    panel.hsync = 20; panel.hbp = 20; panel.hfp = 40;
    panel.vsync = 4; panel.vbp = 12; panel.vfp = 30;
    panel.blI2cAddr = 0;
#elif LUCARNE_PANEL_KIND == 3
    // Timings from Espressif's esp_lcd_ek79007 EK79007_1024_600_PANEL_60HZ_CONFIG
    // (the official ESP32-P4-Function-EV-Board panel).
    panel.driver = MipiPanelDriver::Ek79007;
    panel.panelWidth = 1024;
    panel.panelHeight = 600;
    panel.laneCount = 2;
    panel.laneMbps = 900;
    panel.dpiClockMhz = 52;
    panel.hsync = 10; panel.hbp = 160; panel.hfp = 160;
    panel.vsync = 1; panel.vbp = 23; panel.vfp = 12;
    panel.blI2cAddr = 0;
#endif

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

    homeTitle.setBounds(0, 40, panel.panelWidth, 48);
    homeTitle.setFont(&LucarneFontTitle);
    homeHint.setBounds(0, 90, panel.panelWidth, 28);
    homeHint.setColor(color565(150, 170, 200));
    touchStatus.setBounds(0, 240, panel.panelWidth, 28);
    touchStatus.setColor(color565(150, 170, 200));

    home.add(&homeTitle);
    home.add(&homeHint);
    home.add(&touchStatus);

#if LUCARNE_TOUCH_KIND != 4
    TouchConfig touchCfg;
    touchCfg.bus = TouchBus::I2c;
    touchReady = touch.begin(touchCfg, panel.panelWidth, panel.panelHeight, panel.i2cSda,
                              panel.i2cScl, display.i2cBus());
    if (touchReady) {
        Serial.println("Lucarne: touch controller ready");
        touchInput.attach(&ui);
        touchStatus.setText("Touch: ready");
    } else {
        Serial.println("Lucarne: touch controller not detected");
        touchStatus.setText("Touch: not detected");
    }
#else
    touchStatus.setText("Touch: disabled");
#endif

    ui.show(&home);
    ui.begin();
}

void loop() {
#if LUCARNE_TOUCH_KIND != 4
    if (touchReady) {
        int16_t x = 0, y = 0;
        bool pressed = false;
        if (touch.poll(x, y, pressed)) {
            touchInput.feed(x, y, pressed);
        }
    }
#endif

    ui.update();
}
