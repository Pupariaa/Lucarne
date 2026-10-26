#ifndef LUCARNE_SLIDER_H
#define LUCARNE_SLIDER_H

#include "../LucarneWidget.h"

namespace lucarne {

class Slider : public Widget {
  public:
    Slider(int16_t x, int16_t y, int16_t w, int16_t h, const char *key, float minV, float maxV);

    void setKey(const char *key) { markDirty(); _key = key; }
    void setRange(float minV, float maxV) {
        markDirty();
        _min = minV;
        _max = maxV;
    }
    // Amount next()/prev() move the value by while the slider is focused and
    // in editing mode. Defaults to a 20th of the range if never set.
    void setStep(float step) { markDirty(); _step = step; }
    float step() const;
    void setColor(uint16_t c);
    void clearColor();

    // D-pad focus: OK enters/leaves editing mode, next()/prev() (Up/Down)
    // adjust the value by `step()` while editing, mirroring UI::registerField.
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
    void adjust(Store &store, int direction);
    // Direct manipulation (touch): maps an absolute x coordinate within the
    // widget to a value and writes it immediately.
    void setValueFromX(Store &store, int16_t px);

    Slider *asSlider() override { return this; }
    uint8_t storeKeys(const char **out, uint8_t max) const override { return appendKey(out, 0, max, _key); }
    Rect boundsLogical(Gfx &g, const Theme &theme) const override;
    void draw(Gfx &g, const Theme &theme, Store &store) override;

  private:
    const char *_key;
    float _min;
    float _max;
    float _step;
    uint16_t _color;
    bool _hasColor;
    bool _transparentColor;
    bool _focused;
    bool _editing;
};

}

#endif
