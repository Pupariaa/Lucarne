#ifndef LUCARNE_DISPLAY_H
#define LUCARNE_DISPLAY_H

#include <Arduino.h>
#include <SPI.h>
#include "../core/LucarneGfx.h"
#include "../core/LucarneTypes.h"

namespace lucarne {

class Display : public Gfx {
  public:
    Display();
    virtual ~Display();

    bool begin(const DisplayPins &pins, const DisplayOptions &options,
               const BufferOptions &buffer = BufferOptions(), SPIClass *spi = &SPI);

    void setRotation(uint8_t r);
    void applyPanelConfig(int16_t panelW, int16_t panelH, uint8_t rotation);
    void invertDisplay(bool invert);
    void backlight(bool on);

    void display();
    void display(int16_t x, int16_t y, int16_t w, int16_t h);

    void writeBufferRect(int16_t x, int16_t y, int16_t w, int16_t h, const uint16_t *src);
    void blitBufferRect(int16_t x, int16_t y, int16_t w, int16_t h, const uint16_t *srcBe16);
    void readBufferRectNative(int16_t x, int16_t y, int16_t w, int16_t h, uint16_t *dst);

    void writePixelsFitOver(int16_t boxX, int16_t boxY, int16_t boxW, int16_t boxH, const uint16_t *pix,
                            int16_t sw, int16_t sh, const uint8_t *alpha, bool hasAlpha,
                            const uint16_t *under, int16_t underW, int16_t underH);

    bool canPeekPixel() const override;
    uint16_t peekPixel(int16_t x, int16_t y) const override;

    void writePixel(int16_t x, int16_t y, uint16_t color) override;
    void writeFillRect(int16_t x, int16_t y, int16_t w, int16_t h, uint16_t color) override;
    void writeFastHLine(int16_t x, int16_t y, int16_t w, uint16_t color) override;
    void writeFastVLine(int16_t x, int16_t y, int16_t h, uint16_t color) override;
    void startWrite() override;
    void endWrite() override;

    BufferMode bufferMode() const { return _bufMode; }
    bool hasBuffer() const { return _buffer != nullptr; }
    uint16_t *buffer() { return _buffer; }

    uint16_t *allocFrame();
    void freeFrame(uint16_t *p);
    void snapshotFrame(uint16_t *dst);
    void presentFull();

  protected:
    virtual void initPanel() = 0;
    virtual void setupOffsets() = 0;
    virtual void computeRotation(uint8_t r) = 0;

    void writeCommand(uint8_t cmd);
    void writeData(uint8_t data);
    void writeData16(uint16_t data);
    void sendCommand(uint8_t cmd, const uint8_t *data, uint8_t len);
    void setAddrWindow(int16_t x, int16_t y, int16_t w, int16_t h);
    void hardwareReset();
    void spiBegin();
    void spiEnd();

    bool allocBuffer();
    void freeBuffer();
    void markDirty(int16_t x, int16_t y, int16_t w, int16_t h);
    void flushRegion(int16_t x, int16_t y, int16_t w, int16_t h);

    SPIClass *_spi;
    DisplayPins _pins;
    DisplayOptions _opt;
    SPISettings _spiSettings;

    BufferMode _bufMode;
    BufferMemory _bufMem;
    uint32_t _bufMaxBytes;
    uint16_t *_buffer;
    uint16_t *_lineBuf;
    bool _bufferDmaSafe;

    int16_t _panelW;
    int16_t _panelH;
    int16_t _colStart;
    int16_t _rowStart;
    int16_t _colStart2;
    int16_t _rowStart2;
    int16_t _xstart;
    int16_t _ystart;
    uint8_t _madctl;

    int16_t _dx0;
    int16_t _dy0;
    int16_t _dx1;
    int16_t _dy1;
    bool _dirty;
    uint8_t _txDepth;
};

}

#endif
