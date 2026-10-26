#include "../../LucarneFlushSpiAsync.h"
#include "../../LucarneHalConfig.h"

#if defined(ESP32)
#include "soc/soc_caps.h"
#endif

namespace lucarne {

void halRegisterArduinoBackends(FlushBackend **flush, HwCaps *caps) {
    *flush = &flushSpiAsyncBackend();
    caps->flags |= (uint32_t)kCapBlitMemCopy | (uint32_t)kCapBlitFill;
    halAddSpiAsyncCaps(caps);
#if defined(SOC_MIPI_DSI_SUPPORTED) && SOC_MIPI_DSI_SUPPORTED
    caps->flags |= (uint32_t)kCapDisplayMipiDsi;
#if LUCARNE_HAS_PPA_DRIVER
    caps->flags |= (uint32_t)kCap2dPpa;
#endif
#endif
}

}
