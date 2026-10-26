#include "../../LucarneFlushSpiAsync.h"
#include "../../LucarneBlitBackend.h"
#include "../../LucarneHwCaps.h"
#include "../../LucarneHal.h"
#include "../../LucarneHalConfig.h"

#if defined(LUCARNE_HAL_BACKEND_WCH)
#if defined(LUCARNE_WCH_HAL_HEADER)
#include LUCARNE_WCH_HAL_HEADER
#define LUCARNE_WCH_HAL 1
#elif defined(__has_include)
#if __has_include("ch32_def.h")
#include "ch32_def.h"
#define LUCARNE_WCH_HAL 1
#elif __has_include("ch32v30x.h")
#include "ch32v30x.h"
#define LUCARNE_WCH_HAL 1
#elif __has_include("ch32v20x.h")
#include "ch32v20x.h"
#define LUCARNE_WCH_HAL 1
#elif __has_include("ch32v10x.h")
#include "ch32v10x.h"
#define LUCARNE_WCH_HAL 1
#elif __has_include("ch32h417.h")
#include "ch32h417.h"
#define LUCARNE_WCH_HAL 1
#endif
#endif
#endif

#ifndef LUCARNE_WCH_HAL
#define LUCARNE_WCH_HAL 0
#endif

#if LUCARNE_WCH_HAL && defined(SPI1) && defined(DMA1_Channel3) && defined(DMA1_FLAG_TC3) && \
    !defined(LUCARNE_DISABLE_ASYNC_FLUSH)
#define LUCARNE_WCH_SPI_DMA 1
#else
#define LUCARNE_WCH_SPI_DMA 0
#endif

#if defined(CH32H417) || defined(CH32H416) || defined(CH32H415)
#define LUCARNE_WCH_CH32H 1
#else
#define LUCARNE_WCH_CH32H 0
#endif

#ifndef LUCARNE_WCH_SPI_SPIN_LIMIT
#define LUCARNE_WCH_SPI_SPIN_LIMIT 50000000UL
#endif

namespace lucarne {

#if LUCARNE_WCH_SPI_DMA
static SPI_TypeDef *g_wchSpi = SPI1;
#else
static void *g_wchSpi = nullptr;
#endif

class FlushBackendWch : public FlushBackendSpiDma {
  public:
    bool submitRgb565Rows(int16_t x, int16_t y, int16_t w, int16_t h, int16_t srcStride,
                          const uint16_t *srcPixels) override {
        if (halLtdcFramebuffer().pixels)
            return halLtdcCopyRows(x, y, w, h, srcStride, srcPixels);
        return FlushBackendSpiDma::submitRgb565Rows(x, y, w, h, srcStride, srcPixels);
    }

    bool supportsAsync() const override {
#if LUCARNE_WCH_SPI_DMA
        return g_wchSpi != nullptr && !halLtdcFramebuffer().pixels;
#else
        return false;
#endif
    }

  protected:
#if LUCARNE_WCH_SPI_DMA
    DMA_Channel_TypeDef *channel() const {
#if defined(SPI2) && defined(DMA1_Channel5)
        if (g_wchSpi == SPI2)
            return DMA1_Channel5;
#endif
        return DMA1_Channel3;
    }

    uint32_t tcFlag() const {
#if defined(SPI2) && defined(DMA1_Channel5)
        if (g_wchSpi == SPI2)
            return DMA1_FLAG_TC5;
#endif
        return DMA1_FLAG_TC3;
    }

    bool asyncReady() override {
        if (!g_wchSpi)
            return false;
        if (!_clock) {
            RCC_AHBPeriphClockCmd(RCC_AHBPeriph_DMA1, ENABLE);
            _clock = true;
        }
        return true;
    }

    bool startAsync(const uint8_t *data, size_t len) override {
        _next = data;
        _left = len;
        return pump();
    }

    bool pump() {
        size_t n = _left > 0xFFFFu ? 0xFFFFu : _left;
        DMA_Channel_TypeDef *ch = channel();
        DMA_Cmd(ch, DISABLE);
        DMA_DeInit(ch);
        DMA_InitTypeDef cfg;
        DMA_StructInit(&cfg);
        cfg.DMA_PeripheralBaseAddr = (uint32_t)(uintptr_t)&g_wchSpi->DATAR;
        cfg.DMA_MemoryBaseAddr = (uint32_t)(uintptr_t)_next;
        cfg.DMA_DIR = DMA_DIR_PeripheralDST;
        cfg.DMA_BufferSize = (uint16_t)n;
        cfg.DMA_PeripheralInc = DMA_PeripheralInc_Disable;
        cfg.DMA_MemoryInc = DMA_MemoryInc_Enable;
        cfg.DMA_PeripheralDataSize = DMA_PeripheralDataSize_Byte;
        cfg.DMA_MemoryDataSize = DMA_MemoryDataSize_Byte;
        cfg.DMA_Mode = DMA_Mode_Normal;
        cfg.DMA_Priority = DMA_Priority_High;
        cfg.DMA_M2M = DMA_M2M_Disable;
        DMA_Init(ch, &cfg);
        DMA_ClearFlag(tcFlag());
        SPI_I2S_DMACmd(g_wchSpi, SPI_I2S_DMAReq_Tx, ENABLE);
        DMA_Cmd(ch, ENABLE);
        _next += n;
        _left -= n;
        _running = true;
        return true;
    }

    bool waitChunk() {
        uint32_t spins = 0;
        while (DMA_GetFlagStatus(tcFlag()) == RESET) {
            if (++spins > LUCARNE_WCH_SPI_SPIN_LIMIT)
                return false;
        }
        DMA_ClearFlag(tcFlag());
        return true;
    }

    void endChunk() {
        while (SPI_I2S_GetFlagStatus(g_wchSpi, SPI_I2S_FLAG_TXE) == RESET) {
        }
        while (SPI_I2S_GetFlagStatus(g_wchSpi, SPI_I2S_FLAG_BSY) == SET) {
        }
        DMA_Cmd(channel(), DISABLE);
        SPI_I2S_DMACmd(g_wchSpi, SPI_I2S_DMAReq_Tx, DISABLE);
        (void)g_wchSpi->DATAR;
        (void)g_wchSpi->STATR;
    }

    void finishAsync() override {
        if (!_running)
            return;
        while (true) {
            bool ok = waitChunk();
            endChunk();
            if (!ok || _left == 0)
                break;
            pump();
        }
        _left = 0;
        _running = false;
    }

    bool asyncRunning() const override {
        if (!_running)
            return false;
        return _left > 0 || DMA_GetFlagStatus(tcFlag()) == RESET;
    }

    const uint8_t *_next = nullptr;
    size_t _left = 0;
    bool _running = false;
    bool _clock = false;
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

static FlushBackendWch g_flushWch;

void halWchSetSpi(void *spiInstance) {
    g_flushWch.waitIdle();
#if LUCARNE_WCH_SPI_DMA
    g_wchSpi = spiInstance ? (SPI_TypeDef *)spiInstance : SPI1;
#else
    g_wchSpi = spiInstance;
#endif
    halRefreshCaps();
}

void halRegisterWchBackends(FlushBackend **flush, BlitBackend **blit, HwCaps *caps) {
    *flush = &g_flushWch;
    *blit = nullptr;
    caps->flags |= (uint32_t)kCapBlitFill | (uint32_t)kCapBlitMemCopy;
#if LUCARNE_WCH_SPI_DMA
    if (g_wchSpi)
        caps->flags |= (uint32_t)kCapFlushDmaSpi | (uint32_t)kCapFlushAsync;
#endif
#if LUCARNE_WCH_CH32H
    if (halLtdcFramebuffer().pixels)
        caps->flags |= (uint32_t)kCapDisplayLtdc;
#endif
}

}
