# Changelog

All notable changes to this project are documented here.  
Version numbers follow [Semantic Versioning](https://semver.org/) and match `library.properties`.  
Git tags use the `v` prefix (e.g. `v0.1.0`).

## [Unreleased]

## [0.3.0] — 2026-10-26

### Lucarne Studio UX

- Responsive layout down to tablet width (768px): compact topbar with **More** menu, inspector drawer, Designer palette/layers as overlays, touch-sized controls
- Onboarding: **Welcome** screen on first visit, guided **tour**, contextual **keyboard shortcuts** (`?`, File menu)
- Toasts with type, stack limit, dismiss control and optional Undo action; autosave status indicator; `busy()` state on long actions
- Modal focus trap and ARIA roles (settings, export, icon picker, LucarneDialog); SVG toolbar icons; accessibility pass on inspector rows and wizards
- Project settings regrouped into Module, Screen, Controls, Bus, Performance, and Board
- Module preset **Phase Zero S3-24** (ESP32-S3 N16R8, ST7789 2.4" 240×320 at rotation 1, shared SPI with the SD card, d-pad)
- Controls export Left and Right separately from Confirm and Back. Pin `-1` means the button is absent

### Live Preview

- Protocol **v6**: the receiver acknowledges a frame after the panel flush
- Prebuilt receivers for the Studio flash button: ST7789, ST7735S, ST7796, ILI9342, SSD1306, SSD1315, HD44780, on ESP32, ESP32-S3, ESP32-C3, and ESP32-P4

### V3 — rendering pipeline and HAL

#### Breaking

- **`BufferMode` now has three values**: `None`, `Partial`, `Full`. Code that switched on the old two-value enum must handle `Partial`
- **Partial is the default on ESP32-C3** (and every `Tiny` target): Lucarne Studio exports `BufferMode::Partial` with stripes instead of a full framebuffer. A `Full` request that fails to allocate or exceeds `BufferOptions::maxBytes` now falls back to `Partial` instead of `None`
- **Rich transitions are opt-in**: `HalProfile::preferRichTransitions` defaults to `false`. Transitions are rendered by bands (two stripes of RAM, never a second framebuffer) unless rich is requested on a `Psram` / `MipiHighRes` profile in `Full` mode
- Transitions follow the profile matrix: `Tiny` keeps Fade only, `LowRam` drops Push and Cover, `None`-mode displays (OLED, HD44780) never animate
- `UI::render()` is now a forced full redraw; `UI::update()` redraws only invalidated regions. `Screen::redrawRegion()` was removed (replaced by `Screen::drawClipped`)
- `halBlitBackend()` returns the backend registered by the HAL (DMA2D on STM32) and falls back to `halBlitBackendSw()`

#### Added

- **Dirty regions**: `DirtyRegionList` (8 rects, 35 % merge rule, `LUCARNE_MAX_DIRTY_RECTS`), `UI::invalidateRect`, `UI::invalidateWidget`, `UI::setRenderStrategy(RenderStrategy::ForceFullRedraw)`, per-widget dirty flags and `Widget::boundsLogical()`
- **Clip rectangle** on every `Gfx` terminal write (`setClipRect`, `resetClipRect`, `clipRect`), per-glyph early-out for text outside the clip
- **`BufferMode::Partial`** for `Display` and `MipiDisplay`: `StripeCanvas` stripes of `BufferOptions::partialLineCount` lines (default `max(10, height/10)`, 50 on MIPI), ping-pong stripes when the flush is asynchronous
- **Band transitions** (`src/ui/LucarneUITransition.cpp`): Fade, Slide, Push, Cover composed per band; 8 / 12 / 16 bands for `Tiny`-`LowRam` / `Psram` / `MipiHighRes`; splash to first screen fades by bands
- **Store bindings**: per-key dirty bits (`Store::isKeyDirty`), automatic binding table rebuilt on every screen change from `Widget::storeKeys()` (Label, Metric, Bar, Gauge, Button, Slider, Switch, Clock, Date, Battery, Status, TextField, Graph in Keys mode, DynamicImage), explicit `UI::bindValue(key, widget, formatter, decimals, unit)` / `unbindValue` / `rebuildBindings`, telemetry patch throttled to 50 ms (`LUCARNE_TELEMETRY_MIN_INTERVAL_MS`)
- **Mono OLED drivers** `SSD1306` and `SH1106` (`src/display/LucarneOledMono.h`): I2C and SPI, 1 bpp page buffer, only modified pages are sent, rotation, contrast, invert, flip
- **HD44780 character LCD driver** (`src/display/LucarneHD44780.h`): 4-bit bus, shadow character grid, changed cells only, CGRAM bar glyphs, widget text routed through `Gfx::isCharacterGrid()` / `drawGridText` / `drawGridBar`
- **Asynchronous SPI flush** (`src/hal/LucarneFlushSpiAsync.h`): ESP32 `spi_master` DMA (32 KB chunks, queue of 4) and RP2040 / RP2350 pico-sdk DMA; `LUCARNE_DISABLE_ASYNC_FLUSH` opt-out; SD access waits for the pending flush
- **ESP32-P4**: per-rect MIPI flush through the HAL, `use_dma2d` DPI transfers, PPA block rotation when `HalProfile::preferHwRotate`
- **STM32Cube backend**: `halStm32SetSpi(&hspi)` enables `HAL_SPI_Transmit_DMA` flush, DMA2D fill and copy blitter, D-cache maintenance on F7/H7
- **WCH backend**: CH32V DMA SPI flush (`halWchSetSpi` for `SPI2`)
- **LTDC framebuffer copy** on STM32 and CH32H: `halSetLtdcFramebuffer(fb, w, h, stride, swapBytes)`
- `HalProfile::preferRichTransitions`, `UI::setHalProfile`, `UI::halProfile`, `halRefreshCaps()`
- Lucarne Studio: **Rendering / HAL** section in Hardware (backend, UI profile, buffer mode, stripe lines, rich transitions, hardware rotation, JPEG decode, French explanation per profile), red RAM warning when a full framebuffer exceeds the profile budget, display chip in the memory bar, transitions greyed out per profile in every inspector, `displayBufferOptions()` / `setHalProfile` export, Label "Bind key" fields exported as `ui.bindValue`, complete sketches for OLED and HD44780 projects
- Examples `LucarnePartialC3`, `LucarneOled`, `LucarneHD44780`

#### Changed

- `UI::update()` order: splash, animated icon patch, invalidation collection (widgets, store keys, keyboard, splash bar), then per-region render
- Hardware capabilities only declare what is implemented: the ESP-IDF backend no longer claims RGB parallel, the STM32Cube backend no longer claims LTDC / JPEG / CLUT / GFXMMU, WCH no longer claims GPHA
- On ESP32, `Psram` and `MipiHighRes` profiles fall back to `LowRam` when no PSRAM is detected; `Tiny` and `LowRam` force rich transitions off
- Lucarne Studio memory estimate counts stripes for `Partial` and two extra framebuffers only when rich transitions are actually enabled and used

### Added

- **Dynamic widgets** — `Battery`, `Clock`, `Date`, `Status`, `DynamicImage` (store-driven UI for status bar, time, network, runtime image paths)
- **Oversized assets** — `ImageScaleMode::Native` for 1:1 draw with screen clip; flash export crops to visible region
- Store string capacity increased to 64 chars (paths for dynamic images)
- Store entry capacity increased from 32 to 160 keys, configurable via `LUCARNE_STORE_CAPACITY` in `LucarneUserConfig.h` (large multi-screen projects)
- Lucarne Studio device presets **ILI9342C 2.0"–3.2"** (portrait and landscape)
- **ST7796** SPI display driver (320×480, typical 3.5" panels) — `COLMOD 0x55`, rotation table aligned with common modules
- Lucarne Studio device preset **ST7796 3.5" 320×480**
- Example sketches `LucarneDiagS3`, `LucarneDiagST7796`
- **Unified D-pad focus navigation**: `UI` now builds a single focus list per screen covering navigable `Shape`s, `Button`s, `Switch`es, `TextField`s, `Slider`s and `List`s (previously only shapes were reachable with a physical D-pad). Each widget kind gained a focus highlight (`setFocused`) matching the existing `Shape` selection outline
- **`Slider` and `List` are now interactive on real hardware**, not just in the Studio simulator: pressing `select()` enters edit mode, Up/Down adjust the slider value (`step()`, clamped to `[min, max]`) or move the list selection (wrapping), and a touch tap directly sets the value/row (`UI::activateAt`)
- **`UI::registerField`**: turns any `Button` into a live, D-pad editable numeric value (name/value/unit label, `select()` enters edit mode, Up/Down adjust by a configurable step and clamp to `[min, max]`, `select()`/`back()` confirms). Intended for the numeric settings exported as plain buttons on 4-button (no touch, no keyboard) hardware
- **`TextField` widget + on-device virtual keyboard**: `TextField` is a real text/number input widget (`setKey`, `setLabel`, `setPlaceholder`, `setMaxLen`, `setInputKind` — Text/Numeric/Integer/Hex/Password). Focusing it and pressing `select()` opens an on-screen keyboard drawn by `UI` (mirrors the Lucarne Studio simulator): `next()`/`prev()` cycle through the keys, `select()` types the highlighted one, the on-screen `OK` key or `back()` closes it. Ships with `Full`/`Compact`/`Minimal` QWERTY and AZERTY layouts plus dedicated `Numeric` and `Hex` layouts (auto-picked from the field's input kind); configure globally via `UI::configureKeyboard(VirtualKeyboardOptions)`. Also works with a touch panel — tapping a key or the surrounding overlay area is handled by `UI::activateAt`
- **Keyboard `^` (shift) and `123`/`ABC` (layout switch) keys are now functional on-device**, not decorative placeholders — `^` capitalizes the next letter, `123` swaps to the numeric layout and back to the field's suggested alpha layout via `ABC`
- **PSRAM asset cache** (`ImageStorage::Psram`): images marked for PSRAM storage are now actually copied from flash into a `heap_caps_malloc(MALLOC_CAP_SPIRAM)` buffer once at prefetch time and drawn from there — this used to be a cosmetic enum value that silently fell back to reading flash on every frame
- Exporter now emits real `TextField` widgets for `textfield` widgets (was a static `Button` placeholder with no input) and sets `VirtualKeyboardOptions::layout` from the project's hardware keyboard layout in the generated `keyboardOptions()`
- Example sketch `LucarneUIP4` — ESP32-P4 MIPI-DSI display + GT911 touch, `UI` driven purely via `TouchInput`
- Example sketch `LucarneKeyboard` — `TextField` + on-device virtual keyboard walkthrough
- **Three more MIPI-DSI panel drivers**: `MipiPanelDriver::Ili9881c`, `Jd9365` and `Ek79007`, alongside the existing `Ws5DsiTouchA_Hx8394` — `MipiDisplay::initPanel()` now runs the correct vendor init sequence (from Espressif's `esp_lcd_ili9881c`/`esp_lcd_jd9365`/`esp_lcd_ek79007` components) for each. Lucarne Studio's device catalog now derives working DPI clock/porch/lane defaults per panel IC instead of reusing the HX8394 timings for every MIPI entry
- **Three more MIPI touch controllers**: `GT9271Touch` and `GT928Touch` (`src/input/LucarneTouchGoodix.h`, same Goodix register protocol as `GT911Touch`) and `FT6336Touch` (`src/input/LucarneTouchFT6336.h`, FocalTech FT6x06 protocol)
- Example sketch `LucarneUIP4MultiPanel` — bring-up sketch selecting between all 4 panel ICs × 4 touch ICs above via `#define`

### Fixed

- **Splash screen** no longer pushed onto the navigation stack — pressing back from the first real screen used to return to the splash
- **`ButtonInput`** had no debounce; mechanical switch bounce could fire multiple nav events per press. Added a configurable debounce window (`setDebounce`, default 25 ms)
- **`ButtonInput`** now supports active-low buttons wired to GND with the internal pull-up enabled by default (`begin(..., activeLow, usePullup)`), matching boards with no external pull-up resistors
- **`Shape`** focus highlight (`setActiveFill`/`setActiveStroke`) was silently dropped whenever the shape's base fill/stroke was transparent (typical for nav-bar buttons drawn as an outline only) — the focused state now always renders when an active override is set
- **`UI`**'s shape-group scan no longer pulls in non-navigable decorative shapes sharing the default group, which could pollute D-pad cycling with invisible/unintended stops
- Removed dead, never-defined `Display::spiBegin()` / `Display::spiEnd()` declarations
- **RP2040/RP2350 (`rp2040:rp2040` / arduino-pico core) compile fixes** — the library previously failed to build at all on any non-ESP32 target:
  - `LucarneMipiDsi.cpp` and `LucarneTouchGT911.cpp` unconditionally `#include "soc/soc_caps.h"` (ESP-IDF-only header); Arduino/PlatformIO compile every `.cpp` under `src/` regardless of what `Lucarne.h` includes, so this broke compilation on any board that isn't ESP32, even though neither file's actual code is ever used there. The include is now guarded behind `#if defined(ESP32)`
  - `BufferMemory::PSRAM` renamed to `BufferMemory::Psram` — the all-caps name collided with a `#define PSRAM ...` macro in the RP2040 core's `Arduino.h`
  - `Display::flushRegion()` called `SPIClass::writeBytes()`, an ESP32-only extension not part of the portable Arduino SPI API; it now falls back to a byte-by-byte `transfer()` loop on non-ESP32 targets (this also fixes the same failure on AVR)

### Changed

- Renamed internal `UI` shape-only navigation (`scanActiveShapeGroup`, `_shapeGroup`, ...) to a generic focus group (`scanActiveFocusGroup`, `_focusGroup`, ...) covering all navigable widget kinds
- Lucarne Studio only offers hardware the firmware can actually run: display families/panel ICs without a driver (`oled_mono`, `matrix_lcd`, MIPI panel ICs other than HX8394/ILI9881C/JD9365/EK79007) and touch controllers without a driver (anything other than GT911/GT9271/GT928/FT6336) are disabled in the pickers and hard-blocked by the Design Rule Check instead of silently exporting a non-functional project
- Removed the `Web` image storage option from Lucarne Studio's asset picker — there is no HTTP image loader in the firmware; existing projects using it are flagged by the Design Rule Check

## [0.2.0] — 2026-06-25

### Added

- **Menu** per-state colors: `setActiveFill`, `setActiveText`, `setInactiveFill`, `setInactiveText`, `setInactiveEdge` (+ clear helpers)
- **Screen** optional custom theme (`setTheme`, `clearTheme`) — `UI::activeTheme()` resolves screen override
- **Asset prefetch** on navigation: `screenPrefetchAssets()` warms SD/volume icons and first anim frame before draw
- `imageAssetDrawReady()` — check whether a file-backed asset is cached and drawable
- `iconAnimDrawRect()` — consistent icon/anim hit box from widget bounds
- `Image::asImage()` widget cast for prefetch and tooling
- `Menu::itemIcon()` / `itemBadge()` accessors
- Live Preview docs: USB vs Bluetooth port selection, expanded troubleshooting

### Changed

- Animated icon patch path: first-frame bootstrap (`lastAnimFrame == 0xff`), SD warm before blit, up to 16 anim snap slots
- Emoji icon default draw size **32px** when widget has no explicit bounds
- `iconAnimDrawInitial()` returns `bool` (frame ready)
- Transition **fade** fixes RGB565 endianness in framebuffer snapshots
- Transitions prefetch leaving + entering screen assets; release SD cache on screen change
- Volume/SD draw: skip **RGB565 zero** pixels when no alpha file (transparent holes in opaque assets)
- Optional alpha file open failures no longer log as hard errors
- `LucarneDisplay.cpp` formatting and buffer blit helpers aligned with full-buffer mode

### Fixed

- Animated icons on volume/SD could stall on first frame until cache warm
- Fade transitions could show wrong colors on ESP32 full framebuffer (byte order)

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

[0.3.0]: https://github.com/Pupariaa/Lucarne/releases/tag/v0.3.0
[0.2.0]: https://github.com/Pupariaa/Lucarne/releases/tag/v0.2.0
[0.1.4]: https://github.com/Pupariaa/Lucarne/releases/tag/v0.1.4
[0.1.3]: https://github.com/Pupariaa/Lucarne/releases/tag/v0.1.3
[0.1.2]: https://github.com/Pupariaa/Lucarne/releases/tag/v0.1.2
[0.1.1]: https://github.com/Pupariaa/Lucarne/releases/tag/v0.1.1
[0.1.0]: https://github.com/Pupariaa/Lucarne/releases/tag/v0.1.0
