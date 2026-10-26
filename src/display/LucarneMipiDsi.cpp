#include "LucarneMipiDsi.h"

// soc/soc_caps.h (and the SOC_MIPI_DSI_SUPPORTED macro it defines) only exists
// in the ESP-IDF/ESP32 Arduino core. Arduino/PlatformIO build every .cpp under
// src/ as its own translation unit regardless of what Lucarne.h includes, so
// this file must stay includable (and become a no-op) on AVR, ESP8266, RP2040
// and any other non-ESP32 target.
#if defined(ESP32)
#include "soc/soc_caps.h"
#endif

#if SOC_MIPI_DSI_SUPPORTED

#include <Arduino.h>
#include <cstring>
#include <driver/i2c_master.h>
#include <esp_heap_caps.h>
#include <esp_lcd_mipi_dsi.h>
#include <esp_lcd_panel_commands.h>
#include <esp_lcd_panel_io.h>
#include <esp_lcd_panel_ops.h>
#include <esp_ldo_regulator.h>
#include <freertos/FreeRTOS.h>
#include <freertos/task.h>
#include "../hal/LucarneHal.h"
#include "../core/LucarneRenderConfig.h"

namespace lucarne {

struct Hx8394InitCmd {
  int cmd;
  const uint8_t *data;
  size_t dataBytes;
  unsigned int delayMs;
};

static const Hx8394InitCmd kHx8394Init[] = {
    {0xB9, (const uint8_t[]){0xFF, 0x83, 0x94}, 3, 0},
    {0xB1, (const uint8_t[]){0x48, 0x0A, 0x6A, 0x09, 0x33, 0x54, 0x71, 0x71, 0x2E, 0x45}, 10, 0},
    {0xBA, (const uint8_t[]){0x61, 0x03, 0x68, 0x6B, 0xB2, 0xC0}, 6, 0},
    {0xB2, (const uint8_t[]){0x00, 0x80, 0x64, 0x0C, 0x06, 0x2F}, 6, 0},
    {0xB4, (const uint8_t[]){0x1C, 0x78, 0x1C, 0x78, 0x1C, 0x78, 0x01, 0x0C, 0x86, 0x75, 0x00, 0x3F, 0x1C, 0x78, 0x1C, 0x78, 0x1C, 0x78, 0x01, 0x0C, 0x86}, 21, 0},
    {0xD3, (const uint8_t[]){0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x08, 0x08, 0x32, 0x10, 0x05, 0x00, 0x05, 0x32, 0x13, 0xC1, 0x00, 0x01, 0x32, 0x10, 0x08, 0x00, 0x00, 0x37, 0x03, 0x07, 0x07, 0x37, 0x05, 0x05, 0x37, 0x0C, 0x40}, 33, 0},
    {0xD5, (const uint8_t[]){0x18, 0x18, 0x18, 0x18, 0x22, 0x23, 0x20, 0x21, 0x04, 0x05, 0x06, 0x07, 0x00, 0x01, 0x02, 0x03, 0x18, 0x18, 0x18, 0x18, 0x18, 0x18, 0x18, 0x18, 0x18, 0x18, 0x18, 0x18, 0x18, 0x18, 0x18, 0x18, 0x18, 0x18, 0x18, 0x18, 0x18, 0x18, 0x18, 0x18, 0x19, 0x19, 0x19, 0x19}, 44, 0},
    {0xD6, (const uint8_t[]){0x18, 0x18, 0x19, 0x19, 0x21, 0x20, 0x23, 0x22, 0x03, 0x02, 0x01, 0x00, 0x07, 0x06, 0x05, 0x04, 0x18, 0x18, 0x18, 0x18, 0x18, 0x18, 0x18, 0x18, 0x18, 0x18, 0x18, 0x18, 0x18, 0x18, 0x18, 0x18, 0x18, 0x18, 0x18, 0x18, 0x18, 0x18, 0x18, 0x18, 0x19, 0x19, 0x18, 0x18}, 44, 0},
    {0xE0, (const uint8_t[]){0x07, 0x08, 0x09, 0x0D, 0x10, 0x14, 0x16, 0x13, 0x24, 0x36, 0x48, 0x4A, 0x58, 0x6F, 0x76, 0x80, 0x97, 0xA5, 0xA8, 0xB5, 0xC6, 0x62, 0x63, 0x68, 0x6F, 0x72, 0x78, 0x7F, 0x7F, 0x00, 0x02, 0x08, 0x0D, 0x0C, 0x0E, 0x0F, 0x10, 0x24, 0x36, 0x48, 0x4A, 0x58, 0x6F, 0x78, 0x82, 0x99, 0xA4, 0xA0, 0xB1, 0xC0, 0x5E, 0x5E, 0x64, 0x6B, 0x6C, 0x73, 0x7F, 0x7F}, 58, 0},
    {0xCC, (const uint8_t[]){0x0B}, 1, 0},
    {0xC0, (const uint8_t[]){0x1F, 0x73}, 2, 0},
    {0xB6, (const uint8_t[]){0x6B, 0x6B}, 2, 0},
    {0xD4, (const uint8_t[]){0x02}, 1, 0},
    {0xBD, (const uint8_t[]){0x01}, 1, 0},
    {0xB1, (const uint8_t[]){0x00}, 1, 0},
    {0xBD, (const uint8_t[]){0x00}, 1, 0},
    {0xBF, (const uint8_t[]){0x40, 0x81, 0x50, 0x00, 0x1A, 0xFC, 0x01}, 7, 0},
    {0x3A, (const uint8_t[]){0x50}, 1, 0},
    {0x11, nullptr, 0, 200},
    {0xB2, (const uint8_t[]){0x00, 0x80, 0x64, 0x0C, 0x06, 0x2F, 0x00, 0x00, 0x00, 0x00, 0xC0, 0x18}, 12, 0},
    {0x29, nullptr, 0, 80},
};

static const uint8_t kBlInitSeq[][2] = {{0x95, 0x11}, {0x95, 0x17}, {0x96, 0x00}, {0x96, 0xFF}};

// ILI9881C generic reference init (from Espressif's esp_lcd_ili9881c component,
// vendor_specific_init_default, Apache-2.0). Works for the common
// "ILI9881C-3lane-mipi-gramless" reference panel; some third-party ILI9881C
// modules ship different gamma/power tuning and may need their own table.
struct MipiInitCmd {
  int cmd;
  const uint8_t *data;
  size_t dataBytes;
  unsigned int delayMs;
};

static const MipiInitCmd kIli9881cInit[] = {
    /**** CMD_Page 3 ****/
    {0xFF, (const uint8_t[]){0x98, 0x81, 0x03}, 3, 0},
    {0x01, (const uint8_t[]){0x00}, 1, 0}, {0x02, (const uint8_t[]){0x00}, 1, 0},
    {0x03, (const uint8_t[]){0x53}, 1, 0}, {0x04, (const uint8_t[]){0x53}, 1, 0},
    {0x05, (const uint8_t[]){0x13}, 1, 0}, {0x06, (const uint8_t[]){0x04}, 1, 0},
    {0x07, (const uint8_t[]){0x02}, 1, 0}, {0x08, (const uint8_t[]){0x02}, 1, 0},
    {0x09, (const uint8_t[]){0x00}, 1, 0}, {0x0a, (const uint8_t[]){0x00}, 1, 0},
    {0x0b, (const uint8_t[]){0x00}, 1, 0}, {0x0c, (const uint8_t[]){0x00}, 1, 0},
    {0x0d, (const uint8_t[]){0x00}, 1, 0}, {0x0e, (const uint8_t[]){0x00}, 1, 0},
    {0x0f, (const uint8_t[]){0x00}, 1, 0}, {0x10, (const uint8_t[]){0x00}, 1, 0},
    {0x11, (const uint8_t[]){0x00}, 1, 0}, {0x12, (const uint8_t[]){0x00}, 1, 0},
    {0x13, (const uint8_t[]){0x00}, 1, 0}, {0x14, (const uint8_t[]){0x00}, 1, 0},
    {0x15, (const uint8_t[]){0x00}, 1, 0}, {0x16, (const uint8_t[]){0x00}, 1, 0},
    {0x17, (const uint8_t[]){0x00}, 1, 0}, {0x18, (const uint8_t[]){0x00}, 1, 0},
    {0x19, (const uint8_t[]){0x00}, 1, 0}, {0x1a, (const uint8_t[]){0x00}, 1, 0},
    {0x1b, (const uint8_t[]){0x00}, 1, 0}, {0x1c, (const uint8_t[]){0x00}, 1, 0},
    {0x1d, (const uint8_t[]){0x00}, 1, 0}, {0x1e, (const uint8_t[]){0xc0}, 1, 0},
    {0x1f, (const uint8_t[]){0x80}, 1, 0}, {0x20, (const uint8_t[]){0x02}, 1, 0},
    {0x21, (const uint8_t[]){0x09}, 1, 0}, {0x22, (const uint8_t[]){0x00}, 1, 0},
    {0x23, (const uint8_t[]){0x00}, 1, 0}, {0x24, (const uint8_t[]){0x00}, 1, 0},
    {0x25, (const uint8_t[]){0x00}, 1, 0}, {0x26, (const uint8_t[]){0x00}, 1, 0},
    {0x27, (const uint8_t[]){0x00}, 1, 0}, {0x28, (const uint8_t[]){0x55}, 1, 0},
    {0x29, (const uint8_t[]){0x03}, 1, 0}, {0x2a, (const uint8_t[]){0x00}, 1, 0},
    {0x2b, (const uint8_t[]){0x00}, 1, 0}, {0x2c, (const uint8_t[]){0x00}, 1, 0},
    {0x2d, (const uint8_t[]){0x00}, 1, 0}, {0x2e, (const uint8_t[]){0x00}, 1, 0},
    {0x2f, (const uint8_t[]){0x00}, 1, 0}, {0x30, (const uint8_t[]){0x00}, 1, 0},
    {0x31, (const uint8_t[]){0x00}, 1, 0}, {0x32, (const uint8_t[]){0x00}, 1, 0},
    {0x33, (const uint8_t[]){0x00}, 1, 0}, {0x34, (const uint8_t[]){0x00}, 1, 0},
    {0x35, (const uint8_t[]){0x00}, 1, 0}, {0x36, (const uint8_t[]){0x00}, 1, 0},
    {0x37, (const uint8_t[]){0x00}, 1, 0}, {0x38, (const uint8_t[]){0x3C}, 1, 0},
    {0x39, (const uint8_t[]){0x00}, 1, 0}, {0x3a, (const uint8_t[]){0x00}, 1, 0},
    {0x3b, (const uint8_t[]){0x00}, 1, 0}, {0x3c, (const uint8_t[]){0x00}, 1, 0},
    {0x3d, (const uint8_t[]){0x00}, 1, 0}, {0x3e, (const uint8_t[]){0x00}, 1, 0},
    {0x3f, (const uint8_t[]){0x00}, 1, 0}, {0x40, (const uint8_t[]){0x00}, 1, 0},
    {0x41, (const uint8_t[]){0x00}, 1, 0}, {0x42, (const uint8_t[]){0x00}, 1, 0},
    {0x43, (const uint8_t[]){0x00}, 1, 0}, {0x44, (const uint8_t[]){0x00}, 1, 0},
    {0x50, (const uint8_t[]){0x01}, 1, 0}, {0x51, (const uint8_t[]){0x23}, 1, 0},
    {0x52, (const uint8_t[]){0x45}, 1, 0}, {0x53, (const uint8_t[]){0x67}, 1, 0},
    {0x54, (const uint8_t[]){0x89}, 1, 0}, {0x55, (const uint8_t[]){0xab}, 1, 0},
    {0x56, (const uint8_t[]){0x01}, 1, 0}, {0x57, (const uint8_t[]){0x23}, 1, 0},
    {0x58, (const uint8_t[]){0x45}, 1, 0}, {0x59, (const uint8_t[]){0x67}, 1, 0},
    {0x5a, (const uint8_t[]){0x89}, 1, 0}, {0x5b, (const uint8_t[]){0xab}, 1, 0},
    {0x5c, (const uint8_t[]){0xcd}, 1, 0}, {0x5d, (const uint8_t[]){0xef}, 1, 0},
    {0x5e, (const uint8_t[]){0x01}, 1, 0}, {0x5f, (const uint8_t[]){0x08}, 1, 0},
    {0x60, (const uint8_t[]){0x02}, 1, 0}, {0x61, (const uint8_t[]){0x02}, 1, 0},
    {0x62, (const uint8_t[]){0x0A}, 1, 0}, {0x63, (const uint8_t[]){0x15}, 1, 0},
    {0x64, (const uint8_t[]){0x14}, 1, 0}, {0x65, (const uint8_t[]){0x02}, 1, 0},
    {0x66, (const uint8_t[]){0x11}, 1, 0}, {0x67, (const uint8_t[]){0x10}, 1, 0},
    {0x68, (const uint8_t[]){0x02}, 1, 0}, {0x69, (const uint8_t[]){0x0F}, 1, 0},
    {0x6a, (const uint8_t[]){0x0E}, 1, 0}, {0x6b, (const uint8_t[]){0x02}, 1, 0},
    {0x6c, (const uint8_t[]){0x0D}, 1, 0}, {0x6d, (const uint8_t[]){0x0C}, 1, 0},
    {0x6e, (const uint8_t[]){0x06}, 1, 0}, {0x6f, (const uint8_t[]){0x02}, 1, 0},
    {0x70, (const uint8_t[]){0x02}, 1, 0}, {0x71, (const uint8_t[]){0x02}, 1, 0},
    {0x72, (const uint8_t[]){0x02}, 1, 0}, {0x73, (const uint8_t[]){0x02}, 1, 0},
    {0x74, (const uint8_t[]){0x02}, 1, 0}, {0x75, (const uint8_t[]){0x06}, 1, 0},
    {0x76, (const uint8_t[]){0x02}, 1, 0}, {0x77, (const uint8_t[]){0x02}, 1, 0},
    {0x78, (const uint8_t[]){0x0A}, 1, 0}, {0x79, (const uint8_t[]){0x15}, 1, 0},
    {0x7a, (const uint8_t[]){0x14}, 1, 0}, {0x7b, (const uint8_t[]){0x02}, 1, 0},
    {0x7c, (const uint8_t[]){0x10}, 1, 0}, {0x7d, (const uint8_t[]){0x11}, 1, 0},
    {0x7e, (const uint8_t[]){0x02}, 1, 0}, {0x7f, (const uint8_t[]){0x0C}, 1, 0},
    {0x80, (const uint8_t[]){0x0D}, 1, 0}, {0x81, (const uint8_t[]){0x02}, 1, 0},
    {0x82, (const uint8_t[]){0x0E}, 1, 0}, {0x83, (const uint8_t[]){0x0F}, 1, 0},
    {0x84, (const uint8_t[]){0x08}, 1, 0}, {0x85, (const uint8_t[]){0x02}, 1, 0},
    {0x86, (const uint8_t[]){0x02}, 1, 0}, {0x87, (const uint8_t[]){0x02}, 1, 0},
    {0x88, (const uint8_t[]){0x02}, 1, 0}, {0x89, (const uint8_t[]){0x02}, 1, 0},
    {0x8A, (const uint8_t[]){0x02}, 1, 0},
    /**** CMD_Page 4 ****/
    {0xFF, (const uint8_t[]){0x98, 0x81, 0x04}, 3, 0},
    {0x6C, (const uint8_t[]){0x15}, 1, 0}, {0x6E, (const uint8_t[]){0x30}, 1, 0},
    {0x6F, (const uint8_t[]){0x33}, 1, 0}, {0x8D, (const uint8_t[]){0x1F}, 1, 0},
    {0x87, (const uint8_t[]){0xBA}, 1, 0}, {0x26, (const uint8_t[]){0x76}, 1, 0},
    {0xB2, (const uint8_t[]){0xD1}, 1, 0}, {0x35, (const uint8_t[]){0x1F}, 1, 0},
    {0x33, (const uint8_t[]){0x14}, 1, 0}, {0x3A, (const uint8_t[]){0xA9}, 1, 0},
    {0x3B, (const uint8_t[]){0x3D}, 1, 0}, {0x38, (const uint8_t[]){0x01}, 1, 0},
    {0x39, (const uint8_t[]){0x00}, 1, 0},
    /**** CMD_Page 1 ****/
    {0xFF, (const uint8_t[]){0x98, 0x81, 0x01}, 3, 0},
    {0x22, (const uint8_t[]){0x09}, 1, 0}, {0x31, (const uint8_t[]){0x00}, 1, 0},
    {0x40, (const uint8_t[]){0x53}, 1, 0}, {0x50, (const uint8_t[]){0xC0}, 1, 0},
    {0x51, (const uint8_t[]){0xC0}, 1, 0}, {0x53, (const uint8_t[]){0x47}, 1, 0},
    {0x55, (const uint8_t[]){0x46}, 1, 0}, {0x60, (const uint8_t[]){0x28}, 1, 0},
    {0x2E, (const uint8_t[]){0xC8}, 1, 0},
    {0xA0, (const uint8_t[]){0x01}, 1, 0}, {0xA1, (const uint8_t[]){0x10}, 1, 0},
    {0xA2, (const uint8_t[]){0x1B}, 1, 0}, {0xA3, (const uint8_t[]){0x0C}, 1, 0},
    {0xA4, (const uint8_t[]){0x14}, 1, 0}, {0xA5, (const uint8_t[]){0x25}, 1, 0},
    {0xA6, (const uint8_t[]){0x1A}, 1, 0}, {0xA7, (const uint8_t[]){0x1D}, 1, 0},
    {0xA8, (const uint8_t[]){0x68}, 1, 0}, {0xA9, (const uint8_t[]){0x1B}, 1, 0},
    {0xAA, (const uint8_t[]){0x26}, 1, 0}, {0xAB, (const uint8_t[]){0x5B}, 1, 0},
    {0xAC, (const uint8_t[]){0x1B}, 1, 0}, {0xAD, (const uint8_t[]){0x17}, 1, 0},
    {0xAE, (const uint8_t[]){0x4F}, 1, 0}, {0xAF, (const uint8_t[]){0x24}, 1, 0},
    {0xB0, (const uint8_t[]){0x2A}, 1, 0}, {0xB1, (const uint8_t[]){0x4E}, 1, 0},
    {0xB2, (const uint8_t[]){0x5F}, 1, 0}, {0xB3, (const uint8_t[]){0x39}, 1, 0},
    {0xC0, (const uint8_t[]){0x0F}, 1, 0}, {0xC1, (const uint8_t[]){0x1B}, 1, 0},
    {0xC2, (const uint8_t[]){0x27}, 1, 0}, {0xC3, (const uint8_t[]){0x16}, 1, 0},
    {0xC4, (const uint8_t[]){0x14}, 1, 0}, {0xC5, (const uint8_t[]){0x28}, 1, 0},
    {0xC6, (const uint8_t[]){0x1D}, 1, 0}, {0xC7, (const uint8_t[]){0x21}, 1, 0},
    {0xC8, (const uint8_t[]){0x6C}, 1, 0}, {0xC9, (const uint8_t[]){0x1B}, 1, 0},
    {0xCA, (const uint8_t[]){0x26}, 1, 0}, {0xCB, (const uint8_t[]){0x5B}, 1, 0},
    {0xCC, (const uint8_t[]){0x1B}, 1, 0}, {0xCD, (const uint8_t[]){0x1B}, 1, 0},
    {0xCE, (const uint8_t[]){0x4F}, 1, 0}, {0xCF, (const uint8_t[]){0x24}, 1, 0},
    {0xD0, (const uint8_t[]){0x2A}, 1, 0}, {0xD1, (const uint8_t[]){0x4E}, 1, 0},
    {0xD2, (const uint8_t[]){0x5F}, 1, 0}, {0xD3, (const uint8_t[]){0x39}, 1, 0},
    /**** CMD_Page 0 ****/
    {0xFF, (const uint8_t[]){0x98, 0x81, 0x00}, 3, 0},
    {0x35, (const uint8_t[]){0x00}, 1, 0},
    {0x29, nullptr, 0, 0},
};

// EK79007 default init (from Espressif's esp_lcd_ek79007 component,
// vendor_specific_init_default, Apache-2.0). This is the panel shipped on the
// official ESP32-P4-Function-EV-Board (1024x600).
static const MipiInitCmd kEk79007Init[] = {
    {0x80, (const uint8_t[]){0x8B}, 1, 0}, {0x81, (const uint8_t[]){0x78}, 1, 0},
    {0x82, (const uint8_t[]){0x84}, 1, 0}, {0x83, (const uint8_t[]){0x88}, 1, 0},
    {0x84, (const uint8_t[]){0xA8}, 1, 0}, {0x85, (const uint8_t[]){0xE3}, 1, 0},
    {0x86, (const uint8_t[]){0x88}, 1, 0},
    {0x11, nullptr, 0, 120},
};

// JD9365 default init (from Espressif's esp_lcd_jd9365 component,
// vendor_specific_init_default, Apache-2.0). Common on 800x1280 10.1" panels
// (e.g. Waveshare's ESP32-P4 10.1" MIPI touch display).
static const MipiInitCmd kJd9365Init[] = {
    {0xE0, (const uint8_t[]){0x00}, 1, 0},
    {0xE1, (const uint8_t[]){0x93}, 1, 0}, {0xE2, (const uint8_t[]){0x65}, 1, 0},
    {0xE3, (const uint8_t[]){0xF8}, 1, 0},
    {0xE0, (const uint8_t[]){0x01}, 1, 0},
    {0x00, (const uint8_t[]){0x00}, 1, 0}, {0x01, (const uint8_t[]){0x4E}, 1, 0},
    {0x03, (const uint8_t[]){0x00}, 1, 0}, {0x04, (const uint8_t[]){0x65}, 1, 0},
    {0x0C, (const uint8_t[]){0x74}, 1, 0},
    {0x17, (const uint8_t[]){0x00}, 1, 0}, {0x18, (const uint8_t[]){0xB7}, 1, 0},
    {0x19, (const uint8_t[]){0x00}, 1, 0}, {0x1A, (const uint8_t[]){0x00}, 1, 0},
    {0x1B, (const uint8_t[]){0xB7}, 1, 0}, {0x1C, (const uint8_t[]){0x00}, 1, 0},
    {0x24, (const uint8_t[]){0xFE}, 1, 0},
    {0x37, (const uint8_t[]){0x19}, 1, 0},
    {0x38, (const uint8_t[]){0x05}, 1, 0}, {0x39, (const uint8_t[]){0x00}, 1, 0},
    {0x3A, (const uint8_t[]){0x01}, 1, 0}, {0x3B, (const uint8_t[]){0x01}, 1, 0},
    {0x3C, (const uint8_t[]){0x70}, 1, 0}, {0x3D, (const uint8_t[]){0xFF}, 1, 0},
    {0x3E, (const uint8_t[]){0xFF}, 1, 0}, {0x3F, (const uint8_t[]){0xFF}, 1, 0},
    {0x40, (const uint8_t[]){0x06}, 1, 0}, {0x41, (const uint8_t[]){0xA0}, 1, 0},
    {0x43, (const uint8_t[]){0x1E}, 1, 0}, {0x44, (const uint8_t[]){0x0F}, 1, 0},
    {0x45, (const uint8_t[]){0x28}, 1, 0}, {0x4B, (const uint8_t[]){0x04}, 1, 0},
    {0x55, (const uint8_t[]){0x02}, 1, 0}, {0x56, (const uint8_t[]){0x01}, 1, 0},
    {0x57, (const uint8_t[]){0xA9}, 1, 0}, {0x58, (const uint8_t[]){0x0A}, 1, 0},
    {0x59, (const uint8_t[]){0x0A}, 1, 0}, {0x5A, (const uint8_t[]){0x37}, 1, 0},
    {0x5B, (const uint8_t[]){0x19}, 1, 0},
    {0x5D, (const uint8_t[]){0x78}, 1, 0}, {0x5E, (const uint8_t[]){0x63}, 1, 0},
    {0x5F, (const uint8_t[]){0x54}, 1, 0}, {0x60, (const uint8_t[]){0x49}, 1, 0},
    {0x61, (const uint8_t[]){0x45}, 1, 0}, {0x62, (const uint8_t[]){0x38}, 1, 0},
    {0x63, (const uint8_t[]){0x3D}, 1, 0}, {0x64, (const uint8_t[]){0x28}, 1, 0},
    {0x65, (const uint8_t[]){0x43}, 1, 0}, {0x66, (const uint8_t[]){0x41}, 1, 0},
    {0x67, (const uint8_t[]){0x43}, 1, 0}, {0x68, (const uint8_t[]){0x62}, 1, 0},
    {0x69, (const uint8_t[]){0x50}, 1, 0}, {0x6A, (const uint8_t[]){0x57}, 1, 0},
    {0x6B, (const uint8_t[]){0x49}, 1, 0}, {0x6C, (const uint8_t[]){0x44}, 1, 0},
    {0x6D, (const uint8_t[]){0x37}, 1, 0}, {0x6E, (const uint8_t[]){0x23}, 1, 0},
    {0x6F, (const uint8_t[]){0x10}, 1, 0}, {0x70, (const uint8_t[]){0x78}, 1, 0},
    {0x71, (const uint8_t[]){0x63}, 1, 0}, {0x72, (const uint8_t[]){0x54}, 1, 0},
    {0x73, (const uint8_t[]){0x49}, 1, 0}, {0x74, (const uint8_t[]){0x45}, 1, 0},
    {0x75, (const uint8_t[]){0x38}, 1, 0}, {0x76, (const uint8_t[]){0x3D}, 1, 0},
    {0x77, (const uint8_t[]){0x28}, 1, 0}, {0x78, (const uint8_t[]){0x43}, 1, 0},
    {0x79, (const uint8_t[]){0x41}, 1, 0}, {0x7A, (const uint8_t[]){0x43}, 1, 0},
    {0x7B, (const uint8_t[]){0x62}, 1, 0}, {0x7C, (const uint8_t[]){0x50}, 1, 0},
    {0x7D, (const uint8_t[]){0x57}, 1, 0}, {0x7E, (const uint8_t[]){0x49}, 1, 0},
    {0x7F, (const uint8_t[]){0x44}, 1, 0}, {0x80, (const uint8_t[]){0x37}, 1, 0},
    {0x81, (const uint8_t[]){0x23}, 1, 0}, {0x82, (const uint8_t[]){0x10}, 1, 0},
    {0xE0, (const uint8_t[]){0x02}, 1, 0},
    {0x00, (const uint8_t[]){0x47}, 1, 0}, {0x01, (const uint8_t[]){0x47}, 1, 0},
    {0x02, (const uint8_t[]){0x45}, 1, 0}, {0x03, (const uint8_t[]){0x45}, 1, 0},
    {0x04, (const uint8_t[]){0x4B}, 1, 0}, {0x05, (const uint8_t[]){0x4B}, 1, 0},
    {0x06, (const uint8_t[]){0x49}, 1, 0}, {0x07, (const uint8_t[]){0x49}, 1, 0},
    {0x08, (const uint8_t[]){0x41}, 1, 0}, {0x09, (const uint8_t[]){0x1F}, 1, 0},
    {0x0A, (const uint8_t[]){0x1F}, 1, 0}, {0x0B, (const uint8_t[]){0x1F}, 1, 0},
    {0x0C, (const uint8_t[]){0x1F}, 1, 0}, {0x0D, (const uint8_t[]){0x1F}, 1, 0},
    {0x0E, (const uint8_t[]){0x1F}, 1, 0}, {0x0F, (const uint8_t[]){0x5F}, 1, 0},
    {0x10, (const uint8_t[]){0x5F}, 1, 0}, {0x11, (const uint8_t[]){0x57}, 1, 0},
    {0x12, (const uint8_t[]){0x77}, 1, 0}, {0x13, (const uint8_t[]){0x35}, 1, 0},
    {0x14, (const uint8_t[]){0x1F}, 1, 0}, {0x15, (const uint8_t[]){0x1F}, 1, 0},
    {0x16, (const uint8_t[]){0x46}, 1, 0}, {0x17, (const uint8_t[]){0x46}, 1, 0},
    {0x18, (const uint8_t[]){0x44}, 1, 0}, {0x19, (const uint8_t[]){0x44}, 1, 0},
    {0x1A, (const uint8_t[]){0x4A}, 1, 0}, {0x1B, (const uint8_t[]){0x4A}, 1, 0},
    {0x1C, (const uint8_t[]){0x48}, 1, 0}, {0x1D, (const uint8_t[]){0x48}, 1, 0},
    {0x1E, (const uint8_t[]){0x40}, 1, 0}, {0x1F, (const uint8_t[]){0x1F}, 1, 0},
    {0x20, (const uint8_t[]){0x1F}, 1, 0}, {0x21, (const uint8_t[]){0x1F}, 1, 0},
    {0x22, (const uint8_t[]){0x1F}, 1, 0}, {0x23, (const uint8_t[]){0x1F}, 1, 0},
    {0x24, (const uint8_t[]){0x1F}, 1, 0}, {0x25, (const uint8_t[]){0x5F}, 1, 0},
    {0x26, (const uint8_t[]){0x5F}, 1, 0}, {0x27, (const uint8_t[]){0x57}, 1, 0},
    {0x28, (const uint8_t[]){0x77}, 1, 0}, {0x29, (const uint8_t[]){0x35}, 1, 0},
    {0x2A, (const uint8_t[]){0x1F}, 1, 0}, {0x2B, (const uint8_t[]){0x1F}, 1, 0},
    {0x58, (const uint8_t[]){0x40}, 1, 0}, {0x59, (const uint8_t[]){0x00}, 1, 0},
    {0x5A, (const uint8_t[]){0x00}, 1, 0}, {0x5B, (const uint8_t[]){0x10}, 1, 0},
    {0x5C, (const uint8_t[]){0x06}, 1, 0}, {0x5D, (const uint8_t[]){0x40}, 1, 0},
    {0x5E, (const uint8_t[]){0x01}, 1, 0}, {0x5F, (const uint8_t[]){0x02}, 1, 0},
    {0x60, (const uint8_t[]){0x30}, 1, 0}, {0x61, (const uint8_t[]){0x01}, 1, 0},
    {0x62, (const uint8_t[]){0x02}, 1, 0}, {0x63, (const uint8_t[]){0x03}, 1, 0},
    {0x64, (const uint8_t[]){0x6B}, 1, 0}, {0x65, (const uint8_t[]){0x05}, 1, 0},
    {0x66, (const uint8_t[]){0x0C}, 1, 0}, {0x67, (const uint8_t[]){0x73}, 1, 0},
    {0x68, (const uint8_t[]){0x09}, 1, 0}, {0x69, (const uint8_t[]){0x03}, 1, 0},
    {0x6A, (const uint8_t[]){0x56}, 1, 0}, {0x6B, (const uint8_t[]){0x08}, 1, 0},
    {0x6C, (const uint8_t[]){0x00}, 1, 0}, {0x6D, (const uint8_t[]){0x04}, 1, 0},
    {0x6E, (const uint8_t[]){0x04}, 1, 0}, {0x6F, (const uint8_t[]){0x88}, 1, 0},
    {0x70, (const uint8_t[]){0x00}, 1, 0}, {0x71, (const uint8_t[]){0x00}, 1, 0},
    {0x72, (const uint8_t[]){0x06}, 1, 0}, {0x73, (const uint8_t[]){0x7B}, 1, 0},
    {0x74, (const uint8_t[]){0x00}, 1, 0}, {0x75, (const uint8_t[]){0xF8}, 1, 0},
    {0x76, (const uint8_t[]){0x00}, 1, 0}, {0x77, (const uint8_t[]){0xD5}, 1, 0},
    {0x78, (const uint8_t[]){0x2E}, 1, 0}, {0x79, (const uint8_t[]){0x12}, 1, 0},
    {0x7A, (const uint8_t[]){0x03}, 1, 0}, {0x7B, (const uint8_t[]){0x00}, 1, 0},
    {0x7C, (const uint8_t[]){0x00}, 1, 0}, {0x7D, (const uint8_t[]){0x03}, 1, 0},
    {0x7E, (const uint8_t[]){0x7B}, 1, 0},
    {0xE0, (const uint8_t[]){0x04}, 1, 0},
    {0x00, (const uint8_t[]){0x0E}, 1, 0}, {0x02, (const uint8_t[]){0xB3}, 1, 0},
    {0x09, (const uint8_t[]){0x60}, 1, 0}, {0x0E, (const uint8_t[]){0x2A}, 1, 0},
    {0x36, (const uint8_t[]){0x59}, 1, 0},
    {0xE0, (const uint8_t[]){0x00}, 1, 0},
    {0x11, (const uint8_t[]){0x00}, 1, 120}, {0x29, (const uint8_t[]){0x00}, 1, 120},
    {0x35, (const uint8_t[]){0x00}, 1, 0},
};

MipiDisplay::MipiDisplay()
    : Gfx(0, 0), _panelW(0), _panelH(0), _rotation(0), _bufMode(BufferMode::Full),
      _bufMem(BufferMemory::Auto), _bufMaxBytes(0), _reqLines(0), _buffer(nullptr), _stripeCount(0),
      _stripeIdx(0), _stripeBuf(nullptr), _stripeCap(0), _stripeLines(0), _blockCap(0), _blockIdx(0),
      _dx0(0), _dy0(0), _dx1(0), _dy1(0), _dirty(false), _panel(nullptr), _panelIo(nullptr),
      _dsiBus(nullptr), _i2cBus(nullptr), _blLevel(0xFF) {
  _stripes[0] = nullptr;
  _stripes[1] = nullptr;
  _blocks[0] = nullptr;
  _blocks[1] = nullptr;
}

MipiDisplay::~MipiDisplay() {
  flushWait();
  freeBuffer();
  freeStripe();
  freeBlocks();
}

bool MipiDisplay::i2cWriteReg(uint8_t addr, uint8_t reg, uint8_t value) {
  i2c_master_bus_handle_t bus = (i2c_master_bus_handle_t)_i2cBus;
  i2c_device_config_t devCfg = {
      .dev_addr_length = I2C_ADDR_BIT_LEN_7,
      .device_address = addr,
      .scl_speed_hz = 100000,
  };
  i2c_master_dev_handle_t dev = nullptr;
  if (i2c_master_bus_add_device(bus, &devCfg, &dev) != ESP_OK) {
    return false;
  }
  uint8_t payload[2] = {reg, value};
  esp_err_t err = i2c_master_transmit(dev, payload, sizeof(payload), 100);
  i2c_master_bus_rm_device(dev);
  return err == ESP_OK;
}

bool MipiDisplay::initBacklight() {
  if (_cfg.blI2cAddr == 0) {
    return true;
  }
  if (_i2cBus == nullptr) {
    i2c_master_bus_config_t busCfg = {
        .i2c_port = I2C_NUM_1,
        .sda_io_num = static_cast<gpio_num_t>(_cfg.i2cSda),
        .scl_io_num = static_cast<gpio_num_t>(_cfg.i2cScl),
        .clk_source = I2C_CLK_SRC_DEFAULT,
        .glitch_ignore_cnt = 7,
        .intr_priority = 0,
        .trans_queue_depth = 0,
        .flags =
            {
                .enable_internal_pullup = 1,
            },
    };
    if (i2c_new_master_bus(&busCfg, (i2c_master_bus_handle_t *)&_i2cBus) != ESP_OK) {
      return false;
    }
  }
  for (size_t i = 0; i < (sizeof(kBlInitSeq) / sizeof(kBlInitSeq[0])); i++) {
    if (!i2cWriteReg(_cfg.blI2cAddr, kBlInitSeq[i][0], kBlInitSeq[i][1])) {
      return false;
    }
    vTaskDelay(pdMS_TO_TICKS(100));
  }
  return true;
}

bool MipiDisplay::setBacklightLevel(uint8_t level) {
  if (_i2cBus == nullptr || _cfg.blI2cAddr == 0) {
    return false;
  }
  if (_blLevel == level) {
    return true;
  }
  if (!i2cWriteReg(_cfg.blI2cAddr, 0x96, level)) {
    return false;
  }
  _blLevel = level;
  return true;
}

bool MipiDisplay::initPanel() {
  static esp_ldo_channel_handle_t phyLdo = nullptr;
  if (phyLdo == nullptr) {
    esp_ldo_channel_config_t ldoCfg = {
        .chan_id = 3,
        .voltage_mv = 2500,
    };
    if (esp_ldo_acquire_channel(&ldoCfg, &phyLdo) != ESP_OK) {
      return false;
    }
  }

  if (!initBacklight()) {
    return false;
  }

  esp_lcd_dsi_bus_handle_t dsiBus = nullptr;
  esp_lcd_dsi_bus_config_t dsiCfg = {
      .bus_id = 0,
      .num_data_lanes = _cfg.laneCount,
      .phy_clk_src = MIPI_DSI_PHY_CLK_SRC_DEFAULT,
      .lane_bit_rate_mbps = _cfg.laneMbps,
  };
  if (esp_lcd_new_dsi_bus(&dsiCfg, &dsiBus) != ESP_OK) {
    return false;
  }
  _dsiBus = dsiBus;

  esp_lcd_panel_io_handle_t io = nullptr;
  esp_lcd_dbi_io_config_t dbiCfg = {
      .virtual_channel = 0,
      .lcd_cmd_bits = 8,
      .lcd_param_bits = 8,
  };
  if (esp_lcd_new_panel_io_dbi(dsiBus, &dbiCfg, &io) != ESP_OK) {
    return false;
  }
  _panelIo = io;

  esp_lcd_dpi_panel_config_t dpiCfg = {};
  dpiCfg.dpi_clk_src = MIPI_DSI_DPI_CLK_SRC_DEFAULT;
  dpiCfg.dpi_clock_freq_mhz = _cfg.dpiClockMhz;
  dpiCfg.virtual_channel = 0;
  dpiCfg.pixel_format = LCD_COLOR_PIXEL_FORMAT_RGB565;
  dpiCfg.num_fbs = 1;
  dpiCfg.video_timing.h_size = _cfg.panelWidth;
  dpiCfg.video_timing.v_size = _cfg.panelHeight;
  dpiCfg.video_timing.hsync_pulse_width = _cfg.hsync;
  dpiCfg.video_timing.hsync_back_porch = _cfg.hbp;
  dpiCfg.video_timing.hsync_front_porch = _cfg.hfp;
  dpiCfg.video_timing.vsync_pulse_width = _cfg.vsync;
  dpiCfg.video_timing.vsync_back_porch = _cfg.vbp;
  dpiCfg.video_timing.vsync_front_porch = _cfg.vfp;
  dpiCfg.flags.use_dma2d = true;

  esp_lcd_panel_handle_t panel = nullptr;
  if (esp_lcd_new_panel_dpi(dsiBus, &dpiCfg, &panel) != ESP_OK) {
    return false;
  }

  switch (_cfg.driver) {
  case MipiPanelDriver::Ws5DsiTouchA_Hx8394: {
    if (esp_lcd_panel_io_tx_param(io, LCD_CMD_SLPOUT, nullptr, 0) != ESP_OK) {
      return false;
    }
    vTaskDelay(pdMS_TO_TICKS(120));

    uint8_t madctl = 0;
    if (esp_lcd_panel_io_tx_param(io, LCD_CMD_MADCTL, &madctl, 1) != ESP_OK) {
      return false;
    }

    uint8_t colmod = 0x55;
    if (esp_lcd_panel_io_tx_param(io, LCD_CMD_COLMOD, &colmod, 1) != ESP_OK) {
      return false;
    }

    uint8_t lane = 0x61;
    if (esp_lcd_panel_io_tx_param(io, 0xBA, &lane, 1) != ESP_OK) {
      return false;
    }

    for (size_t i = 0; i < (sizeof(kHx8394Init) / sizeof(kHx8394Init[0])); i++) {
      const Hx8394InitCmd *cmd = &kHx8394Init[i];
      const uint8_t *data = cmd->dataBytes > 0 ? cmd->data : nullptr;
      if (esp_lcd_panel_io_tx_param(io, cmd->cmd, data, cmd->dataBytes) != ESP_OK) {
        return false;
      }
      if (cmd->delayMs) {
        vTaskDelay(pdMS_TO_TICKS(cmd->delayMs));
      }
    }
    break;
  }
  case MipiPanelDriver::Ili9881c: {
    // Lane pad control (0xB7) lives on CMD_Page 1.
    uint8_t page1[3] = {0x98, 0x81, 0x01};
    if (esp_lcd_panel_io_tx_param(io, 0xFF, page1, 3) != ESP_OK) {
      return false;
    }
    uint8_t laneCmd = (_cfg.laneCount == 3 || _cfg.laneCount == 4) ? 0x02 : 0x03;
    if (esp_lcd_panel_io_tx_param(io, 0xB7, &laneCmd, 1) != ESP_OK) {
      return false;
    }
    uint8_t page0[3] = {0x98, 0x81, 0x00};
    if (esp_lcd_panel_io_tx_param(io, 0xFF, page0, 3) != ESP_OK) {
      return false;
    }

    if (esp_lcd_panel_io_tx_param(io, LCD_CMD_SLPOUT, nullptr, 0) != ESP_OK) {
      return false;
    }
    vTaskDelay(pdMS_TO_TICKS(120));

    uint8_t madctl = 0;
    if (esp_lcd_panel_io_tx_param(io, LCD_CMD_MADCTL, &madctl, 1) != ESP_OK) {
      return false;
    }
    uint8_t colmod = 0x55;
    if (esp_lcd_panel_io_tx_param(io, LCD_CMD_COLMOD, &colmod, 1) != ESP_OK) {
      return false;
    }

    for (size_t i = 0; i < (sizeof(kIli9881cInit) / sizeof(kIli9881cInit[0])); i++) {
      const MipiInitCmd *cmd = &kIli9881cInit[i];
      const uint8_t *data = cmd->dataBytes > 0 ? cmd->data : nullptr;
      if (esp_lcd_panel_io_tx_param(io, cmd->cmd, data, cmd->dataBytes) != ESP_OK) {
        return false;
      }
      if (cmd->delayMs) {
        vTaskDelay(pdMS_TO_TICKS(cmd->delayMs));
      }
    }
    break;
  }
  case MipiPanelDriver::Jd9365: {
    uint8_t pageUser = 0x00;
    if (esp_lcd_panel_io_tx_param(io, 0xE0, &pageUser, 1) != ESP_OK) {
      return false;
    }
    uint8_t madctl = 0;
    if (esp_lcd_panel_io_tx_param(io, LCD_CMD_MADCTL, &madctl, 1) != ESP_OK) {
      return false;
    }
    uint8_t colmod = 0x55;
    if (esp_lcd_panel_io_tx_param(io, LCD_CMD_COLMOD, &colmod, 1) != ESP_OK) {
      return false;
    }
    uint8_t laneCmd;
    switch (_cfg.laneCount) {
    case 1: laneCmd = 0x00; break;
    case 3: laneCmd = 0x10; break;
    case 4: laneCmd = 0x11; break;
    default: laneCmd = 0x01; break; // 0 or 2 lanes
    }
    if (esp_lcd_panel_io_tx_param(io, 0x80, &laneCmd, 1) != ESP_OK) {
      return false;
    }

    for (size_t i = 0; i < (sizeof(kJd9365Init) / sizeof(kJd9365Init[0])); i++) {
      const MipiInitCmd *cmd = &kJd9365Init[i];
      const uint8_t *data = cmd->dataBytes > 0 ? cmd->data : nullptr;
      if (esp_lcd_panel_io_tx_param(io, cmd->cmd, data, cmd->dataBytes) != ESP_OK) {
        return false;
      }
      if (cmd->delayMs) {
        vTaskDelay(pdMS_TO_TICKS(cmd->delayMs));
      }
    }
    break;
  }
  case MipiPanelDriver::Ek79007: {
    uint8_t laneCmd = (_cfg.laneCount == 4) ? 0x00 : 0x10; // 2 lanes is the common case
    if (esp_lcd_panel_io_tx_param(io, 0xB2, &laneCmd, 1) != ESP_OK) {
      return false;
    }

    for (size_t i = 0; i < (sizeof(kEk79007Init) / sizeof(kEk79007Init[0])); i++) {
      const MipiInitCmd *cmd = &kEk79007Init[i];
      const uint8_t *data = cmd->dataBytes > 0 ? cmd->data : nullptr;
      if (esp_lcd_panel_io_tx_param(io, cmd->cmd, data, cmd->dataBytes) != ESP_OK) {
        return false;
      }
      if (cmd->delayMs) {
        vTaskDelay(pdMS_TO_TICKS(cmd->delayMs));
      }
    }
    break;
  }
  default:
    return false;
  }

  if (esp_lcd_panel_init(panel) != ESP_OK) {
    return false;
  }

  _panel = panel;
  return true;
}

static inline size_t alignUp64(size_t b) { return (b + 63u) & ~(size_t)63u; }

static void *mipiAlloc(size_t bytes, bool preferInternal) {
  void *p = nullptr;
  if (!preferInternal) {
    p = heap_caps_aligned_alloc(64, bytes, MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT);
  }
  if (!p) {
    p = heap_caps_aligned_alloc(64, bytes, MALLOC_CAP_8BIT | MALLOC_CAP_INTERNAL | MALLOC_CAP_DMA);
  }
  if (!p && preferInternal) {
    p = heap_caps_aligned_alloc(64, bytes, MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT);
  }
  return p;
}

bool MipiDisplay::allocBuffer() {
  size_t count = (size_t)_panelW * (size_t)_panelH;
  if (count == 0) {
    return false;
  }
  size_t bytes = count * 2;
  if (_bufMaxBytes && bytes > _bufMaxBytes) {
    return false;
  }
  _buffer = (uint16_t *)mipiAlloc(alignUp64(bytes), _bufMem == BufferMemory::Internal);
  if (!_buffer) {
    return false;
  }
  memset(_buffer, 0, bytes);
  return true;
}

void MipiDisplay::freeBuffer() {
  if (_buffer) {
    heap_caps_free(_buffer);
    _buffer = nullptr;
  }
}

bool MipiDisplay::allocStripe() {
  freeStripe();
  int16_t maxDim = (_panelW > _panelH) ? _panelW : _panelH;
  if (maxDim <= 0) {
    return false;
  }
  uint16_t lines = _reqLines ? _reqLines : kMipiStripeLines;
  if (lines > (uint16_t)maxDim) {
    lines = (uint16_t)maxDim;
  }
  if (_bufMaxBytes) {
    uint32_t maxLines = _bufMaxBytes / ((uint32_t)maxDim * 4u);
    if (maxLines < 1) {
      maxLines = 1;
    }
    if (lines > maxLines) {
      lines = (uint16_t)maxLines;
    }
  }
  while (lines >= 1) {
    size_t cap = (size_t)lines * (size_t)maxDim;
    _stripes[0] = (uint16_t *)mipiAlloc(alignUp64(cap * 2), true);
    if (_stripes[0]) {
      _stripes[1] = (uint16_t *)mipiAlloc(alignUp64(cap * 2), true);
      _stripeCount = _stripes[1] ? 2 : 1;
      _stripeCap = cap;
      _stripeLines = lines;
      _stripeIdx = 0;
      return true;
    }
    if (lines == 1) {
      break;
    }
    lines = (uint16_t)(lines / 2);
  }
  return false;
}

void MipiDisplay::freeStripe() {
  for (uint8_t i = 0; i < 2; i++) {
    if (_stripes[i]) {
      heap_caps_free(_stripes[i]);
      _stripes[i] = nullptr;
    }
  }
  _stripeCount = 0;
  _stripeCap = 0;
  _stripeBuf = nullptr;
}

bool MipiDisplay::allocBlocks(size_t pixels) {
  freeBlocks();
  while (pixels >= 64) {
    _blocks[0] = (uint16_t *)mipiAlloc(alignUp64(pixels * 2), false);
    if (_blocks[0]) {
      _blocks[1] = (uint16_t *)mipiAlloc(alignUp64(pixels * 2), false);
      _blockCap = pixels;
      _blockIdx = 0;
      return true;
    }
    pixels /= 2;
  }
  return false;
}

void MipiDisplay::freeBlocks() {
  for (uint8_t i = 0; i < 2; i++) {
    if (_blocks[i]) {
      heap_caps_free(_blocks[i]);
      _blocks[i] = nullptr;
    }
  }
  _blockCap = 0;
}

uint16_t *MipiDisplay::nextBlock() {
  if (_blocks[1]) {
    uint16_t *b = _blocks[_blockIdx];
    _blockIdx = (uint8_t)(_blockIdx ^ 1);
    return b;
  }
  halMipiWait();
  return _blocks[0];
}

void MipiDisplay::flushWait() { halMipiWait(); }

static void mipiFlushYield(uint16_t chunk) {
  if ((chunk & 7) == 7) {
    vTaskDelay(1);
  }
}

void MipiDisplay::applyRotation(uint8_t rotation) {
  _rotation = (uint8_t)(rotation & 3);
  switch (_rotation) {
  case 1:
  case 3:
    _width = _panelH;
    _height = _panelW;
    break;
  default:
    _width = _panelW;
    _height = _panelH;
    break;
  }
  WIDTH = _width;
  HEIGHT = _height;
}

void MipiDisplay::setRotation(uint8_t rotation) {
  flushWait();
  applyRotation(rotation);
}

void MipiDisplay::nativeFromLogical(int16_t lx, int16_t ly, int16_t &px, int16_t &py) const {
  switch (_rotation) {
  case 1:
    px = (int16_t)(_panelW - 1 - ly);
    py = lx;
    break;
  case 2:
    px = (int16_t)(_panelW - 1 - lx);
    py = (int16_t)(_panelH - 1 - ly);
    break;
  case 3:
    px = ly;
    py = (int16_t)(_panelH - 1 - lx);
    break;
  default:
    px = lx;
    py = ly;
    break;
  }
}

void MipiDisplay::logicalFromNative(int16_t px, int16_t py, int16_t &lx, int16_t &ly) const {
  switch (_rotation) {
  case 1:
    lx = py;
    ly = (int16_t)(_panelW - 1 - px);
    break;
  case 2:
    lx = (int16_t)(_panelW - 1 - px);
    ly = (int16_t)(_panelH - 1 - py);
    break;
  case 3:
    lx = (int16_t)(_panelH - 1 - py);
    ly = px;
    break;
  default:
    lx = px;
    ly = py;
    break;
  }
}

void MipiDisplay::nativeRectFromLogical(int16_t x, int16_t y, int16_t w, int16_t h, int16_t &nx, int16_t &ny,
                                        int16_t &nw, int16_t &nh) const {
  int16_t ax = 0, ay = 0, bx = 0, by = 0;
  nativeFromLogical(x, y, ax, ay);
  nativeFromLogical((int16_t)(x + w - 1), (int16_t)(y + h - 1), bx, by);
  nx = ax < bx ? ax : bx;
  ny = ay < by ? ay : by;
  nw = (int16_t)((ax > bx ? ax : bx) - nx + 1);
  nh = (int16_t)((ay > by ? ay : by) - ny + 1);
}

void MipiDisplay::rotateChunkSw(const uint16_t *src, int16_t srcStride, int16_t w, int16_t h, uint16_t *dst) {
  switch (_rotation) {
  case 1:
    for (int16_t r = 0; r < w; r++) {
      uint16_t *out = dst + (int32_t)r * h;
      const uint16_t *col = src + r + (int32_t)(h - 1) * srcStride;
      for (int16_t c = 0; c < h; c++) {
        out[c] = *col;
        col -= srcStride;
      }
    }
    break;
  case 2:
    for (int16_t r = 0; r < h; r++) {
      uint16_t *out = dst + (int32_t)r * w;
      const uint16_t *in = src + (int32_t)(h - 1 - r) * srcStride + (w - 1);
      for (int16_t c = 0; c < w; c++) {
        out[c] = *in--;
      }
    }
    break;
  case 3:
    for (int16_t r = 0; r < w; r++) {
      uint16_t *out = dst + (int32_t)r * h;
      const uint16_t *col = src + (w - 1 - r);
      for (int16_t c = 0; c < h; c++) {
        out[c] = *col;
        col += srcStride;
      }
    }
    break;
  default:
    for (int16_t r = 0; r < h; r++) {
      memcpy(dst + (int32_t)r * w, src + (int32_t)r * srcStride, (size_t)w * 2);
    }
    break;
  }
}

void MipiDisplay::flushLogical(const uint16_t *src, int16_t srcStride, int16_t picH, int16_t x, int16_t y,
                               int16_t w, int16_t h, bool async) {
  if (!_panel || !src || w <= 0 || h <= 0) {
    return;
  }
  const uint16_t *pic = src;
  int16_t picW = srcStride;
  int16_t px = 0;
  int16_t py = 0;
  if (picW != w) {
    px = x;
    py = y;
  }
  if (_rotation == 0 && picW == w) {
    halMipiDraw(x, y, (int16_t)(x + w), (int16_t)(y + h), pic);
    if (!async) {
      halMipiWait();
    }
    return;
  }
  if (_blockCap == 0) {
    return;
  }
  int16_t rowsPer = (int16_t)(_blockCap / (size_t)w);
  if (rowsPer < 1) {
    rowsPer = 1;
  }
  uint16_t chunk = 0;
  for (int16_t r = 0; r < h; r = (int16_t)(r + rowsPer)) {
    int16_t n = (int16_t)((h - r) < rowsPer ? (h - r) : rowsPer);
    uint16_t *blk = nextBlock();
    const uint16_t *rowSrc = pic + (int32_t)(py + r) * picW + px;
    if (_rotation == 0) {
      rotateChunkSw(rowSrc, picW, w, n, blk);
      halMipiDraw(x, (int16_t)(y + r), (int16_t)(x + w), (int16_t)(y + r + n), blk);
    } else {
      if (!halRotateBlock565(pic, picW, picH, px, (int16_t)(py + r), w, n, blk,
                             alignUp64((size_t)w * (size_t)n * 2), _rotation)) {
        rotateChunkSw(rowSrc, picW, w, n, blk);
      }
      int16_t nx = 0, ny = 0, nw = 0, nh = 0;
      nativeRectFromLogical(x, (int16_t)(y + r), w, n, nx, ny, nw, nh);
      halMipiDraw(nx, ny, (int16_t)(nx + nw), (int16_t)(ny + nh), blk);
    }
    mipiFlushYield(chunk++);
  }
  if (!async) {
    halMipiWait();
  }
}

void MipiDisplay::fillDirect(int16_t x, int16_t y, int16_t w, int16_t h, uint16_t color) {
  if (!_panel || _blockCap == 0 || w <= 0 || h <= 0) {
    return;
  }
  int16_t nx = 0, ny = 0, nw = 0, nh = 0;
  nativeRectFromLogical(x, y, w, h, nx, ny, nw, nh);
  int16_t rowsPer = (int16_t)(_blockCap / (size_t)nw);
  if (rowsPer < 1) {
    rowsPer = 1;
  }
  if (rowsPer > nh) {
    rowsPer = nh;
  }
  halMipiWait();
  uint16_t *blk = _blocks[0];
  size_t n = (size_t)nw * (size_t)rowsPer;
  for (size_t i = 0; i < n; i++) {
    blk[i] = color;
  }
  uint16_t chunk = 0;
  for (int16_t r = 0; r < nh; r = (int16_t)(r + rowsPer)) {
    int16_t rows = (int16_t)((nh - r) < rowsPer ? (nh - r) : rowsPer);
    halMipiDraw(nx, (int16_t)(ny + r), (int16_t)(nx + nw), (int16_t)(ny + r + rows), blk);
    mipiFlushYield(chunk++);
  }
  halMipiWait();
}

bool MipiDisplay::begin(const MipiDisplayConfig &cfg, const BufferOptions &buffer, uint8_t rotation) {
  _cfg = cfg;
  _panelW = cfg.panelWidth;
  _panelH = cfg.panelHeight;
  applyRotation(rotation);
  _bufMode = buffer.mode;
  _bufMem = buffer.memory;
  _bufMaxBytes = buffer.maxBytes;
  halInit(buffer.hal);
  _reqLines = buffer.partialLineCount ? buffer.partialLineCount : halActiveProfile().stripeLines;
  _dirty = false;

  if (!initPanel()) {
    return false;
  }
  halMipiBindPanel(_panel);

  if (_bufMode == BufferMode::Full) {
    if (!allocBuffer()) {
      _bufMode = BufferMode::Partial;
      if (_cfg.debug) {
        Serial.println("Lucarne Mipi: framebuffer unavailable, downgrading to partial mode");
      }
    }
  }
  if (_bufMode == BufferMode::Partial) {
    if (!allocStripe()) {
      _bufMode = BufferMode::None;
      if (_cfg.debug) {
        Serial.println("Lucarne Mipi: stripe buffer unavailable, falling back to direct mode");
      }
    }
  }
  int16_t maxDim = (_panelW > _panelH) ? _panelW : _panelH;
  size_t blockPixels = (size_t)maxDim * 64;
  if (_stripeCap > blockPixels) {
    blockPixels = _stripeCap;
  }
  if (!allocBlocks(blockPixels) && _cfg.debug) {
    Serial.println("Lucarne Mipi: block buffers unavailable");
  }

  if (_cfg.debug) {
    Serial.print("Lucarne Mipi: ");
    Serial.print(_width);
    Serial.print("x");
    Serial.print(_height);
    Serial.print(" rot=");
    Serial.print(_rotation);
    Serial.print(" bufMode=");
    Serial.print(_bufMode == BufferMode::Full
                     ? "full"
                     : (_bufMode == BufferMode::Partial ? "partial" : "none"));
    Serial.print(" stripeLines=");
    Serial.print(_stripeLines);
    Serial.print(" blockPixels=");
    Serial.println((uint32_t)_blockCap);
  }

  setBacklightLevel(255);
  fillScreen(Color::Black);
  presentFull();
  return true;
}

void MipiDisplay::backlight(bool on) {
  setBacklightLevel(on ? 255 : 0);
}

Rect MipiDisplay::targetBounds() const {
  if (_bufMode == BufferMode::Full && _buffer) {
    return Rect(0, 0, _width, _height);
  }
  if (stripeTarget()) {
    return _stripeWin;
  }
  return Rect();
}

bool MipiDisplay::targetRect(int16_t &x, int16_t &y, int16_t &w, int16_t &h) const {
  Rect r = Rect(x, y, w, h).intersect(clipRect());
  if (stripeTarget()) {
    r = r.intersect(_stripeWin);
  }
  if (r.empty()) {
    return false;
  }
  x = r.x;
  y = r.y;
  w = r.w;
  h = r.h;
  return true;
}

bool MipiDisplay::canPeekPixel() const { return hasTarget(); }

uint16_t MipiDisplay::peekPixel(int16_t x, int16_t y) const {
  if (!hasTarget() || !targetBounds().contains(x, y)) {
    return 0;
  }
  return *targetAt(x, y);
}

void MipiDisplay::startWrite() {}

void MipiDisplay::endWrite() {}

void MipiDisplay::markDirty(int16_t x, int16_t y, int16_t w, int16_t h) {
  if (_bufMode != BufferMode::Full || !_buffer) {
    return;
  }
  int16_t x2 = (int16_t)(x + w - 1);
  int16_t y2 = (int16_t)(y + h - 1);
  if (x < 0) {
    x = 0;
  }
  if (y < 0) {
    y = 0;
  }
  if (x2 > _width - 1) {
    x2 = (int16_t)(_width - 1);
  }
  if (y2 > _height - 1) {
    y2 = (int16_t)(_height - 1);
  }
  if (x2 < x || y2 < y) {
    return;
  }
  if (!_dirty) {
    _dx0 = x;
    _dy0 = y;
    _dx1 = x2;
    _dy1 = y2;
    _dirty = true;
  } else {
    if (x < _dx0) {
      _dx0 = x;
    }
    if (y < _dy0) {
      _dy0 = y;
    }
    if (x2 > _dx1) {
      _dx1 = x2;
    }
    if (y2 > _dy1) {
      _dy1 = y2;
    }
  }
}

void MipiDisplay::flushRegion(int16_t x, int16_t y, int16_t w, int16_t h) {
  if (!_panel || !_buffer) {
    return;
  }
  Rect r = Rect(x, y, w, h).intersect(Rect(0, 0, _width, _height));
  if (r.empty()) {
    return;
  }
  flushLogical(_buffer, _width, _height, r.x, r.y, r.w, r.h, false);
}

void MipiDisplay::display() {
  if (_bufMode != BufferMode::Full || !_buffer || !_dirty) {
    return;
  }
  flushRegion(_dx0, _dy0, (int16_t)(_dx1 - _dx0 + 1), (int16_t)(_dy1 - _dy0 + 1));
  _dirty = false;
}

void MipiDisplay::display(int16_t x, int16_t y, int16_t w, int16_t h) {
  if (_bufMode != BufferMode::Full || !_buffer) {
    return;
  }
  flushRegion(x, y, w, h);
}

void MipiDisplay::presentFull() {
  if (_bufMode != BufferMode::Full || !_buffer) {
    flushWait();
    return;
  }
  flushRegion(0, 0, _width, _height);
  _dirty = false;
}

void MipiDisplay::presentDirty() {
  if (_bufMode != BufferMode::Full || !_buffer) {
    flushWait();
    return;
  }
  display();
}

void MipiDisplay::invalidateRegion(int16_t x, int16_t y, int16_t w, int16_t h) { markDirty(x, y, w, h); }

bool MipiDisplay::displayDirtyRegion(int16_t &x, int16_t &y, int16_t &w, int16_t &h) const {
  if (!_dirty)
    return false;
  x = _dx0;
  y = _dy0;
  w = (int16_t)(_dx1 - _dx0 + 1);
  h = (int16_t)(_dy1 - _dy0 + 1);
  return true;
}

bool MipiDisplay::flushRect(int16_t x, int16_t y, int16_t w, int16_t h) {
  if (_bufMode != BufferMode::Full || !_buffer) {
    return false;
  }
  Rect r = Rect(x, y, w, h).intersect(Rect(0, 0, _width, _height));
  if (r.empty()) {
    return false;
  }
  flushRegion(r.x, r.y, r.w, r.h);
  if (_dirty) {
    Rect d(_dx0, _dy0, (int16_t)(_dx1 - _dx0 + 1), (int16_t)(_dy1 - _dy0 + 1));
    if (r.contains(d)) {
      _dirty = false;
    }
  }
  return true;
}

bool MipiDisplay::supportsPartialPresent() const {
  return _bufMode == BufferMode::Partial && _stripeCount > 0;
}

int16_t MipiDisplay::stripeRowsFor(int16_t w) const {
  if (_bufMode != BufferMode::Partial || _stripeCount == 0 || w <= 0) {
    return _height;
  }
  size_t rows = _stripeCap / (size_t)w;
  if (rows < 1) {
    rows = 1;
  }
  if (rows > (size_t)_height) {
    rows = (size_t)_height;
  }
  return (int16_t)rows;
}

bool MipiDisplay::beginStripe(int16_t x, int16_t y, int16_t w, int16_t h) {
  if (_stripeActive) {
    endStripe();
  }
  if (_bufMode == BufferMode::Partial && _stripeCount > 0) {
    Rect r = Rect(x, y, w, h).intersect(Rect(0, 0, _width, _height));
    if (r.empty()) {
      return false;
    }
    int16_t rows = stripeRowsFor(r.w);
    if (r.h > rows) {
      r.h = rows;
    }
    _stripeBuf = _stripes[_stripeIdx];
    if (_stripeCount < 2) {
      flushWait();
    }
    return Gfx::beginStripe(r.x, r.y, r.w, r.h);
  }
  _stripeBuf = nullptr;
  return Gfx::beginStripe(x, y, w, h);
}

void MipiDisplay::endStripe() {
  if (!_stripeActive) {
    return;
  }
  Rect r = _stripeWin;
  if (_bufMode == BufferMode::Partial && _stripeBuf) {
    uint16_t *buf = _stripeBuf;
    _stripeActive = false;
    _stripeBuf = nullptr;
    resetClipRect();
    flushLogical(buf, r.w, r.h, r.x, r.y, r.w, r.h, _stripeCount > 1);
    if (_stripeCount > 1) {
      _stripeIdx = (uint8_t)(_stripeIdx ^ 1);
    }
    return;
  }
  _stripeActive = false;
  _stripeBuf = nullptr;
  resetClipRect();
  flushRect(r.x, r.y, r.w, r.h);
}

void MipiDisplay::writePixel(int16_t x, int16_t y, uint16_t color) {
  if (!inTarget(x, y)) {
    return;
  }
  if (hasTarget()) {
    *targetAt(x, y) = color;
    markDirty(x, y, 1, 1);
    return;
  }
  fillDirect(x, y, 1, 1, color);
}

void MipiDisplay::writeFillRect(int16_t x, int16_t y, int16_t w, int16_t h, uint16_t color) {
  if (!targetRect(x, y, w, h)) {
    return;
  }
  if (hasTarget()) {
    for (int16_t row = 0; row < h; row++) {
      uint16_t *p = targetAt(x, (int16_t)(y + row));
      for (int16_t col = 0; col < w; col++) {
        p[col] = color;
      }
    }
    markDirty(x, y, w, h);
    return;
  }
  fillDirect(x, y, w, h, color);
}

void MipiDisplay::writeFastHLine(int16_t x, int16_t y, int16_t w, uint16_t color) {
  writeFillRect(x, y, w, 1, color);
}

void MipiDisplay::writeFastVLine(int16_t x, int16_t y, int16_t h, uint16_t color) {
  writeFillRect(x, y, 1, h, color);
}

uint16_t *MipiDisplay::allocFrame() {
  const HalProfile &prof = halActiveProfile();
  if (_bufMode != BufferMode::Full || !_buffer || !prof.allowRichTransitions ||
      prof.uiProfile == UiProfile::Tiny) {
    return nullptr;
  }
  size_t bytes = (size_t)_width * (size_t)_height * 2;
  if (bytes == 0) {
    return nullptr;
  }
  uint16_t *p = (uint16_t *)heap_caps_malloc(bytes, MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT);
  if (!p) {
    p = (uint16_t *)heap_caps_malloc(bytes, MALLOC_CAP_8BIT | MALLOC_CAP_INTERNAL);
  }
  return p;
}

void MipiDisplay::freeFrame(uint16_t *p) {
  if (p) {
    heap_caps_free(p);
  }
}

void MipiDisplay::snapshotFrame(uint16_t *dst) {
#if !defined(LUCARNE_DEBUG_SNAPSHOT)
  if (halActiveProfile().uiProfile == UiProfile::Tiny) {
    return;
  }
#endif
  if (_buffer && dst) {
    memcpy(dst, _buffer, (size_t)_width * (size_t)_height * 2);
  }
}

void MipiDisplay::flushArea(int16_t x, int16_t y, int16_t w, int16_t h) {
  display(x, y, w, h);
}

void MipiDisplay::writeBufferRect(int16_t x, int16_t y, int16_t w, int16_t h, const uint16_t *src) {
  if (!hasTarget() || !src || w < 1 || h < 1) {
    return;
  }
  int16_t rx = x, ry = y, rw = w, rh = h;
  if (!targetRect(rx, ry, rw, rh)) {
    return;
  }
  for (int16_t row = 0; row < rh; row++) {
    memcpy(targetAt(rx, (int16_t)(ry + row)), src + (size_t)(ry + row - y) * (size_t)w + (size_t)(rx - x),
           (size_t)rw * 2);
  }
  markDirty(rx, ry, rw, rh);
}

void MipiDisplay::blitBufferRect(int16_t x, int16_t y, int16_t w, int16_t h, const uint16_t *srcPacked) {
  if (!hasTarget() || !srcPacked || w < 1 || h < 1) {
    return;
  }
  int16_t rx = x, ry = y, rw = w, rh = h;
  if (!targetRect(rx, ry, rw, rh)) {
    return;
  }
  for (int16_t row = 0; row < rh; row++) {
    uint16_t *dst = targetAt(rx, (int16_t)(ry + row));
    const uint16_t *srcRow = srcPacked + (size_t)(ry + row - y) * (size_t)w + (size_t)(rx - x);
    for (int16_t col = 0; col < rw; col++) {
      uint16_t c = srcRow[col];
      dst[col] = (uint16_t)((c << 8) | (c >> 8));
    }
  }
  markDirty(rx, ry, rw, rh);
}

void MipiDisplay::readBufferRectNative(int16_t x, int16_t y, int16_t w, int16_t h, uint16_t *dst) {
  if (!hasTarget() || !dst || w < 1 || h < 1) {
    return;
  }
  Rect r = Rect(x, y, w, h).intersect(targetBounds());
  if (r.empty()) {
    return;
  }
  for (int16_t row = 0; row < r.h; row++) {
    memcpy(dst + (size_t)(r.y + row - y) * (size_t)w + (size_t)(r.x - x), targetAt(r.x, (int16_t)(r.y + row)),
           (size_t)r.w * 2);
  }
}

} // namespace lucarne

#endif
