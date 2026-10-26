#ifndef LUCARNE_HW_CAPS_H
#define LUCARNE_HW_CAPS_H

#include <stdint.h>

namespace lucarne {

enum HwCap : uint32_t {
    kCapFlushDmaSpi = 1u << 0,
    kCapFlushAsync = 1u << 1,
    kCapBlitMemCopy = 1u << 2,
    kCapBlitFill = 1u << 3,
    kCapBlitBlend = 1u << 4,
    kCapBlitRotate90 = 1u << 5,
    kCapBlitScale = 1u << 6,
    kCapDisplayLtdc = 1u << 7,
    kCapDisplayMipiDsi = 1u << 8,
    kCapDisplayRgbParallel = 1u << 9,
    kCapJpegDecode = 1u << 10,
    kCapClutPalette = 1u << 11,
    kCapGfxmmuVirtualFb = 1u << 12,
    kCap2dDma2d = 1u << 13,
    kCap2dPpa = 1u << 14,
    kCap2dGpha = 1u << 15,
    kCapSimdHelium = 1u << 16,
    kCapSimdRvv = 1u << 17,
};

struct HwCaps {
    uint32_t flags = 0;

    bool has(HwCap c) const { return (flags & (uint32_t)c) != 0; }
};

}

#endif
