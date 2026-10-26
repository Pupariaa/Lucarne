#define LUCARNE_LIVE_MAX_FRAME 4096
#define LUCARNE_LIVE_DRIVER_ID 6
#define LUCARNE_LIVE_BAUD 460800
#include <Lucarne.h>
#include <tools/LucarneLivePreview.h>

using namespace lucarne;

HD44780 display;
LivePreview preview(display, Serial, LUCARNE_LIVE_DRIVER_ID);

bool onMatrixReconfigure(const MatrixDisplayPins &pins, const MatrixDisplayOptions &matrix,
                         const DisplayOptions &options, LivePreview *self) {
    return display.begin(pins, matrix, options);
}

void setup() {
#if defined(ARDUINO_USB_CDC_ON_BOOT) && ARDUINO_USB_CDC_ON_BOOT
    Serial.setRxBufferSize(4096);
    Serial.setTxBufferSize(1024);
    Serial.setTxTimeoutMs(20);
#endif
    Serial.begin(LUCARNE_LIVE_BAUD);

    MatrixDisplayPins pins;
    pins.rs = 27;
    pins.en = 26;
    pins.d4 = 25;
    pins.d5 = 33;
    pins.d6 = 32;
    pins.d7 = 35;
    pins.rw = -1;
    pins.bl = -1;

    MatrixDisplayOptions matrix;
    matrix.cols = 16;
    matrix.rows = 2;

    DisplayOptions options;
    options.panelWidth = 128;
    options.panelHeight = 32;
    options.rotation = 0;

    display.begin(pins, matrix, options);
    preview.setMatrixReconfigureHandler(onMatrixReconfigure);
    preview.begin();
}

void loop() {
    preview.update();
}
