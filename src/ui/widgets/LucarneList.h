#ifndef LUCARNE_LIST_H
#define LUCARNE_LIST_H

#include "../LucarneWidget.h"

namespace lucarne {

class List : public Widget {
  public:
    static const uint8_t MAX_ITEMS = 12;

    List(int16_t x, int16_t y, int16_t w, int16_t h);

    void addItem(const char *label);
    void setItemStyle(uint8_t index, const TextStyle &style);
    void setTextFont(const AAFont *font);
    void setTextColor(uint16_t color);
    void setTextTransparent(bool transparent);
    void setTextSize(uint8_t size);
    void setTextSpacing(int8_t spacing);
    void clearItems();
    int itemCount() const { return _count; }

    void draw(Gfx &g, const Theme &theme, Store &store) override;

  private:
    const char *_items[MAX_ITEMS];
    TextStyle _itemStyles[MAX_ITEMS];
    TextStyle _textStyle;
    uint8_t _count;
    int _scroll;
};

}

#endif
