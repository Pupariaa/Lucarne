#include "LucarneMenu.h"

namespace lucarne {

Menu::Menu(int16_t x, int16_t y, int16_t w, int16_t h)
    : Widget(x, y, w, h), _count(0), _selected(0), _scroll(0), _iconScale(1), _badgeScale(1) {}

void Menu::setIconScale(uint8_t scale) {
    if (scale < 1) scale = 1;
    _iconScale = scale;
}

void Menu::setBadgeScale(uint8_t scale) {
    if (scale < 1) scale = 1;
    _badgeScale = scale;
}

uint8_t Menu::resolvedScale(uint8_t scale) const {
    if (scale > 0) return scale;
    return 1;
}

int16_t Menu::targetIconPx(int16_t rh, uint8_t itemScale, uint8_t menuScale) const {
    uint8_t mul = resolvedScale(itemScale > 0 ? itemScale : menuScale);
    int16_t maxFit = (int16_t)(rh - 4);
    if (maxFit < 8) maxFit = 8;
    int16_t baseAt1 = (int16_t)(maxFit * 55 / 100);
    if (baseAt1 > 16) baseAt1 = 16;
    int16_t target = (int16_t)(baseAt1 * mul);
    if (target > maxFit) target = maxFit;
    return target;
}

void Menu::addItem(const char *label, IconId icon, Screen *target, Transition transition,
                   const MenuItemOpts &opts) {
    if (_count >= MAX_ITEMS) return;
    _items[_count].label = label;
    _items[_count].icon = icon;
    _items[_count].badge = opts.badge;
    _items[_count].noBadge = opts.noBadge;
    _items[_count].iconScale = opts.iconScale;
    _items[_count].badgeScale = opts.badgeScale;
    _items[_count].target = target;
    _items[_count].transition = transition;
    _items[_count].kind = MenuItemKind::Navigate;
    _items[_count].actionId = 0;
    _count++;
}

void Menu::addCallbackItem(const char *label, IconId icon, uint8_t actionId,
                           const MenuItemOpts &opts) {
    if (_count >= MAX_ITEMS) return;
    _items[_count].label = label;
    _items[_count].icon = icon;
    _items[_count].badge = opts.badge;
    _items[_count].noBadge = opts.noBadge;
    _items[_count].iconScale = opts.iconScale;
    _items[_count].badgeScale = opts.badgeScale;
    _items[_count].target = nullptr;
    _items[_count].transition = Transition::Inherit;
    _items[_count].kind = MenuItemKind::Callback;
    _items[_count].actionId = actionId;
    _count++;
}

void Menu::clearItems() {
    _count = 0;
    _selected = 0;
    _scroll = 0;
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

        uint16_t fill = sel ? theme.primary : theme.surface;
        uint16_t txt = sel ? theme.background : theme.text;
        g.fillRoundRect(x, ry, w, rh, theme.radius, fill);
        if (!sel) g.drawRoundRect(x, ry, w, rh, theme.radius, theme.surfaceEdge);

        int16_t pad = theme.padding;
        int16_t contentX = (int16_t)(x + pad);

        const Item &it = _items[idx];
        const uint16_t *icon = iconData(it.icon);
        if (icon) {
            int16_t side = targetIconPx(rh, it.iconScale, _iconScale);
            int16_t iconY = (int16_t)(ry + (rh - side) / 2);
            drawIconFit(g, icon, contentX, iconY, side, side, txt);
            contentX += (int16_t)(side + pad);
        }

        int16_t labelW = (int16_t)(x + w - pad - contentX);
        drawText(g, theme, it.label, contentX, ry, labelW, rh, TextAlign::Left, txt,
                 theme.textSize, fill, theme.font);

        if (!it.noBadge) {
            IconId badgeId = it.badge;
            if (badgeId == IconId::None && it.kind == MenuItemKind::Navigate && it.target) {
                badgeId = IconId::ArrowRight;
            }
            const uint16_t *badge = iconData(badgeId);
            if (badge) {
                int16_t side = targetIconPx(rh, it.badgeScale, _badgeScale);
                int16_t aY = (int16_t)(ry + (rh - side) / 2);
                drawIconFit(g, badge, (int16_t)(x + w - pad - side), aY, side, side, txt);
            }
        }
    }
}

}
