#include "LucarneILI9342.h"
#include "LucarneST77xx.h"

namespace lucarne {

ILI9342::ILI9342() : Display() {}

void ILI9342::initPanel() {
    writeCommand(ST77XX_SWRESET);
    delay(150);

    writeCommand(0xEF);
    writeData(0x03);
    writeData(0x80);
    writeData(0x02);

    writeCommand(0xCF);
    writeData(0x00);
    writeData(0xC1);
    writeData(0x30);

    writeCommand(0xED);
    writeData(0x64);
    writeData(0x03);
    writeData(0x12);
    writeData(0x81);

    writeCommand(0xE8);
    writeData(0x85);
    writeData(0x00);
    writeData(0x78);

    writeCommand(0xCB);
    writeData(0x39);
    writeData(0x2C);
    writeData(0x00);
    writeData(0x34);
    writeData(0x02);

    writeCommand(0xF7);
    writeData(0x20);

    writeCommand(0xEA);
    writeData(0x00);
    writeData(0x00);

    writeCommand(0xC0);
    writeData(0x23);

    writeCommand(0xC1);
    writeData(0x10);

    writeCommand(0xC5);
    writeData(0x3E);
    writeData(0x28);

    writeCommand(0xC7);
    writeData(0x86);

    writeCommand(ST77XX_COLMOD);
    writeData(0x55);
    delay(10);

    writeCommand(0xB1);
    writeData(0x00);
    writeData(0x18);

    writeCommand(0xB6);
    writeData(0x08);
    writeData(0x82);
    writeData(0x27);

    writeCommand(0xF2);
    writeData(0x00);

    writeCommand(0x26);
    writeData(0x01);

    writeCommand(0xE0);
    writeData(0xD4);
    writeData(0x01);
    writeData(0x08);
    writeData(0x70);
    writeData(0x79);
    writeData(0x38);
    writeData(0x3B);
    writeData(0x6C);
    writeData(0x89);
    writeData(0x4B);
    writeData(0x6B);
    writeData(0x5B);
    writeData(0x06);
    writeData(0x0C);
    writeData(0x1A);
    writeData(0x2E);
    writeData(0x63);

    writeCommand(0xE1);
    writeData(0xD5);
    writeData(0x00);
    writeData(0x03);
    writeData(0x0D);
    writeData(0x11);
    writeData(0x3A);
    writeData(0x3B);
    writeData(0x06);
    writeData(0x10);
    writeData(0x6D);
    writeData(0x07);
    writeData(0x03);
    writeData(0x0E);
    writeData(0x09);
    writeData(0x3A);
    writeData(0x1D);
    writeData(0x06);
    writeData(0x06);

    writeCommand(ST77XX_SLPOUT);
    delay(120);
    writeCommand(ST77XX_NORON);
    delay(10);
    writeCommand(ST77XX_DISPON);
    delay(120);
}

void ILI9342::setupOffsets() {
    int16_t w = _panelW;
    int16_t h = _panelH;
    _colStart = 0;
    _rowStart = 0;
    _colStart2 = 0;
    _rowStart2 = 0;

    if ((w == 240 && h == 320) || (w == 320 && h == 240)) {
        return;
    }
}

void ILI9342::computeRotation(uint8_t r) {
    uint8_t rgb = (_opt.colorOrder == ColorOrder::BGR) ? MADCTL_BGR : MADCTL_RGB;
    uint8_t m = 0;
    switch (r & 3) {
        case 0:
            m = MADCTL_MX;
            _xstart = _colStart;
            _ystart = _rowStart;
            _width = _panelW;
            _height = _panelH;
            break;
        case 1:
            m = MADCTL_MV;
            _xstart = _rowStart;
            _ystart = _colStart2;
            _width = _panelH;
            _height = _panelW;
            break;
        case 2:
            m = MADCTL_MY;
            _xstart = _colStart2;
            _ystart = _rowStart2;
            _width = _panelW;
            _height = _panelH;
            break;
        case 3:
            m = MADCTL_MX | MADCTL_MY | MADCTL_MV;
            _xstart = _rowStart2;
            _ystart = _colStart;
            _width = _panelH;
            _height = _panelW;
            break;
    }
    _madctl = (uint8_t)(m | rgb);
}

}
