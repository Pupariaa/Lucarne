#ifndef LUCARNE_DYNAMIC_IMAGE_H
#define LUCARNE_DYNAMIC_IMAGE_H

#include "../LucarneWidget.h"
#include "../LucarneImageAsset.h"

namespace lucarne {

class DynamicImage : public Widget {
  public:
    DynamicImage(int16_t x, int16_t y, int16_t w, int16_t h, const char *pathKey, ImageStorage storage,
                 int16_t imgWidth, int16_t imgHeight);

    void setPathKey(const char *key) { markDirty(); _pathKey = key; }
    void setStorage(ImageStorage storage) { markDirty(); _storage = storage; }
    void setScaleMode(ImageScaleMode mode) { markDirty(); _scaleMode = mode; }
    void setSourceOffset(int16_t ox, int16_t oy) {
        markDirty();
        _srcOx = ox;
        _srcOy = oy;
    }
    void setSourceSize(int16_t imgW, int16_t imgH) {
        markDirty();
        _imgW = imgW;
        _imgH = imgH;
    }
    void setPathOverride(const char *path);

    uint8_t storeKeys(const char **out, uint8_t max) const override {
        return _pathOverride ? 0 : appendKey(out, 0, max, _pathKey);
    }
    void draw(Gfx &g, const Theme &theme, Store &store) override;

  private:
    const char *_pathKey;
    ImageStorage _storage;
    ImageScaleMode _scaleMode;
    int16_t _srcOx;
    int16_t _srcOy;
    int16_t _imgW;
    int16_t _imgH;
    char _pathBuf[96];
    bool _pathOverride;
};

}

#endif
