#include "LucarneClock.h"
#include <stdio.h>

namespace lucarne {

Clock::Clock(int16_t x, int16_t y, int16_t w, int16_t h, const char *hourKey, const char *minuteKey,
               const char *secondKey, ClockFormat format)
    : Widget(x, y, w, h), _timeKey(nullptr), _hourKey(hourKey), _minuteKey(minuteKey),
      _secondKey(secondKey), _format(format), _hasTextStyle(false) {}

void Clock::draw(Gfx &g, const Theme &theme, Store &store) {
    char buf[16];
    if (_timeKey && store.typeOf(_timeKey) == ValueType::String) {
        const char *s = store.getString(_timeKey, "");
        if (!s[0]) return;
        drawStyledText(g, theme, s, x, y, w, h, TextAlign::Center, theme.background,
                       _hasTextStyle ? &_textStyle : nullptr);
        return;
    }

    long hour = _hourKey ? store.getInt(_hourKey, 0) : 0;
    long minute = _minuteKey ? store.getInt(_minuteKey, 0) : 0;
    long second = _secondKey ? store.getInt(_secondKey, 0) : 0;
    hour %= 24;
    if (hour < 0) hour += 24;
    minute %= 60;
    if (minute < 0) minute += 60;
    second %= 60;
    if (second < 0) second += 60;

    if (_format == ClockFormat::hm12) {
        bool pm = hour >= 12;
        long h12 = hour % 12;
        if (h12 == 0) h12 = 12;
        if (_secondKey) {
            snprintf(buf, sizeof(buf), "%ld:%02ld:%02ld %c", h12, minute, second, pm ? 'P' : 'A');
        } else {
            snprintf(buf, sizeof(buf), "%ld:%02ld %c", h12, minute, pm ? 'P' : 'A');
        }
    } else if (_format == ClockFormat::Hms && _secondKey) {
        snprintf(buf, sizeof(buf), "%02ld:%02ld:%02ld", hour, minute, second);
    } else {
        snprintf(buf, sizeof(buf), "%02ld:%02ld", hour, minute);
    }

    drawStyledText(g, theme, buf, x, y, w, h, TextAlign::Center, theme.background,
                   _hasTextStyle ? &_textStyle : nullptr);
}

}
