#ifndef LUCARNE_WIDGET_H
#define LUCARNE_WIDGET_H

#include <stdint.h>
#include "../core/LucarneGfx.h"
#include "../core/LucarneTypes.h"
#include "LucarneTheme.h"
#include "LucarneStore.h"
#include "LucarneImageAsset.h"

namespace lucarne {

class Icon;
class Image;

enum class TextAlign : uint8_t { Left, Center, Right };

struct TextStyle {
    const AAFont *font = nullptr;
    uint8_t size = 0;
    uint16_t color = 0;
    int8_t spacing = 0;
    bool hasFont = false;
    bool hasSize = false;
    bool hasColor = false;
    bool hasSpacing = false;
    bool transparent = false;
};

class Menu;

class Widget {
  public:
    friend class UI;

    Widget(int16_t x, int16_t y, int16_t w, int16_t h);
    virtual ~Widget();

    virtual void draw(Gfx &g, const Theme &theme, Store &store) = 0;
    virtual Menu *asMenu() { return nullptr; }
    virtual class Button *asButton() { return nullptr; }
    virtual class Shape *asShape() { return nullptr; }
    virtual class Switch *asSwitch() { return nullptr; }
    virtual class TextField *asTextField() { return nullptr; }
    virtual class Slider *asSlider() { return nullptr; }
    virtual class List *asList() { return nullptr; }
    virtual Icon *asIcon() { return nullptr; }
    virtual Image *asImage() { return nullptr; }
    virtual class Label *asLabel() { return nullptr; }
    virtual class Graph *asGraph() { return nullptr; }

    virtual Rect boundsLogical(Gfx &g, const Theme &theme) const;
    virtual uint8_t storeKeys(const char **out, uint8_t max) const;
    virtual void onStoreKeyChanged(const char *key, Store &store);

    bool contains(int16_t px, int16_t py) const {
        return px >= x && py >= y && px < x + w && py < y + h;
    }

    void setBounds(int16_t x, int16_t y, int16_t w, int16_t h);
    void setVisible(bool v) {
        if (visible == v) return;
        visible = v;
        markDirty();
    }

    void markDirty() { _dirty = true; }
    bool isDirty() const { return _dirty; }
    void clearDirty() { _dirty = false; }
    Rect lastBounds() const { return _lastBounds; }
    void setLastBounds(const Rect &r) { _lastBounds = r; }

    int16_t x;
    int16_t y;
    int16_t w;
    int16_t h;
    bool visible;
    Widget *_next;

    static void drawIcon(Gfx &g, const uint16_t *rows, int16_t x, int16_t y, uint8_t scale,
                         uint16_t color);
    static void drawIconFit(Gfx &g, const uint16_t *rows, int16_t x, int16_t y, int16_t dw,
                            int16_t dh, uint16_t color);
    static void drawImageAsset(Gfx &g, const ImageAsset *asset, int16_t x, int16_t y, int16_t dw,
                               int16_t dh, uint16_t bg);
    static void drawImageAssetNative(Gfx &g, const ImageAsset *asset, int16_t x, int16_t y,
                                     int16_t srcOx, int16_t srcOy, int16_t viewW, int16_t viewH,
                                     uint16_t bg);
    static void drawImageAssetFit(Gfx &g, const ImageAsset *asset, int16_t x, int16_t y, int16_t dw,
                                  int16_t dh, uint16_t bg);
    static void drawRamImageFit(Gfx &g, const uint16_t *pix, const uint8_t *alpha, int16_t sw,
                                int16_t sh, int16_t x, int16_t y, int16_t dw, int16_t dh,
                                uint16_t bg);

  protected:
    static uint8_t appendKey(const char **out, uint8_t n, uint8_t max, const char *key);
    static void drawText(Gfx &g, const Theme &theme, const char *text, int16_t bx, int16_t by,
                         int16_t bw, int16_t bh, TextAlign align, uint16_t color, uint8_t size,
                         uint16_t bg, const AAFont *aafont);
    static void drawStyledText(Gfx &g, const Theme &theme, const char *text, int16_t bx, int16_t by,
                               int16_t bw, int16_t bh, TextAlign align, uint16_t bg,
                               const TextStyle *style, bool dimDefault = false);

  private:
    Rect _lastBounds;
    bool _dirty;
};

}

#endif
