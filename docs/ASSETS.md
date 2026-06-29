# Assets — images & animated icons

Lucarne Studio exports **pixels** (flash or binary files) and **headers** (paths + metadata). This guide explains which storage to pick and how export, upload, and runtime fit together.

## Quick choice

| Goal | Storage | Where pixels live | Typical size |
|------|---------|-------------------|--------------|
| Small UI, few images | **Flash** | `Projet_images.h` / `Projet_icons.h` (hex arrays) | Grows app partition |
| Large UI, removable media | **SD card** | FAT32 files on microSD | Small firmware |
| Large UI, no SD card | **Internal partition** | FAT/LittleFS/SPIFFS on flash | Small firmware (~3 MB app + ~9 MB data) |
| Loaded from network at runtime | **Web** | Your server | Headers only |

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
2. Per image, set **Storage**: Flash, SD card, Internal partition, or Web.
3. Place the image on a screen (Designer). Only **used** images are exported.
4. Export size = max size used on screens (scaled down automatically if the widget is smaller than the source).

### Export output

| Storage | `Projet_images.h` | Binary files |
|---------|------------------|--------------|
| Flash | `ImageStorage::Flash` + pixel array | — |
| SD | `ImageStorage::Sd` + `source` path | `assets/*.rgb565` in zip |
| Volume | `ImageStorage::Volume` + `source` path | `assets/*.rgb565` in zip |
| Web | `ImageStorage::Web` + URL/path | — |

### Runtime

Call `projet::initStorage()` (or `mountSdCard()` / `mountVolume()`) **before** `ui.begin()`.

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
