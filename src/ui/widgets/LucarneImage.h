#ifndef LUCARNE_IMAGE_WIDGET_H
#define LUCARNE_IMAGE_WIDGET_H

#include "../LucarneWidget.h"
#include "../LucarneImageAsset.h"

namespace lucarne {

class Image : public Widget {
  public:
    Image(int16_t x, int16_t y, int16_t w, int16_t h, const ImageAsset *asset);

    void setAsset(const ImageAsset *asset) { _asset = asset; }
    const ImageAsset *asset() const { return _asset; }

    Image *asImage() override { return this; }
    void draw(Gfx &g, const Theme &theme, Store &store) override;

  private:
    const ImageAsset *_asset;
};

}

#endif
