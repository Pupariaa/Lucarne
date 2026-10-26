#if defined(ESP32)
#include "soc/soc_caps.h"
#endif

#if defined(SOC_MIPI_DSI_SUPPORTED) && SOC_MIPI_DSI_SUPPORTED

#include <string.h>
#include <esp_lcd_mipi_dsi.h>
#include <esp_lcd_panel_ops.h>
#include <freertos/FreeRTOS.h>
#include <freertos/semphr.h>
#include "../../LucarneHal.h"
#include "../../LucarneHwCaps.h"

#if defined(__has_include)
#if __has_include(<driver/ppa.h>)
#include <driver/ppa.h>
#define LUCARNE_HAS_PPA 1
#endif
#endif

namespace lucarne {

static esp_lcd_panel_handle_t g_mipiPanel = nullptr;
static SemaphoreHandle_t g_mipiDone = nullptr;
static volatile bool g_mipiPending = false;

static bool IRAM_ATTR mipiColorTransDone(esp_lcd_panel_handle_t panel, esp_lcd_dpi_panel_event_data_t *edata,
                                         void *user) {
    (void)panel;
    (void)edata;
    (void)user;
    BaseType_t woken = pdFALSE;
    if (g_mipiDone)
        xSemaphoreGiveFromISR(g_mipiDone, &woken);
    return woken == pdTRUE;
}

bool halMipiBindPanel(void *panel) {
    g_mipiPanel = (esp_lcd_panel_handle_t)panel;
    g_mipiPending = false;
    if (!g_mipiPanel)
        return false;
    if (!g_mipiDone)
        g_mipiDone = xSemaphoreCreateBinary();
    if (!g_mipiDone)
        return false;
    esp_lcd_dpi_panel_event_callbacks_t cbs = {};
    cbs.on_color_trans_done = mipiColorTransDone;
    return esp_lcd_dpi_panel_register_event_callbacks(g_mipiPanel, &cbs, nullptr) == ESP_OK;
}

void halMipiWait() {
    if (!g_mipiPending)
        return;
    if (g_mipiDone)
        xSemaphoreTake(g_mipiDone, pdMS_TO_TICKS(200));
    g_mipiPending = false;
}

bool halMipiBusy() { return g_mipiPending; }

bool halMipiDraw(int16_t x0, int16_t y0, int16_t x1, int16_t y1, const void *pixels) {
    if (!g_mipiPanel || !pixels || x1 <= x0 || y1 <= y0)
        return false;
    halMipiWait();
    if (g_mipiDone)
        xSemaphoreTake(g_mipiDone, 0);
    if (esp_lcd_panel_draw_bitmap(g_mipiPanel, x0, y0, x1, y1, pixels) != ESP_OK)
        return false;
    g_mipiPending = g_mipiDone != nullptr;
    return true;
}

#if defined(LUCARNE_HAS_PPA)
static ppa_client_handle_t g_ppaSrm = nullptr;
static bool g_ppaFailed = false;

static bool ppaEnsure() {
    if (g_ppaSrm)
        return true;
    if (g_ppaFailed)
        return false;
    ppa_client_config_t cfg = {};
    cfg.oper_type = PPA_OPERATION_SRM;
    cfg.max_pending_trans_num = 1;
    if (ppa_register_client(&cfg, &g_ppaSrm) != ESP_OK) {
        g_ppaSrm = nullptr;
        g_ppaFailed = true;
        return false;
    }
    return true;
}
#endif

bool halRotateBlock565(const uint16_t *pic, int16_t picW, int16_t picH, int16_t bx, int16_t by, int16_t bw,
                       int16_t bh, uint16_t *dst, size_t dstBytes, uint8_t rotation) {
#if defined(LUCARNE_HAS_PPA)
    if (!pic || !dst || bw <= 0 || bh <= 0 || rotation == 0)
        return false;
    if (!halActiveProfile().preferHwRotate || !halCaps().has(kCap2dPpa))
        return false;
    if (((uintptr_t)dst & 63u) != 0 || (dstBytes & 63u) != 0)
        return false;
    if (!ppaEnsure())
        return false;
    ppa_srm_oper_config_t op = {};
    op.in.buffer = pic;
    op.in.pic_w = (uint32_t)picW;
    op.in.pic_h = (uint32_t)picH;
    op.in.block_w = (uint32_t)bw;
    op.in.block_h = (uint32_t)bh;
    op.in.block_offset_x = (uint32_t)bx;
    op.in.block_offset_y = (uint32_t)by;
    op.in.srm_cm = PPA_SRM_COLOR_MODE_RGB565;
    op.out.buffer = dst;
    op.out.buffer_size = (uint32_t)dstBytes;
    bool quarter = rotation == 1 || rotation == 3;
    op.out.pic_w = (uint32_t)(quarter ? bh : bw);
    op.out.pic_h = (uint32_t)(quarter ? bw : bh);
    op.out.block_offset_x = 0;
    op.out.block_offset_y = 0;
    op.out.srm_cm = PPA_SRM_COLOR_MODE_RGB565;
    switch (rotation) {
    case 1:
        op.rotation_angle = PPA_SRM_ROTATION_ANGLE_270;
        break;
    case 2:
        op.rotation_angle = PPA_SRM_ROTATION_ANGLE_180;
        break;
    default:
        op.rotation_angle = PPA_SRM_ROTATION_ANGLE_90;
        break;
    }
    op.scale_x = 1.0f;
    op.scale_y = 1.0f;
    op.mirror_x = false;
    op.mirror_y = false;
    op.rgb_swap = false;
    op.byte_swap = false;
    op.mode = PPA_TRANS_MODE_BLOCKING;
    return ppa_do_scale_rotate_mirror(g_ppaSrm, &op) == ESP_OK;
#else
    (void)pic;
    (void)picW;
    (void)picH;
    (void)bx;
    (void)by;
    (void)bw;
    (void)bh;
    (void)dst;
    (void)dstBytes;
    (void)rotation;
    return false;
#endif
}

}

#endif
