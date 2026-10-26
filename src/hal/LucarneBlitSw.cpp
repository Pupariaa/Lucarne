#include "LucarneBlitBackend.h"
#include <string.h>

namespace lucarne {

class BlitBackendSw : public BlitBackend {
  public:
    bool fillRect565(uint16_t *dst, int16_t dstStride, int16_t w, int16_t h, uint16_t color) override {
        if (!dst || w <= 0 || h <= 0)
            return false;
        for (int16_t row = 0; row < h; row++) {
            uint16_t *p = dst + (int32_t)row * dstStride;
            for (int16_t col = 0; col < w; col++)
                p[col] = color;
        }
        return true;
    }

    bool copyRect565(const uint16_t *src, int16_t srcStride, uint16_t *dst, int16_t dstStride, int16_t w,
                     int16_t h) override {
        if (!src || !dst || w <= 0 || h <= 0)
            return false;
        if (srcStride == dstStride && w == srcStride) {
            memcpy(dst, src, (size_t)w * (size_t)h * 2);
            return true;
        }
        for (int16_t row = 0; row < h; row++) {
            memcpy(dst + (int32_t)row * dstStride, src + (int32_t)row * srcStride, (size_t)w * 2);
        }
        return true;
    }

    bool blendRect565(const uint16_t *src, int16_t srcStride, uint16_t *dst, int16_t dstStride, int16_t w,
                      int16_t h, uint8_t alpha) override {
        if (!src || !dst || w <= 0 || h <= 0)
            return false;
        if (alpha >= 255)
            return copyRect565(src, srcStride, dst, dstStride, w, h);
        if (alpha == 0)
            return true;
        for (int16_t row = 0; row < h; row++) {
            const uint16_t *s = src + (int32_t)row * srcStride;
            uint16_t *d = dst + (int32_t)row * dstStride;
            for (int16_t col = 0; col < w; col++) {
                uint16_t fg = s[col];
                uint16_t bg = d[col];
                uint8_t fr = (uint8_t)((fg >> 11) << 3);
                uint8_t fg_g = (uint8_t)(((fg >> 5) & 0x3F) << 2);
                uint8_t fb = (uint8_t)((fg & 0x1F) << 3);
                uint8_t br = (uint8_t)((bg >> 11) << 3);
                uint8_t bg_g = (uint8_t)(((bg >> 5) & 0x3F) << 2);
                uint8_t bb = (uint8_t)((bg & 0x1F) << 3);
                uint8_t r = (uint8_t)((fr * alpha + br * (255 - alpha)) / 255);
                uint8_t g = (uint8_t)((fg_g * alpha + bg_g * (255 - alpha)) / 255);
                uint8_t b = (uint8_t)((fb * alpha + bb * (255 - alpha)) / 255);
                d[col] = (uint16_t)(((r >> 3) << 11) | ((g >> 2) << 5) | (b >> 3));
            }
        }
        return true;
    }

    bool rotate90Rect565(const uint16_t *src, int16_t srcW, int16_t srcH, uint16_t *dst,
                         int16_t dstStride) override {
        if (!src || !dst || srcW <= 0 || srcH <= 0)
            return false;
        for (int16_t sy = 0; sy < srcH; sy++) {
            for (int16_t sx = 0; sx < srcW; sx++) {
                int16_t dx = sy;
                int16_t dy = (int16_t)(srcW - 1 - sx);
                dst[(int32_t)dy * dstStride + dx] = src[(int32_t)sy * srcW + sx];
            }
        }
        return true;
    }
};

static BlitBackendSw g_blitSw;

BlitBackend *halBlitBackendSw() { return &g_blitSw; }

}
