#ifndef LUCARNE_MENU_H
#define LUCARNE_MENU_H

#include "../LucarneWidget.h"
#include "../LucarneTransition.h"

namespace lucarne {

class Screen;

enum class MenuItemKind : uint8_t { Navigate, Callback };

struct MenuItemOpts {
    const char *badge = nullptr;
    bool noBadge = false;
    uint8_t iconScale = 0;
    uint8_t badgeScale = 0;
};

class Menu : public Widget {
  public:
    static const uint8_t MAX_ITEMS = 16;

    Menu(int16_t x, int16_t y, int16_t w, int16_t h);

    void setIconScale(uint8_t scale);
    void setBadgeScale(uint8_t scale);

    void addItem(const char *label, const char *iconRef, Screen *target = nullptr,
                 Transition transition = Transition::Inherit, const MenuItemOpts &opts = MenuItemOpts());
    void addCallbackItem(const char *label, const char *iconRef, uint8_t actionId,
                         const MenuItemOpts &opts = MenuItemOpts());
    void clearItems();

    void moveNext();
    void movePrev();
    MenuItemKind selectedKind() const;
    Screen *selectedTarget() const;
    Transition selectedTransition() const;
    uint8_t selectedActionId() const;
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
        const char *icon;
        const char *badge;
        bool noBadge;
        uint8_t iconScale;
        uint8_t badgeScale;
        Screen *target;
        Transition transition;
        MenuItemKind kind;
        uint8_t actionId;
    };

    uint8_t resolvedScale(uint8_t scale) const;
    int16_t targetIconPx(int16_t rh, uint8_t itemScale, uint8_t menuScale) const;
    Item _items[MAX_ITEMS];
    uint8_t _count;
    int _selected;
    int _scroll;
    uint8_t _iconScale;
    uint8_t _badgeScale;
};

}

#endif
