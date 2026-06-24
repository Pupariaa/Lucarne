#ifndef LUCARNE_MENU_H
#define LUCARNE_MENU_H

#include "../LucarneWidget.h"
#include "../LucarneIcons.h"
#include "../LucarneTransition.h"

namespace lucarne {

class Screen;

class Menu : public Widget {
  public:
    static const uint8_t MAX_ITEMS = 16;

    Menu(int16_t x, int16_t y, int16_t w, int16_t h);

    void addItem(const char *label, IconId icon = IconId::None, Screen *target = nullptr,
                 Transition transition = Transition::Inherit);
    void clearItems();

    void moveNext();
    void movePrev();
    Screen *selectedTarget() const;
    Transition selectedTransition() const;
    int selectedIndex() const { return _selected; }
    void setSelected(int index);
    int itemCount() const { return _count; }
    int scrollOffset() const { return _scroll; }
    const char *selectedLabel() const;

    Menu *asMenu() override { return this; }
    void draw(Gfx &g, const Theme &theme, Store &store) override;

  private:
    struct Item {
        const char *label;
        IconId icon;
        Screen *target;
        Transition transition;
    };

    Item _items[MAX_ITEMS];
    uint8_t _count;
    int _selected;
    int _scroll;
};

}

#endif
