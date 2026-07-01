#include "LucarneMenu.h"
#include "../LucarneIconDraw.h"

namespace lucarne {

static inline uint8_t iconScaleTenths(uint8_t raw) {
    if (raw == 0) return 10;
    if (raw <= 4) return (uint8_t)(raw * 10);
    if (raw > 40) return 40;
    return raw;
}

Menu::Menu(int16_t x, int16_t y, int16_t w, int16_t h)
    : Widget(x, y, w, h), _count(0), _selected(0), _scroll(0), _iconScale(1), _badgeScale(1),
      _activeFill(0), _activeText(0), _inactiveFill(0), _inactiveText(0), _inactiveEdge(0),
      _hasActiveFill(false), _hasActiveText(false), _hasInactiveFill(false), _hasInactiveText(false),
      _hasInactiveEdge(false) {}

void Menu::setIconScale(uint8_t scale) {
    _iconScale = scale;
}

void Menu::setBadgeScale(uint8_t scale) {
    _badgeScale = scale;
}

uint8_t Menu::resolvedScale(uint8_t scale) const {
    if (scale > 0) return scale;
    return _iconScale;
}

int16_t Menu::targetIconPx(int16_t rh, uint8_t itemScale, uint8_t menuScale) const {
    uint8_t raw = resolvedScale(itemScale > 0 ? itemScale : menuScale);
    uint8_t mulT = iconScaleTenths(raw);
    int16_t maxFit = (int16_t)(rh - 4);
    if (maxFit < 8) maxFit = 8;
    int16_t baseAt1 = (int16_t)(maxFit * 55 / 100);
    if (baseAt1 > 16) baseAt1 = 16;
    int16_t target = (int16_t)((baseAt1 * mulT + 5) / 10);
    if (target > maxFit) target = maxFit;
    return target;
}

void Menu::addItem(const char *label, const char *iconRef, Screen *target, Transition transition,
                   const MenuItemOpts &opts) {
    if (_count >= MAX_ITEMS) return;
    _items[_count].label = label;
    _items[_count].icon = iconRef;
    _items[_count].badge = opts.badge;
    _items[_count].noBadge = opts.noBadge;
    _items[_count].iconScale = opts.iconScale;
    _items[_count].badgeScale = opts.badgeScale;
    _items[_count].target = target;
    _items[_count].transition = transition;
    _items[_count].kind = MenuItemKind::Navigate;
    _items[_count].actionId = 0;
    _items[_count].textStyle = TextStyle();
    _count++;
}

void Menu::addCallbackItem(const char *label, const char *iconRef, uint8_t actionId,
                           const MenuItemOpts &opts) {
    if (_count >= MAX_ITEMS) return;
    _items[_count].label = label;
    _items[_count].icon = iconRef;
    _items[_count].badge = opts.badge;
    _items[_count].noBadge = opts.noBadge;
    _items[_count].iconScale = opts.iconScale;
    _items[_count].badgeScale = opts.badgeScale;
    _items[_count].target = nullptr;
    _items[_count].transition = Transition::Inherit;
    _items[_count].kind = MenuItemKind::Callback;
    _items[_count].actionId = actionId;
    _items[_count].textStyle = TextStyle();
    _count++;
}

void Menu::setItemStyle(uint8_t index, const TextStyle &style) {
    if (index >= _count) return;
    _items[index].textStyle = style;
}

void Menu::setTextFont(const AAFont *font) {
    _textStyle.font = font;
    _textStyle.hasFont = true;
}

void Menu::setTextColor(uint16_t color) {
    _textStyle.color = color;
    _textStyle.hasColor = true;
    _textStyle.transparent = false;
}

void Menu::setTextTransparent(bool transparent) { _textStyle.transparent = transparent; }

void Menu::setTextSize(uint8_t size) {
    _textStyle.size = size;
    _textStyle.hasSize = true;
}

void Menu::setTextSpacing(int8_t spacing) {
    _textStyle.spacing = spacing;
    _textStyle.hasSpacing = true;
}

void Menu::setActiveFill(uint16_t color) {
    _activeFill = color;
    _hasActiveFill = true;
}

void Menu::setActiveText(uint16_t color) {
    _activeText = color;
    _hasActiveText = true;
}

void Menu::setInactiveFill(uint16_t color) {
    _inactiveFill = color;
    _hasInactiveFill = true;
}

void Menu::setInactiveText(uint16_t color) {
    _inactiveText = color;
    _hasInactiveText = true;
}

void Menu::setInactiveEdge(uint16_t color) {
    _inactiveEdge = color;
    _hasInactiveEdge = true;
}

void Menu::clearActiveFill() { _hasActiveFill = false; }

void Menu::clearActiveText() { _hasActiveText = false; }

void Menu::clearInactiveFill() { _hasInactiveFill = false; }

void Menu::clearInactiveText() { _hasInactiveText = false; }

void Menu::clearInactiveEdge() { _hasInactiveEdge = false; }

void Menu::clearItems() {
    _count = 0;
    _selected = 0;
    _scroll = 0;
}

const char *Menu::itemIcon(uint8_t index) const {
    return index < _count ? _items[index].icon : nullptr;
}

const char *Menu::itemBadge(uint8_t index) const {
    return index < _count ? _items[index].badge : nullptr;
}

void Menu::moveNext() {
    if (_count == 0) return;
    _selected++;
    if (_selected >= _count) _selected = 0;
}

void Menu::movePrev() {
    if (_count == 0) return;
    _selected--;
    if (_selected < 0) _selected = _count - 1;
}

void Menu::setSelected(int index) {
    if (_count == 0) return;
    if (index < 0) index = 0;
    if (index >= _count) index = _count - 1;
    _selected = index;
}

MenuItemKind Menu::selectedKind() const {
    if (_count == 0) return MenuItemKind::Navigate;
    return _items[_selected].kind;
}

Screen *Menu::selectedTarget() const {
    if (_count == 0) return nullptr;
    if (_items[_selected].kind != MenuItemKind::Navigate) return nullptr;
    return _items[_selected].target;
}

Transition Menu::selectedTransition() const {
    if (_count == 0) return Transition::Inherit;
    return _items[_selected].transition;
}

uint8_t Menu::selectedActionId() const {
    if (_count == 0) return 0;
    return _items[_selected].actionId;
}

const char *Menu::selectedLabel() const {
    if (_count == 0) return "";
    return _items[_selected].label;
}

void Menu::draw(Gfx &g, const Theme &theme, Store &store) {
    (void)store;
    int16_t rowH = theme.rowHeight;
    if (rowH < 16) rowH = 16;
    int16_t visible = h / rowH;
    if (visible < 1) visible = 1;

    if (_selected < _scroll) _scroll = _selected;
    if (_selected >= _scroll + visible) _scroll = _selected - visible + 1;
    if (_scroll < 0) _scroll = 0;

    int16_t gap = 3;
    for (int16_t row = 0; row < visible; row++) {
        int idx = _scroll + row;
        if (idx >= _count) break;

        int16_t ry = (int16_t)(y + row * rowH);
        int16_t rh = (int16_t)(rowH - gap);
        bool sel = (idx == _selected);

        uint16_t fill = sel ? (_hasActiveFill ? _activeFill : theme.primary)
                            : (_hasInactiveFill ? _inactiveFill : theme.surface);
        uint16_t txt = sel ? (_hasActiveText ? _activeText : theme.background)
                           : (_hasInactiveText ? _inactiveText : theme.text);
        uint16_t edge = _hasInactiveEdge ? _inactiveEdge : theme.surfaceEdge;
        g.fillRoundRect(x, ry, w, rh, theme.radius, fill);
        if (!sel) g.drawRoundRect(x, ry, w, rh, theme.radius, edge);

        int16_t pad = theme.padding;
        int16_t contentX = (int16_t)(x + pad);

        const Item &it = _items[idx];
        if (iconRefValid(it.icon)) {
            int16_t side = targetIconPx(rh, it.iconScale, _iconScale);
            int16_t iconY = (int16_t)(ry + (rh - side) / 2);
            drawIconRef(g, it.icon, contentX, iconY, side, side, txt, fill);
            contentX += (int16_t)(side + pad);
        }

        int16_t labelW = (int16_t)(x + w - pad - contentX);
        TextStyle style = _textStyle;
        const TextStyle &itemStyle = it.textStyle;
        if (itemStyle.hasFont) {
            style.font = itemStyle.font;
            style.hasFont = true;
        }
        if (itemStyle.hasColor) {
            style.color = itemStyle.color;
            style.hasColor = true;
        }
        if (itemStyle.hasSize) {
            style.size = itemStyle.size;
            style.hasSize = true;
        }
        if (itemStyle.hasSpacing) {
            style.spacing = itemStyle.spacing;
            style.hasSpacing = true;
        }
        if (!style.hasColor) {
            style.color = txt;
            style.hasColor = true;
        }
        drawStyledText(g, theme, it.label, contentX, ry, labelW, rh, TextAlign::Left, fill, &style,
                       false);

        if (!it.noBadge) {
            const char *badgeRef = it.badge;
            if (!badgeRef && it.kind == MenuItemKind::Navigate && it.target) {
                badgeRef = "arrow_right";
            }
            if (badgeRef && iconRefValid(badgeRef)) {
                int16_t side = targetIconPx(rh, it.badgeScale, _badgeScale);
                int16_t aY = (int16_t)(ry + (rh - side) / 2);
                drawIconRef(g, badgeRef, (int16_t)(x + w - pad - side), aY, side, side, txt, fill);
            }
        }
    }
}

}
