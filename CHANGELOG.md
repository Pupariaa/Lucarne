# Changelog

All notable changes to this project are documented here.  
Version numbers follow [Semantic Versioning](https://semver.org/) and match `library.properties`.  
Git tags use the `v` prefix (e.g. `v0.1.0`).

## [0.1.4] — 2026-06-25

### Added

- Internal flash partition assets (`ImageStorage::Volume`) via `mountVolume()` — FFat, LittleFS, SPIFFS
- `LucarneStorageConfig.h` and sketch-level `LucarneUserConfig.h` for conditional SD / volume backends
- Animated icon frames loaded from SD and volume (PSRAM-aware frame cache, `setSdCacheMaxBytes`)
- RLE-compressed RGB565 flash images (`LucarneImageRle`)
- Opaque baked emoji icons (no per-frame alpha) and `setAnimReadyBudget()` for animation RAM limits
- Display `peekPixel()` / `writeBufferRect()` for full-buffer compositing
- Documentation: [`docs/ASSETS.md`](docs/ASSETS.md), [`docs/VOLUME.md`](docs/VOLUME.md), updated Studio and runtime guides

### Fixed

- Volume file paths no longer double-prefix `/ffat` when opening assets
- `ImageAsset` metadata read correctly from PROGMEM on ESP32
- UTF-8 decode edge case affecting icon and label rendering

## [0.1.3] — 2026-06-25

### Added

- SD card image loading for `Image` widgets (`ImageStorage::Sd`, RAM cache, row streaming fallback)
- Animated icon support (APNG emoji frames exported as `IconAnimAsset`, partial screen refresh)
- `setIconAnimSpeedPercent()` to tune animation playback speed
- Icon refs by name (`setIconRef`, Tabler / Fluent / custom / animated) on Icon, Menu, and Button widgets
- `Projet_setup.h` export: shared SPI bus, display pins, SD mount helpers
- Studio: PNG transparency and BMP import, export total size, images resized to on-screen usage

### Fixed

- ESP32 PROGMEM access for animated icon frames and string lookups (`strcmp_P`, `pgm_read_*`)
- Animated icons no longer trigger full-screen redraws every frame

## [0.1.2] — 2026-06-25

### Fixed

- ESP32 compile: include `ImageAsset` in `LucarneWidget.h`
- ESP32 compile: expose icon/image draw helpers used by `LucarneIconDraw`
- ESP32 compile: replace AVR-only `dtostrf` with `snprintf` in Gauge widget

## [0.1.1] — 2026-06-26

### Changed

- Align `library.json` with `library.properties` for PlatformIO and registry tooling
- Enable Arduino Library Manager lint in CI

## [0.1.0] — 2026-06-25

### Added

- ST7789 and ST7735S display drivers with rotation and panel offsets
- Graphics layer with optional framebuffer (full / direct modes, PSRAM-aware)
- UI runtime: screens, theme, data store, transitions, menu navigation
- Widgets: Label, Metric, Bar, Icon, Menu, Image, Button, Switch, Slider, Chart, Gauge, List
- Physical input: GPIO buttons, rotary encoder, touch feed
- Built-in Fira Sans fonts (`LucarneFontBody`, `LucarneFontTitle`)
- Lucarne Studio web editor (blueprint, designer, fonts, simulate, export)
- USB Live Preview for ESP32-S3
- Examples: HelloLucarne, LucarneDiag, LucarneUI, LucarneMenu, LucarnePreview
- Online documentation at [lucarne.techalchemy.fr](https://lucarne.techalchemy.fr/doc/)

[0.1.4]: https://github.com/Pupariaa/Lucarne/releases/tag/v0.1.4
[0.1.3]: https://github.com/Pupariaa/Lucarne/releases/tag/v0.1.3
[0.1.2]: https://github.com/Pupariaa/Lucarne/releases/tag/v0.1.2
[0.1.1]: https://github.com/Pupariaa/Lucarne/releases/tag/v0.1.1
[0.1.0]: https://github.com/Pupariaa/Lucarne/releases/tag/v0.1.0
