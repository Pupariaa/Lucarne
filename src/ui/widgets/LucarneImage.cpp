#include "LucarneImage.h"

namespace lucarne {

Image::Image(int16_t x, int16_t y, int16_t w, int16_t h, const ImageAsset *asset)
    : Widget(x, y, w, h), _asset(asset) {}

void Image::draw(Gfx &g, const Theme &theme, Store &store) {
    (void)store;
    if (!_asset || !_asset->data) return;
    int16_t bw = w > 0 ? w : _asset->width;
    int16_t bh = h > 0 ? h : _asset->height;
    drawImageAsset(g, _asset, x, y, bw, bh, theme.background);
}

}
