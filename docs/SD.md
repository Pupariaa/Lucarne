# SD card assets

Lucarne can load **Image** widgets from raw RGB565 files on a FAT32 SD card instead of embedding pixels in flash.

## Workflow (Studio → device)

1. In **Assets**, set an image **Storage** to **SD card**. The device path defaults to `{assets folder}/{image id}.rgb565` (configured in **Hardware → SD card**).
2. **Export** → tab **Files (SD)** → download `.rgb565` files and `SD_MANIFEST.txt`.
3. Copy files to the SD card keeping the same paths from the card root (e.g. `/assets/img_xxx.rgb565`).
4. Flash firmware with `Projet.h`, `Projet_setup.h`, and mount the SD card before `ui.begin()`.

## Wiring (shared SPI bus)

Display and SD share **MOSI**, **MISO**, and **SCLK**. Each device has its own **CS**.

| Signal | Display | SD |
|--------|---------|-----|
| MOSI | shared | shared |
| MISO | optional for panel | required |
| SCLK | shared | shared |
| CS | dedicated GPIO | dedicated GPIO |

Set pins in Studio **Hardware** tab. Export generates `Projet_setup.h` with `initSpiBus()`, `displayPins()`, `displayOptions()`, and `mountSdCard()`.

`DisplayPins::miso` must be set when SD is used so the SPI bus keeps MISO configured after `display.begin()`.

## Sketch integration

```cpp
#include <Lucarne.h>
#include "Projet.h"
#include "Projet_setup.h"

using namespace lucarne;

ST7789 display;
UI ui(display);

void setup() {
    Serial.begin(115200);

    BufferOptions buffer;
    buffer.mode = BufferMode::Full;

    projet::initSpiBus();
    display.begin(projet::displayPins(), projet::displayOptions(), buffer, &SPI);

    if (!projet::mountSdCard()) {
        Serial.println("SD mount failed");
    }

    projet::build(ui);
    projet::attachInput(ui);
    ui.begin();
}

void loop() {
    projet::update();
    ui.update();
}
```

## File format

- Raw **RGB565**, little-endian, row-major.
- Size must match `width × height × 2` bytes (same as Studio export).
- No alpha channel on SD (opaque pixels only).
- Paths in `Projet_images.h` use `ImageStorage::Sd` and the `source` string (e.g. `"/assets/img_abc.rgb565"`).

## Runtime behaviour

- On first draw, Lucarne loads the file into an **RAM cache** (up to 384 KB). Further redraws reuse the cache.
- Images larger than the cache limit are read **row by row** from the SD card (slower, but works for full-screen backgrounds on tight RAM).
- Call `lucarne::releaseSdImageCache()` if you unmount or replace SD files at runtime.

## Requirements

- **ESP32** with Arduino `SD` library and a mounted FAT32 card.
- SD must be mounted **before** the first `Image` draw (`mountSdCard()` in `setup()`).
- AVR targets: SD image loading is not compiled in (flash-only images).

## Troubleshooting

| Symptom | Check |
|---------|--------|
| Blank image widget | SD mounted? Path matches manifest? File size = w×h×2? |
| Works once, fails after remount | Call `releaseSdImageCache()` after changing the card |
| Slow full-screen refresh | Image exceeds cache → row streaming; reduce size or use a smaller asset |
| Display OK, SD mount fail | MISO wired? CS pin? 3.3 V? FAT32? |

See also [`HARDWARE.md`](HARDWARE.md) for SPI wiring details.
