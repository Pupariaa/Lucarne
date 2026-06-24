#include "LucarneST7789.h"
#include "LucarneST77xx.h"

namespace lucarne {

ST7789::ST7789() : Display() {}

void ST7789::initPanel() {
    writeCommand(ST77XX_SWRESET);
    delay(150);
    writeCommand(ST77XX_SLPOUT);
    delay(10);

    writeCommand(ST77XX_COLMOD);
    writeData(0x55);
    delay(10);

    writeCommand(ST77XX_NORON);
    delay(10);
    writeCommand(ST77XX_DISPON);
    delay(10);
}

void ST7789::setupOffsets() {
    int16_t w = _panelW;
    int16_t h = _panelH;
    _colStart = 0;
    _rowStart = 0;
    _colStart2 = 0;
    _rowStart2 = 0;

    if ((w == 135 && h == 240) || (w == 240 && h == 135)) {
        _colStart = 52;
        _rowStart = 40;
        _colStart2 = 53;
        _rowStart2 = 40;
    } else if ((w == 240 && h == 240)) {
        _rowStart2 = 80;
    } else if ((w == 172 && h == 320) || (w == 320 && h == 172)) {
        _colStart = 34;
        _colStart2 = 34;
    } else if ((w == 170 && h == 320) || (w == 320 && h == 170)) {
        _colStart = 35;
        _colStart2 = 35;
    } else if ((w == 240 && h == 280) || (w == 280 && h == 240)) {
        _rowStart = 20;
        _rowStart2 = 20;
    }
}

void ST7789::computeRotation(uint8_t r) {
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
            _ystart = _colStart;
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
            _ystart = _colStart2;
            _width = _panelH;
            _height = _panelW;
            break;
    }
    _madctl = (uint8_t)(m | rgb);
}

}
