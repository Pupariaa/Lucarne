#ifndef LUCARNE_BLIT_BACKEND_H
#define LUCARNE_BLIT_BACKEND_H

#include <stdint.h>
#include <stddef.h>

namespace lucarne {

class BlitBackend {
  public:
    virtual ~BlitBackend() = default;

    virtual bool fillRect565(uint16_t *dst, int16_t dstStride, int16_t w, int16_t h, uint16_t color) = 0;
    virtual bool copyRect565(const uint16_t *src, int16_t srcStride, uint16_t *dst, int16_t dstStride,
                             int16_t w, int16_t h) = 0;
    virtual bool blendRect565(const uint16_t *src, int16_t srcStride, uint16_t *dst, int16_t dstStride,
                              int16_t w, int16_t h, uint8_t alpha) = 0;
    virtual bool rotate90Rect565(const uint16_t *src, int16_t srcW, int16_t srcH, uint16_t *dst,
                                 int16_t dstStride) = 0;
};

BlitBackend *halBlitBackend();
BlitBackend *halBlitBackendSw();

}

#endif
