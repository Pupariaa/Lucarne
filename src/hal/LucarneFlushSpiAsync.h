#ifndef LUCARNE_FLUSH_SPI_ASYNC_H
#define LUCARNE_FLUSH_SPI_ASYNC_H

#include "LucarneFlushBackend.h"
#include "LucarneHwCaps.h"
#include <string.h>

#if defined(ARDUINO)
#include <Arduino.h>
#endif

#if defined(__has_include)
#if defined(ESP32) && __has_include(<driver/spi_master.h>) && !defined(LUCARNE_DISABLE_ASYNC_FLUSH)
#include <driver/spi_master.h>
#include <esp_idf_version.h>
#include <SPI.h>
#if ESP_IDF_VERSION_MAJOR >= 5 && __has_include(<hal/spi_ll.h>) && !CONFIG_IDF_TARGET_ESP32
#include <hal/spi_ll.h>
#define LUCARNE_ESP32_SPI_LL 1
#endif
#define LUCARNE_ASYNC_ESP32 1
#endif
#if defined(ARDUINO_ARCH_RP2040) && __has_include(<hardware/dma.h>) && __has_include(<hardware/spi.h>) && \
    !defined(LUCARNE_DISABLE_ASYNC_FLUSH)
#include <hardware/dma.h>
#include <hardware/spi.h>
#define LUCARNE_ASYNC_RP2040 1
#endif
#if defined(ESP32) && __has_include(<driver/ppa.h>)
#define LUCARNE_HAS_PPA_DRIVER 1
#endif
#endif

#ifndef LUCARNE_ASYNC_ESP32
#define LUCARNE_ASYNC_ESP32 0
#endif
#ifndef LUCARNE_ASYNC_RP2040
#define LUCARNE_ASYNC_RP2040 0
#endif
#ifndef LUCARNE_HAS_PPA_DRIVER
#define LUCARNE_HAS_PPA_DRIVER 0
#endif

#define LUCARNE_SPI_ASYNC (LUCARNE_ASYNC_ESP32 || LUCARNE_ASYNC_RP2040)

#ifndef LUCARNE_ESP32_DMA_CHUNK
#define LUCARNE_ESP32_DMA_CHUNK 32000
#endif

#ifndef LUCARNE_ESP32_DMA_QUEUE
#define LUCARNE_ESP32_DMA_QUEUE 4
#endif

namespace lucarne {

class FlushBackendSpiDma : public FlushBackend {
  public:
    void bindSpiFlush(SpiFlushContext *ctx) override {
        if (_ctx != ctx) waitIdle();
        _ctx = ctx;
    }

    bool submitRgb565Rows(int16_t x, int16_t y, int16_t w, int16_t h, int16_t srcStride,
                          const uint16_t *srcPixels) override {
        if (!_ctx || !_ctx->beginWindow || !_ctx->writePixels || !_ctx->endWindow || !srcPixels)
            return false;
        waitIdle();
        size_t rowBytes = (size_t)w * 2;
        bool contiguous = srcStride == w;
        if (contiguous && _ctx->dmaSafeSrc && _ctx->allowAsync && asyncReady()) {
            _ctx->beginWindow(_ctx->user, x, y, w, h);
            if (startAsync((const uint8_t *)srcPixels, rowBytes * (size_t)h)) {
                _pending = true;
                return true;
            }
            _ctx->writePixels(_ctx->user, (const uint8_t *)srcPixels, rowBytes * (size_t)h);
            _ctx->endWindow(_ctx->user);
            return true;
        }
        _ctx->beginWindow(_ctx->user, x, y, w, h);
        if (contiguous && _ctx->dmaSafeSrc) {
            _ctx->writePixels(_ctx->user, (const uint8_t *)srcPixels, rowBytes * (size_t)h);
            _ctx->endWindow(_ctx->user);
            return true;
        }
        for (int16_t row = 0; row < h; row++) {
            const uint16_t *src = srcPixels + (int32_t)row * srcStride;
            const uint8_t *bytes = (const uint8_t *)src;
            if (!_ctx->dmaSafeSrc && _ctx->stagingLine && _ctx->stagingLineBytes >= rowBytes) {
                memcpy(_ctx->stagingLine, src, rowBytes);
                bytes = (const uint8_t *)_ctx->stagingLine;
            }
            _ctx->writePixels(_ctx->user, bytes, rowBytes);
        }
        _ctx->endWindow(_ctx->user);
        return true;
    }

    void waitIdle() override {
        if (!_pending) return;
        finishAsync();
        _pending = false;
        if (_ctx && _ctx->endWindow) _ctx->endWindow(_ctx->user);
    }

    bool isBusy() const override {
        if (!_pending) return false;
        return asyncRunning();
    }

  protected:
    virtual bool asyncReady() = 0;
    virtual bool startAsync(const uint8_t *data, size_t len) = 0;
    virtual void finishAsync() = 0;
    virtual bool asyncRunning() const = 0;

    SpiFlushContext *_ctx = nullptr;
    bool _pending = false;
};

class FlushBackendSpiAsync : public FlushBackendSpiDma {
  public:
    bool supportsAsync() const override { return LUCARNE_SPI_ASYNC; }

  protected:
#if LUCARNE_ASYNC_ESP32
    bool asyncReady() override {
        if (_espFailed || _ctx->spi != (void *)&SPI) return false;
        if (_espDev && _espSclk == _ctx->pinSclk && _espMosi == _ctx->pinMosi && _espHz == _ctx->spiHz &&
            _espMode == _ctx->spiMode)
            return true;
        return espInit();
    }

    spi_host_device_t espHost() const {
#if CONFIG_IDF_TARGET_ESP32
        return SPI3_HOST;
#else
        return SPI2_HOST;
#endif
    }

    bool espInit() {
        if (_espDev) {
            spi_bus_remove_device(_espDev);
            _espDev = nullptr;
        }
        if (_ctx->pinSclk < 0 || _ctx->pinMosi < 0 || _ctx->spiHz == 0) {
            _espFailed = true;
            return false;
        }
        if (!_espBus) {
            spi_bus_config_t bus;
            memset(&bus, 0, sizeof(bus));
            bus.mosi_io_num = _ctx->pinMosi;
            bus.miso_io_num = -1;
            bus.sclk_io_num = _ctx->pinSclk;
            bus.quadwp_io_num = -1;
            bus.quadhd_io_num = -1;
            bus.max_transfer_sz = LUCARNE_ESP32_DMA_CHUNK + 8;
            bus.flags = SPICOMMON_BUSFLAG_MASTER;
            esp_err_t err = spi_bus_initialize(espHost(), &bus, SPI_DMA_CH_AUTO);
            if (err != ESP_OK && err != ESP_ERR_INVALID_STATE) {
                _espFailed = true;
                return false;
            }
            _espBus = true;
        }
        spi_device_interface_config_t dev;
        memset(&dev, 0, sizeof(dev));
        dev.mode = _ctx->spiMode & 3;
        dev.clock_speed_hz = (int)_ctx->spiHz;
        dev.spics_io_num = -1;
        dev.queue_size = LUCARNE_ESP32_DMA_QUEUE;
        dev.flags = SPI_DEVICE_NO_DUMMY;
        if (spi_bus_add_device(espHost(), &dev, &_espDev) != ESP_OK) {
            _espDev = nullptr;
            _espFailed = true;
            return false;
        }
        _espSclk = _ctx->pinSclk;
        _espMosi = _ctx->pinMosi;
        _espHz = _ctx->spiHz;
        _espMode = _ctx->spiMode;
        return true;
    }

    bool startAsync(const uint8_t *data, size_t len) override {
        _espQueued = 0;
        _espNext = data;
        _espLeft = len;
        while (_espLeft > 0 && _espQueued < LUCARNE_ESP32_DMA_QUEUE) {
            if (!queueChunk()) {
                if (_espQueued == 0) return false;
                break;
            }
        }
        return true;
    }

    bool queueChunk() {
        size_t n = _espLeft > LUCARNE_ESP32_DMA_CHUNK ? LUCARNE_ESP32_DMA_CHUNK : _espLeft;
        spi_transaction_t *t = &_espTrans[_espSlot];
        memset(t, 0, sizeof(*t));
        t->length = n * 8;
        t->tx_buffer = _espNext;
        if (spi_device_queue_trans(_espDev, t, portMAX_DELAY) != ESP_OK) return false;
        _espSlot = (uint8_t)((_espSlot + 1) % LUCARNE_ESP32_DMA_QUEUE);
        _espQueued++;
        _espNext += n;
        _espLeft -= n;
        return true;
    }

    void finishAsync() override {
        while (_espQueued > 0) {
            spi_transaction_t *done = nullptr;
            if (spi_device_get_trans_result(_espDev, &done, portMAX_DELAY) != ESP_OK) break;
            _espQueued--;
            if (_espLeft > 0) queueChunk();
        }
        _espQueued = 0;
        _espLeft = 0;
#if defined(LUCARNE_ESP32_SPI_LL)
        spi_ll_dma_tx_enable(SPI_LL_GET_HW(espHost()), false);
#endif
    }

    bool asyncRunning() const override { return _espQueued > 0 || _espLeft > 0; }

    spi_device_handle_t _espDev = nullptr;
    spi_transaction_t _espTrans[LUCARNE_ESP32_DMA_QUEUE];
    const uint8_t *_espNext = nullptr;
    size_t _espLeft = 0;
    uint8_t _espQueued = 0;
    uint8_t _espSlot = 0;
    bool _espBus = false;
    bool _espFailed = false;
    int8_t _espSclk = -1;
    int8_t _espMosi = -1;
    uint32_t _espHz = 0;
    uint8_t _espMode = 0;
#elif LUCARNE_ASYNC_RP2040
    spi_inst_t *rpSpi() const { return (((uint8_t)_ctx->pinSclk >> 3) & 1u) ? spi1 : spi0; }

    bool asyncReady() override {
        if (_rpFailed || _ctx->pinSclk < 0) return false;
        if (_rpCh < 0) {
            _rpCh = dma_claim_unused_channel(false);
            if (_rpCh < 0) {
                _rpFailed = true;
                return false;
            }
        }
        return true;
    }

    bool startAsync(const uint8_t *data, size_t len) override {
        spi_inst_t *spi = rpSpi();
        _rpSpi = spi;
        dma_channel_config c = dma_channel_get_default_config((uint)_rpCh);
        channel_config_set_transfer_data_size(&c, DMA_SIZE_8);
        channel_config_set_read_increment(&c, true);
        channel_config_set_write_increment(&c, false);
        channel_config_set_dreq(&c, spi_get_dreq(spi, true));
        dma_channel_configure((uint)_rpCh, &c, &spi_get_hw(spi)->dr, data, (uint)len, true);
        return true;
    }

    void finishAsync() override {
        if (_rpCh < 0 || !_rpSpi) return;
        dma_channel_wait_for_finish_blocking((uint)_rpCh);
        while (spi_is_busy(_rpSpi)) {
        }
        while (spi_is_readable(_rpSpi)) (void)spi_get_hw(_rpSpi)->dr;
        spi_get_hw(_rpSpi)->icr = SPI_SSPICR_RORIC_BITS;
    }

    bool asyncRunning() const override {
        if (_rpCh < 0) return false;
        if (dma_channel_is_busy((uint)_rpCh)) return true;
        return _rpSpi && spi_is_busy(_rpSpi);
    }

    int _rpCh = -1;
    spi_inst_t *_rpSpi = nullptr;
    bool _rpFailed = false;
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

inline FlushBackendSpiAsync &flushSpiAsyncBackend() {
    static FlushBackendSpiAsync instance;
    return instance;
}

inline void halAddSpiAsyncCaps(HwCaps *caps) {
#if LUCARNE_SPI_ASYNC
    caps->flags |= (uint32_t)kCapFlushDmaSpi | (uint32_t)kCapFlushAsync;
#else
    (void)caps;
#endif
}

}

#endif
