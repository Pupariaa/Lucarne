#include "LucarneTouchGT911.h"

// soc/soc_caps.h (and the SOC_MIPI_DSI_SUPPORTED macro it defines) only exists
// in the ESP-IDF/ESP32 Arduino core. Arduino/PlatformIO build every .cpp under
// src/ as its own translation unit regardless of what Lucarne.h includes, so
// this file must stay includable (and become a no-op) on AVR, ESP8266, RP2040
// and any other non-ESP32 target.
#if defined(ESP32)
#include "soc/soc_caps.h"
#endif

#if SOC_MIPI_DSI_SUPPORTED
#include "driver/i2c_master.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#endif

namespace lucarne {

static const uint16_t kGt911RegStatus = 0x814E;
static const uint16_t kGt911RegPoints = 0x814F;
static const uint16_t kGt911RegProductId = 0x8140;
static const uint8_t kGt911AddrPrimary = 0x5D;
static const uint8_t kGt911AddrBackup = 0x14;

#if SOC_MIPI_DSI_SUPPORTED

static bool gt911Read(i2c_master_dev_handle_t dev, uint16_t reg, uint8_t *data, size_t len)
{
    uint8_t addr[2] = {(uint8_t)(reg >> 8), (uint8_t)(reg & 0xFF)};
    return i2c_master_transmit_receive(dev, addr, sizeof(addr), data, len, 100) == ESP_OK;
}

static bool gt911Write8(i2c_master_dev_handle_t dev, uint16_t reg, uint8_t value)
{
    uint8_t payload[3] = {(uint8_t)(reg >> 8), (uint8_t)(reg & 0xFF), value};
    return i2c_master_transmit(dev, payload, sizeof(payload), 100) == ESP_OK;
}

static bool gt911Probe(i2c_master_dev_handle_t dev)
{
    uint8_t id[4] = {0};
    if (!gt911Read(dev, kGt911RegProductId, id, sizeof(id))) {
        return false;
    }
    return id[0] == '9' && id[1] == '1' && id[2] == '1';
}

#endif

GT911Touch::GT911Touch()
    : _panelW(0), _panelH(0), _i2cSda(7), _i2cScl(8), _i2cBus(nullptr), _i2cDev(nullptr),
      _ownsBus(false) {}

GT911Touch::~GT911Touch()
{
#if SOC_MIPI_DSI_SUPPORTED
    if (_i2cDev) {
        i2c_master_bus_rm_device((i2c_master_dev_handle_t)_i2cDev);
        _i2cDev = nullptr;
    }
    if (_ownsBus && _i2cBus) {
        i2c_del_master_bus((i2c_master_bus_handle_t)_i2cBus);
        _i2cBus = nullptr;
    }
#endif
}

bool GT911Touch::attachDevice(uint8_t addr)
{
#if !SOC_MIPI_DSI_SUPPORTED
    (void)addr;
    return false;
#else
    if (!_i2cBus) {
        return false;
    }

    i2c_device_config_t dev_cfg = {
        .dev_addr_length = I2C_ADDR_BIT_LEN_7,
        .device_address = addr,
        .scl_speed_hz = 400000,
    };
    i2c_master_dev_handle_t dev = NULL;
    if (i2c_master_bus_add_device((i2c_master_bus_handle_t)_i2cBus, &dev_cfg, &dev) != ESP_OK) {
        return false;
    }
    if (!gt911Probe(dev)) {
        i2c_master_bus_rm_device(dev);
        return false;
    }
    _i2cDev = dev;
    return true;
#endif
}

bool GT911Touch::begin(const TouchConfig &cfg, int16_t panelWidth, int16_t panelHeight,
                       int8_t i2cSda, int8_t i2cScl, void *existingI2cBus)
{
#if !SOC_MIPI_DSI_SUPPORTED
    (void)cfg;
    (void)panelWidth;
    (void)panelHeight;
    (void)i2cSda;
    (void)i2cScl;
    (void)existingI2cBus;
    return false;
#else
    _cfg = cfg;
    _panelW = panelWidth;
    _panelH = panelHeight;
    _i2cSda = i2cSda;
    _i2cScl = i2cScl;
    _ownsBus = false;

    if (existingI2cBus) {
        _i2cBus = existingI2cBus;
    } else {
        i2c_master_bus_config_t bus_cfg = {
            .i2c_port = I2C_NUM_1,
            .sda_io_num = static_cast<gpio_num_t>(_i2cSda),
            .scl_io_num = static_cast<gpio_num_t>(_i2cScl),
            .clk_source = I2C_CLK_SRC_DEFAULT,
            .glitch_ignore_cnt = 7,
            .intr_priority = 0,
            .trans_queue_depth = 0,
            .flags =
                {
                    .enable_internal_pullup = 1,
                },
        };
        if (i2c_new_master_bus(&bus_cfg, (i2c_master_bus_handle_t *)&_i2cBus) != ESP_OK) {
            return false;
        }
        _ownsBus = true;
    }

    if (_cfg.i2cAddr == kGt911AddrBackup) {
        return attachDevice(kGt911AddrBackup);
    }
    if (_cfg.i2cAddr != 0 && _cfg.i2cAddr != 0x38) {
        return attachDevice(_cfg.i2cAddr);
    }
    if (attachDevice(kGt911AddrPrimary)) {
        return true;
    }
    return attachDevice(kGt911AddrBackup);
#endif
}

bool GT911Touch::mapPoint(int16_t rawX, int16_t rawY, int16_t &x, int16_t &y)
{
    int32_t px = rawX;
    int32_t py = rawY;
    if (_cfg.swapXY) {
        int32_t t = px;
        px = py;
        py = t;
    }
    if (_cfg.invertX) {
        px = _panelW - 1 - px;
    }
    if (_cfg.invertY) {
        py = _panelH - 1 - py;
    }
    if (px < 0) {
        px = 0;
    }
    if (py < 0) {
        py = 0;
    }
    if (px >= _panelW) {
        px = _panelW - 1;
    }
    if (py >= _panelH) {
        py = _panelH - 1;
    }
    x = (int16_t)px;
    y = (int16_t)py;
    return true;
}

void GT911Touch::feedCalibrated(int16_t rawX, int16_t rawY, bool pressed, int16_t &x, int16_t &y)
{
    if (!pressed) {
        x = 0;
        y = 0;
        return;
    }
    mapPoint(rawX, rawY, x, y);
}

bool GT911Touch::poll(int16_t &x, int16_t &y, bool &pressed)
{
#if !SOC_MIPI_DSI_SUPPORTED
    (void)x;
    (void)y;
    pressed = false;
    return false;
#else
    if (!_i2cDev) {
        pressed = false;
        return false;
    }

    i2c_master_dev_handle_t dev = (i2c_master_dev_handle_t)_i2cDev;
    uint8_t status = 0;
    if (!gt911Read(dev, kGt911RegStatus, &status, 1)) {
        pressed = false;
        return true;
    }

    uint8_t count = status & 0x0F;
    if ((status & 0x80) == 0) {
        if (count != 0) {
            gt911Write8(dev, kGt911RegStatus, 0);
        }
        pressed = false;
        x = 0;
        y = 0;
        return true;
    }
    if (count == 0 || count > 5) {
        gt911Write8(dev, kGt911RegStatus, 0);
        pressed = false;
        x = 0;
        y = 0;
        return true;
    }

    uint8_t data[8] = {0};
    if (!gt911Read(dev, kGt911RegPoints, data, sizeof(data))) {
        gt911Write8(dev, kGt911RegStatus, 0);
        pressed = false;
        return false;
    }

    gt911Write8(dev, kGt911RegStatus, 0);

    int16_t rawX = (int16_t)(data[1] | (data[2] << 8));
    int16_t rawY = (int16_t)(data[3] | (data[4] << 8));
    pressed = true;
    mapPoint(rawX, rawY, x, y);
    return true;
#endif
}

}
