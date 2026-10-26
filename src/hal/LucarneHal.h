#ifndef LUCARNE_HAL_H
#define LUCARNE_HAL_H

#include "../core/LucarneTypes.h"
#include "LucarneHwCaps.h"
#include "LucarneFlushBackend.h"

namespace lucarne {

struct LtdcFramebuffer {
    uint16_t *pixels = nullptr;
    int16_t width = 0;
    int16_t height = 0;
    int16_t stride = 0;
    bool swapBytes = true;
};

void halInit(const HalProfile &profile);
const HwCaps &halCaps();
const HalProfile &halActiveProfile();
void halRefreshCaps();

bool halFlushRgb565Region(int16_t x, int16_t y, int16_t w, int16_t h, int16_t srcStride,
                          const uint16_t *srcPixels, SpiFlushContext *spiCtx);
void halFlushWait();

void halSetLtdcFramebuffer(uint16_t *pixels, int16_t width, int16_t height, int16_t stride = 0,
                           bool swapBytes = true);
const LtdcFramebuffer &halLtdcFramebuffer();
bool halLtdcCopyRows(int16_t x, int16_t y, int16_t w, int16_t h, int16_t srcStride, const uint16_t *srcPixels);

void halStm32SetSpi(void *spiHandle);
void halWchSetSpi(void *spiInstance);

bool halMipiBindPanel(void *panel);
bool halMipiDraw(int16_t x0, int16_t y0, int16_t x1, int16_t y1, const void *pixels);
void halMipiWait();
bool halMipiBusy();
bool halRotateBlock565(const uint16_t *pic, int16_t picW, int16_t picH, int16_t bx, int16_t by, int16_t bw,
                       int16_t bh, uint16_t *dst, size_t dstBytes, uint8_t rotation);

}

#endif
