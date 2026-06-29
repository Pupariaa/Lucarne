#ifndef LUCARNE_VOLUME_H
#define LUCARNE_VOLUME_H

#include <stdint.h>

#if defined(ESP32)
#include <FS.h>
#endif

namespace lucarne {

enum class VolumeFsKind : uint8_t {
    None = 0,
    Fat,
    LittleFs,
    Spiffs,
};

#if defined(ESP32)

bool mountVolume(VolumeFsKind kind, const char *partitionLabel, bool formatOnFail = false);
void unmountVolume();
bool volumeMounted();
VolumeFsKind volumeFsKind();
fs::FS *volumeFs();
const char *volumeMountPath();

#else

inline bool mountVolume(VolumeFsKind, const char *, bool = false) { return false; }
inline void unmountVolume() {}
inline bool volumeMounted() { return false; }
inline VolumeFsKind volumeFsKind() { return VolumeFsKind::None; }
inline const char *volumeMountPath() { return ""; }

#endif

}

#endif
