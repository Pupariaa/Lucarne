#ifndef LUCARNE_SHAPE_H
#define LUCARNE_SHAPE_H

#include "../LucarneWidget.h"
#include "../LucarneTransition.h"

namespace lucarne {

class Screen;

enum class ShapeKind : uint8_t { Rect, Circle, Triangle };

class Shape : public Widget {
  public:
    Shape(int16_t x, int16_t y, int16_t w, int16_t h, ShapeKind kind);

    void setKind(ShapeKind kind) { markDirty(); _kind = kind; }
    ShapeKind kind() const { return _kind; }
    void setFill(uint16_t color);
    void setFillTransparent(bool transparent);
    void setStroke(uint16_t color);
    void setStrokeTransparent(bool transparent);
    void setStrokeWidth(uint8_t width);
    void setLabel(const char *label) { markDirty(); _label = label; }
    void setTextColor(uint16_t color);
    void setTextSize(uint8_t size);
    void setTextFont(const AAFont *font);
    void setTextTransparent(bool transparent);
    void setNavigate(Screen *target, Transition t = Transition::Inherit);
    void setCallback(uint8_t actionId);
    void setGroup(const char *group) { markDirty(); _group = group; }
    const char *group() const { return _group; }
    void setSelected(bool selected) {
        if (_selected == selected) return;
        _selected = selected;
        markDirty();
    }
    bool selected() const { return _selected; }
    void setActiveFill(uint16_t color);
    void setActiveStroke(uint16_t color);
    void setActiveText(uint16_t color);
    void clearActiveFill();
    void clearActiveStroke();
    void clearActiveText();
    bool isNavigable() const { return _isCallback || _target != nullptr; }

    Screen *navigateTarget() const { return _target; }
    Transition navigateTransition() const { return _transition; }
    uint8_t callbackActionId() const { return _actionId; }
    bool isCallback() const { return _isCallback; }
    bool hitTest(int16_t px, int16_t py) const;

    Shape *asShape() override { return this; }
    void draw(Gfx &g, const Theme &theme, Store &store) override;

  private:
    ShapeKind _kind;
    const char *_label;
    Screen *_target;
    Transition _transition;
    uint8_t _actionId;
    bool _isCallback;
    uint16_t _fill;
    uint16_t _stroke;
    uint8_t _strokeWidth;
    bool _hasFill;
    bool _hasStroke;
    bool _transparentFill;
    bool _transparentStroke;
    bool _selected;
    const char *_group;
    uint16_t _activeFill;
    uint16_t _activeStroke;
    uint16_t _activeText;
    bool _hasActiveFill;
    bool _hasActiveStroke;
    bool _hasActiveText;
    TextStyle _textStyle;
};

}

#endif
