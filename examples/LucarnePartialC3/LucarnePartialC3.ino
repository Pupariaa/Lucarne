#include <Lucarne.h>
#include <math.h>

using namespace lucarne;

ST7789 display;
UI ui(display);

Screen home("home");
Screen details("details");

Label title(16, 10, "C3 PARTIAL");
Metric tempMetric(16, 44, 208, 40, "Temp", "temp", " C");
Metric humMetric(16, 92, 208, 40, "Humidity", "hum", " %");
Bar loadBar(16, 146, 208, 18, "load", 0.0f, 1.0f);
Gauge loadGauge(60, 172, 120, 90, "Load", "load", 0.0f, 1.0f);
Button toDetails(16, 238, 208, 34, "Details");

Label detailsTitle(16, 10, "DETAILS");
Label uptimeLabel(16, 52, "");
Switch fanSwitch(16, 90, 208, 36, "Fan", "fan");
Button toHome(16, 238, 208, 34, "Back");

void setup() {
    Serial.begin(115200);

    HalProfile hal;
    hal.backend = HalBackend::Arduino;
    hal.uiProfile = UiProfile::Tiny;
    hal.stripeLines = 16;
    hal.allowRichTransitions = false;
    hal.preferRichTransitions = false;
    ui.setHalProfile(hal);

    DisplayPins pins;
    pins.cs = 7;
    pins.dc = 2;
    pins.rst = 3;
    pins.mosi = 6;
    pins.sclk = 4;
    pins.bl = 10;

    DisplayOptions options;
    options.panelWidth = 240;
    options.panelHeight = 280;
    options.rotation = 0;
    options.spiHz = 40000000;
    options.spiMode = 3;
    options.colorOrder = ColorOrder::RGB;
    options.invert = true;

    BufferOptions buffer;
    buffer.mode = BufferMode::Partial;
    buffer.memory = BufferMemory::Internal;
    buffer.maxBytes = 0;
    buffer.partialLineCount = 16;
    buffer.hal = hal;

    display.begin(pins, options, buffer);

    Theme theme;
    theme.font = &LucarneFontBody;
    theme.fontTitle = &LucarneFontTitle;
    ui.setTheme(theme);
    ui.setTransition(Transition::Fade, 180);

    title.setFont(&LucarneFontTitle);
    detailsTitle.setFont(&LucarneFontTitle);
    loadBar.setShowValue(true);
    toDetails.setNavigate(&details, Transition::Fade);
    toHome.setNavigate(&home, Transition::Fade);

    home.add(&title);
    home.add(&tempMetric);
    home.add(&humMetric);
    home.add(&loadBar);
    home.add(&loadGauge);
    home.add(&toDetails);

    details.add(&detailsTitle);
    details.add(&uptimeLabel);
    details.add(&fanSwitch);
    details.add(&toHome);

    ui.bindValue("uptime", &uptimeLabel, nullptr, 0, "s");

    ui.setFloat("temp", 23.4f);
    ui.setFloat("hum", 48.0f);
    ui.setFloat("load", 0.3f);
    ui.setInt("uptime", 0);
    ui.setBool("fan", false);

    ui.show(&home);
    ui.begin();

    Serial.println("Lucarne C3 partial ready");
}

void loop() {
    float t = millis() / 1000.0f;

    ui.setFloat("temp", 23.0f + 2.0f * sinf(t * 0.5f));
    ui.setFloat("hum", 48.0f + 6.0f * sinf(t * 0.3f));
    ui.setFloat("load", 0.5f + 0.45f * sinf(t));
    ui.setInt("uptime", (long)(millis() / 1000));

    if (Serial.available()) {
        char c = (char)Serial.read();
        if (c == 'd') ui.navigate(&details);
        if (c == 'h') ui.navigate(&home);
    }

    ui.update();
    delay(20);
}
