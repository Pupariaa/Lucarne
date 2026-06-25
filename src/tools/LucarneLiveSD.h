#ifndef LUCARNE_LIVE_SD_H
#define LUCARNE_LIVE_SD_H

#include <SD.h>
#include "LucarneLivePreview.h"

namespace lucarne {

inline void liveLoadFromSd(const char *path, LivePreview *preview) {
    if (!preview || !path) {
        if (preview) preview->sendLoadChunk(nullptr, 0, 2);
        return;
    }
    File f = SD.open(path, FILE_READ);
    if (!f) {
        preview->sendLoadChunk(nullptr, 0, 2);
        return;
    }
    uint8_t buf[512];
    while (f.available()) {
        size_t n = f.read(buf, sizeof(buf));
        bool last = f.available() == 0;
        preview->sendLoadChunk(buf, (uint32_t)n, last ? 1u : 0u);
    }
    if (f.size() == 0) preview->sendLoadChunk(nullptr, 0, 1);
    f.close();
}

}

#endif
