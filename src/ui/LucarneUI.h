#ifndef LUCARNE_UI_H
#define LUCARNE_UI_H

#include "../core/LucarneGfx.h"
#include "../core/LucarneDirtyRegions.h"
#include "../core/LucarneRenderConfig.h"
#include "LucarneTheme.h"
#include "LucarneStore.h"
#include "LucarneScreen.h"
#include "LucarneTransition.h"
#include "widgets/LucarneMenu.h"

#if defined(__has_include)
#if __has_include("LucarneUserConfig.h")
#include "LucarneUserConfig.h"
#endif
#endif

#ifndef LUCARNE_MAX_FOCUS_GROUP
#define LUCARNE_MAX_FOCUS_GROUP 24
#endif

#ifndef LUCARNE_MAX_VALUE_FIELDS
#if defined(__AVR__)
#define LUCARNE_MAX_VALUE_FIELDS 8
#else
#define LUCARNE_MAX_VALUE_FIELDS 64
#endif
#endif

#ifndef LUCARNE_MAX_VALUE_BINDINGS
#if defined(__AVR__)
#define LUCARNE_MAX_VALUE_BINDINGS 4
#else
#define LUCARNE_MAX_VALUE_BINDINGS 16
#endif
#endif

#ifndef LUCARNE_MAX_AUTO_BINDINGS
#if defined(__AVR__)
#define LUCARNE_MAX_AUTO_BINDINGS 16
#else
#define LUCARNE_MAX_AUTO_BINDINGS 96
#endif
#endif

#ifndef LUCARNE_BINDING_TEXT_LEN
#define LUCARNE_BINDING_TEXT_LEN 24
#endif

namespace lucarne {

typedef void (*MenuActionHandler)(uint8_t actionId);

struct ValueBinding;
typedef void (*ValueFormatter)(ValueBinding &binding, Store &store, const Theme &theme);

struct ValueBinding {
    const char *key;
    Widget *widget;
    ValueFormatter format;
    const char *unit;
    uint8_t decimals;
    char text[LUCARNE_BINDING_TEXT_LEN];
};

class Shape;
class Button;
class Switch;
class TextField;
class Slider;
class List;
class StripeCanvas;

class UI {
  public:
    static const uint8_t STACK_SIZE = 8;

    UI(Gfx &display);

    void setTheme(const Theme &theme);
    const Theme &theme() const { return _theme; }

    void setTransition(Transition def, uint16_t durationMs = 220);
    void setMenuHandler(MenuActionHandler handler) { _menuHandler = handler; }

    void setSplash(Screen *next, uint16_t durationMs, bool showProgress = false);

    void show(Screen *screen);
    void navigate(Screen *screen, Transition transition = Transition::Inherit);
    void back();
    Screen *current() const { return _current; }

    void next();
    void prev();
    void select();
    void left();
    void right();
    void activateAt(int16_t x, int16_t y);
    Menu *activeMenu() const { return _activeMenu; }

    // Registers a Button widget as a live, D-pad editable numeric field.
    // Once registered, focusing the button and pressing select() toggles
    // edit mode; while editing, next()/prev() adjust the stored value by
    // `step` (clamped to [minV, maxV]) instead of moving focus.
    void registerField(Button *button, const char *key, float step, float minV, float maxV,
                       uint8_t decimals = 2, const char *label = nullptr, const char *unit = nullptr);
    void refreshField(Button *button);
    void refreshFields();
    bool isEditingField() const { return _editingField != nullptr; }

    // On-screen virtual keyboard for TextField widgets. Mirrors the Lucarne Studio
    // simulator: focusing a TextField and pressing select() opens the overlay,
    // next()/prev() cycle through its keys, select() types the highlighted key,
    // the "OK" key or back() closes it.
    void configureKeyboard(const VirtualKeyboardOptions &opts) { _kbOptions = opts; }
    bool isEditingText() const { return _kbField != nullptr; }

    uint8_t pollMenuAction();
    bool hasMenuAction() const { return _pendingMenuAction != 0; }

    void begin();
    void update();
    void render();
    void invalidate() { _invalid.addFull(); }
    void invalidateRect(int16_t x, int16_t y, int16_t w, int16_t h) { _invalid.add(x, y, w, h); }
    void invalidateWidget(Widget *widget);
    void setRenderStrategy(RenderStrategy strategy) { _strategy = strategy; }
    RenderStrategy renderStrategy() const { return _strategy; }

    bool bindValue(const char *key, Widget *widget, ValueFormatter format = nullptr, uint8_t decimals = 1,
                   const char *unit = nullptr);
    void unbindValue(Widget *widget);
    void rebuildBindings() { _autoStale = true; }
    static void formatBindingDefault(ValueBinding &binding, Store &store, const Theme &theme);

    void setHalProfile(const HalProfile &profile) {
        _halProfile = profile;
        _halProfileSet = true;
    }
    const HalProfile &halProfile() const;

    void setFloat(const char *key, float v);
    void setInt(const char *key, long v);
    void setBool(const char *key, bool v);
    void setString(const char *key, const char *v);

    Store &store() { return _store; }
    Gfx &display() { return _display; }

  private:
    struct StackEntry {
        Screen *screen;
        Transition trans;
    };

    struct ValueField {
        Button *button;
        const char *key;
        const char *label;
        const char *unit;
        float step;
        float minV;
        float maxV;
        uint8_t decimals;
    };

    void scanActiveMenu();
    void scanActiveFocusGroup();
    void clearFocusSelection();
    void selectFocusIndex(uint8_t idx);
    void activateFocused();
    bool focusGroupMatches(Widget *w) const;
    bool widgetFocusable(Widget *w) const;
    void setWidgetFocused(Widget *w, bool focused);
    ValueField *findField(Button *button);
    void formatField(ValueField &f);
    void beginEditField(ValueField *f);
    void endEditField();
    void adjustEditingField(int direction);
    void beginTextEdit(TextField *field);
    void endTextEdit();
    void beginSliderEdit(Slider *s);
    void endSliderEdit();
    void adjustEditingSlider(int direction);
    void beginListEdit(List *l);
    void endListEdit();
    void moveEditingList(int direction);
    void moveKbFocus(int8_t direction);
    void selectKbKey();
    void applyKbToken(const char *token);
    void drawKeyboardOverlay();
    Rect keyboardRect() const;
    Rect splashBarRect() const;
    void invalidateKeyboard();
    void runTransition(Screen *toScreen, Transition t);
    Transition resolveTransition(Transition t) const;
    uint8_t transitionBandCount() const;
    void enterScreen(Screen *screen, uint8_t prefetchFrames);
    bool runBandTransition(Screen *from, Screen *to, Transition t);
    bool runRichTransition(Screen *from, Screen *to, Transition t);
    void pushCanvasRect(StripeCanvas &canvas, int16_t dx, int16_t dy);
    void drawSplashProgress(uint32_t elapsedMs);
    void renderInternal();
    void collectWidgetInvalidations();
    void renderRegion(const Rect &r);
    void patchStoreBindings(uint32_t now, bool force);
    void rebuildAutoBindings();
    bool keyMatches(const char *a, const char *b) const;
    static void composeFrame(Gfx &g, uint16_t *fb, const uint16_t *a, const uint16_t *b, int16_t w,
                             int16_t h, Transition t, float p);
    static Transition reverseTransition(Transition t);
    const Theme &activeTheme() const;
    const Theme &themeFor(Screen *screen) const;

    Gfx &_display;
    Theme _theme;
    Store _store;
    Screen *_current;
    Menu *_activeMenu;
    static const uint8_t MAX_FOCUS_GROUP = LUCARNE_MAX_FOCUS_GROUP;
    Widget *_focusGroup[MAX_FOCUS_GROUP];
    uint8_t _focusCount;
    uint8_t _focusSel;
    const char *_focusGroupId;
    StackEntry _stack[STACK_SIZE];
    uint8_t _stackTop;
    Transition _defaultTransition;
    uint16_t _transitionMs;
    DirtyRegionList _invalid;
    RenderStrategy _strategy;

    struct AutoBinding {
        const char *key;
        Widget *widget;
    };
    static const uint8_t MAX_VALUE_BINDINGS = LUCARNE_MAX_VALUE_BINDINGS;
    static const uint16_t MAX_AUTO_BINDINGS = LUCARNE_MAX_AUTO_BINDINGS;
    ValueBinding _bindings[MAX_VALUE_BINDINGS];
    uint8_t _bindingCount;
    AutoBinding _auto[MAX_AUTO_BINDINGS];
    uint16_t _autoCount;
    bool _autoOverflow;
    bool _autoStale;
    uint32_t _lastPatchMs;

    static const uint8_t MAX_VALUE_FIELDS = LUCARNE_MAX_VALUE_FIELDS;
    ValueField _fields[MAX_VALUE_FIELDS];
    char _fieldText[MAX_VALUE_FIELDS][40];
    uint8_t _fieldCount;
    ValueField *_editingField;
    Slider *_editingSlider;
    List *_editingList;

    static const uint8_t KB_BUFFER_LEN = 40;
    VirtualKeyboardOptions _kbOptions;
    TextField *_kbField;
    KeyboardLayout _kbActiveLayout;
    KeyboardLayout _kbAlphaLayout;
    bool _kbShift;
    uint8_t _kbIndex;
    char _kbBuffer[KB_BUFFER_LEN];

    MenuActionHandler _menuHandler;
    uint8_t _pendingMenuAction;
    Screen *_splashNext;
    uint16_t _splashDuration;
    bool _splashProgress;
    bool _splashActive;
    uint32_t _splashStart;
    HalProfile _halProfile;
    bool _halProfileSet;
};

}

#endif
