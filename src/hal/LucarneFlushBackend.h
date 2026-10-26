#ifndef LUCARNE_FLUSH_BACKEND_H
#define LUCARNE_FLUSH_BACKEND_H

#include <stdint.h>
#include <stddef.h>

namespace lucarne {

struct SpiFlushContext;

class FlushBackend {
  public:
    virtual ~FlushBackend() = default;

    virtual void bindSpiFlush(SpiFlushContext *ctx) { (void)ctx; }

    virtual bool submitRgb565Rows(int16_t x, int16_t y, int16_t w, int16_t h, int16_t srcStride,
                                  const uint16_t *srcPixels) = 0;
    virtual bool supportsAsync() const { return false; }
    virtual void waitIdle() = 0;
    virtual bool isBusy() const = 0;
};

struct SpiFlushContext {
    void *spi = nullptr;
    void (*beginWindow)(void *user, int16_t x, int16_t y, int16_t w, int16_t h) = nullptr;
    void (*writePixels)(void *user, const uint8_t *data, size_t len) = nullptr;
    void (*endWindow)(void *user) = nullptr;
    void *user = nullptr;
    bool dmaSafeSrc = true;
    bool allowAsync = false;
    uint16_t *stagingLine = nullptr;
    size_t stagingLineBytes = 0;
    int8_t pinCs = -1;
    int8_t pinDc = -1;
    int8_t pinSclk = -1;
    int8_t pinMosi = -1;
    uint32_t spiHz = 0;
    uint8_t spiMode = 0;
    bool busShared = true;
};

FlushBackend *halFlushBackend();

}

#endif
