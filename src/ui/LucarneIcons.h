#ifndef LUCARNE_ICONS_H
#define LUCARNE_ICONS_H

#include <stdint.h>

namespace lucarne {

enum class IconId : uint8_t {
    None = 0,
    Home,
    Settings,
    Wifi,
    Bluetooth,
    Battery,
    Thermo,
    Drop,
    Fan,
    Bell,
    Chart,
    Power,
    Sun,
    Lock,
    Check,
    Cross,
    ArrowUp,
    ArrowDown,
    ArrowLeft,
    ArrowRight,
    Play,
    Pause,
    Plus,
    Minus,
    Count
};

static const uint8_t ICON_W = 16;
static const uint8_t ICON_H = 16;

const uint16_t *iconData(IconId id);
const char *iconName(IconId id);
IconId iconFromName(const char *name);

}

#endif
