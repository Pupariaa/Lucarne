#ifndef LUCARNE_BUTTON_H
#define LUCARNE_BUTTON_H

#include "../LucarneWidget.h"
#include "../LucarneTransition.h"

namespace lucarne {

class Screen;

class Button : public Widget {
  public:
    Button(int16_t x, int16_t y, int16_t w, int16_t h, const char *label);

    void setLabel(const char *label) { _label = label; }
    void setIconRef(const char *ref) { _icon = ref; }
    const char *iconRef() const { return _icon; }
    void setNavigate(Screen *target, Transition t = Transition::Inherit);
    void setCallback(uint8_t actionId);
    void setColor(uint16_t fill, uint16_t text);
    void setFillTransparent(bool transparent);
    void setTextColorTransparent(bool transparent);
    void setTextTransparent(bool transparent);
    void setTextFont(const AAFont *font);
    void setTextColor(uint16_t color);
    void setTextSize(uint8_t size);
    void setTextSpacing(int8_t spacing);
    void setTextAlign(TextAlign align) { _textAlign = align; }

    Screen *navigateTarget() const { return _target; }
    Transition navigateTransition() const { return _transition; }
    uint8_t callbackActionId() const { return _actionId; }
    bool isCallback() const { return _isCallback; }
    bool hitTest(int16_t px, int16_t py) const;

    Button *asButton() override { return this; }
    void draw(Gfx &g, const Theme &theme, Store &store) override;

  private:
    const char *_label;
    const char *_icon;
    Screen *_target;
    Transition _transition;
    uint8_t _actionId;
    bool _isCallback;
    uint16_t _fill;
    uint16_t _textColor;
    bool _hasColors;
    bool _transparentFill;
    bool _transparentTextColor;
    TextStyle _textStyle;
    TextAlign _textAlign;
};

}

#endif
