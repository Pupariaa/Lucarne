# Lucarne

UI toolkit for small SPI displays (ST7789, ST7735S) on Arduino and ESP32. No Adafruit dependency.

Three parts work together:

1. **Graphics** — SPI drivers, drawing primitives, optional framebuffer.
2. **UI runtime** — screens, widgets, menus, animated transitions, data binding.
3. **Lucarne Studio** — browser editor to design screens, simulate navigation, export C++ headers.

---

## Quick start

### Install

- **Arduino IDE** — copy this repo to `Documents/Arduino/libraries/Lucarne`
- **PlatformIO** — put it in `lib/Lucarne/` or add it via `lib_deps`

Then `#include <Lucarne.h>`. Everything is in the `lucarne` namespace.

### Hello screen

```cpp
#include <Lucarne.h>
using namespace lucarne;

ST7789 display;

void setup() {
    DisplayPins pins;
    pins.cs = 1; pins.dc = 2; pins.rst = 3; pins.mosi = 4; pins.sclk = 5;

    DisplayOptions options;
    options.panelWidth = 240;
    options.panelHeight = 280;
    options.spiMode = 3;      // many ST7789 boards need mode 3
    options.invert = true;

    BufferOptions buffer;
    buffer.mode = BufferMode::Full;

    display.begin(pins, options, buffer);
    display.fillScreen(color565(0, 0, 0));
    display.setCursor(20, 20);
    display.setTextColor(color565(255, 255, 255));
    display.print("Hello Lucarne");
    display.display();
}

void loop() {}
```

With `BufferMode::Full`, drawing goes to RAM and `display()` pushes dirty regions to the panel. With `BufferMode::None`, drawing goes straight to the screen.

---

## Build a UI in code

A UI needs a `Theme`, one or more `Screen` objects with widgets, and a `UI` controller.

```cpp
ST7789 display;
UI ui(display);
Screen dashboard("Dashboard");

Label title(0, 14, "Dashboard", TextAlign::Center);
Metric temp(14, 56, 212, 34, "Temp", "temp", "C");
Bar loadBar(14, 166, 212, 20, "load", 0.0f, 1.0f);

void setup() {
    display.begin(/* pins, options, buffer */);

    Theme theme;
    theme.font = &LucarneFontBody;
    theme.fontTitle = &LucarneFontTitle;
    ui.setTheme(theme);

    dashboard.add(&title);
    dashboard.add(&temp);
    dashboard.add(&loadBar);

    ui.setFloat("temp", 23.4f);
    ui.setFloat("load", 0.32f);
    ui.show(&dashboard);
    ui.begin();
}

void loop() {
    ui.setFloat("temp", readTemperature());
    ui.update();
}
```

Widgets: `Label`, `Metric`, `Bar`, `Icon`, `Menu`, `Image`. Full API: [docs/RUNTIME.md](docs/RUNTIME.md).

### Data binding

Widgets read named keys from the UI store. Update a key, the screen redraws.

```cpp
ui.setFloat("temp", 21.7f);
ui.setInt("rssi", -62);
ui.setBool("fan", true);
ui.setString("mode", "AUTO");
```

`Metric` and `Bar` bind to a key. `ui.update()` only redraws when a bound value changed.

---

## Menus

Menu items either **go to another screen** or **run your code** in `loop()`.

```cpp
Screen home("Home");
Screen settings("Settings");
Menu menu(12, 24, 216, 230);

static const uint8_t ACTION_ABOUT = 1;

menu.addItem("Sensors", iconFromName("thermo"), &dashboard, Transition::SlideLeft);
menu.addItem("Settings", iconFromName("settings"), &settings, Transition::Fade);
menu.addCallbackItem("About", iconFromName("home"), ACTION_ABOUT);

home.add(&menu);
ui.show(&home);
```

Handle callbacks in `loop()`:

```cpp
switch (ui.pollMenuAction()) {
    case ACTION_ABOUT:
        Serial.println("About tapped");
        break;
}
```

Navigation:

| Call | Effect |
|------|--------|
| `ui.next()` / `ui.prev()` | Move menu selection |
| `ui.select()` | Open target screen or queue callback |
| `ui.pollMenuAction()` | Read callback id (0 if none) |
| `ui.back()` | Go to previous screen |

Each item has a left icon and an optional right icon (`MenuItemOpts`). Default right icon: arrow when navigating to a screen, hidden otherwise. Scales: `menu.setIconScale(2)`, `menu.setBadgeScale(2)`.

Animated transitions need `BufferMode::Full`. Types: `SlideLeft`, `SlideRight`, `Fade`, `Push`, `Cover`, and more.

---

## Physical input

Wire buttons, encoder, or touch to the UI.

**Buttons** (up, down, OK, back):

```cpp
ButtonInput buttons;
buttons.begin(25, 26, 27, 14, true);  // pins, active low
buttons.attach(&ui);

void loop() {
    buttons.update();
    ui.update();
}
```

**Encoder** — rotation moves selection, press selects, long press goes back.

**Touch** — call `touch.feed(x, y, pressed)` from your touch driver.

Pin wiring details: [docs/HARDWARE.md](docs/HARDWARE.md).

---

## Lucarne Studio

Open `editor/index.html` in a browser. No install, no build step.

| Tab | What it does |
|-----|----------------|
| Blueprint | Connect screens via menu links |
| Designer | Place widgets, edit theme and layout |
| Fonts | Import or pick fonts (exported as C++) |
| Simulate | Test navigation with keyboard or on-screen pad |
| Export | Download `Projet.h` (+ `Projet_fonts.h` if needed) |

Projects auto-save in the browser. Use Save/Load for JSON backup.

Full editor guide: [docs/EDITOR.md](docs/EDITOR.md).

### Live preview (USB)

Flash `examples/LucarnePreview` once, plug in ESP32-S3, click **Live** in the editor (Chrome/Edge). The editor streams the framebuffer over USB; the board just displays it.

Details: [docs/LIVE_PREVIEW.md](docs/LIVE_PREVIEW.md).

---

## Use exported UI in your sketch

Export gives you `Projet.h` (and `Projet_fonts.h` if you added custom fonts). Drop them next to your `.ino`.

```cpp
#include <Lucarne.h>
#include "Projet.h"

using namespace lucarne;

ST7789 display;
UI ui(display);

void setup() {
    display.begin(/* your pins and panel options */);

    projet::build(ui);
    projet::attachInput(ui);
    ui.begin();
}

void loop() {
    projet::update();
    ui.update();

    switch (ui.pollMenuAction()) {
        case projet::ACTION_OPEN_SETTINGS:
            break;
    }

    ui.setFloat("temp", readTemperature());
}
```

You own `display.begin()` — the editor does not know your wiring.

Data keys from the editor Data tab map to `ui.setFloat`, `setInt`, `setBool`, `setString`.

Menu callbacks: the export defines `projet::ACTION_<NAME>` constants. Read them with `ui.pollMenuAction()` in `loop()`. No extra `.cpp` file needed.

Re-export `Projet.h` after editor changes. Your `.ino` stays the same unless you add new callback names.

---

## Displays

Set `panelWidth` and `panelHeight` to the native size at rotation 0. Lucarne applies offsets per panel size; override with `colStart`, `rowStart`, etc. if needed.

| Driver | Common sizes |
|--------|--------------|
| ST7789 | 135x240, 240x240, 172x320, 240x280, 240x320 |
| ST7735S | 80x160, 128x128, 128x160 |

If the screen stays black, try `spiMode = 3` and `invert = true`.

---

## Memory

| Mode | RAM | Transitions |
|------|-----|-------------|
| `BufferMode::Full` | Framebuffer (PSRAM or internal) | Animated |
| `BufferMode::None` | Minimal | Instant only |

`BufferMemory::Auto` picks PSRAM when available. `maxBytes` caps allocation; Lucarne falls back to direct mode if memory is too low.

---

## Fonts

Built-in anti-aliased fonts (Fira Sans):

- `LucarneFontBody` — body text
- `LucarneFontTitle` — titles

Custom fonts are created in the editor and exported to `Projet_fonts.h`. Details: [docs/FONTS.md](docs/FONTS.md).

---

## Examples

| Sketch | Shows |
|--------|-------|
| `HelloLucarne` | Basic drawing and text |
| `LucarneDiag` | Panel test pattern |
| `LucarneUI` | Dashboard with live data |
| `LucarneMenu` | Menus, transitions, callbacks, buttons |
| `LucarnePreview` | USB live preview firmware |

---

## Repo layout

```
Lucarne/
├── src/          SDK (display, UI, widgets)
├── editor/       Lucarne Studio (web app)
├── examples/     Arduino sketches
├── scripts/      Font/icon build tools
└── docs/         Detailed reference
```

## More docs

- [docs/RUNTIME.md](docs/RUNTIME.md) — widgets and API reference
- [docs/EDITOR.md](docs/EDITOR.md) — Studio and export
- [docs/LIVE_PREVIEW.md](docs/LIVE_PREVIEW.md) — USB preview
- [docs/HARDWARE.md](docs/HARDWARE.md) — wiring
- [docs/FONTS.md](docs/FONTS.md) — custom fonts

## License

Default font: **Fira Sans** (SIL Open Font License). See the repo for library license terms.
