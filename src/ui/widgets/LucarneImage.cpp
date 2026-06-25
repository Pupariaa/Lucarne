#include "LucarneImage.h"

namespace lucarne {

Image::Image(int16_t x, int16_t y, int16_t w, int16_t h, const ImageAsset *asset)
    : Widget(x, y, w, h), _asset(asset) {}

void Image::draw(Gfx &g, const Theme &theme, Store &store) {
    (void)theme;
    (void)store;
    if (!_asset || !_asset->data) return;
    int16_t bw = w > 0 ? w : _asset->width;
    int16_t bh = h > 0 ? h : _asset->height;
    g.drawRGBBitmap(x, y, _asset->data, bw, bh);
}

}
