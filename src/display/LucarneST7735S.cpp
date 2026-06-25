#include "LucarneST7735S.h"
#include "LucarneST77xx.h"

namespace lucarne {

ST7735S::ST7735S() : Display() {}

void ST7735S::initPanel() {
    writeCommand(ST77XX_SWRESET);
    delay(150);
    writeCommand(ST77XX_SLPOUT);
    delay(200);

    writeCommand(0xB1);
    writeData(0x01);
    writeData(0x2C);
    writeData(0x2D);

    writeCommand(0xB2);
    writeData(0x01);
    writeData(0x2C);
    writeData(0x2D);

    writeCommand(0xB3);
    writeData(0x01);
    writeData(0x2C);
    writeData(0x2D);
    writeData(0x01);
    writeData(0x2C);
    writeData(0x2D);

    writeCommand(0xB4);
    writeData(0x07);

    writeCommand(0xC0);
    writeData(0xA2);
    writeData(0x02);
    writeData(0x84);

    writeCommand(0xC1);
    writeData(0xC5);

    writeCommand(0xC2);
    writeData(0x0A);
    writeData(0x00);

    writeCommand(0xC3);
    writeData(0x8A);
    writeData(0x2A);

    writeCommand(0xC4);
    writeData(0x8A);
    writeData(0xEE);

    writeCommand(0xC5);
    writeData(0x0E);

    writeCommand(ST77XX_INVOFF);

    writeCommand(ST77XX_COLMOD);
    writeData(0x05);

    writeCommand(0xE0);
    writeData(0x02);
    writeData(0x1C);
    writeData(0x07);
    writeData(0x12);
    writeData(0x37);
    writeData(0x32);
    writeData(0x29);
    writeData(0x2D);
    writeData(0x29);
    writeData(0x25);
    writeData(0x2B);
    writeData(0x39);
    writeData(0x00);
    writeData(0x01);
    writeData(0x03);
    writeData(0x10);

    writeCommand(0xE1);
    writeData(0x03);
    writeData(0x1D);
    writeData(0x07);
    writeData(0x06);
    writeData(0x2E);
    writeData(0x2C);
    writeData(0x29);
    writeData(0x2D);
    writeData(0x2E);
    writeData(0x2E);
    writeData(0x37);
    writeData(0x3F);
    writeData(0x00);
    writeData(0x00);
    writeData(0x02);
    writeData(0x10);

    writeCommand(ST77XX_NORON);
    delay(10);
    writeCommand(ST77XX_DISPON);
    delay(100);
}

void ST7735S::setupOffsets() {
    int16_t w = _panelW;
    int16_t h = _panelH;
    _colStart = 0;
    _rowStart = 0;
    _colStart2 = 0;
    _rowStart2 = 0;

    if ((w == 80 && h == 160) || (w == 160 && h == 80)) {
        _colStart = 26;
        _rowStart = 1;
        _colStart2 = 26;
        _rowStart2 = 1;
    } else if (w == 128 && h == 128) {
        _colStart = 2;
        _rowStart = 1;
        _colStart2 = 2;
        _rowStart2 = 1;
    }
}

void ST7735S::computeRotation(uint8_t r) {
    uint8_t rgb = (_opt.colorOrder == ColorOrder::BGR) ? MADCTL_BGR : MADCTL_RGB;
    uint8_t m = 0;
    switch (r & 3) {
        case 0:
            m = MADCTL_MX | MADCTL_MY;
            _xstart = _colStart;
            _ystart = _rowStart;
            _width = _panelW;
            _height = _panelH;
            break;
        case 1:
            m = MADCTL_MY | MADCTL_MV;
            _xstart = _rowStart;
            _ystart = _colStart2;
            _width = _panelH;
            _height = _panelW;
            break;
        case 2:
            m = 0;
            _xstart = _colStart2;
            _ystart = _rowStart2;
            _width = _panelW;
            _height = _panelH;
            break;
        case 3:
            m = MADCTL_MX | MADCTL_MV;
            _xstart = _rowStart2;
            _ystart = _colStart;
            _width = _panelH;
            _height = _panelW;
            break;
    }
    _madctl = (uint8_t)(m | rgb);
}

}
