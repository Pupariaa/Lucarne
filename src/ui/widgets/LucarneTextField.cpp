#include "LucarneTextField.h"
#include <stdio.h>
#include <string.h>

namespace lucarne {

TextField::TextField(int16_t x, int16_t y, int16_t w, int16_t h)
    : Widget(x, y, w, h), _key(nullptr), _label(nullptr), _placeholder(nullptr), _maxLen(32),
      _kind(Kind::Text), _focused(false), _editing(false) {
    _liveText[0] = '\0';
}

void TextField::setTextFont(const AAFont *font) {
    markDirty();
    _textStyle.font = font;
    _textStyle.hasFont = true;
}

void TextField::setTextColor(uint16_t color) {
    markDirty();
    _textStyle.color = color;
    _textStyle.hasColor = true;
}

void TextField::setTextTransparent(bool transparent) { markDirty(); _textStyle.transparent = transparent; }

void TextField::setTextSize(uint8_t size) {
    markDirty();
    _textStyle.size = size;
    _textStyle.hasSize = true;
}

void TextField::setTextSpacing(int8_t spacing) {
    markDirty();
    _textStyle.spacing = spacing;
    _textStyle.hasSpacing = true;
}

void TextField::setLiveText(const char *text) {
    markDirty();
    if (!text) {
        _liveText[0] = '\0';
        return;
    }
    strncpy(_liveText, text, LIVE_LEN - 1);
    _liveText[LIVE_LEN - 1] = '\0';
}

void TextField::draw(Gfx &g, const Theme &theme, Store &store) {
    int16_t r = theme.radius < 6 ? theme.radius : 6;
    bool active = _focused || _editing;
    g.fillRoundRect(x, y, w, h, r, theme.surface);
    g.drawRoundRect(x, y, w, h, r, active ? theme.primary : theme.surfaceEdge);
    if (_editing) {
        g.drawRoundRect((int16_t)(x + 1), (int16_t)(y + 1), (int16_t)(w - 2), (int16_t)(h - 2), r,
                        theme.primary);
    }

    int16_t pad = theme.padding;
    char valueBuf[LIVE_LEN];
    const char *show = nullptr;
    bool dim = false;

    if (_editing) {
        show = _liveText;
        if (!show[0]) {
            show = _placeholder ? _placeholder : "";
            dim = true;
        } else if (_kind == Kind::Password) {
            uint8_t n = (uint8_t)strlen(_liveText);
            if (n > LIVE_LEN - 1) n = LIVE_LEN - 1;
            for (uint8_t i = 0; i < n; i++) valueBuf[i] = '*';
            valueBuf[n] = '\0';
            show = valueBuf;
        }
    } else if (_key && store.has(_key)) {
        if (_kind == Kind::Numeric || _kind == Kind::Integer) {
            if (_kind == Kind::Integer) snprintf(valueBuf, sizeof(valueBuf), "%ld", store.getInt(_key, 0));
            else snprintf(valueBuf, sizeof(valueBuf), "%g", (double)store.getFloat(_key, 0.0f));
            show = valueBuf;
        } else if (_kind == Kind::Password) {
            uint8_t n = (uint8_t)strlen(store.getString(_key, ""));
            if (n > LIVE_LEN - 1) n = LIVE_LEN - 1;
            for (uint8_t i = 0; i < n; i++) valueBuf[i] = '*';
            valueBuf[n] = '\0';
            show = valueBuf;
        } else {
            show = store.getString(_key, "");
        }
        if (!show || !show[0]) {
            show = _placeholder ? _placeholder : "";
            dim = true;
        }
    } else {
        show = _placeholder ? _placeholder : "";
        dim = true;
    }

    TextStyle style = _textStyle;
    if (dim && !style.hasColor) {
        style.color = theme.textDim;
        style.hasColor = true;
    }
    drawStyledText(g, theme, show, (int16_t)(x + pad), y, (int16_t)(w - pad * 2), h, TextAlign::Left,
                   theme.surface, &style, dim);

    if (_label && _label[0]) {
        TextStyle labelStyle;
        labelStyle.hasSize = true;
        labelStyle.size = 10;
        drawStyledText(g, theme, _label, x, (int16_t)(y - 12), w, 12, TextAlign::Left, theme.background,
                       &labelStyle, true);
    }
}

}
