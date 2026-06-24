#ifndef LUCARNE_LABEL_H
#define LUCARNE_LABEL_H

#include "../LucarneWidget.h"

namespace lucarne {

class Label : public Widget {
  public:
    Label(int16_t x, int16_t y, const char *text, TextAlign align = TextAlign::Left);

    void setText(const char *text);
    void setColor(uint16_t color);
    void clearColor();
    void setSize(uint8_t size);
    void setAlign(TextAlign align) { _align = align; }
    void setFont(const AAFont *font) { _font = font; }
    void setBackground(uint16_t bg) { _bg = bg; _hasBg = true; }

    void draw(Gfx &g, const Theme &theme, Store &store) override;

  private:
    const char *_text;
    TextAlign _align;
    uint16_t _color;
    bool _hasColor;
    uint8_t _size;
    bool _hasSize;
    const AAFont *_font;
    uint16_t _bg;
    bool _hasBg;
};

}

#endif
