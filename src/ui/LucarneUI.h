#ifndef LUCARNE_UI_H
#define LUCARNE_UI_H

#include "../display/LucarneDisplay.h"
#include "LucarneTheme.h"
#include "LucarneStore.h"
#include "LucarneScreen.h"
#include "LucarneTransition.h"
#include "widgets/LucarneMenu.h"

namespace lucarne {

class UI {
  public:
    static const uint8_t STACK_SIZE = 8;

    UI(Display &display);

    void setTheme(const Theme &theme);
    const Theme &theme() const { return _theme; }

    void setTransition(Transition def, uint16_t durationMs = 220);

    void show(Screen *screen);
    void navigate(Screen *screen, Transition transition = Transition::Inherit);
    void back();
    Screen *current() const { return _current; }

    void next();
    void prev();
    void select();
    Menu *activeMenu() const { return _activeMenu; }

    void begin();
    void update();
    void render();
    void invalidate() { _dirty = true; }

    void setFloat(const char *key, float v);
    void setInt(const char *key, long v);
    void setBool(const char *key, bool v);
    void setString(const char *key, const char *v);

    Store &store() { return _store; }
    Display &display() { return _display; }

  private:
    struct StackEntry {
        Screen *screen;
        Transition trans;
    };

    void scanActiveMenu();
    void runTransition(Screen *toScreen, Transition t);
    static void composeFrame(uint16_t *fb, const uint16_t *a, const uint16_t *b, int16_t w,
                             int16_t h, Transition t, float p);
    static Transition reverseTransition(Transition t);

    Display &_display;
    Theme _theme;
    Store _store;
    Screen *_current;
    Menu *_activeMenu;
    StackEntry _stack[STACK_SIZE];
    uint8_t _stackTop;
    Transition _defaultTransition;
    uint16_t _transitionMs;
    bool _dirty;
};

}

#endif
