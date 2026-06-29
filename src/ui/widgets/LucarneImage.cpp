#include "LucarneImage.h"

namespace lucarne {

Image::Image(int16_t x, int16_t y, int16_t w, int16_t h, const ImageAsset *asset)
    : Widget(x, y, w, h), _asset(asset) {}

void Image::draw(Gfx &g, const Theme &theme, Store &store) {
    (void)store;
    if (!_asset) return;
    if (!imageAssetData(_asset) && !isFileBackedStorage(imageAssetStorage(_asset))) return;
    int16_t bw = w > 0 ? w : imageAssetWidth(_asset);
    int16_t bh = h > 0 ? h : imageAssetHeight(_asset);
    drawImageAsset(g, _asset, x, y, bw, bh, theme.background);
}

}
