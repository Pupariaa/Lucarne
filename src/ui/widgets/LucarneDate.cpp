#include "LucarneDate.h"
#include <stdio.h>

namespace lucarne {

Date::Date(int16_t x, int16_t y, int16_t w, int16_t h, const char *dayKey, const char *monthKey,
           const char *yearKey, DateFormat format)
    : Widget(x, y, w, h), _dateKey(nullptr), _dayKey(dayKey), _monthKey(monthKey), _yearKey(yearKey),
      _format(format), _hasTextStyle(false) {}

void Date::draw(Gfx &g, const Theme &theme, Store &store) {
    if (_dateKey && store.typeOf(_dateKey) == ValueType::String) {
        const char *s = store.getString(_dateKey, "");
        if (!s[0]) return;
        drawStyledText(g, theme, s, x, y, w, h, TextAlign::Center, theme.background,
                       _hasTextStyle ? &_textStyle : nullptr);
        return;
    }

    long day = _dayKey ? store.getInt(_dayKey, 1) : 1;
    long month = _monthKey ? store.getInt(_monthKey, 1) : 1;
    long year = _yearKey ? store.getInt(_yearKey, 2026) : 2026;
    if (day < 1) day = 1;
    if (day > 31) day = 31;
    if (month < 1) month = 1;
    if (month > 12) month = 12;

    char buf[20];
    switch (_format) {
        case DateFormat::YmdDash:
            snprintf(buf, sizeof(buf), "%04ld-%02ld-%02ld", year, month, day);
            break;
        case DateFormat::MdySlash:
            snprintf(buf, sizeof(buf), "%02ld/%02ld/%04ld", month, day, year);
            break;
        case DateFormat::DmyDot:
            snprintf(buf, sizeof(buf), "%02ld.%02ld.%04ld", day, month, year);
            break;
        default:
            snprintf(buf, sizeof(buf), "%02ld/%02ld/%04ld", day, month, year);
            break;
    }

    drawStyledText(g, theme, buf, x, y, w, h, TextAlign::Center, theme.background,
                   _hasTextStyle ? &_textStyle : nullptr);
}

}
