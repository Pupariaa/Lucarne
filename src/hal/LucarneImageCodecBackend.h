#ifndef LUCARNE_IMAGE_CODEC_BACKEND_H
#define LUCARNE_IMAGE_CODEC_BACKEND_H

#include <stdint.h>
#include <stddef.h>

namespace lucarne {

struct JpegDecodeResult {
    bool ok = false;
    int16_t width = 0;
    int16_t height = 0;
    const uint16_t *rgb565 = nullptr;
};

class ImageCodecBackend {
  public:
    virtual ~ImageCodecBackend() = default;

    virtual bool decodeJpegToRgb565(const uint8_t *data, size_t len, JpegDecodeResult &out) = 0;
    virtual void releaseDecode(JpegDecodeResult &out) = 0;
};

ImageCodecBackend *halImageCodecBackend();

}

#endif
