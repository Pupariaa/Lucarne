# UI & widgets roadmap

Checklist for Lucarne widget library, Studio designer, and premium embedded UI (status bar, media player, iPod-class polish).  
Hardware / display families: see [DISPLAY_ROADMAP.md](./DISPLAY_ROADMAP.md). For the historical log of Studio editor UI/UX work (already shipped), see [EDITOR_HISTORY.md](./EDITOR_HISTORY.md) — this document is kept as a clean, forward-looking backlog only.

Legend: `[x]` done · `[ ]` planned · `[~]` partial

---

## Dynamic widgets (store-driven)

### Firmware

- [x] `Battery` — level 0–100, optional charging key, low threshold, show/hide percent
- [x] `Clock` — hour/minute/second ints or preformatted string key; formats `HH:MM`, `HH:MM:SS`, 12h
- [x] `Date` — day/month/year ints or string key; formats DMY / YMD / MDY / DMY dot
- [x] `Status` — WiFi bars (RSSI), Bluetooth icon
- [x] `DynamicImage` — path from Store; storage SD / Volume / PSRAM
- [x] `FlashRle` (RLE-compressed flash images) and `Psram` (preload asset into PSRAM at boot) storage kinds
- [ ] `ImageStorage::Web` — HTTP image loader (enum value exists, no loader implemented; **removed** from Studio's asset-storage picker until this ships)
- [x] Oversized images/icons — native 1:1 scale mode, screen clip, flash export crop
- [ ] `DynamicImage` — LRU cache + prefetch on screen navigation
- [ ] Helper `LucarneSystem` — bind NTP/RTC, fuel gauge, WiFi RSSI to store keys

### Studio

- [x] Palette entries (Battery, Clock, Date, Status, Dynamic image)
- [x] Inspector (format, keys, storage, showPercent, styles)
- [x] Designer preview (`lucarne-render.js`)
- [x] C++ export (`Projet.h` declarations + setup)
- [x] Auto-init keys on export (`collectInitKeys`)
- [x] Auto-create keys when adding widget from palette
- [x] Preset template **Status bar**
- [ ] Data tab simulators — live clock tick, battery slider, RSSI in preview
- [ ] Dynamic image preview from project asset or sample path

---

## Status bar & system chrome

- [x] Individual widgets (clock, date, battery, status icons)
- [ ] Composite **StatusBar** widget (single drop-in zone)
- [ ] Extra indicators — cellular, VPN, alarm, silent mode, headphones
- [ ] **Marquee** label for long titles (artist, filename)
- [ ] Fixed top layer — status bar does not scroll with content
- [ ] Safe area insets (notch, rounded corners, touch margins)

---

## Navigation & lists

- [x] `Menu` — selectable rows, icons, badges, callbacks
- [x] `List` — interactive: focus, D-pad/button scroll and selection (no longer static-only)
- [ ] **ListView** enhancements — momentum, rubber-band, scroll indicator (beyond `List`'s current focus-driven scroll)
- [ ] Section headers + collapsible groups
- [ ] **Wheel picker** (settings-style drum)
- [ ] **Tab bar** / segmented control
- [ ] **Breadcrumbs** for deep hierarchy
- [ ] **Search bar** with live filter
- [ ] Pull-to-refresh hook (callback + spinner)

---

## Media & visual

- [x] `Image` — static asset (flash / volume / SD)
- [x] `DynamicImage` — runtime path
- [x] `Icon` + animated emoji (`IconAnim`)
- [ ] **Now playing** block — title, artist, elapsed/total, progress bar
- [ ] **CoverFlow** / 3D album carousel
- [ ] Progress ring around cover art
- [ ] Mini **waveform** / spectrum visualizer
- [ ] Dominant color from cover → theme accent
- [ ] **Parallax** on scroll (cover / background)

---

## Controls & feedback

- [x] `Button`, `Switch`, `Slider`, `Bar`, `Gauge`, `Chart`, `Metric`
- [x] `Slider` — interactive: focus, D-pad/button value adjustment (no longer display-only)
- [ ] **Volume** widget — vertical slider (iPod-style)
- [ ] **Stepper** (+ / − numeric)
- [ ] **Spinner** / loading indicator
- [ ] **Toast** / banner notification
- [ ] **Modal** / action sheet overlay
- [ ] **Rating** stars
- [ ] **Chip** / tag group
- [ ] Haptic / sound feedback hooks (optional, board-dependent)

---

## Motion & transitions

- [x] Screen transitions — Slide, Fade, etc. (`LucarneTransition`)
- [x] Icon animations (Fluent emoji frames)
- [ ] Easing curves — ease-in-out on all transitions
- [ ] Cross-fade between screens (simultaneous out/in)
- [ ] Spring animation on menus / modals
- [ ] Skeleton / shimmer while loading network assets
- [ ] Per-widget enter/exit animations

---

## Typography & themes

- [x] `Theme` — colors, row height, fonts body/title
- [x] Per-screen theme override
- [x] Custom fonts export (`.lucfont`)
- [ ] Condensed font preset for status bar / dense lists
- [ ] Theme variants — light / dark / OLED pure black
- [ ] Dynamic accent from cover or user setting
- [ ] 8px baseline grid helpers in Studio snap

---

## Performance & architecture

- [x] Store-driven widgets (160 keys, 64-char strings — up from the original 32/24, configurable via `LUCARNE_STORE_CAPACITY` in `LucarneUserConfig.h`)
- [x] SD / volume image cache (`LucarneImageLoader`)
- [x] Asset prefetch on navigation
- [ ] Dirty regions — clock/battery refresh without full screen redraw
- [ ] Layer compositing — fixed chrome + scrollable content
- [ ] Namespaced sub-stores (beyond the flat capacity increase already shipped)
- [ ] Widget-level `invalidate()` granularity audit

---

## Studio templates & UX

- [x] Templates — Dashboard, Settings, IoT panel, Status bar
- [ ] Template **Music player** — now playing + menu + cover area
- [ ] Template **Settings** with wheel pickers
- [ ] Template **Gallery** — grid of dynamic images
- [ ] Hardware-aware widget palette (OLED / matrix restrictions)
- [ ] Touch simulator — long press, swipe gestures

---

## Input & text

Formerly tracked as "Phase 3" — now fully shipped, both in firmware and in Studio.

- [x] `TextField` widget in Studio, exported as a real `TextField` (no longer a static `Button` placeholder)
- [x] Keyboard layout in designer matches the on-device overlay
- [x] `TextField` firmware — focus, on-screen editing, touch input (`UI::activateAt`)
- [x] Virtual keyboard overlay — `Full`/`Compact`/`Minimal` QWERTY and AZERTY, `Numeric`, `Hex` layouts, dock top/bottom (`UI::configureKeyboard`)
- [x] Layout-switch keys (`^` shift/symbols, `123` numeric) — functional, not placeholder keys
- [x] Focus chain across fields — unified D-pad focus navigation covers every `TextField` (and `Shape`/`Button`/`Switch`/`Slider`/`List`) on a screen
- [x] On-screen keyboard simulated in Studio's Simulate mode

---

## Documentation & examples

- [x] `CHANGELOG` — dynamic widgets entry
- [x] `keywords.txt` / `Lucarne.h` exports
- [ ] Example sketch — status bar + NTP + WiFi bind
- [ ] Example sketch — dynamic cover from SD
- [ ] `docs/EDITOR.md` — dynamic widget section
- [ ] Firmware cookbook — store update loop patterns

---

## Suggested priority order

1. [ ] Composite `StatusBar` widget + fixed chrome layer (status bar does not scroll with content)
2. [ ] `ListView` enhancements — momentum, rubber-band, scroll indicator
3. [ ] Now playing + progress bar
4. [ ] CoverFlow / carousel
5. [ ] Transitions easing + cross-fade
6. [ ] Music player Studio template
7. [ ] `DynamicImage` Web loader (network fetch) — no firmware work planned until this is prioritized; currently removed from Studio's storage picker

Also see the hardware/display-side backlog (non-GT911 touch drivers, non-HX8394 MIPI panels, OLED, character LCD) in [DISPLAY_ROADMAP.md](./DISPLAY_ROADMAP.md).

---

## Cross-reference

| Track | Document |
|-------|----------|
| Displays, touch, MIPI, OLED, matrix | [DISPLAY_ROADMAP.md](./DISPLAY_ROADMAP.md) |
| Editor usage | [EDITOR.md](./EDITOR.md) |
| Editor UI/UX history (already shipped) | [EDITOR_HISTORY.md](./EDITOR_HISTORY.md) |
| Hardware presets | [HARDWARE.md](./HARDWARE.md) |
