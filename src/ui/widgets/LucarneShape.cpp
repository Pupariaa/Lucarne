#include "LucarneShape.h"

namespace lucarne {

namespace {

bool pointInTriangle(int16_t px, int16_t py, int16_t x0, int16_t y0, int16_t x1, int16_t y1,
                     int16_t x2, int16_t y2) {
    int32_t d0 = (int32_t)(px - x2) * (int32_t)(y0 - y2) - (int32_t)(x0 - x2) * (int32_t)(py - y2);
    int32_t d1 = (int32_t)(px - x0) * (int32_t)(y1 - y0) - (int32_t)(x1 - x0) * (int32_t)(py - y0);
    int32_t d2 = (int32_t)(px - x1) * (int32_t)(y2 - y1) - (int32_t)(x2 - x1) * (int32_t)(py - y1);
    bool hasNeg = (d0 < 0) || (d1 < 0) || (d2 < 0);
    bool hasPos = (d0 > 0) || (d1 > 0) || (d2 > 0);
    return !(hasNeg && hasPos);
}

}

Shape::Shape(int16_t x, int16_t y, int16_t w, int16_t h, ShapeKind kind)
    : Widget(x, y, w, h), _kind(kind), _label(nullptr), _target(nullptr),
      _transition(Transition::Inherit), _actionId(0), _isCallback(false), _fill(0), _stroke(0),
      _strokeWidth(1), _hasFill(false), _hasStroke(false), _transparentFill(false),
      _transparentStroke(false), _selected(false), _group(nullptr), _activeFill(0), _activeStroke(0),
      _activeText(0), _hasActiveFill(false), _hasActiveStroke(false), _hasActiveText(false) {}

void Shape::setFill(uint16_t color) {
    markDirty();
    _fill = color;
    _hasFill = true;
    _transparentFill = false;
}

void Shape::setFillTransparent(bool transparent) { markDirty(); _transparentFill = transparent; }

void Shape::setStroke(uint16_t color) {
    markDirty();
    _stroke = color;
    _hasStroke = true;
    _transparentStroke = false;
}

void Shape::setStrokeTransparent(bool transparent) { markDirty(); _transparentStroke = transparent; }

void Shape::setStrokeWidth(uint8_t width) {
    markDirty();
    if (width < 1) width = 1;
    _strokeWidth = width;
}

void Shape::setTextColor(uint16_t color) {
    markDirty();
    _textStyle.color = color;
    _textStyle.hasColor = true;
}

void Shape::setTextSize(uint8_t size) {
    markDirty();
    _textStyle.size = size;
    _textStyle.hasSize = true;
}

void Shape::setTextFont(const AAFont *font) {
    markDirty();
    _textStyle.font = font;
    _textStyle.hasFont = true;
}

void Shape::setTextTransparent(bool transparent) { markDirty(); _textStyle.transparent = transparent; }

void Shape::setNavigate(Screen *target, Transition t) {
    markDirty();
    _target = target;
    _transition = t;
    _isCallback = false;
    _actionId = 0;
}

void Shape::setCallback(uint8_t actionId) {
    markDirty();
    _actionId = actionId;
    _isCallback = true;
    _target = nullptr;
}

void Shape::setActiveFill(uint16_t color) {
    markDirty();
    _activeFill = color;
    _hasActiveFill = true;
}

void Shape::setActiveStroke(uint16_t color) {
    markDirty();
    _activeStroke = color;
    _hasActiveStroke = true;
}

void Shape::setActiveText(uint16_t color) {
    markDirty();
    _activeText = color;
    _hasActiveText = true;
}

void Shape::clearActiveFill() { markDirty(); _hasActiveFill = false; }

void Shape::clearActiveStroke() { markDirty(); _hasActiveStroke = false; }

void Shape::clearActiveText() { markDirty(); _hasActiveText = false; }

bool Shape::hitTest(int16_t px, int16_t py) const {
    if (px < x || py < y || px >= x + w || py >= y + h) return false;
    if (_kind == ShapeKind::Rect) return true;
    if (_kind == ShapeKind::Circle) {
        int16_t cx = (int16_t)(x + w / 2);
        int16_t cy = (int16_t)(y + h / 2);
        int16_t r = w < h ? (int16_t)(w / 2) : (int16_t)(h / 2);
        int32_t dx = (int32_t)px - (int32_t)cx;
        int32_t dy = (int32_t)py - (int32_t)cy;
        return dx * dx + dy * dy <= (int32_t)r * (int32_t)r;
    }
    int16_t x0 = (int16_t)(x + w / 2);
    int16_t y0 = y;
    int16_t x1 = x;
    int16_t y1 = (int16_t)(y + h - 1);
    int16_t x2 = (int16_t)(x + w - 1);
    int16_t y2 = y1;
    return pointInTriangle(px, py, x0, y0, x1, y1, x2, y2);
}

void Shape::draw(Gfx &g, const Theme &theme, Store &store) {
    (void)store;
    uint16_t fill = _selected ? (_hasActiveFill ? _activeFill : theme.primary)
                              : (_hasFill ? _fill : theme.surface);
    uint16_t stroke = _selected ? (_hasActiveStroke ? _activeStroke : theme.text)
                                : (_hasStroke ? _stroke : theme.surfaceEdge);
    // An explicit active override means the shape should still show that state
    // (e.g. a focus highlight) even if it is otherwise configured as transparent.
    bool showFill = _selected ? (!_transparentFill || _hasActiveFill) : !_transparentFill;
    bool showStroke = _selected ? (!_transparentStroke || _hasActiveStroke) : !_transparentStroke;
    uint8_t sw = _strokeWidth;
    if (_kind == ShapeKind::Rect) {
        if (showFill) g.fillRect(x, y, w, h, fill);
        if (showStroke) {
            for (uint8_t i = 0; i < sw; i++) g.drawRect((int16_t)(x + i), (int16_t)(y + i),
                                                         (int16_t)(w - i * 2), (int16_t)(h - i * 2),
                                                         stroke);
        }
    } else if (_kind == ShapeKind::Circle) {
        int16_t cx = (int16_t)(x + w / 2);
        int16_t cy = (int16_t)(y + h / 2);
        int16_t r = w < h ? (int16_t)(w / 2) : (int16_t)(h / 2);
        if (showFill) g.fillCircle(cx, cy, r, fill);
        if (showStroke) g.drawCircle(cx, cy, r, stroke);
    } else {
        int16_t x0 = (int16_t)(x + w / 2);
        int16_t y0 = y;
        int16_t x1 = x;
        int16_t y1 = (int16_t)(y + h - 1);
        int16_t x2 = (int16_t)(x + w - 1);
        int16_t y2 = y1;
        if (showFill) g.fillTriangle(x0, y0, x1, y1, x2, y2, fill);
        if (showStroke) g.drawTriangle(x0, y0, x1, y1, x2, y2, stroke);
    }
    if (_label && _label[0]) {
        TextStyle style = _textStyle;
        if (!style.hasColor) {
            style.color = _selected ? (_hasActiveText ? _activeText : theme.background)
                                    : theme.background;
            style.hasColor = true;
        } else if (_selected && _hasActiveText) {
            style.color = _activeText;
        }
        uint16_t textBg = _transparentFill ? theme.background : fill;
        drawStyledText(g, theme, _label, x, y, w, h, TextAlign::Center, textBg, &style, false);
    }
}

}
