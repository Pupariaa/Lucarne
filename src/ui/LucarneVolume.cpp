#include "LucarneVolume.h"
#include "LucarneImageAsset.h"
#include "../LucarneStorageConfig.h"

#if defined(ESP32) && LUCARNE_ENABLE_VOLUME

#include <Arduino.h>
#if LUCARNE_ENABLE_VOLUME_FAT
#include <FFat.h>
#endif
#if LUCARNE_ENABLE_VOLUME_LITTLEFS
#include <LittleFS.h>
#endif
#if LUCARNE_ENABLE_VOLUME_SPIFFS
#include <SPIFFS.h>
#endif

namespace lucarne {

static fs::FS *_volFs = nullptr;
static VolumeFsKind _volKind = VolumeFsKind::None;
static const char *_volBasePath = nullptr;

bool mountVolume(VolumeFsKind kind, const char *partitionLabel, bool formatOnFail) {
    unmountVolume();
    const char *label = (partitionLabel && partitionLabel[0]) ? partitionLabel : nullptr;
    bool ok = false;
    switch (kind) {
#if LUCARNE_ENABLE_VOLUME_FAT
        case VolumeFsKind::Fat:
            _volBasePath = "/ffat";
            ok = FFat.begin(formatOnFail, _volBasePath, 10, label);
            if (ok) _volFs = &FFat;
            break;
#endif
#if LUCARNE_ENABLE_VOLUME_LITTLEFS
        case VolumeFsKind::LittleFs:
            _volBasePath = "/littlefs";
            ok = LittleFS.begin(formatOnFail, _volBasePath, 10, label);
            if (ok) _volFs = &LittleFS;
            break;
#endif
#if LUCARNE_ENABLE_VOLUME_SPIFFS
        case VolumeFsKind::Spiffs:
            _volBasePath = "/spiffs";
            ok = SPIFFS.begin(formatOnFail, _volBasePath, 10, label);
            if (ok) _volFs = &SPIFFS;
            break;
#endif
        default:
            return false;
    }
    if (!ok) {
        _volBasePath = nullptr;
        Serial.print(F("Lucarne: volume mount failed ("));
        Serial.print(label ? label : "?");
        Serial.println(F(")"));
    } else {
        _volKind = kind;
        Serial.print(F("Lucarne: volume mounted at "));
        Serial.println(_volBasePath);
    }
    return ok;
}

void unmountVolume() {
    if (!_volFs) {
        _volKind = VolumeFsKind::None;
        _volBasePath = nullptr;
        return;
    }
    switch (_volKind) {
#if LUCARNE_ENABLE_VOLUME_FAT
        case VolumeFsKind::Fat:
            FFat.end();
            break;
#endif
#if LUCARNE_ENABLE_VOLUME_LITTLEFS
        case VolumeFsKind::LittleFs:
            LittleFS.end();
            break;
#endif
#if LUCARNE_ENABLE_VOLUME_SPIFFS
        case VolumeFsKind::Spiffs:
            SPIFFS.end();
            break;
#endif
        default:
            break;
    }
    _volFs = nullptr;
    _volKind = VolumeFsKind::None;
    _volBasePath = nullptr;
}

bool volumeMounted() { return _volFs != nullptr; }

VolumeFsKind volumeFsKind() { return _volKind; }

fs::FS *volumeFs() { return _volFs; }

const char *volumeMountPath() { return _volBasePath ? _volBasePath : ""; }

}

#endif
