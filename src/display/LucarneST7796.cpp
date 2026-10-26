#include "LucarneST7796.h"
#include "LucarneST77xx.h"

namespace lucarne {

ST7796::ST7796() : Display() {}

void ST7796::initPanel() {
    writeCommand(ST77XX_SWRESET);
    delay(150);
    writeCommand(ST77XX_SLPOUT);
    delay(120);

    writeCommand(0xF0);
    writeData(0xC3);
    writeCommand(0xF0);
    writeData(0x96);

    writeCommand(ST77XX_COLMOD);
    writeData(0x55);
    delay(10);

    writeCommand(0xB4);
    writeData(0x01);

    writeCommand(0xB6);
    writeData(0x80);
    writeData(0x02);

    writeCommand(0xB7);
    writeData(0xC6);

    writeCommand(0xE8);
    writeData(0x40);
    writeData(0x8A);
    writeData(0x00);
    writeData(0x00);
    writeData(0x29);
    writeData(0x19);
    writeData(0xA5);
    writeData(0x33);

    writeCommand(0xC1);
    writeData(0x06);

    writeCommand(0xC2);
    writeData(0xA7);

    writeCommand(0xC5);
    writeData(0x18);

    writeCommand(0xE0);
    writeData(0xF0);
    writeData(0x09);
    writeData(0x0B);
    writeData(0x06);
    writeData(0x04);
    writeData(0x15);
    writeData(0x2F);
    writeData(0x54);
    writeData(0x42);
    writeData(0x3C);
    writeData(0x17);
    writeData(0x14);
    writeData(0x18);
    writeData(0x1B);

    writeCommand(0xE1);
    writeData(0xE0);
    writeData(0x09);
    writeData(0x0B);
    writeData(0x06);
    writeData(0x04);
    writeData(0x03);
    writeData(0x2D);
    writeData(0x43);
    writeData(0x42);
    writeData(0x3B);
    writeData(0x16);
    writeData(0x14);
    writeData(0x17);
    writeData(0x1B);

    writeCommand(0xF0);
    writeData(0x3C);
    writeCommand(0xF0);
    writeData(0x69);

    writeCommand(ST77XX_SLPOUT);
    delay(120);
    writeCommand(ST77XX_NORON);
    delay(10);
    writeCommand(ST77XX_DISPON);
    delay(120);
}

void ST7796::setupOffsets() {
    _colStart = 0;
    _rowStart = 0;
    _colStart2 = 0;
    _rowStart2 = 0;
}

void ST7796::computeRotation(uint8_t r) {
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
