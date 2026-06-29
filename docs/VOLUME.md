# Internal partition assets (Volume)

Lucarne can load **Image** widgets and **animated icons** from raw `.rgb565` (and optional `.alpha`) files stored on an **internal flash partition** instead of embedding pixels in `Projet.h` or using an external SD card.

This uses `ImageStorage::Volume`: headers only contain width, height, and a `source` path string; pixel data lives as binary files on the partition.

## When to use

| Storage | Flash app partition | Extra hardware | Typical size |
|---------|---------------------|----------------|--------------|
| Flash (`Projet.h`) | Large (hex arrays in source) | None | Small/medium UIs |
| SD card | Small headers only | microSD + wiring | Large UIs |
| **Volume** | Small headers only | Partition in flash table | Large UIs without SD |

Volume export zips are **compact** (binary files + small headers), similar to SD export.

## Studio workflow

1. **Hardware** tab → **Internal partition**:
   - Enable **Use volume**
   - Pick **Filesystem**: FAT (FFat), LittleFS, or SPIFFS
   - Set **Partition label** to match your board partition table (e.g. `ffat` for `app3M_fat9M_16MB`)
   - Set **Assets folder** (default `/assets`)
2. **Assets** → per image **Storage** → **Internal partition**, or **Icon export** → **Internal partition**
3. **Export** → tab **Files** → download `.rgb565` / `.alpha` binaries and `VOLUME_MANIFEST.txt`
4. Flash firmware (`Projet.h`, `Projet_setup.h`, …)
5. Upload binary files into the mounted partition (see below)
6. Call `projet::initStorage()` (mounts volume) before `ui.begin()`

## Partition scheme (you must configure this)

The partition label in Studio **must match** a data partition in your board's partition table.

Example (ESP32-S3 16 MB, Arduino scheme **app3M_fat9M_16MB**):

| Partition | Type | Size | Label (typical) |
|-----------|------|------|-----------------|
| app0 | app | 3 MB | — |
| fat | data, fat | 9 MB | `ffat` |

In Studio Hardware, use:

- Filesystem: **FAT (FFat)**
- Partition label: **`ffat`**

For **LittleFS** or **SPIFFS** schemes, pick the matching filesystem and the **exact label** from your `partitions.csv` (e.g. `spiffs`, `littlefs`).

Arduino IDE: **Tools → Partition Scheme** must include a data partition large enough for your assets.

PlatformIO: set `board_build.partitions` to your custom CSV.

## Sketch integration

`Projet_setup.h` generates `mountVolume()` and `initStorage()` when volume is enabled:

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

    if (!projet::initStorage()) {
        Serial.println("Volume mount failed");
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

Low-level API (if you mount manually):

```cpp
lucarne::mountVolume(lucarne::VolumeFsKind::Fat, "ffat");
lucarne::mountVolume(lucarne::VolumeFsKind::LittleFs, "spiffs");
lucarne::mountVolume(lucarne::VolumeFsKind::Spiffs, "spiffs");
```

## Storage compile flags

Export generates `LucarneUserConfig.h` with `LUCARNE_ENABLE_SD`, `LUCARNE_ENABLE_VOLUME_FAT`, etc. Only enabled backends are linked (SD, FFat, LittleFS, SPIFFS).

Place `LucarneUserConfig.h` in your sketch folder. `Projet_setup.h` includes it before any storage headers.

## Uploading assets to the partition

Paths in `VOLUME_MANIFEST.txt` are relative to the **filesystem root** (e.g. `/assets/img_xxx.rgb565`).

### FAT (FFat) — Arduino IDE 3.x

1. Export **Files** zip from Studio
2. Copy **only** the `assets/` tree (and optional manifest) into the sketch `data/` folder — not the whole zip (no nested `data/data/`)
3. **Tools → Partition Scheme** → entry with **FATFS** in the name (e.g. `16M Flash (3MB APP/9.9MB FATFS)`)
4. Install [arduino-ffat-upload](https://github.com/r-iki/arduino-ffat-upload) (IDE 2.x `.vsix` plugin)
5. **Upload order (important)**:
   - Upload **sketch** first (firmware)
   - Then **Upload FFAT** (data partition only)
   - Do **not** enable **Erase All Flash Before Upload** when flashing the sketch, or you must re-run Upload FFAT afterward
6. Wait until the uploader finishes with a **success** message (building the image is not enough — it must flash to `0x610000` on `app3M_fat9M_16MB`)

If serial shows `No filesystem detected` / error 13: the FAT partition is **empty** — Upload FFAT did not run to completion, or a full flash erase wiped it.

`mkfatfs` warning: ESP32 core 3.x does **not** ship `mkfatfs` (only `mklittlefs` / `mkspiffs`). The **arduino-ffat-upload** plugin looks **only** here:

```
%LOCALAPPDATA%\Arduino15\packages\esp32\tools\mkfatfs\<version>\mkfatfs.exe
```

Example: `...\tools\mkfatfs\1.0.0\mkfatfs.exe`

It does **not** search `hardware\esp32\3.3.10\tools\` (old lorol plugin path). Download [mkfatfs_v1.0.exe](https://github.com/labplus-cn/mkfatfs/releases/download/v1.0/mkfatfs_v1.0.exe), rename to `mkfatfs.exe`, place in the folder above. After install, the uploader should print `mkfatfs Tool: ...` in green (no WARNING).

The WARNING alone does not always mean failure (fallback: `mkfatfs` on system PATH). If upload still ends with `No filesystem detected` on device, the flash step did not complete — re-run Upload FFAT after sketch flash.

Expected serial after a good upload + mount:

```
Lucarne: volume mounted at /ffat
```

### LittleFS

PlatformIO (common):

```ini
board_build.filesystem = littlefs
```

```bash
pio run -t uploadfs
```

Place files under `data/` mirroring manifest paths (without leading `/`).

Arduino: use the LittleFS upload plugin for your partition label.

### SPIFFS

Same pattern as LittleFS with `board_build.filesystem = spiffs` or the SPIFFS upload tool.

**Important:** Re-uploading the filesystem **erases** previous files on that partition. Keep a copy of the export zip.

## File format

Same as SD assets:

- Raw **RGB565**, little-endian, row-major (`width × height × 2` bytes)
- Optional **`.alpha`** sidecar for animated icons (`width × height` bytes, one alpha per pixel)
- `Projet_images.h` / `Projet_icons.h` reference paths with `ImageStorage::Volume`

Example:

```cpp
static const lucarne::ImageAsset Img_photo = {
    nullptr, nullptr, 240, 280,
    lucarne::ImageStorage::Volume,
    "/assets/img_photo.rgb565"
};
```

## Runtime behaviour

Volume assets use the same RAM cache and row-streaming fallback as SD (`setSdCacheMaxBytes`, `releaseSdImageCache`). Mount the volume **before** the first draw.

## SD and volume together

You can enable both **SD card** and **Internal partition** in Hardware. `initStorage()` mounts each if enabled. Images/icons use either `ImageStorage::Sd` or `ImageStorage::Volume` per asset — not both for the same file.

## Troubleshooting

| Symptom | Check |
|---------|--------|
| `volume mount failed` | Partition scheme, label spelling, filesystem type (FAT vs LittleFS vs SPIFFS) |
| `No filesystem detected` / error 13 | Partition empty: run **Upload FFAT** after sketch flash; disable **Erase All Flash**; wait for upload success |
| Guru Meditation on mount | Never pass `nullptr` as FFat base path; use `/ffat` (fixed in Lucarne 0.x) |
| Boot loop right after `SD mounted` | Same — `mountVolume()` was crashing inside `FFat.begin` |
| Blank image / icon | Files uploaded? Path matches manifest? File size = w×h×2? |
| `volume file not found` after mount OK | Paths in headers are `/assets/...` — do not prefix `/ffat` in code (library handles mount) |
| Worked once, then empty | Firmware flash without re-uploading filesystem wiped the data partition |
| Wrong colours | Same RGB565 endianness as SD export (Studio default is correct) |

See also [`SD.md`](SD.md) (external card, same binary format) and [`HARDWARE.md`](HARDWARE.md).
