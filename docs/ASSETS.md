# Assets — images & animated icons

Lucarne Studio exports **pixels** (flash or binary files) and **headers** (paths + metadata). This guide explains which storage to pick and how export, upload, and runtime fit together.

## Quick choice

| Goal | Storage | Where pixels live | Typical size |
|------|---------|-------------------|--------------|
| Small UI, few images | **Flash** | `Projet_images.h` / `Projet_icons.h` (hex arrays) | Grows app partition |
| Small UI, large flat-color images | **Flash (RLE)** | `Projet_images.h`, RLE-compressed hex arrays | Smaller than plain Flash for compressible art |
| Large UI, removable media | **SD card** | FAT32 files on microSD | Small firmware |
| Large UI, no SD card | **Internal partition** | FAT/LittleFS/SPIFFS on flash | Small firmware (~3 MB app + ~9 MB data) |
| Frequently redrawn image, board has PSRAM | **PSRAM** | Loaded from its file once at boot into PSRAM | Small firmware, fastest repeated draws |
| Loaded from network at runtime | ~~Web~~ | **Not implemented** — see [Web storage — not available](#web-storage--not-available) | — |

You can mix storages in one project (e.g. background on **volume**, small icons in **flash**).

## File format (SD & volume)

| File | Content |
|------|---------|
| `*.rgb565` | Raw RGB565, little-endian, row-major (`width × height × 2` bytes) |
| `*.alpha` | Optional sidecar for transparency (`width × height` bytes, one alpha per pixel) |

Paths in headers look like `/assets/img_abc.rgb565`. On device they are **relative to the filesystem root** (not prefixed with `/ffat` — the library mounts FFat for you).

## Images (Image widget)

### Studio workflow

1. **Assets** tab → import PNG or BMP.
2. Per image, set **Storage**: Flash, Flash (RLE), SD card, Internal partition, or PSRAM.
3. Place the image on a screen (Designer). Only **used** images are exported.
4. Export size = max size used on screens (scaled down automatically if the widget is smaller than the source, unless **scale mode** is set to Native — see below).

### Export output

| Storage | `Projet_images.h` | Binary files |
|---------|------------------|--------------|
| Flash | `ImageStorage::Flash` + pixel array | — |
| Flash (RLE) | `ImageStorage::FlashRle` + RLE-encoded pixel array | — |
| SD | `ImageStorage::Sd` + `source` path | `assets/*.rgb565` in zip |
| Volume | `ImageStorage::Volume` + `source` path | `assets/*.rgb565` in zip |
| PSRAM | `ImageStorage::Psram` + `source` path | `assets/*.rgb565` in zip (same file layout as SD/Volume) |

### Runtime

Call `projet::initStorage()` (or `mountSdCard()` / `mountVolume()`) **before** `ui.begin()`.

### Scale modes

| Mode | Behavior |
|------|----------|
| **Fit** (default) | Image is scaled to the widget's `w × h` at draw time (and at export for Flash storage). |
| **Native** | Image is drawn at its real pixel size (1:1), with no scaling. If the source is larger than the widget, it is **cropped to the visible area** instead of being scaled down (`setSourceOffset` picks which region is shown); Flash export also crops the embedded pixel array to the visible region instead of shipping the full source. Use this for pixel-art or icons where scaling would introduce blur.

### `FlashRle` — compressed flash images

Same as **Flash**, but the pixel array exported to `Projet_images.h` is RLE-compressed (`LucarneImageRle.cpp` decodes it on the fly at draw time). Reduces the size of `Projet_images.h` for images with large flat color regions (icons, UI chrome, simple illustrations); less effective on photographic/noisy source images. No workflow difference from Flash — just a smaller header for compressible art.

### `Psram` — preloaded into PSRAM

Uses the same file format and export path as **SD**/**Volume** (`.rgb565` + optional `.alpha`), but instead of the on-demand RAM cache described below, the asset is loaded **once at boot** directly into PSRAM. Subsequent draws blit straight from that PSRAM buffer — no filesystem access, no cache-miss penalty — which matters for images redrawn very often (backgrounds, frequently-updated sprites). Requires a board with PSRAM; the Design Rule Check flags a `Psram`-storage asset on a board without PSRAM.

### Web storage — not available

`ImageStorage::Web` exists as an enum value in `LucarneImageAsset.h`, but **there is no HTTP/network image loader in the firmware** — nothing in `src/` ever fetches an asset over the network. Selecting it would not produce a working image on real hardware.

Lucarne Studio's asset **Storage** picker no longer offers **Web** as a choice (removed from the picker); any older project file that still references `Web` storage should be re-exported with a supported storage kind (Flash, Flash RLE, SD, Volume, or PSRAM). Network-loaded images remain a possible future addition, but are not part of the current library.

## Animated icons (Fluent Emoji, etc.)

### Studio workflow

1. **Assets** → pick emoji or pack icon; animated emojis load as APNG.
2. **Icon export** (project setting): Flash, SD card, or Internal partition.
3. Scale on the **Icon** widget sets export resolution (larger scale = more pixels per frame).
4. Export produces one `.rgb565` per unique frame (+ `.alpha` when transparency is kept).

Frames identical at export resolution are **deduplicated** (one file, multiple header references).

### Flash vs files

| Mode | Pros | Cons |
|------|------|------|
| Flash | No upload step | Large `Projet_icons.h` |
| SD / Volume | Compact firmware | Upload binaries; mount before draw |

Animated icons on SD/volume use the same cache as images (`setSdCacheMaxBytes`, PSRAM-aware defaults).

## Opaque bake (pre-process)

For **animated emoji** icons placed over a **static background**, alpha blending every frame is expensive on device.

**Opaque bake** (per Icon widget in Designer inspector, emoji refs only):

- At export, each frame is composited onto the **static pixels** behind the icon (same screen, lower z-order).
- Output is **opaque RGB565** only — no `.alpha` sidecar for those frames.
- Requires a non-transparent **Image** or static layer under the icon; overlapping animated icons on the same screen are rejected with an export warning.

Use opaque bake when:

- The emoji sits on a fixed background image.
- You want fewer bytes and faster draw on ESP32 without PSRAM.

Do **not** use it when the icon moves over changing content or other animations.

## Internal partition (volume)

See [`VOLUME.md`](VOLUME.md) for partition scheme, FFat upload, and troubleshooting.

Summary:

1. **Hardware** → enable **Internal partition**, set label (`ffat` for `16M Flash (3MB APP/9.9MB FATFS)`).
2. Export **Files** zip → copy `assets/` into sketch `data/`.
3. Arduino: **Upload sketch**, then **Upload FFAT** (do not erase all flash without re-uploading FFAT).
4. Headers include `LucarneUserConfig.h` (which backends to link: SD, FFat, …).

## SD card

See [`SD.md`](SD.md). Copy `assets/` from the export zip to the card root (FAT32). `SD_MANIFEST.txt` lists paths.

## `LucarneUserConfig.h`

Generated beside `Projet_setup.h`. Controls which filesystem libraries are compiled in:

```cpp
#define LUCARNE_ENABLE_SD 0
#define LUCARNE_ENABLE_VOLUME_FAT 1
#define LUCARNE_ENABLE_VOLUME 1
```

Match this to what you actually use (disable SD if you only use volume). Re-export after changing Hardware.

## Troubleshooting

| Symptom | Check |
|---------|--------|
| `volume file not found` | FFat uploaded? Paths match manifest? `initStorage()` before `ui.begin()`? |
| `volume not mounted` | Partition scheme with FATFS? Upload FFAT completed? |
| `No filesystem detected` | Partition empty — run Upload FFAT after sketch flash |
| SD image blank | `mountSdCard()` before draw, MISO wired, files on card |
| Icon missing | Icon used on a screen? Pack loaded in Studio before export? |
| Opaque bake warning | Static background under icon? No overlapping anim icons on same screen |
