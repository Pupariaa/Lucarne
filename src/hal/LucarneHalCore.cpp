#include "LucarneHal.h"
#include "LucarneBlitBackend.h"
#include "LucarneFlushBackend.h"
#include "LucarneImageCodecBackend.h"
#include "LucarneHalConfig.h"
#include <string.h>
#if defined(ESP32) && defined(ARDUINO)
#include <Arduino.h>
#endif

namespace lucarne {

static HalProfile g_profile;
static HwCaps g_caps;
static bool g_inited = false;

#if defined(LUCARNE_HAL_BACKEND_ESP_IDF)
void halRegisterEspIdfBackends(FlushBackend **flush, ImageCodecBackend **codec, HwCaps *caps);
#elif defined(LUCARNE_HAL_BACKEND_STM32CUBE)
void halRegisterStm32CubeBackends(FlushBackend **flush, BlitBackend **blit, ImageCodecBackend **codec, HwCaps *caps);
#elif defined(LUCARNE_HAL_BACKEND_WCH)
void halRegisterWchBackends(FlushBackend **flush, BlitBackend **blit, HwCaps *caps);
#else
void halRegisterArduinoBackends(FlushBackend **flush, HwCaps *caps);
#endif

class ImageCodecBackendSw : public ImageCodecBackend {
  public:
    bool decodeJpegToRgb565(const uint8_t *data, size_t len, JpegDecodeResult &out) override {
        (void)data;
        (void)len;
        out = JpegDecodeResult();
        return false;
    }
    void releaseDecode(JpegDecodeResult &out) override { (void)out; }
};

static ImageCodecBackendSw g_codecSw;
static FlushBackend *g_flush = nullptr;
static ImageCodecBackend *g_codec = nullptr;
static BlitBackend *g_blit = nullptr;

static HwCaps detectCaps(const HalProfile &profile) {
    HwCaps c;
    if (profile.capsOverride)
        c.flags = profile.capsOverride;
#if defined(LUCARNE_HAL_BACKEND_ESP_IDF)
    halRegisterEspIdfBackends(&g_flush, &g_codec, &c);
#elif defined(LUCARNE_HAL_BACKEND_STM32CUBE)
    halRegisterStm32CubeBackends(&g_flush, &g_blit, &g_codec, &c);
#elif defined(LUCARNE_HAL_BACKEND_WCH)
    halRegisterWchBackends(&g_flush, &g_blit, &c);
#else
    halRegisterArduinoBackends(&g_flush, &c);
#endif
    if (profile.uiProfile == UiProfile::Tiny) {
        c.flags &= ~(uint32_t)(kCapBlitRotate90 | kCap2dPpa | kCapJpegDecode);
    }
    return c;
}

void halInit(const HalProfile &profile) {
    g_profile = profile;
    if (g_profile.stripeLines == 0)
        g_profile.stripeLines = LUCARNE_HAL_STRIPE_LINES;
#if defined(ESP32) && defined(ARDUINO)
    if ((g_profile.uiProfile == UiProfile::Psram || g_profile.uiProfile == UiProfile::MipiHighRes) && !psramFound()) {
        g_profile.uiProfile = UiProfile::LowRam;
    }
#endif
    if (g_profile.uiProfile == UiProfile::Tiny || g_profile.uiProfile == UiProfile::LowRam) {
        g_profile.allowRichTransitions = false;
        g_profile.preferRichTransitions = false;
    }
    g_caps = detectCaps(g_profile);
    if (!g_codec)
        g_codec = &g_codecSw;
    g_inited = true;
}

void halRefreshCaps() {
    if (!g_inited)
        return;
    g_caps = detectCaps(g_profile);
    if (!g_codec)
        g_codec = &g_codecSw;
}

const HwCaps &halCaps() {
    if (!g_inited)
        halInit(HalProfile());
    return g_caps;
}

const HalProfile &halActiveProfile() {
    if (!g_inited)
        halInit(HalProfile());
    return g_profile;
}

FlushBackend *halFlushBackend() {
    if (!g_inited)
        halInit(HalProfile());
    return g_flush;
}

BlitBackend *halBlitBackend() {
    if (!g_inited)
        halInit(HalProfile());
    return g_blit ? g_blit : halBlitBackendSw();
}

ImageCodecBackend *halImageCodecBackend() {
    if (!g_inited)
        halInit(HalProfile());
    return g_codec;
}

bool halFlushRgb565Region(int16_t x, int16_t y, int16_t w, int16_t h, int16_t srcStride,
                          const uint16_t *srcPixels, SpiFlushContext *spiCtx) {
    FlushBackend *fb = halFlushBackend();
    if (fb && spiCtx) {
        fb->bindSpiFlush(spiCtx);
        if (fb->submitRgb565Rows(x, y, w, h, srcStride, srcPixels))
            return true;
    }
    if (!srcPixels || w <= 0 || h <= 0)
        return false;
    for (int16_t row = 0; row < h; row++) {
        const uint16_t *src = srcPixels + (int32_t)row * srcStride;
        if (spiCtx && spiCtx->beginWindow && spiCtx->writePixels && spiCtx->endWindow) {
            if (row == 0)
                spiCtx->beginWindow(spiCtx->user, x, y, w, h);
            const uint8_t *bytes = (const uint8_t *)src;
            size_t rowBytes = (size_t)w * 2;
            if (!spiCtx->dmaSafeSrc && spiCtx->stagingLine && spiCtx->stagingLineBytes >= rowBytes) {
                memcpy(spiCtx->stagingLine, src, rowBytes);
                bytes = (const uint8_t *)spiCtx->stagingLine;
            }
            spiCtx->writePixels(spiCtx->user, bytes, rowBytes);
        }
    }
    if (spiCtx && spiCtx->endWindow)
        spiCtx->endWindow(spiCtx->user);
    return true;
}

void halFlushWait() {
    FlushBackend *fb = halFlushBackend();
    if (fb)
        fb->waitIdle();
}

static LtdcFramebuffer g_ltdc;

void halSetLtdcFramebuffer(uint16_t *pixels, int16_t width, int16_t height, int16_t stride, bool swapBytes) {
    if (g_inited)
        halFlushWait();
    g_ltdc.pixels = pixels;
    g_ltdc.width = pixels ? width : 0;
    g_ltdc.height = pixels ? height : 0;
    g_ltdc.stride = pixels ? (stride > 0 ? stride : width) : 0;
    g_ltdc.swapBytes = swapBytes;
    halRefreshCaps();
}

const LtdcFramebuffer &halLtdcFramebuffer() { return g_ltdc; }

bool halLtdcCopyRows(int16_t x, int16_t y, int16_t w, int16_t h, int16_t srcStride, const uint16_t *srcPixels) {
    if (!g_ltdc.pixels || !srcPixels || w <= 0 || h <= 0)
        return false;
    if (x < 0 || y < 0 || x + w > g_ltdc.width || y + h > g_ltdc.height)
        return false;
    for (int16_t row = 0; row < h; row++) {
        const uint16_t *src = srcPixels + (int32_t)row * srcStride;
        uint16_t *dst = g_ltdc.pixels + (int32_t)(y + row) * g_ltdc.stride + x;
        if (g_ltdc.swapBytes) {
            for (int16_t col = 0; col < w; col++)
                dst[col] = (uint16_t)((src[col] << 8) | (src[col] >> 8));
        } else {
            memcpy(dst, src, (size_t)w * 2);
        }
    }
    return true;
}

}
