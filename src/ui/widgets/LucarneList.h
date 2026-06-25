#ifndef LUCARNE_LIST_H
#define LUCARNE_LIST_H

#include "../LucarneWidget.h"

namespace lucarne {

class List : public Widget {
  public:
    static const uint8_t MAX_ITEMS = 12;

    List(int16_t x, int16_t y, int16_t w, int16_t h);

    void addItem(const char *label);
    void clearItems();
    int itemCount() const { return _count; }

    void draw(Gfx &g, const Theme &theme, Store &store) override;

  private:
    const char *_items[MAX_ITEMS];
    uint8_t _count;
    int _scroll;
};

}

#endif
