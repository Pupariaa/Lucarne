#include "../../LucarneFlushSpiAsync.h"
#include "../../LucarneBlitBackend.h"
#include "../../LucarneImageCodecBackend.h"
#include "../../LucarneHwCaps.h"
#include "../../LucarneHal.h"
#include "../../LucarneHalConfig.h"

#if defined(LUCARNE_HAL_BACKEND_STM32CUBE)
#if defined(LUCARNE_STM32_HAL_HEADER)
#include LUCARNE_STM32_HAL_HEADER
#define LUCARNE_STM32_HAL 1
#elif defined(__has_include)
#if __has_include("stm32_def.h")
#include "stm32_def.h"
#define LUCARNE_STM32_HAL 1
#elif __has_include("stm32h7xx_hal.h")
#include "stm32h7xx_hal.h"
#define LUCARNE_STM32_HAL 1
#elif __has_include("stm32f7xx_hal.h")
#include "stm32f7xx_hal.h"
#define LUCARNE_STM32_HAL 1
#elif __has_include("stm32f4xx_hal.h")
#include "stm32f4xx_hal.h"
#define LUCARNE_STM32_HAL 1
#elif __has_include("stm32u5xx_hal.h")
#include "stm32u5xx_hal.h"
#define LUCARNE_STM32_HAL 1
#elif __has_include("stm32h5xx_hal.h")
#include "stm32h5xx_hal.h"
#define LUCARNE_STM32_HAL 1
#elif __has_include("stm32l4xx_hal.h")
#include "stm32l4xx_hal.h"
#define LUCARNE_STM32_HAL 1
#elif __has_include("stm32l5xx_hal.h")
#include "stm32l5xx_hal.h"
#define LUCARNE_STM32_HAL 1
#elif __has_include("stm32g4xx_hal.h")
#include "stm32g4xx_hal.h"
#define LUCARNE_STM32_HAL 1
#elif __has_include("stm32g0xx_hal.h")
#include "stm32g0xx_hal.h"
#define LUCARNE_STM32_HAL 1
#elif __has_include("stm32f3xx_hal.h")
#include "stm32f3xx_hal.h"
#define LUCARNE_STM32_HAL 1
#elif __has_include("stm32f2xx_hal.h")
#include "stm32f2xx_hal.h"
#define LUCARNE_STM32_HAL 1
#elif __has_include("stm32f1xx_hal.h")
#include "stm32f1xx_hal.h"
#define LUCARNE_STM32_HAL 1
#elif __has_include("stm32f0xx_hal.h")
#include "stm32f0xx_hal.h"
#define LUCARNE_STM32_HAL 1
#elif __has_include("stm32wbxx_hal.h")
#include "stm32wbxx_hal.h"
#define LUCARNE_STM32_HAL 1
#elif __has_include("stm32l0xx_hal.h")
#include "stm32l0xx_hal.h"
#define LUCARNE_STM32_HAL 1
#elif __has_include("stm32c0xx_hal.h")
#include "stm32c0xx_hal.h"
#define LUCARNE_STM32_HAL 1
#endif
#endif
#endif

#ifndef LUCARNE_STM32_HAL
#define LUCARNE_STM32_HAL 0
#endif

#if LUCARNE_STM32_HAL && defined(HAL_SPI_MODULE_ENABLED) && defined(HAL_DMA_MODULE_ENABLED) && \
    !defined(LUCARNE_DISABLE_ASYNC_FLUSH)
#define LUCARNE_STM32_SPI_DMA 1
#else
#define LUCARNE_STM32_SPI_DMA 0
#endif

#if LUCARNE_STM32_HAL && defined(DMA2D) && !defined(LUCARNE_DISABLE_DMA2D)
#define LUCARNE_STM32_DMA2D 1
#else
#define LUCARNE_STM32_DMA2D 0
#endif

#if LUCARNE_STM32_HAL && defined(__DCACHE_PRESENT) && (__DCACHE_PRESENT == 1U)
#define LUCARNE_STM32_DCACHE 1
#else
#define LUCARNE_STM32_DCACHE 0
#endif

#ifndef LUCARNE_STM32_SPI_TIMEOUT_MS
#define LUCARNE_STM32_SPI_TIMEOUT_MS 1000
#endif

#ifndef LUCARNE_DMA2D_MIN_PIXELS
#define LUCARNE_DMA2D_MIN_PIXELS 256
#endif

namespace lucarne {

#if LUCARNE_STM32_HAL

static bool stm32DmaReachable(const void *p) {
#if defined(STM32H7xx) || defined(STM32H7)
    uintptr_t a = (uintptr_t)p;
    if (a < 0x00010000u)
        return false;
    if (a >= 0x20000000u && a < 0x20020000u)
        return false;
#else
    (void)p;
#endif
    return true;
}

static bool stm32CacheOn() {
#if LUCARNE_STM32_DCACHE
    return (SCB->CCR & SCB_CCR_DC_Msk) != 0;
#else
    return false;
#endif
}

static void stm32CacheClean(const void *p, size_t bytes) {
#if LUCARNE_STM32_DCACHE
    if (stm32CacheOn() && bytes)
        SCB_CleanDCache_by_Addr((uint32_t *)(uintptr_t)p, (int32_t)bytes);
#else
    (void)p;
    (void)bytes;
#endif
}

static void stm32CacheCleanInvalidate(void *p, size_t bytes) {
#if LUCARNE_STM32_DCACHE
    if (stm32CacheOn() && bytes)
        SCB_CleanInvalidateDCache_by_Addr((uint32_t *)(uintptr_t)p, (int32_t)bytes);
#else
    (void)p;
    (void)bytes;
#endif
}

static void stm32CacheInvalidate(void *p, size_t bytes) {
#if LUCARNE_STM32_DCACHE
    if (stm32CacheOn() && bytes)
        SCB_InvalidateDCache_by_Addr((uint32_t *)(uintptr_t)p, (int32_t)bytes);
#else
    (void)p;
    (void)bytes;
#endif
}

#endif

#if LUCARNE_STM32_SPI_DMA
static SPI_HandleTypeDef *g_stm32Spi = nullptr;
#else
static void *g_stm32Spi = nullptr;
#endif

class FlushBackendStm32 : public FlushBackendSpiDma {
  public:
    bool submitRgb565Rows(int16_t x, int16_t y, int16_t w, int16_t h, int16_t srcStride,
                          const uint16_t *srcPixels) override {
        if (halLtdcFramebuffer().pixels) {
            if (!halLtdcCopyRows(x, y, w, h, srcStride, srcPixels))
                return false;
#if LUCARNE_STM32_HAL
            const LtdcFramebuffer &fb = halLtdcFramebuffer();
            for (int16_t row = 0; row < h; row++)
                stm32CacheClean(fb.pixels + (int32_t)(y + row) * fb.stride + x, (size_t)w * 2);
#endif
            return true;
        }
        return FlushBackendSpiDma::submitRgb565Rows(x, y, w, h, srcStride, srcPixels);
    }

    bool supportsAsync() const override {
#if LUCARNE_STM32_SPI_DMA
        return g_stm32Spi && g_stm32Spi->hdmatx && !halLtdcFramebuffer().pixels;
#else
        return false;
#endif
    }

  protected:
#if LUCARNE_STM32_SPI_DMA
    bool asyncReady() override {
        return g_stm32Spi && g_stm32Spi->hdmatx && HAL_SPI_GetState(g_stm32Spi) == HAL_SPI_STATE_READY;
    }

    bool startAsync(const uint8_t *data, size_t len) override {
        if (!stm32DmaReachable(data))
            return false;
        stm32CacheClean(data, len);
        _next = data;
        _left = len;
        return pump();
    }

    bool pump() {
        size_t n = _left > 0xFFFFu ? 0xFFFFu : _left;
        if (HAL_SPI_Transmit_DMA(g_stm32Spi, (uint8_t *)(uintptr_t)_next, (uint16_t)n) != HAL_OK)
            return false;
        _next += n;
        _left -= n;
        return true;
    }

    bool waitReady() {
        uint32_t start = HAL_GetTick();
        while (HAL_SPI_GetState(g_stm32Spi) != HAL_SPI_STATE_READY) {
            if (HAL_GetTick() - start > LUCARNE_STM32_SPI_TIMEOUT_MS) {
                HAL_SPI_Abort(g_stm32Spi);
                return false;
            }
        }
        return true;
    }

    void finishAsync() override {
        if (!g_stm32Spi)
            return;
        while (true) {
            if (!waitReady()) {
                _left = 0;
                break;
            }
            if (_left == 0)
                break;
            if (!pump()) {
                while (_left > 0) {
                    size_t n = _left > 0xFFFFu ? 0xFFFFu : _left;
                    HAL_SPI_Transmit(g_stm32Spi, (uint8_t *)(uintptr_t)_next, (uint16_t)n,
                                     LUCARNE_STM32_SPI_TIMEOUT_MS);
                    _next += n;
                    _left -= n;
                }
                break;
            }
        }
    }

    bool asyncRunning() const override {
        if (!g_stm32Spi)
            return false;
        return _left > 0 || HAL_SPI_GetState(g_stm32Spi) != HAL_SPI_STATE_READY;
    }

    const uint8_t *_next = nullptr;
    size_t _left = 0;
#else
    bool asyncReady() override { return false; }
    bool startAsync(const uint8_t *data, size_t len) override {
        (void)data;
        (void)len;
        return false;
    }
    void finishAsync() override {}
    bool asyncRunning() const override { return false; }
#endif
};

#if LUCARNE_STM32_DMA2D
class BlitBackendDma2d : public BlitBackend {
  public:
    bool fillRect565(uint16_t *dst, int16_t dstStride, int16_t w, int16_t h, uint16_t color) override {
        if (!dst || w <= 0 || h <= 0)
            return false;
        if ((int32_t)w * h < LUCARNE_DMA2D_MIN_PIXELS || !stm32DmaReachable(dst) || !ready())
            return halBlitBackendSw()->fillRect565(dst, dstStride, w, h, color);
        size_t span = spanBytes(dstStride, w, h);
        stm32CacheCleanInvalidate(dst, span);
        DMA2D->CR = 0x00030000u;
        DMA2D->OPFCCR = 2u;
        DMA2D->OCOLR = color;
        DMA2D->OMAR = (uint32_t)(uintptr_t)dst;
        DMA2D->OOR = (uint32_t)(dstStride - w);
        DMA2D->NLR = ((uint32_t)w << 16) | (uint32_t)h;
        bool ok = run();
        stm32CacheInvalidate(dst, span);
        return ok || halBlitBackendSw()->fillRect565(dst, dstStride, w, h, color);
    }

    bool copyRect565(const uint16_t *src, int16_t srcStride, uint16_t *dst, int16_t dstStride, int16_t w,
                     int16_t h) override {
        if (!src || !dst || w <= 0 || h <= 0)
            return false;
        if ((int32_t)w * h < LUCARNE_DMA2D_MIN_PIXELS || !stm32DmaReachable(src) || !stm32DmaReachable(dst) ||
            !ready())
            return halBlitBackendSw()->copyRect565(src, srcStride, dst, dstStride, w, h);
        size_t dstSpan = spanBytes(dstStride, w, h);
        stm32CacheClean(src, spanBytes(srcStride, w, h));
        stm32CacheCleanInvalidate(dst, dstSpan);
        DMA2D->CR = 0x00000000u;
        DMA2D->FGMAR = (uint32_t)(uintptr_t)src;
        DMA2D->FGOR = (uint32_t)(srcStride - w);
        DMA2D->FGPFCCR = 2u;
        DMA2D->OPFCCR = 2u;
        DMA2D->OMAR = (uint32_t)(uintptr_t)dst;
        DMA2D->OOR = (uint32_t)(dstStride - w);
        DMA2D->NLR = ((uint32_t)w << 16) | (uint32_t)h;
        bool ok = run();
        stm32CacheInvalidate(dst, dstSpan);
        return ok || halBlitBackendSw()->copyRect565(src, srcStride, dst, dstStride, w, h);
    }

    bool blendRect565(const uint16_t *src, int16_t srcStride, uint16_t *dst, int16_t dstStride, int16_t w,
                      int16_t h, uint8_t alpha) override {
        return halBlitBackendSw()->blendRect565(src, srcStride, dst, dstStride, w, h, alpha);
    }

    bool rotate90Rect565(const uint16_t *src, int16_t srcW, int16_t srcH, uint16_t *dst,
                         int16_t dstStride) override {
        return halBlitBackendSw()->rotate90Rect565(src, srcW, srcH, dst, dstStride);
    }

  private:
    static size_t spanBytes(int16_t stride, int16_t w, int16_t h) {
        return ((size_t)(h - 1) * (size_t)stride + (size_t)w) * 2;
    }

    bool ready() {
        if (!_clock) {
#if defined(__HAL_RCC_DMA2D_CLK_ENABLE)
            __HAL_RCC_DMA2D_CLK_ENABLE();
#endif
            _clock = true;
        }
        return (DMA2D->CR & DMA2D_CR_START) == 0;
    }

    bool run() {
        DMA2D->IFCR = 0x3Fu;
        DMA2D->CR |= DMA2D_CR_START;
        uint32_t start = HAL_GetTick();
        while (DMA2D->CR & DMA2D_CR_START) {
            if (HAL_GetTick() - start > 100u) {
                DMA2D->CR |= DMA2D_CR_ABORT;
                return false;
            }
        }
        bool err = (DMA2D->ISR & (DMA2D_ISR_TEIF | DMA2D_ISR_CEIF)) != 0;
        DMA2D->IFCR = 0x3Fu;
        return !err;
    }

    bool _clock = false;
};

static BlitBackendDma2d g_blitDma2d;
#endif

static FlushBackendStm32 g_flushStm32;

void halStm32SetSpi(void *spiHandle) {
    g_flushStm32.waitIdle();
#if LUCARNE_STM32_SPI_DMA
    g_stm32Spi = (SPI_HandleTypeDef *)spiHandle;
#else
    g_stm32Spi = spiHandle;
#endif
    halRefreshCaps();
}

void halRegisterStm32CubeBackends(FlushBackend **flush, BlitBackend **blit, ImageCodecBackend **codec,
                                  HwCaps *caps) {
    *flush = &g_flushStm32;
    *codec = nullptr;
#if LUCARNE_STM32_DMA2D
    *blit = &g_blitDma2d;
    caps->flags |= (uint32_t)kCap2dDma2d;
#else
    *blit = nullptr;
#endif
    caps->flags |= (uint32_t)kCapBlitFill | (uint32_t)kCapBlitMemCopy;
#if LUCARNE_STM32_SPI_DMA
    if (g_stm32Spi && g_stm32Spi->hdmatx)
        caps->flags |= (uint32_t)kCapFlushDmaSpi | (uint32_t)kCapFlushAsync;
#endif
#if LUCARNE_STM32_HAL && defined(LTDC)
    if (halLtdcFramebuffer().pixels)
        caps->flags |= (uint32_t)kCapDisplayLtdc;
#endif
}

}
