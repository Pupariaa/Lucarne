#ifndef LUCARNE_OLED_MONO_H
#define LUCARNE_OLED_MONO_H

#include <Arduino.h>
#include <SPI.h>
#include <Wire.h>
#include "../core/LucarneGfx.h"
#include "../core/LucarneTypes.h"

#ifndef LUCARNE_OLED_I2C_CHUNK
#define LUCARNE_OLED_I2C_CHUNK 16
#endif

namespace lucarne {

class OledMono : public Gfx {
  public:
    OledMono();
    ~OledMono() override;

    bool begin(const I2cDisplayPins &pins, const OledOptions &options = OledOptions(), TwoWire *wire = &Wire);
    bool begin(const I2cDisplayPins &pins, const DisplayOptions &options, TwoWire *wire = &Wire);
    bool beginSpi(const DisplayPins &pins, const OledOptions &options = OledOptions(), SPIClass *spi = &SPI,
                  uint32_t spiHz = 8000000);
    bool begin(const DisplayPins &pins, const DisplayOptions &options, SPIClass *spi = &SPI);

    void setRotation(uint8_t r);
    uint8_t getRotation() const { return _rot; }
    void setContrast(uint8_t contrast);
    void invertDisplay(bool invert);
    void displayOn(bool on);
    void clear();
    void display();

    void writePixel(int16_t x, int16_t y, uint16_t color) override;
    void writeFillRect(int16_t x, int16_t y, int16_t w, int16_t h, uint16_t color) override;
    void writeFastHLine(int16_t x, int16_t y, int16_t w, uint16_t color) override;
    void writeFastVLine(int16_t x, int16_t y, int16_t h, uint16_t color) override;
    void writeRowRgb565Le(int16_t x, int16_t y, int16_t w, const uint16_t *srcLe) override;

    bool canPeekPixel() const override { return _buf != nullptr; }
    uint16_t peekPixel(int16_t x, int16_t y) const override;

    BufferMode bufferMode() const override { return BufferMode::None; }
    void presentFull() override;
    void presentDirty() override;
    void invalidateRegion(int16_t x, int16_t y, int16_t w, int16_t h) override;
    void flushArea(int16_t x, int16_t y, int16_t w, int16_t h) override;
    bool flushRect(int16_t x, int16_t y, int16_t w, int16_t h) override;
    void discardDirty() override { _dirty = false; }

    static bool colorIsOn(uint16_t color);
    static OledOptions optionsFrom(const DisplayOptions &options);

  protected:
    virtual void initController() = 0;
    virtual void sendPages(uint8_t p0, uint8_t p1, int16_t c0, int16_t c1) = 0;

    void command(uint8_t c);
    void commandList(const uint8_t *list, uint8_t count);
    void sendData(const uint8_t *data, size_t len);
    const uint8_t *pageRow(uint8_t page) const { return _buf + (size_t)page * (size_t)_pw; }
    bool flipped() const { return _opt.flipVertical != ((_rot & 2) != 0); }
    int16_t panelHeight() const { return _ph; }
    int16_t panelWidth() const { return _pw; }

  private:
    bool setup();
    void hardwareReset(int8_t rst);
    void applyRotation();
    void markDirty(int16_t x, int16_t y, int16_t w, int16_t h);
    void setBit(int16_t px, int16_t py, bool on);
    bool transposed() const { return (_rot & 1) != 0; }
    Rect physicalRect(const Rect &logical) const;

    TwoWire *_wire;
    SPIClass *_spi;
    SPISettings _spiSettings;
    bool _useSpi;
    I2cDisplayPins _i2cPins;
    DisplayPins _spiPins;
    OledOptions _opt;
    uint8_t *_buf;
    int16_t _pw;
    int16_t _ph;
    uint8_t _rot;
    int16_t _dx0;
    int16_t _dy0;
    int16_t _dx1;
    int16_t _dy1;
    bool _dirty;
};

class SSD1306 : public OledMono {
  protected:
    void initController() override;
    void sendPages(uint8_t p0, uint8_t p1, int16_t c0, int16_t c1) override;
};

class SH1106 : public OledMono {
  protected:
    void initController() override;
    void sendPages(uint8_t p0, uint8_t p1, int16_t c0, int16_t c1) override;
};

class SSD1315 : public SSD1306 {};

}

#endif
