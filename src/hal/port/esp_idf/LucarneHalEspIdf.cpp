#include "../../LucarneFlushSpiAsync.h"
#include "../../LucarneBlitBackend.h"
#include "../../LucarneImageCodecBackend.h"

#if defined(ESP32)
#include "soc/soc_caps.h"
#endif

namespace lucarne {

void halRegisterEspIdfBackends(FlushBackend **flush, ImageCodecBackend **codec, HwCaps *caps) {
    *flush = &flushSpiAsyncBackend();
    *codec = nullptr;
    caps->flags |= (uint32_t)kCapBlitMemCopy | (uint32_t)kCapBlitFill;
    halAddSpiAsyncCaps(caps);
#if defined(SOC_MIPI_DSI_SUPPORTED) && SOC_MIPI_DSI_SUPPORTED
    caps->flags |= (uint32_t)kCapDisplayMipiDsi;
#endif
#if defined(CONFIG_IDF_TARGET_ESP32P4) && LUCARNE_HAS_PPA_DRIVER
    caps->flags |= (uint32_t)kCap2dPpa;
#endif
}

}
