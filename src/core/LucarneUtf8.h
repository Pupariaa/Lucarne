#ifndef LUCARNE_UTF8_H
#define LUCARNE_UTF8_H

namespace lucarne {

inline bool utf8NextCodepoint(const char *&p, uint16_t &cp) {
    if (!p || !*p) return false;
    const uint8_t b0 = (uint8_t)p[0];
    if (b0 < 0x80) {
        cp = b0;
        p++;
        return true;
    }
    if ((b0 & 0xE0) == 0xC0 && p[1]) {
        cp = (uint16_t)(((b0 & 0x1F) << 6) | (p[1] & 0x3F));
        p += 2;
        return cp >= 0x80 && cp <= 0xFF;
    }
    if ((b0 & 0xF0) == 0xE0 && p[1] && p[2]) {
        p += 3;
        return false;
    }
    if ((b0 & 0xF8) == 0xF0 && p[1] && p[2] && p[3]) {
        p += 4;
        return false;
    }
    p++;
    return false;
}

}

#endif
