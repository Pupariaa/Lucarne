# Changelog

All notable changes to this project are documented here.  
Version numbers follow [Semantic Versioning](https://semver.org/) and match `library.properties`.  
Git tags use the `v` prefix (e.g. `v0.1.0`).

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

[0.1.1]: https://github.com/Pupariaa/Lucarne/releases/tag/v0.1.1
[0.1.0]: https://github.com/Pupariaa/Lucarne/releases/tag/v0.1.0
