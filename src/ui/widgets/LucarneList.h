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

    // D-pad focus: OK enters/leaves scroll mode, next()/prev() (Up/Down)
    // move the selection by one row while in that mode. Tapping a row
    // (touch) selects it directly via setSelected().
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
    void moveSelection(int direction);
    void setSelected(int index);
    int selectedIndex() const { return _selected; }
    const char *selectedLabel() const;
    // Row index under an absolute y coordinate, or -1 if none (used by
    // touch hit-testing); rowHeight must match the value used by draw().
    int rowAt(int16_t py, int16_t rowHeight) const;

    List *asList() override { return this; }
    void draw(Gfx &g, const Theme &theme, Store &store) override;

  private:
    const char *_items[MAX_ITEMS];
    TextStyle _itemStyles[MAX_ITEMS];
    TextStyle _textStyle;
    uint8_t _count;
    int _selected;
    int _scroll;
    bool _focused;
    bool _editing;
};

}

#endif
