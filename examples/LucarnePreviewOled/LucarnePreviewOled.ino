#include "lucarne_preview_oled_config.h"
#include <Lucarne.h>
#include <tools/LucarneLivePreview.h>

using namespace lucarne;

#if LUCARNE_PREVIEW_OLED_DRIVER == LUCARNE_PREVIEW_OLED_SH1106
SH1106 display;
#elif LUCARNE_PREVIEW_OLED_DRIVER == LUCARNE_PREVIEW_OLED_SSD1315
SSD1315 display;
#else
SSD1306 display;
#endif

LivePreview preview(display, Serial, LUCARNE_LIVE_DRIVER_ID);

bool onOledReconfigure(const I2cDisplayPins &pins, const DisplayOptions &options, LivePreview *self) {
    return display.begin(pins, options);
}

void setup() {
#if ARDUINO_USB_CDC_ON_BOOT
    Serial.setRxBufferSize(8192);
    Serial.setTxBufferSize(2048);
    Serial.setTxTimeoutMs(20);
#endif
    Serial.begin(LUCARNE_LIVE_BAUD);
    preview.setOledReconfigureHandler(onOledReconfigure);
    preview.begin();
}

void loop() {
    preview.update();
    if (preview.hostSeen()) return;
    static uint32_t nextInfo = 0;
    uint32_t now = millis();
    if ((int32_t)(now - nextInfo) >= 0) {
        nextInfo = now + 200;
        preview.begin();
    }
}
