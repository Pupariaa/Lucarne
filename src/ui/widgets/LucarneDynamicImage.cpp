#include "LucarneDynamicImage.h"
#include <string.h>

namespace lucarne {

DynamicImage::DynamicImage(int16_t x, int16_t y, int16_t w, int16_t h, const char *pathKey,
                             ImageStorage storage, int16_t imgWidth, int16_t imgHeight)
    : Widget(x, y, w, h), _pathKey(pathKey), _storage(storage), _scaleMode(ImageScaleMode::Fit),
      _srcOx(0), _srcOy(0), _imgW(imgWidth), _imgH(imgHeight), _pathOverride(false) {
    _pathBuf[0] = '\0';
}

void DynamicImage::setPathOverride(const char *path) {
    markDirty();
    if (path && path[0]) {
        strncpy(_pathBuf, path, sizeof(_pathBuf) - 1);
        _pathBuf[sizeof(_pathBuf) - 1] = '\0';
        _pathOverride = true;
    } else {
        _pathBuf[0] = '\0';
        _pathOverride = false;
    }
}

void DynamicImage::draw(Gfx &g, const Theme &theme, Store &store) {
    const char *path = nullptr;
    if (_pathOverride && _pathBuf[0]) {
        path = _pathBuf;
    } else if (_pathKey) {
        path = store.getString(_pathKey, "");
    }
    if (!path || !path[0]) return;

    char localPath[96];
    strncpy(localPath, path, sizeof(localPath) - 1);
    localPath[sizeof(localPath) - 1] = '\0';

    int16_t sw = _imgW > 0 ? _imgW : w;
    int16_t sh = _imgH > 0 ? _imgH : h;
    ImageAsset asset = {nullptr, nullptr, sw, sh, _storage, localPath};
    if (_scaleMode == ImageScaleMode::Native) {
        int16_t vw = w > 0 ? w : sw;
        int16_t vh = h > 0 ? h : sh;
        drawImageAssetNative(g, &asset, x, y, _srcOx, _srcOy, vw, vh, theme.background);
        return;
    }
    int16_t bw = w > 0 ? w : sw;
    int16_t bh = h > 0 ? h : sh;
    drawImageAsset(g, &asset, x, y, bw, bh, theme.background);
}

}
