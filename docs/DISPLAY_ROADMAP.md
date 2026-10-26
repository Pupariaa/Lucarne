# Display families roadmap

Lucarne ships drivers for **SPI RGB565** panels (ST7789, ST7796, ST7735S, ILI9342), **mono OLED** panels (SSD1306, SH1106 over I2C or SPI), **HD44780** character LCDs and **MIPI DSI** panels on ESP32-P4. This document tracks the multi-display architecture and implementation phases for OLED, character LCD, MIPI DSI, touch, and virtual keyboard support.

## Display families

| Family | Bus | Studio preset examples | Firmware status |
|--------|-----|------------------------|-----------------|
| `spi_rgb` | SPI + RGB565 framebuffer | ST7789, ST7796, ST7735S, ILI9342 | **Available** |
| `oled_mono` | I2C or SPI, 1 bpp | SSD1306 128×64, SH1106 | **Available** (V3, `BufferMode::None`) |
| `matrix_lcd` | Parallel 4-bit HD44780 | 16×2, 20×4 | **Available** (V3, `BufferMode::None`) |
| `mipi_dsi` | MIPI DSI (ESP32-P4) | Waveshare 5-DSI-TOUCH-A (720×1280), generic ILI9881C/JD9365/EK79007 panels | **Done** in firmware for 4 panel ICs × 4 touch ICs (Phase 5) ; not yet exposed in Studio |

Each family uses different pin models in Studio **Hardware** and exports a matching `Projet_setup.h` (`displayPins`, `oledPins`, `matrixPins`, or `mipiConfig`).

Types live in `src/core/LucarneTypes.h`: `DisplayBus`, `I2cDisplayPins`, `MatrixDisplayPins`, `MipiDisplayConfig`, `TouchConfig`, `VirtualKeyboardOptions`.

## Studio (Phase 0 — done)

- Device presets per family in `editor/state.js` (`deviceCaps`, `deviceFamily`)
- Conditional Hardware tab: SPI / I2C / HD44780 / MIPI / touch / keyboard
- Export branches in `Projet_setup.h` by family
- Touch: Studio's picker only offers what the firmware implements — **GT911** on the MIPI-DSI/P4 path. I2C touch choices that had no firmware driver (FT6336, GT9271, GT928) have been removed from the picker and are hard-blocked by the Design Rule Check; see [HARDWARE.md](./HARDWARE.md) and the *Touch controllers* phase below for the real implementation status
- Virtual keyboard toggle (layout + dock) — **done**, no longer an export stub (see Phase 3)

## Phase 1 — OLED 0.96" (SSD1306 / SH1106)

**Status: done in firmware (V3)**, Studio exports working sketches.

**Firmware**

- [x] `OledMono` base class (`src/display/LucarneOledMono.h`) with `SSD1306` and `SH1106` controllers (SH1106 column offset 2)
- [x] 1 bpp page buffer (1 KB for 128×64), RGB565 colors thresholded by luminance, only the modified pages are sent
- [x] I2C `begin(I2cDisplayPins, OledOptions | DisplayOptions, TwoWire*)` and SPI `begin(DisplayPins, DisplayOptions, SPIClass*)` / `beginSpi(...)` (SPI clock capped below 10 MHz)
- [x] Rotation 0 to 3, `OledOptions.invert`, `flipVertical`, `setContrast`, `displayOn`
- [x] Example `examples/LucarneOled`
- [ ] Live Preview: mono strip protocol (separate from RGB565 RLE)

**Studio**

- [x] `deviceFirmwareSupported` accepts SSD1306 and SH1106; export emits `oledPins()` / SPI pins and `buildInoSketch` produces a complete sketch
- [x] Transitions limited to None/Fade by the profile matrix (OLED is `BufferMode::None`, so the effective transition is None)
- [ ] Restrict widget palette on `oled_mono` (no `image`)
- [ ] Mono preview in designer/simulator

## Phase 2 — Touch controllers

**Status: GT911 done ; all other controllers pending.**

**Firmware**

- [x] `GT911Touch` (`src/input/LucarneTouchGT911.h`/`.cpp`) — I2C, wired for the MIPI-DSI / ESP32-P4 path (shared I2C bus with the panel's backlight controller)
- [ ] `LucarneTouchFT6336` — **not implemented**, no driver class exists
- [ ] `GT9271`, `GT928` I2C touch drivers — **not implemented**
- [ ] `projet::initTouch(TouchInput &)` generic helper that polls any configured controller and calls `feed(x, y, pressed)` — currently the GT911 path is wired manually per example (`LucarneUIP4.ino`), not through a generated generic helper
- [x] Calibration: `TouchConfig` swap/invert applied before hit testing (used by `GT911Touch::feedCalibrated`)

**Studio**

- Hardware tab exposes GT911 pins for MIPI-DSI projects; the Design Rule Check blocks selecting any other touch controller, since selecting an unimplemented one used to silently export a `// TODO` stub instead of working code

## Phase 3 — Virtual keyboard

**Status: done.**

**Firmware**

- [x] Keyboard overlay drawn directly by `UI` (`LucarneUI.cpp`), docked top/bottom (`VirtualKeyboardOptions::dock`)
- [x] Focus chain across `TextField`s and every other focusable widget on a screen (unified D-pad focus group); overlay opens on `select()`, closes on the keyboard's `OK` key or `back()`; also usable via touch (`UI::activateAt`)
- [x] Layouts: `Full`/`Compact`/`Minimal` QWERTY, `FullAzerty`/`CompactAzerty`/`MinimalAzerty`, `Numeric`, `Hex` (`KeyboardLayout`, auto-suggested from `TextField::Kind`)
- [x] Layout-switch keys (`^` shift/symbols, `123` numeric) are functional, not decorative placeholders

**Studio**

- Keyboard enable syncs `input.virtualKeyboard` and hardware section
- Simulator: on-screen keyboard for touch testing, matching the on-device layouts above

## Phase 4 — HD44780 character LCD

**Status: done in firmware (V3)**, Studio exports working sketches.

**Firmware**

- [x] `HD44780` (`src/display/LucarneHD44780.h`): logical `Gfx` of `cols × charWidth` by `rows × charHeight` pixels backed by a shadow character grid, 4-bit bus, only changed cells are written
- [x] Styled widget text is routed through `Gfx::isCharacterGrid()` / `drawGridText` (alignment, inverted marker); `fillRect` blanks the covered cells
- [x] `Bar` uses 5-level CGRAM glyphs through `drawGridBar`
- [x] Glyph mapping: ASCII, `°`, `µ`, accented letters folded to their base letter, arrows; anything else becomes `?`
- [x] `begin(MatrixDisplayPins, MatrixDisplayOptions, DisplayOptions)` honours `blActiveLow`
- [x] Example `examples/LucarneHD44780`

**Studio**

- [x] Designer canvas = `cols × charW` by `rows × charH` pixels (layout aid only)
- [x] Export uses `matrixPins()` / `matrixOptions()`, `buildInoSketch` produces a complete sketch

## Phase 5 — MIPI DSI (ESP32-P4)

**Status: done in firmware for 4 panel ICs × 4 touch ICs**, not yet exposed by Studio's board/board-wizard UI (Studio has no ESP32-P4/MIPI-DSI board picker at all; this hardware is coded directly against the `Lucarne` C++ library today).

**Firmware — done**

- [x] `MipiDisplay` — PSRAM RGB565 framebuffer, flush via `esp_lcd_panel_draw_bitmap`
- [x] Panel ICs: `MipiPanelDriver::Ws5DsiTouchA_Hx8394` (Waveshare 5-DSI-TOUCH-A, 720×1280), `Ili9881c` (Espressif reference, 800×1280), `Jd9365` (Espressif reference, 800×1280), `Ek79007` (official ESP32-P4-Function-EV-Board, 1024×600) — each with its own vendor init sequence in `MipiDisplay::initPanel()`
- [x] Touch ICs: `GT911Touch`, `GT9271Touch`, `GT928Touch` (`src/input/LucarneTouchGoodix.h`, same Goodix protocol as GT911), `FT6336Touch` (`src/input/LucarneTouchFT6336.h`, FocalTech FT6x06 protocol) — any panel driver can be paired with any touch class, they share the panel's I2C bus
- [x] Examples: `examples/LucarneUIP4/LucarneUIP4.ino` (HX8394 + GT911), `examples/LucarneUIP4MultiPanel/LucarneUIP4MultiPanel.ino` (all 4×4 combinations, selectable via `#define`)
- [x] Lucarne Studio's device catalog (`editor/state.js`) recognizes the 4 supported panel ICs and 4 supported touch ICs as firmware-backed (`deviceFirmwareSupported`/`deviceTouchFirmwareSupported`) and exports the matching `MipiPanelDriver`/touch class — but Studio still has no dedicated ESP32-P4 board/GPIO wizard step, so P4 projects rely on the generic Hardware tab

**Still pending**

- [ ] Other MIPI panel driver ICs (e.g. NT35510, R63419, OTA7290B) and other touch ICs (e.g. GT967, GT9147, FT5x06, CST816) — no driver class exists for these
- [x] Per-rect flush (dirty regions), `use_dma2d` DPI transfers, PPA 90° rotation by blocks when `HalProfile.preferHwRotate` (V3)
- [ ] Optional double buffering
- [ ] Reuse RGB565 widget pipeline where resolution allows on other panel sizes
- [ ] A dedicated ESP32-P4/MIPI-DSI board + panel picker in Studio's hardware wizard (see `docs/UI_ROADMAP.md`)

The init sequences and DPI/lane timings above are Espressif's own reference values for each controller (`esp_lcd_ili9881c`/`esp_lcd_jd9365`/`esp_lcd_ek79007`) or the panel vendor's table (HX8394/Waveshare); third-party modules using the same IC at a different resolution can still need their own gamma/power tuning or porch values if the picture is garbled or rolls — see `docs/HARDWARE.md`.

**Video / MPEG-4 (Phase 5b — separate track)**

- ESP32-P4 hardware JPEG/MPEG decode where enabled in IDF
- Not part of the Lucarne UI widget tree: dedicated `VideoScreen` or external player feeding the panel
- Studio: optional “video region” widget pointing to file/stream URL (export as integration hook)

## Live Preview by family

| Family | Preview |
|--------|---------|
| `spi_rgb` | RGB565 RLE strips (current) |
| `oled_mono` | 1 bpp vertical strips (planned) |
| `matrix_lcd` | Text snapshot / serial log (planned) |
| `mipi_dsi` | RGB565 strips when USB bandwidth allows; else snapshot |

## Migration notes

- Existing projects default to `spi_rgb`; no breaking change to `DisplayPins` / SPI export path.
- Selecting a MIPI preset sets board to ESP32-P4, touch to DSI, and input type to touch.
- OLED/matrix projects should disable RGB565 asset export or accept Studio warnings.
- OLED and HD44780 always run in `BufferMode::None`; Studio hides the buffer mode selector for these families.
