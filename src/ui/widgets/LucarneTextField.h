#ifndef LUCARNE_TEXTFIELD_H
#define LUCARNE_TEXTFIELD_H

#include "../LucarneWidget.h"

namespace lucarne {

class TextField : public Widget {
  public:
    enum class Kind : uint8_t { Text, Numeric, Integer, Hex, Password };

    TextField(int16_t x, int16_t y, int16_t w, int16_t h);

    void setKey(const char *key) { markDirty(); _key = key; }
    const char *key() const { return _key; }
    void setLabel(const char *label) { markDirty(); _label = label; }
    const char *label() const { return _label; }
    void setPlaceholder(const char *placeholder) { markDirty(); _placeholder = placeholder; }
    const char *placeholder() const { return _placeholder; }
    void setMaxLen(uint8_t maxLen) { markDirty(); _maxLen = maxLen; }
    uint8_t maxLen() const { return _maxLen; }
    void setInputKind(Kind kind) { markDirty(); _kind = kind; }
    Kind inputKind() const { return _kind; }

    void setTextFont(const AAFont *font);
    void setTextColor(uint16_t color);
    void setTextTransparent(bool transparent);
    void setTextSize(uint8_t size);
    void setTextSpacing(int8_t spacing);

    void setFocused(bool focused) {
        if (_focused == focused) return;
        _focused = focused;
        markDirty();
    }
    bool focused() const { return _focused; }
    void setEditing(bool editing) {
        if (_editing == editing) return;
        _editing = editing;
        markDirty();
    }
    bool editing() const { return _editing; }
    void setLiveText(const char *text);
    const char *liveText() const { return _liveText; }

    TextField *asTextField() override { return this; }
    uint8_t storeKeys(const char **out, uint8_t max) const override { return appendKey(out, 0, max, _key); }
    void draw(Gfx &g, const Theme &theme, Store &store) override;

  private:
    static const uint8_t LIVE_LEN = 40;

    const char *_key;
    const char *_label;
    const char *_placeholder;
    uint8_t _maxLen;
    Kind _kind;
    TextStyle _textStyle;
    bool _focused;
    bool _editing;
    char _liveText[LIVE_LEN];
};

}

#endif
