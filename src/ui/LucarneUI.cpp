#include "LucarneUI.h"
#include "LucarneIconDraw.h"
#include "LucarneImageLoader.h"
#include "widgets/LucarneButton.h"
#include "widgets/LucarneShape.h"
#include "widgets/LucarneSwitch.h"
#include "widgets/LucarneTextField.h"
#include "widgets/LucarneSlider.h"
#include "widgets/LucarneList.h"
#include "widgets/LucarneLabel.h"
#include "../core/LucarneColor.h"
#include "../hal/LucarneHal.h"
#include <Arduino.h>
#include <ctype.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

namespace lucarne {

namespace {

struct KbKey {
    const char *token;
    uint8_t units;
};

struct KbRow {
    const KbKey *keys;
    uint8_t count;
};

struct KbLayoutDef {
    const KbRow *rows;
    uint8_t rowCount;
};

#define LUCARNE_KB_ROW(name, ...)                                                                  \
    static const KbKey name[] = {__VA_ARGS__};

LUCARNE_KB_ROW(kRowNums, {"1", 1}, {"2", 1}, {"3", 1}, {"4", 1}, {"5", 1}, {"6", 1}, {"7", 1}, {"8", 1},
              {"9", 1}, {"0", 1})
LUCARNE_KB_ROW(kRowQwerty1, {"q", 1}, {"w", 1}, {"e", 1}, {"r", 1}, {"t", 1}, {"y", 1}, {"u", 1}, {"i", 1},
              {"o", 1}, {"p", 1})
LUCARNE_KB_ROW(kRowQwerty2, {"a", 1}, {"s", 1}, {"d", 1}, {"f", 1}, {"g", 1}, {"h", 1}, {"j", 1}, {"k", 1},
              {"l", 1})
LUCARNE_KB_ROW(kRowQwerty3, {"^", 1}, {"z", 1}, {"x", 1}, {"c", 1}, {"v", 1}, {"b", 1}, {"n", 1}, {"m", 1},
              {"<-", 2})
LUCARNE_KB_ROW(kRowQwertyMinimal, {"^", 1}, {"a", 1}, {"s", 1}, {"d", 1}, {"f", 1}, {"g", 1}, {"h", 1},
              {"j", 1}, {"k", 1}, {"l", 1}, {"<-", 1})
LUCARNE_KB_ROW(kRowBottomFull, {"123", 2}, {" ", 5}, {"OK", 2})
LUCARNE_KB_ROW(kRowBottomCompact, {"123", 2}, {" ", 4}, {"OK", 2})
LUCARNE_KB_ROW(kRowBottomMinimal, {"123", 1}, {" ", 6}, {"OK", 1})

LUCARNE_KB_ROW(kRowAzerty1, {"a", 1}, {"z", 1}, {"e", 1}, {"r", 1}, {"t", 1}, {"y", 1}, {"u", 1}, {"i", 1},
              {"o", 1}, {"p", 1})
LUCARNE_KB_ROW(kRowAzerty2, {"q", 1}, {"s", 1}, {"d", 1}, {"f", 1}, {"g", 1}, {"h", 1}, {"j", 1}, {"k", 1},
              {"l", 1}, {"m", 1})
LUCARNE_KB_ROW(kRowAzerty3, {"^", 1}, {"w", 1}, {"x", 1}, {"c", 1}, {"v", 1}, {"b", 1}, {"n", 1}, {"<-", 2})
LUCARNE_KB_ROW(kRowAzertyMinimal, {"^", 1}, {"q", 1}, {"s", 1}, {"d", 1}, {"f", 1}, {"g", 1}, {"h", 1},
              {"j", 1}, {"k", 1}, {"l", 1}, {"<-", 1})

LUCARNE_KB_ROW(kRowNum1, {"1", 1}, {"2", 1}, {"3", 1})
LUCARNE_KB_ROW(kRowNum2, {"4", 1}, {"5", 1}, {"6", 1})
LUCARNE_KB_ROW(kRowNum3, {"7", 1}, {"8", 1}, {"9", 1})
LUCARNE_KB_ROW(kRowNum4, {".", 1}, {"0", 1}, {"-", 1}, {"<-", 1})
LUCARNE_KB_ROW(kRowNumOk, {"ABC", 2}, {"OK", 2})

LUCARNE_KB_ROW(kRowHex1, {"1", 1}, {"2", 1}, {"3", 1}, {"A", 1})
LUCARNE_KB_ROW(kRowHex2, {"4", 1}, {"5", 1}, {"6", 1}, {"B", 1})
LUCARNE_KB_ROW(kRowHex3, {"7", 1}, {"8", 1}, {"9", 1}, {"C", 1})
LUCARNE_KB_ROW(kRowHex4, {"0", 1}, {"D", 1}, {"E", 1}, {"F", 1})
LUCARNE_KB_ROW(kRowHexOk, {"<-", 2}, {"OK", 2})

#undef LUCARNE_KB_ROW

static const KbRow kRowsFull[] = {{kRowNums, 10}, {kRowQwerty1, 10}, {kRowQwerty2, 9}, {kRowQwerty3, 9},
                                  {kRowBottomFull, 3}};
static const KbRow kRowsCompact[] = {{kRowQwerty1, 10}, {kRowQwerty2, 9}, {kRowQwerty3, 9},
                                     {kRowBottomCompact, 3}};
static const KbRow kRowsMinimal[] = {{kRowNums, 10}, {kRowQwerty1, 10}, {kRowQwertyMinimal, 11},
                                     {kRowBottomMinimal, 3}};
static const KbRow kRowsFullAzerty[] = {{kRowNums, 10}, {kRowAzerty1, 10}, {kRowAzerty2, 10},
                                        {kRowAzerty3, 8}, {kRowBottomFull, 3}};
static const KbRow kRowsCompactAzerty[] = {{kRowAzerty1, 10}, {kRowAzerty2, 10}, {kRowAzerty3, 8},
                                           {kRowBottomCompact, 3}};
static const KbRow kRowsMinimalAzerty[] = {{kRowNums, 10}, {kRowAzerty1, 10}, {kRowAzertyMinimal, 11},
                                           {kRowBottomMinimal, 3}};
static const KbRow kRowsNumeric[] = {{kRowNum1, 3}, {kRowNum2, 3}, {kRowNum3, 3}, {kRowNum4, 4},
                                     {kRowNumOk, 2}};
static const KbRow kRowsHex[] = {{kRowHex1, 4}, {kRowHex2, 4}, {kRowHex3, 4}, {kRowHex4, 4},
                                 {kRowHexOk, 2}};

static const KbLayoutDef kLayoutFull = {kRowsFull, 5};
static const KbLayoutDef kLayoutCompact = {kRowsCompact, 4};
static const KbLayoutDef kLayoutMinimal = {kRowsMinimal, 4};
static const KbLayoutDef kLayoutFullAzerty = {kRowsFullAzerty, 5};
static const KbLayoutDef kLayoutCompactAzerty = {kRowsCompactAzerty, 4};
static const KbLayoutDef kLayoutMinimalAzerty = {kRowsMinimalAzerty, 4};
static const KbLayoutDef kLayoutNumeric = {kRowsNumeric, 5};
static const KbLayoutDef kLayoutHex = {kRowsHex, 5};

const KbLayoutDef *kbLayoutFor(KeyboardLayout id) {
    switch (id) {
        case KeyboardLayout::Full: return &kLayoutFull;
        case KeyboardLayout::Compact: return &kLayoutCompact;
        case KeyboardLayout::Minimal: return &kLayoutMinimal;
        case KeyboardLayout::FullAzerty: return &kLayoutFullAzerty;
        case KeyboardLayout::CompactAzerty: return &kLayoutCompactAzerty;
        case KeyboardLayout::MinimalAzerty: return &kLayoutMinimalAzerty;
        case KeyboardLayout::Numeric: return &kLayoutNumeric;
        case KeyboardLayout::Hex: return &kLayoutHex;
    }
    return &kLayoutCompact;
}

uint8_t kbKeyCount(const KbLayoutDef *layout) {
    uint8_t n = 0;
    for (uint8_t r = 0; r < layout->rowCount; r++) n = (uint8_t)(n + layout->rows[r].count);
    return n;
}

const KbKey *kbKeyAt(const KbLayoutDef *layout, uint8_t flatIndex) {
    for (uint8_t r = 0; r < layout->rowCount; r++) {
        const KbRow &row = layout->rows[r];
        if (flatIndex < row.count) return &row.keys[flatIndex];
        flatIndex = (uint8_t)(flatIndex - row.count);
    }
    return nullptr;
}

KeyboardLayout kbSuggestedLayout(TextField::Kind kind, KeyboardLayout hwLayout) {
    if (kind == TextField::Kind::Numeric || kind == TextField::Kind::Integer) return KeyboardLayout::Numeric;
    if (kind == TextField::Kind::Hex) return KeyboardLayout::Hex;
    return hwLayout;
}

bool kbAcceptChar(char c, TextField::Kind kind) {
    if (kind == TextField::Kind::Numeric) return (c >= '0' && c <= '9') || c == '.' || c == '-';
    if (kind == TextField::Kind::Integer) return (c >= '0' && c <= '9') || c == '-';
    if (kind == TextField::Kind::Hex) return (c >= '0' && c <= '9') || (c >= 'A' && c <= 'F') || (c >= 'a' && c <= 'f');
    return true;
}

void kbMetrics(int16_t pw, int16_t ph, const KbLayoutDef *layout, int16_t &outKeyH, int16_t &outTotalH) {
    const int16_t pad = 2;
    const int16_t gap = 2;
    uint8_t rows = layout->rowCount > 0 ? layout->rowCount : 1;
    int16_t byH = (int16_t)((ph * 4 / 10) / rows - gap);
    int16_t byW = (int16_t)(pw / 14);
    int16_t kh = byH < byW ? byH : byW;
    if (kh > 32) kh = 32;
    if (kh < 8) kh = 8;
    outKeyH = kh;
    int16_t rowGaps = (int16_t)(layout->rowCount > 0 ? layout->rowCount - 1 : 0);
    outTotalH = (int16_t)(pad * 2 + layout->rowCount * kh + rowGaps * gap);
}

int16_t kbHitTest(const KbLayoutDef *layout, int16_t pw, int16_t kbY, int16_t keyH, int16_t px, int16_t py) {
    const int16_t pad = 2;
    const int16_t gap = 2;
    int16_t cy = (int16_t)(kbY + pad);
    uint8_t flat = 0;
    for (uint8_t r = 0; r < layout->rowCount; r++) {
        const KbRow &row = layout->rows[r];
        uint16_t totalUnits = 0;
        for (uint8_t i = 0; i < row.count; i++) totalUnits = (uint16_t)(totalUnits + row.keys[i].units);
        int16_t rowW = (int16_t)(pw - pad * 2);
        float unitW = (float)(rowW - gap * (row.count > 0 ? row.count - 1 : 0)) /
                     (float)(totalUnits > 0 ? totalUnits : 1);
        int16_t cx = (int16_t)pad;
        for (uint8_t i = 0; i < row.count; i++) {
            int16_t kw = (int16_t)(unitW * row.keys[i].units);
            if (kw < 4) kw = 4;
            if (px >= cx && px < cx + kw && py >= cy && py < cy + keyH) return (int16_t)flat;
            cx = (int16_t)(cx + kw + gap);
            flat++;
        }
        cy = (int16_t)(cy + keyH + gap);
    }
    return -1;
}

}

UI::UI(Gfx &display)
    : _display(display), _current(nullptr), _activeMenu(nullptr), _focusCount(0),
      _focusSel(0), _focusGroupId(nullptr), _stackTop(0), _defaultTransition(Transition::None),
      _transitionMs(kTransitionMsDefault), _strategy(RenderStrategy::Auto), _bindingCount(0), _autoCount(0),
      _autoOverflow(false), _autoStale(true), _lastPatchMs(0), _fieldCount(0), _editingField(nullptr),
      _editingSlider(nullptr), _editingList(nullptr), _kbField(nullptr),
      _kbActiveLayout(KeyboardLayout::Compact), _kbAlphaLayout(KeyboardLayout::Compact),
      _kbShift(false), _kbIndex(0), _menuHandler(nullptr),
      _pendingMenuAction(0), _splashNext(nullptr), _splashDuration(0), _splashProgress(false),
      _splashActive(false), _splashStart(0), _halProfileSet(false) {
    for (uint8_t i = 0; i < MAX_FOCUS_GROUP; i++) _focusGroup[i] = nullptr;
    _kbBuffer[0] = '\0';
    _invalid.setScreen(display.width(), display.height());
    _invalid.addFull();
}

void UI::setTheme(const Theme &theme) {
    _theme = theme;
    invalidate();
}

const HalProfile &UI::halProfile() const {
    return _halProfileSet ? _halProfile : halActiveProfile();
}

const Theme &UI::activeTheme() const { return themeFor(_current); }

const Theme &UI::themeFor(Screen *screen) const {
    if (screen) {
        const Theme *custom = screen->customTheme();
        if (custom) return *custom;
    }
    return _theme;
}

void UI::invalidateWidget(Widget *widget) {
    if (!widget) return;
    widget->markDirty();
}

void UI::setTransition(Transition def, uint16_t durationMs) {
    _defaultTransition = def;
    _transitionMs = durationMs;
}

void UI::scanActiveMenu() {
    _activeMenu = nullptr;
    if (!_current) return;
    for (Widget *w = _current->first(); w; w = w->_next) {
        Menu *m = w->asMenu();
        if (m) {
            _activeMenu = m;
            return;
        }
    }
}

namespace {

bool groupEqual(const char *a, const char *b) {
    if (!a || !a[0]) a = "menu";
    if (!b || !b[0]) b = "menu";
    return strcmp(a, b) == 0;
}

}

bool UI::widgetFocusable(Widget *w) const {
    if (!w || !w->visible) return false;
    Shape *sh = w->asShape();
    if (sh) return sh->isNavigable();
    Switch *sw = w->asSwitch();
    if (sw) return true;
    if (w->asTextField()) return true;
    if (w->asSlider()) return true;
    List *ls = w->asList();
    if (ls) return ls->itemCount() > 0;
    Button *btn = w->asButton();
    if (btn) {
        if (btn->isCallback() || btn->navigateTarget() != nullptr) return true;
        for (uint8_t i = 0; i < _fieldCount; i++) {
            if (_fields[i].button == btn) return true;
        }
        return false;
    }
    return false;
}

bool UI::focusGroupMatches(Widget *w) const {
    if (!widgetFocusable(w)) return false;
    if (!_focusGroupId) return false;
    Shape *sh = w->asShape();
    if (sh) return groupEqual(sh->group(), _focusGroupId);
    return true;
}

void UI::setWidgetFocused(Widget *w, bool focused) {
    if (!w) return;
    Shape *sh = w->asShape();
    if (sh) {
        sh->setSelected(focused);
        return;
    }
    Button *btn = w->asButton();
    if (btn) {
        btn->setFocused(focused);
        if (!focused) btn->setEditing(false);
        return;
    }
    Switch *sw = w->asSwitch();
    if (sw) {
        sw->setFocused(focused);
        return;
    }
    TextField *tf = w->asTextField();
    if (tf) {
        tf->setFocused(focused);
        return;
    }
    Slider *sl = w->asSlider();
    if (sl) {
        sl->setFocused(focused);
        if (!focused) sl->setEditing(false);
        return;
    }
    List *ls = w->asList();
    if (ls) {
        ls->setFocused(focused);
        if (!focused) ls->setEditing(false);
    }
}

void UI::clearFocusSelection() {
    for (uint8_t i = 0; i < _focusCount; i++) setWidgetFocused(_focusGroup[i], false);
}

void UI::selectFocusIndex(uint8_t idx) {
    if (_focusCount == 0) return;
    if (idx >= _focusCount) idx = (uint8_t)(_focusCount - 1);
    clearFocusSelection();
    _focusSel = idx;
    setWidgetFocused(_focusGroup[idx], true);
}

void UI::scanActiveFocusGroup() {
    endEditField();
    endTextEdit();
    endSliderEdit();
    endListEdit();
    for (uint8_t i = 0; i < _focusCount; i++) setWidgetFocused(_focusGroup[i], false);
    for (uint8_t i = 0; i < MAX_FOCUS_GROUP; i++) _focusGroup[i] = nullptr;
    _focusCount = 0;
    _focusSel = 0;
    _focusGroupId = nullptr;
    if (!_current || _activeMenu) return;

    Shape *firstShape = nullptr;
    for (Widget *w = _current->first(); w; w = w->_next) {
        Shape *sh = w->asShape();
        if (sh && sh->isNavigable()) {
            firstShape = sh;
            break;
        }
    }
    _focusGroupId = firstShape ? firstShape->group() : nullptr;
    if (!_focusGroupId || !_focusGroupId[0]) _focusGroupId = "menu";

    for (Widget *w = _current->first(); w; w = w->_next) {
        if (!w->visible) continue;
        Shape *sh = w->asShape();
        if (sh) {
            if (!sh->isNavigable()) continue;
            if (!groupEqual(sh->group(), _focusGroupId)) continue;
            if (_focusCount >= MAX_FOCUS_GROUP) break;
            _focusGroup[_focusCount++] = w;
            continue;
        }
        if (!widgetFocusable(w)) continue;
        if (_focusCount >= MAX_FOCUS_GROUP) break;
        _focusGroup[_focusCount++] = w;
    }

    if (_focusCount == 0) {
        _focusGroupId = nullptr;
        return;
    }

    for (uint8_t i = 0; i < _focusCount - 1; i++) {
        for (uint8_t j = (uint8_t)(i + 1); j < _focusCount; j++) {
            Widget *a = _focusGroup[i];
            Widget *b = _focusGroup[j];
            int ay = a->y + a->h / 2;
            int by = b->y + b->h / 2;
            int ax = a->x + a->w / 2;
            int bx = b->x + b->w / 2;
            bool swap = ay > by || (ay == by && ax > bx);
            if (swap) {
                _focusGroup[i] = b;
                _focusGroup[j] = a;
            }
        }
    }

    selectFocusIndex(0);
}

void UI::activateFocused() {
    if (_focusCount == 0 || _focusSel >= _focusCount) return;
    Widget *w = _focusGroup[_focusSel];
    if (!w) return;
    Shape *sh = w->asShape();
    if (sh) {
        if (!sh->isNavigable()) return;
        if (sh->isCallback()) {
            uint8_t id = sh->callbackActionId();
            if (id) _pendingMenuAction = id;
            if (_menuHandler) _menuHandler(id);
            return;
        }
        if (sh->navigateTarget()) navigate(sh->navigateTarget(), sh->navigateTransition());
        return;
    }
    Switch *sw = w->asSwitch();
    if (sw) {
        sw->toggle(_store);
        return;
    }
    TextField *tf = w->asTextField();
    if (tf) {
        beginTextEdit(tf);
        return;
    }
    Slider *sl = w->asSlider();
    if (sl) {
        if (_editingSlider == sl) endSliderEdit();
        else beginSliderEdit(sl);
        return;
    }
    List *ls = w->asList();
    if (ls) {
        if (_editingList == ls) endListEdit();
        else beginListEdit(ls);
        return;
    }
    Button *btn = w->asButton();
    if (btn) {
        ValueField *f = findField(btn);
        if (f) {
            if (_editingField == f) {
                endEditField();
            } else {
                beginEditField(f);
            }
            return;
        }
        if (btn->isCallback()) {
            uint8_t id = btn->callbackActionId();
            if (id) _pendingMenuAction = id;
            if (_menuHandler) _menuHandler(id);
            return;
        }
        if (btn->navigateTarget()) navigate(btn->navigateTarget(), btn->navigateTransition());
    }
}

UI::ValueField *UI::findField(Button *button) {
    if (!button) return nullptr;
    for (uint8_t i = 0; i < _fieldCount; i++) {
        if (_fields[i].button == button) return &_fields[i];
    }
    return nullptr;
}

void UI::formatField(ValueField &f) {
    if (!f.button || !f.key) return;
    uint8_t idx = (uint8_t)(&f - _fields);
    char valueBuf[24];
    float v = _store.getFloat(f.key, 0.0f);
    snprintf(valueBuf, sizeof(valueBuf), "%.*f", (int)f.decimals, (double)v);
    char *buf = _fieldText[idx];
    if (f.label && f.label[0]) {
        if (f.unit && f.unit[0]) {
            snprintf(buf, 40, "%s: %s %s", f.label, valueBuf, f.unit);
        } else {
            snprintf(buf, 40, "%s: %s", f.label, valueBuf);
        }
    } else if (f.unit && f.unit[0]) {
        snprintf(buf, 40, "%s %s", valueBuf, f.unit);
    } else {
        snprintf(buf, 40, "%s", valueBuf);
    }
    f.button->setLabel(buf);
}

void UI::registerField(Button *button, const char *key, float step, float minV, float maxV,
                       uint8_t decimals, const char *label, const char *unit) {
    if (!button || !key || _fieldCount >= MAX_VALUE_FIELDS) return;
    ValueField &f = _fields[_fieldCount++];
    f.button = button;
    f.key = key;
    f.label = label;
    f.unit = unit;
    f.step = step;
    f.minV = minV;
    f.maxV = maxV;
    f.decimals = decimals;
    formatField(f);
}

void UI::refreshField(Button *button) {
    ValueField *f = findField(button);
    if (f) formatField(*f);
}

void UI::refreshFields() {
    for (uint8_t i = 0; i < _fieldCount; i++) formatField(_fields[i]);
}

void UI::beginEditField(ValueField *f) {
    if (!f || !f->button) return;
    _editingField = f;
    f->button->setEditing(true);
    formatField(*f);
}

void UI::endEditField() {
    if (!_editingField) return;
    Button *btn = _editingField->button;
    _editingField = nullptr;
    if (btn) {
        btn->setEditing(false);
        ValueField *f = findField(btn);
        if (f) formatField(*f);
    }
}

void UI::adjustEditingField(int direction) {
    if (!_editingField) return;
    ValueField &f = *_editingField;
    float v = _store.getFloat(f.key, 0.0f);
    v += (direction > 0 ? f.step : -f.step);
    if (v < f.minV) v = f.minV;
    if (v > f.maxV) v = f.maxV;
    _store.setFloat(f.key, v);
    formatField(f);
}

void UI::beginTextEdit(TextField *field) {
    if (!field) return;
    _kbField = field;
    _kbAlphaLayout = kbSuggestedLayout(field->inputKind(), _kbOptions.layout);
    _kbActiveLayout = _kbAlphaLayout;
    _kbShift = false;
    _kbIndex = 0;
    _kbBuffer[0] = '\0';
    const char *key = field->key();
    if (key && _store.has(key)) {
        if (field->inputKind() == TextField::Kind::Integer) {
            snprintf(_kbBuffer, KB_BUFFER_LEN, "%ld", _store.getInt(key, 0));
        } else if (field->inputKind() == TextField::Kind::Numeric) {
            snprintf(_kbBuffer, KB_BUFFER_LEN, "%g", (double)_store.getFloat(key, 0.0f));
        } else {
            strncpy(_kbBuffer, _store.getString(key, ""), KB_BUFFER_LEN - 1);
            _kbBuffer[KB_BUFFER_LEN - 1] = '\0';
        }
    }
    field->setEditing(true);
    field->setLiveText(_kbBuffer);
    invalidateKeyboard();
}

void UI::endTextEdit() {
    if (!_kbField) return;
    invalidateKeyboard();
    _kbField->setEditing(false);
    _kbField = nullptr;
}

void UI::beginSliderEdit(Slider *s) {
    if (!s) return;
    _editingSlider = s;
    s->setEditing(true);
}

void UI::endSliderEdit() {
    if (!_editingSlider) return;
    _editingSlider->setEditing(false);
    _editingSlider = nullptr;
}

void UI::adjustEditingSlider(int direction) {
    if (!_editingSlider) return;
    _editingSlider->adjust(_store, direction);
}

void UI::beginListEdit(List *l) {
    if (!l) return;
    _editingList = l;
    l->setEditing(true);
}

void UI::endListEdit() {
    if (!_editingList) return;
    _editingList->setEditing(false);
    _editingList = nullptr;
}

void UI::moveEditingList(int direction) {
    if (!_editingList) return;
    _editingList->moveSelection(direction);
}

void UI::moveKbFocus(int8_t direction) {
    if (!_kbField) return;
    const KbLayoutDef *layout = kbLayoutFor(_kbActiveLayout);
    uint8_t count = kbKeyCount(layout);
    if (count == 0) return;
    if (direction > 0) _kbIndex = (uint8_t)((_kbIndex + 1) % count);
    else _kbIndex = (uint8_t)(_kbIndex == 0 ? count - 1 : _kbIndex - 1);
    invalidateKeyboard();
}

Rect UI::keyboardRect() const {
    const KbLayoutDef *layout = kbLayoutFor(_kbActiveLayout);
    int16_t keyH = 0;
    int16_t kbH = 0;
    kbMetrics(_display.width(), _display.height(), layout, keyH, kbH);
    int16_t kbY = _kbOptions.dock == 1 ? 0 : (int16_t)(_display.height() - kbH);
    if (kbY < 0) kbY = 0;
    return Rect(0, kbY, _display.width(), kbH);
}

void UI::invalidateKeyboard() { _invalid.add(keyboardRect()); }

void UI::selectKbKey() {
    if (!_kbField) return;
    const KbLayoutDef *layout = kbLayoutFor(_kbActiveLayout);
    const KbKey *k = kbKeyAt(layout, _kbIndex);
    if (k) applyKbToken(k->token);
}

void UI::applyKbToken(const char *token) {
    if (!_kbField || !token) return;
    TextField::Kind kind = _kbField->inputKind();
    size_t len = strlen(_kbBuffer);

    if (strcmp(token, "OK") == 0) {
        endTextEdit();
        return;
    }
    invalidateKeyboard();
    if (strcmp(token, "<-") == 0) {
        if (len > 0) _kbBuffer[len - 1] = '\0';
    } else if (strcmp(token, "^") == 0) {
        // One-shot shift: capitalizes the next letter, then reverts automatically.
        _kbShift = !_kbShift;
    } else if (strcmp(token, "123") == 0) {
        _kbActiveLayout = KeyboardLayout::Numeric;
        _kbShift = false;
        _kbIndex = 0;
    } else if (strcmp(token, "ABC") == 0) {
        _kbActiveLayout = _kbAlphaLayout;
        _kbShift = false;
        _kbIndex = 0;
    } else if (strcmp(token, " ") == 0) {
        if ((kind == TextField::Kind::Text || kind == TextField::Kind::Password) &&
            len < _kbField->maxLen() && len < KB_BUFFER_LEN - 1) {
            _kbBuffer[len] = ' ';
            _kbBuffer[len + 1] = '\0';
        }
    } else if (token[0] != '\0' && token[1] == '\0') {
        char c = token[0];
        if (_kbShift && c >= 'a' && c <= 'z') {
            c = (char)toupper(c);
            _kbShift = false;
        }
        if (kbAcceptChar(c, kind) && len < _kbField->maxLen() && len < KB_BUFFER_LEN - 1) {
            _kbBuffer[len] = c;
            _kbBuffer[len + 1] = '\0';
        }
    }

    _kbField->setLiveText(_kbBuffer);
    const char *key = _kbField->key();
    if (key) {
        if (kind == TextField::Kind::Integer) {
            bool empty = _kbBuffer[0] == '\0' || strcmp(_kbBuffer, "-") == 0;
            _store.setInt(key, empty ? 0 : atol(_kbBuffer));
        } else if (kind == TextField::Kind::Numeric) {
            bool empty = _kbBuffer[0] == '\0' || strcmp(_kbBuffer, "-") == 0 || strcmp(_kbBuffer, ".") == 0;
            _store.setFloat(key, empty ? 0.0f : (float)atof(_kbBuffer));
        } else {
            _store.setString(key, _kbBuffer);
        }
    }
    invalidateKeyboard();
}

void UI::drawKeyboardOverlay() {
    if (!_kbField) return;
    const KbLayoutDef *layout = kbLayoutFor(_kbActiveLayout);
    const Theme &theme = activeTheme();
    int16_t pw = _display.width();
    int16_t ph = _display.height();
    const int16_t pad = 2;
    const int16_t gap = 2;

    int16_t keyH = 0;
    int16_t kbH = 0;
    kbMetrics(pw, ph, layout, keyH, kbH);
    int16_t kbY = _kbOptions.dock == 1 ? 0 : (int16_t)(ph - kbH);
    if (kbY < 0) kbY = 0;

    _display.fillRect(0, kbY, pw, kbH, theme.background);
    _display.drawFastHLine(0, kbY, pw, theme.surfaceEdge);

    uint8_t flat = 0;
    int16_t cy = (int16_t)(kbY + pad);
    for (uint8_t r = 0; r < layout->rowCount; r++) {
        const KbRow &row = layout->rows[r];
        uint16_t totalUnits = 0;
        for (uint8_t i = 0; i < row.count; i++) totalUnits = (uint16_t)(totalUnits + row.keys[i].units);
        int16_t rowW = (int16_t)(pw - pad * 2);
        float unitW = (float)(rowW - gap * (row.count > 0 ? row.count - 1 : 0)) /
                     (float)(totalUnits > 0 ? totalUnits : 1);
        int16_t cx = (int16_t)pad;
        for (uint8_t i = 0; i < row.count; i++) {
            int16_t kw = (int16_t)(unitW * row.keys[i].units);
            if (kw < 4) kw = 4;
            bool focused = (flat == _kbIndex);
            bool shiftActive = _kbShift && strcmp(row.keys[i].token, "^") == 0;
            uint16_t keyFill = shiftActive ? theme.primary : theme.surface;
            _display.fillRoundRect(cx, cy, kw, keyH, 2, keyFill);
            _display.drawRoundRect(cx, cy, kw, keyH, 2, focused ? theme.primary : theme.surfaceEdge);
            Widget::drawStyledText(_display, theme, row.keys[i].token, cx, cy, kw, keyH, TextAlign::Center,
                                   keyFill, nullptr, false);
            cx = (int16_t)(cx + kw + gap);
            flat++;
        }
        cy = (int16_t)(cy + keyH + gap);
    }
}

void UI::enterScreen(Screen *screen, uint8_t prefetchFrames) {
    _current = screen;
    scanActiveMenu();
    scanActiveFocusGroup();
    iconAnimResetScreen(_current);
    releaseSdImageCache();
    screenPrefetchAssets(_current, prefetchFrames);
    _autoStale = true;
}

void UI::show(Screen *screen) {
    if (_current == screen) return;
    enterScreen(screen, 1);
    invalidate();
}

void UI::navigate(Screen *screen, Transition transition) {
    if (!screen || screen == _current) return;
    Transition t = (transition == Transition::Inherit) ? _defaultTransition : transition;
    if (_current && _stackTop < STACK_SIZE) {
        _stack[_stackTop].screen = _current;
        _stack[_stackTop].trans = t;
        _stackTop++;
    }
    runTransition(screen, t);
}

void UI::back() {
    if (_kbField) {
        endTextEdit();
        return;
    }
    if (_editingSlider) {
        endSliderEdit();
        return;
    }
    if (_editingList) {
        endListEdit();
        return;
    }
    if (_editingField) {
        endEditField();
        return;
    }
    if (_stackTop == 0) return;
    StackEntry e = _stack[--_stackTop];
    runTransition(e.screen, reverseTransition(e.trans));
}

void UI::next() {
    if (_kbField) {
        moveKbFocus(1);
        return;
    }
    if (_editingSlider) {
        // "next" is fired by the Down button; treat it as decreasing the value.
        adjustEditingSlider(-1);
        return;
    }
    if (_editingList) {
        // "next" is fired by the Down button; move the selection down the list.
        moveEditingList(1);
        return;
    }
    if (_editingField) {
        // "next" is fired by the Down button; treat it as decreasing the value.
        adjustEditingField(-1);
        return;
    }
    if (_activeMenu) {
        _activeMenu->moveNext();
        return;
    }
    if (_focusCount > 0) {
        uint8_t idx = (uint8_t)((_focusSel + 1) % _focusCount);
        selectFocusIndex(idx);
    }
}

void UI::prev() {
    if (_kbField) {
        moveKbFocus(-1);
        return;
    }
    if (_editingSlider) {
        // "prev" is fired by the Up button; treat it as increasing the value.
        adjustEditingSlider(1);
        return;
    }
    if (_editingList) {
        // "prev" is fired by the Up button; move the selection up the list.
        moveEditingList(-1);
        return;
    }
    if (_editingField) {
        // "prev" is fired by the Up button; treat it as increasing the value.
        adjustEditingField(1);
        return;
    }
    if (_activeMenu) {
        _activeMenu->movePrev();
        return;
    }
    if (_focusCount > 0) {
        uint8_t idx = _focusSel == 0 ? (uint8_t)(_focusCount - 1) : (uint8_t)(_focusSel - 1);
        selectFocusIndex(idx);
    }
}

void UI::left() {
    if (_editingSlider) adjustEditingSlider(-1);
}

void UI::right() {
    if (_editingSlider) adjustEditingSlider(1);
}

void UI::setSplash(Screen *next, uint16_t durationMs, bool showProgress) {
    _splashNext = next;
    _splashDuration = durationMs;
    _splashProgress = showProgress;
    _splashStart = millis();
    _splashActive = (next != nullptr && durationMs > 0);
    invalidate();
}

void UI::activateAt(int16_t px, int16_t py) {
    if (!_current) return;
    if (_kbField) {
        const KbLayoutDef *layout = kbLayoutFor(_kbActiveLayout);
        int16_t keyH = 0;
        int16_t kbH = 0;
        kbMetrics(_display.width(), _display.height(), layout, keyH, kbH);
        Rect kb = keyboardRect();
        int16_t kbY = kb.y;
        if (py >= kbY && py < kbY + kbH) {
            int16_t idx = kbHitTest(layout, _display.width(), kbY, keyH, px, py);
            if (idx >= 0) {
                const KbKey *k = kbKeyAt(layout, (uint8_t)idx);
                if (k) applyKbToken(k->token);
            }
            return;
        }
        endTextEdit();
        return;
    }
    Widget *hit = nullptr;
    for (Widget *w = _current->first(); w; w = w->_next) {
        if (!w->visible) continue;
        Shape *sh = w->asShape();
        if (sh) {
            if (sh->hitTest(px, py)) hit = w;
            continue;
        }
        if (w->contains(px, py)) hit = w;
    }
    if (!hit) return;
    Slider *slHit = hit->asSlider();
    if (slHit) {
        endSliderEdit();
        endListEdit();
        slHit->setValueFromX(_store, px);
        if (focusGroupMatches(hit)) {
            for (uint8_t i = 0; i < _focusCount; i++) {
                if (_focusGroup[i] == hit) {
                    selectFocusIndex(i);
                    break;
                }
            }
        }
        return;
    }
    List *lsHit = hit->asList();
    if (lsHit) {
        endSliderEdit();
        endListEdit();
        int16_t rowH = activeTheme().rowHeight;
        if (rowH < 14) rowH = 14;
        int row = lsHit->rowAt(py, rowH);
        if (row >= 0) lsHit->setSelected(row);
        if (focusGroupMatches(hit)) {
            for (uint8_t i = 0; i < _focusCount; i++) {
                if (_focusGroup[i] == hit) {
                    selectFocusIndex(i);
                    break;
                }
            }
        }
        return;
    }
    if (focusGroupMatches(hit)) {
        for (uint8_t i = 0; i < _focusCount; i++) {
            if (_focusGroup[i] == hit) {
                selectFocusIndex(i);
                break;
            }
        }
        activateFocused();
        return;
    }
    Shape *sh = hit->asShape();
    if (sh) {
        if (sh->isCallback()) {
            uint8_t id = sh->callbackActionId();
            if (id) _pendingMenuAction = id;
            if (_menuHandler) _menuHandler(id);
        } else if (sh->navigateTarget()) {
            navigate(sh->navigateTarget(), sh->navigateTransition());
        }
        return;
    }
    Button *btn = hit->asButton();
    if (btn) {
        if (btn->isCallback()) {
            uint8_t id = btn->callbackActionId();
            if (id) _pendingMenuAction = id;
            if (_menuHandler) _menuHandler(id);
        } else if (btn->navigateTarget()) {
            navigate(btn->navigateTarget(), btn->navigateTransition());
        }
        return;
    }
    Switch *sw = hit->asSwitch();
    if (sw) sw->toggle(_store);
}

void UI::select() {
    if (_kbField) {
        selectKbKey();
        return;
    }
    if (_editingField) {
        endEditField();
        return;
    }
    if (_activeMenu) {
        if (_activeMenu->selectedKind() == MenuItemKind::Callback) {
            uint8_t id = _activeMenu->selectedActionId();
            if (id) _pendingMenuAction = id;
            if (_menuHandler) _menuHandler(id);
            return;
        }
        Screen *target = _activeMenu->selectedTarget();
        if (target) navigate(target, _activeMenu->selectedTransition());
        return;
    }
    if (_focusCount > 0) activateFocused();
}

uint8_t UI::pollMenuAction() {
    uint8_t id = _pendingMenuAction;
    _pendingMenuAction = 0;
    return id;
}


void UI::begin() {
    if (_current) screenPrefetchAssets(_current, 1);
    _autoStale = true;
    invalidate();
    renderInternal();
}

void UI::render() {
    invalidate();
    renderInternal();
}

void UI::collectWidgetInvalidations() {
    const Theme &theme = activeTheme();
    bool full = _invalid.isFull();
    for (Widget *w = _current->first(); w; w = w->_next) {
        if (!w->isDirty()) continue;
        w->clearDirty();
        Rect nb = w->visible ? w->boundsLogical(_display, theme) : Rect();
        Rect ob = w->lastBounds();
        w->setLastBounds(nb);
        if (full) continue;
        if (!ob.empty() && !nb.empty() && ob.intersects(nb)) {
            _invalid.add(ob.unite(nb));
        } else {
            _invalid.add(ob);
            _invalid.add(nb);
        }
    }
    if (_invalid.isFull() || _invalid.empty() || !_display.hasBuffer() || !iconAnimPlaybackActive()) return;
    for (Widget *w = _current->first(); w; w = w->_next) {
        Icon *ic = w->asIcon();
        if (!ic || !iconWidgetIsAnim(ic)) continue;
        IconAnimDrawRect dr = iconAnimDrawRect(ic);
        Rect ir(dr.x, dr.y, dr.w, dr.h);
        uint8_t n = _invalid.count();
        for (uint8_t i = 0; i < n; i++) {
            const Rect &r = _invalid.at(i);
            if (r.intersects(ir) && !r.contains(ir)) {
                _invalid.add(ir);
                break;
            }
        }
        if (_invalid.isFull()) return;
    }
}

void UI::renderRegion(const Rect &r) {
    _current->drawClipped(_display, activeTheme(), _store, r);
    bool splash = _splashActive && _splashProgress && splashBarRect().intersects(r);
    bool kb = _kbField != nullptr && keyboardRect().intersects(r);
    if (!splash && !kb) return;
    bool hadClip = _display.clipActive();
    Rect prev = _display.clipRect();
    Rect eff = hadClip ? r.intersect(prev) : r;
    if (eff.empty()) return;
    _display.setClipRect(eff);
    if (splash) drawSplashProgress((uint32_t)(millis() - _splashStart));
    if (kb) drawKeyboardOverlay();
    if (hadClip) {
        _display.setClipRect(prev);
    } else {
        _display.resetClipRect();
    }
}

void UI::renderInternal() {
    if (!_current) {
        _invalid.clear();
        return;
    }
    _invalid.setScreen(_display.width(), _display.height());
    if (_strategy == RenderStrategy::ForceFullRedraw && !_invalid.empty()) _invalid.addFull();
    collectWidgetInvalidations();
    if (_invalid.empty()) return;

    bool full = _invalid.isFull();
    Rect rects[kMaxDirtyRects + 1];
    uint8_t count = _invalid.count();
    for (uint8_t i = 0; i < count; i++) rects[i] = _invalid.at(i);
    _invalid.clear();

    for (uint8_t i = 0; i < count; i++) {
        const Rect &r = rects[i];
        int16_t rows = _display.stripeRowsFor(r.w);
        if (rows < 1) rows = 1;
        int16_t y = r.y;
        while (y < r.bottom()) {
            int16_t bh = (int16_t)(r.bottom() - y);
            if (bh > rows) bh = rows;
            if (_display.beginStripe(r.x, y, r.w, bh)) {
                Rect band = _display.stripeRect();
                renderRegion(band);
                _display.endStripe();
                y = band.bottom() > y ? band.bottom() : (int16_t)(y + bh);
            } else {
                renderRegion(Rect(r.x, y, r.w, bh));
                y = (int16_t)(y + bh);
            }
        }
    }
    if (_display.bufferMode() == BufferMode::Full) _display.discardDirty();
    _display.flushWait();
    if (full) _current->clearAllDirty(_display, activeTheme());
}

Rect UI::splashBarRect() const {
    int16_t sw = _display.width();
    int16_t sh = _display.height();
    int16_t barH = 6;
    int16_t margin = activeTheme().padding;
    return Rect(margin, (int16_t)(sh - margin - barH), (int16_t)(sw - margin * 2), barH);
}

void UI::drawSplashProgress(uint32_t elapsedMs) {
    if (!_splashActive || _splashDuration == 0) return;
    float ratio = (float)elapsedMs / (float)_splashDuration;
    if (ratio < 0.0f) ratio = 0.0f;
    if (ratio > 1.0f) ratio = 1.0f;
    Rect bar = splashBarRect();
    int16_t fillW = (int16_t)(bar.w * ratio);
    _display.fillRoundRect(bar.x, bar.y, bar.w, bar.h, 3, activeTheme().surface);
    if (fillW > 0) {
        _display.fillRoundRect(bar.x, bar.y, fillW, bar.h, 3, activeTheme().primary);
    }
}

void UI::update() {
    uint32_t now = millis();
    if (_splashActive) {
        uint32_t elapsed = (uint32_t)(now - _splashStart);
        if (elapsed >= _splashDuration) {
            _splashActive = false;
            if (_splashNext) runTransition(_splashNext, Transition::Fade);
            return;
        }
        if (_splashProgress) _invalid.add(splashBarRect());
    }
    if (_current && !_splashActive) {
        iconAnimPatchScreen(_display, _current, activeTheme(), _store);
        iconAnimAdvanceDirty(_current);
    }
    patchStoreBindings(now, false);
    renderInternal();
}

bool UI::keyMatches(const char *a, const char *b) const {
    if (a == b) return a != nullptr;
    if (!a || !b) return false;
    return strcmp(a, b) == 0;
}

void UI::rebuildAutoBindings() {
    _autoCount = 0;
    _autoOverflow = false;
    _autoStale = false;
    if (!_current) return;
    const char *keys[8];
    for (Widget *w = _current->first(); w; w = w->_next) {
        uint8_t n = w->storeKeys(keys, 8);
        for (uint8_t k = 0; k < n; k++) {
            if (_autoCount >= MAX_AUTO_BINDINGS) {
                _autoOverflow = true;
                return;
            }
            _auto[_autoCount].key = keys[k];
            _auto[_autoCount].widget = w;
            _autoCount++;
        }
    }
}

void UI::patchStoreBindings(uint32_t now, bool force) {
    if (!_store.dirty()) return;
    if (!force && (uint32_t)(now - _lastPatchMs) < kTelemetryMinIntervalMs) return;
    _lastPatchMs = now;
    if (_autoStale) rebuildAutoBindings();
    const Theme &theme = activeTheme();
    uint16_t n = _store.count();
    const char *keys[8];
    for (uint16_t i = 0; i < n; i++) {
        if (!_store.dirtyAt(i)) continue;
        const char *key = _store.keyAt(i);
        for (uint8_t b = 0; b < _bindingCount; b++) {
            ValueBinding &vb = _bindings[b];
            if (!keyMatches(vb.key, key)) continue;
            if (vb.format) vb.format(vb, _store, theme);
            else formatBindingDefault(vb, _store, theme);
        }
        for (uint8_t f = 0; f < _fieldCount; f++) {
            if (keyMatches(_fields[f].key, key)) formatField(_fields[f]);
        }
        if (!_current) continue;
        if (!_autoOverflow) {
            for (uint16_t a = 0; a < _autoCount; a++) {
                if (keyMatches(_auto[a].key, key)) _auto[a].widget->onStoreKeyChanged(key, _store);
            }
        } else {
            for (Widget *w = _current->first(); w; w = w->_next) {
                uint8_t kn = w->storeKeys(keys, 8);
                for (uint8_t k = 0; k < kn; k++) {
                    if (keyMatches(keys[k], key)) {
                        w->onStoreKeyChanged(key, _store);
                        break;
                    }
                }
            }
        }
    }
    _store.clearDirty();
}

bool UI::bindValue(const char *key, Widget *widget, ValueFormatter format, uint8_t decimals, const char *unit) {
    if (!key || !widget) return false;
    ValueBinding *slot = nullptr;
    for (uint8_t i = 0; i < _bindingCount; i++) {
        if (_bindings[i].widget == widget && keyMatches(_bindings[i].key, key)) {
            slot = &_bindings[i];
            break;
        }
    }
    if (!slot) {
        if (_bindingCount >= MAX_VALUE_BINDINGS) return false;
        slot = &_bindings[_bindingCount++];
        slot->text[0] = '\0';
    }
    slot->key = key;
    slot->widget = widget;
    slot->format = format;
    slot->decimals = decimals;
    slot->unit = unit;
    if (_store.has(key)) {
        if (format) format(*slot, _store, activeTheme());
        else formatBindingDefault(*slot, _store, activeTheme());
    }
    return true;
}

void UI::unbindValue(Widget *widget) {
    uint8_t w = 0;
    for (uint8_t i = 0; i < _bindingCount; i++) {
        if (_bindings[i].widget == widget) continue;
        if (w != i) _bindings[w] = _bindings[i];
        w++;
    }
    _bindingCount = w;
}

void UI::formatBindingDefault(ValueBinding &binding, Store &store, const Theme &theme) {
    (void)theme;
    if (!binding.widget) return;
    char value[LUCARNE_BINDING_TEXT_LEN];
    value[0] = '\0';
    switch (store.typeOf(binding.key)) {
        case ValueType::Float: {
#if defined(__AVR__)
            dtostrf((double)store.getFloat(binding.key, 0.0f), 1, binding.decimals, value);
#else
            snprintf(value, sizeof(value), "%.*f", (int)binding.decimals, (double)store.getFloat(binding.key, 0.0f));
#endif
            break;
        }
        case ValueType::Int:
            snprintf(value, sizeof(value), "%ld", store.getInt(binding.key, 0));
            break;
        case ValueType::Bool:
            snprintf(value, sizeof(value), "%s", store.getBool(binding.key, false) ? "ON" : "OFF");
            break;
        case ValueType::String:
            snprintf(value, sizeof(value), "%s", store.getString(binding.key, ""));
            break;
        default:
            snprintf(value, sizeof(value), "--");
            break;
    }
    if (binding.unit && binding.unit[0]) {
        snprintf(binding.text, sizeof(binding.text), "%s %s", value, binding.unit);
    } else {
        snprintf(binding.text, sizeof(binding.text), "%s", value);
    }
    Label *label = binding.widget->asLabel();
    if (label) {
        label->setText(binding.text);
        return;
    }
    Button *button = binding.widget->asButton();
    if (button) {
        button->setLabel(binding.text);
        return;
    }
    binding.widget->markDirty();
}

void UI::setFloat(const char *key, float v) { _store.setFloat(key, v); }
void UI::setInt(const char *key, long v) { _store.setInt(key, v); }
void UI::setBool(const char *key, bool v) { _store.setBool(key, v); }
void UI::setString(const char *key, const char *v) { _store.setString(key, v); }

}