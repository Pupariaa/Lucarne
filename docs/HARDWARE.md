# Matériel — câblage des écrans et des contrôles

## Écran SPI

Lucarne pilote des écrans SPI 4 fils (avec broches CS/DC/RST distinctes). Le câblage typique sur ESP32 :

| Signal | Rôle | `DisplayPins` |
|--------|------|---------------|
| SCLK | Horloge SPI | `pins.sclk` |
| MOSI / SDA | Données SPI | `pins.mosi` |
| CS | Chip select | `pins.cs` |
| DC / RS | Données vs commande | `pins.dc` |
| RST | Reset | `pins.rst` |
| BLK / LED | Rétroéclairage | `pins.bl` (`-1` si câblé en dur) |
| VCC | 3V3 | — |
| GND | Masse | — |

```cpp
DisplayPins pins;
pins.cs   = 1;
pins.dc   = 2;
pins.rst  = 3;
pins.mosi = 4;
pins.sclk = 5;
pins.bl   = -1; // ou une broche GPIO pour contrôler le rétroéclairage
```

### Options importantes

```cpp
DisplayOptions options;
options.panelWidth  = 240;   // définition native (rotation 0)
options.panelHeight = 280;
options.rotation    = 0;     // 0..3
options.spiHz       = 27000000;
options.spiMode     = 3;     // 0..3
options.colorOrder  = ColorOrder::RGB; // ou BGR
options.invert      = true;  // souvent nécessaire sur ST7789
```

- **Mode SPI** : de nombreux modules ST7789 exigent `spiMode = 3`. Avec un mauvais mode, l'écran reste totalement noir (le contrôleur ne latch pas les données). En cas d'écran noir alors que le rétroéclairage fonctionne, testez `spiMode = 3`.
- **Inversion** : `invert = true` est fréquent sur ST7789 (sinon couleurs inversées).
- **ST7796** (souvent 3.5" 320×480) : `spiMode = 3`, `COLMOD 0x55` (driver). Réglages typiques : `ColorOrder::BGR`, `invert = false` (pas un négatif photo — permutation R/B). Full framebuffer ≈ 307 KB. Live Preview : `BufferMode::None`. Si ghosting : `spiHz` 27 MHz.
- **ILI9342C** (2.0"–3.2" 240×320 ou 320×240) : `spiMode = 3`, `ColorOrder::BGR`, `invert = false`. Résolution native 240×320 ; modules paysage 320×240 via `rotation` ou preset Studio. Full framebuffer ≈ 150 KB. Pas d'exemple dédié : reprenez `examples/LucarneDiagST7796/LucarneDiagST7796.ino` en remplaçant `ST7796 display;` par `ILI9342 display;` et les dimensions du panneau.
- **Ordre des couleurs** : si rouge et bleu sont permutés, basculez `ColorOrder`.
- **Offsets** : appliqués automatiquement selon la taille (voir le README). Pour un module exotique, surchargez `colStart`, `rowStart`, `colStart2`, `rowStart2`. Exemple : l'écran 240×280 utilise un `rowStart` de 20 (sinon une bande de bruit apparaît en bas).
- **Débogage** : `options.debug = true` active des messages de diagnostic sur le port série.

### Vitesse SPI

`spiHz` par défaut à 27 MHz est un bon compromis de stabilité. Vous pouvez monter (40 MHz) sur un câblage court et propre ; en cas d'artefacts, redescendez.

### Mode de buffer selon la carte

Un framebuffer complet coûte `largeur × hauteur × 2` octets (134 KB pour 240×280, 307 KB pour 320×480). Sur les cartes sans PSRAM (ESP32-C3, ESP32 classique, RP2040, STM32 courants), utilisez `BufferMode::Partial` : seules des bandes de quelques lignes sont allouées.

| Carte | Profil conseillé | Mode conseillé |
|-------|------------------|----------------|
| ESP32-C3, CH32V, AVR | `Tiny` | `Partial` (AVR : 4 à 8 lignes) |
| ESP32, S2, C5, C6, H4, RP2040, STM32 | `LowRam` | `Partial`, `Full` si le framebuffer tient dans le budget |
| ESP32-S3 + PSRAM, STM32H7, CH32H | `Psram` | `Full` |
| ESP32-P4 MIPI | `MipiHighRes` | `Full`, bandes de 50 lignes |

```cpp
HalProfile hal;
hal.uiProfile = UiProfile::Tiny;

BufferOptions buffer;
buffer.mode = BufferMode::Partial;
buffer.partialLineCount = 16;
buffer.hal = hal;

display.begin(pins, options, buffer);
ui.setHalProfile(hal);
```

Si `BufferMode::Full` est demandé mais que l'allocation échoue (ou dépasse `buffer.maxBytes`), le driver passe seul en `Partial`. Lucarne Studio affiche le mode résolu et l'empreinte mémoire dans la section **Rendering / HAL** et dans la barre mémoire, en rouge quand le framebuffer dépasse le budget du profil. Exemple complet : `examples/LucarnePartialC3`.

### Flush DMA

Sur ESP32 et RP2040, le flush passe automatiquement en DMA asynchrone sur le bus `SPI` par défaut. Sur ESP32, le bus est piloté par `spi_master` (SPI2, SPI3 sur ESP32 classique) ; si la carte SD partage ce bus, chaque accès SD attend la fin du transfert. Définissez `LUCARNE_DISABLE_ASYNC_FLUSH` pour revenir au flush bloquant.

Backends hors Arduino (définir la macro avant toute inclusion, par exemple dans les options de compilation) :

- `LUCARNE_HAL_BACKEND_STM32CUBE` : appelez `halStm32SetSpi(&hspi1)` avec un handle dont la DMA TX est liée (`__HAL_LINKDMA`) et dont l'IRQ DMA est active. DMA2D est utilisé pour les remplissages et copies quand le périphérique existe. Sur STM32H7, les buffers en DTCM restent en flush synchrone. `LUCARNE_STM32_HAL_HEADER` force le header HAL à inclure.
- `LUCARNE_HAL_BACKEND_WCH` : CH32V en DMA SPI sur `SPI1` par défaut, `halWchSetSpi(SPI2)` pour le second bus.
- STM32 et CH32H avec LTDC : `halSetLtdcFramebuffer(fb, largeur, hauteur)` copie chaque région dans le framebuffer LTDC au lieu du bus SPI.

---

## OLED mono (SSD1306, SH1106)

Écrans 1 bit 128×64 ou 128×32, en I2C (adresse `0x3C` ou `0x3D`) ou en SPI. Les couleurs RGB565 sont seuillées par luminance : un pixel est allumé si sa couleur est claire. Le mode est toujours `BufferMode::None` (page buffer interne de `largeur × hauteur / 8` octets) et seules les pages modifiées sont envoyées.

```cpp
SSD1306 display;   // ou SH1106 (décalage de colonne 2 géré)

I2cDisplayPins pins;
pins.sda  = -1;    // -1 = broches I2C par défaut de la carte
pins.scl  = -1;
pins.rst  = -1;
pins.addr = 0x3C;

OledOptions options;
options.panelWidth   = 128;
options.panelHeight  = 64;
options.flipVertical = false;

display.begin(pins, options);
```

En SPI : `display.begin(displayPins, displayOptions, &SPI)` (horloge limitée à 10 MHz, 8 MHz par défaut). `setRotation(0..3)`, `setContrast(0..255)`, `invertDisplay(bool)` et `displayOn(bool)` sont disponibles. Utilisez un thème noir et blanc (`background = 0x0000`, `text = 0xFFFF`). Exemple : `examples/LucarneOled`.

---

## Écran à caractères HD44780

LCD 16×2, 20×4 (jusqu'à 40×4) en bus parallèle 4 bits. Le driver expose une surface logique de `cols × charWidth` par `rows × charHeight` pixels : les widgets se placent en pixels comme dans Lucarne Studio, puis leur texte est aligné sur la grille de caractères. Seules les cellules modifiées sont réécrites.

| Signal | `MatrixDisplayPins` |
|--------|---------------------|
| RS | `pins.rs` |
| E | `pins.en` |
| D4 à D7 | `pins.d4` à `pins.d7` |
| RW | `pins.rw` (`-1` si relié à la masse) |
| Rétroéclairage | `pins.bl` (`-1` si câblé en dur) |

```cpp
HD44780 display;

MatrixDisplayPins pins;
pins.rs = 12; pins.en = 11;
pins.d4 = 5;  pins.d5 = 4; pins.d6 = 3; pins.d7 = 2;

MatrixDisplayOptions options;
options.cols = 16;
options.rows = 2;

display.begin(pins, options);
```

- Les `Bar` utilisent 5 niveaux de remplissage par cellule (caractères CGRAM 1 à 4).
- Jeu de caractères : ASCII, `°`, `µ`, flèches ; les lettres accentuées sont ramenées à la lettre de base, le reste devient `?`.
- Le texte inversé (élément sélectionné) est précédé d'une flèche.
- Transitions : toujours `None`.
- Exemple : `examples/LucarneHD44780`.

---

## Boutons

Quatre boutons poussoirs vers la masse, avec pull-ups internes (configuration par défaut, `activeLow = true`).

```
GPIO ──[ bouton ]── GND      (répété pour haut, bas, OK, retour)
```

```cpp
ButtonInput buttons;

void setup() {
    // ...
    // up, down, ok, back ; activeLow=true => INPUT_PULLUP
    buttons.begin(25, 26, 27, 14, true);
    buttons.attach(&ui);
    buttons.setRepeat(420, 120);   // (optionnel) délai puis cadence de répétition, en ms
    buttons.setDebounce(25);       // (optionnel) fenêtre anti-rebond en ms, défaut 25 ms
}

void loop() {
    buttons.update();
    ui.update();
}
```

- `up` → `prev`, `down` → `next`, `ok` → `select`, `back` → `back`.
- Les boutons haut/bas se répètent quand on les maintient.
- Une broche à `-1` désactive ce bouton.
- `setDebounce(ms)` ignore les changements d'état trop rapprochés (rebond mécanique d'un poussoir) ; la fenêtre par défaut est de 25 ms, à augmenter si un bouton déclenche plusieurs événements de navigation par appui.

---

## Encodeur rotatif

Encodeur à quadrature (A/B) avec bouton-poussoir intégré.

```
A   ── GPIO
B   ── GPIO
SW  ── GPIO ── (vers GND, pull-up interne)
+   ── 3V3
GND ── GND
```

```cpp
EncoderInput encoder;

void setup() {
    encoder.begin(25, 26, 27);     // A, B, bouton ; activeLow par défaut
    encoder.attach(&ui);
    encoder.setStepsPerDetent(4);  // crans par détente (souvent 4 ; ajuster si besoin)
}

void loop() {
    encoder.update();
    ui.update();
}
```

- Rotation horaire → `next`, antihoraire → `prev`.
- Appui court → `select`. Appui long (≥ 500 ms) → `back`.
- Si la rotation va à l'envers, inversez les broches A et B (ou ajustez le câblage).

---

## Tactile

`TouchInput` reste un adaptateur générique : vous lui fournissez des coordonnées (`feed(x, y, pressed)`) depuis n'importe quel pilote, ce qui fonctionne avec tout contrôleur capable de renvoyer un point.

```cpp
TouchInput touch;

void setup() {
    touch.attach(&ui);
}

void loop() {
    // exemple : votre pilote renvoie un point quand l'écran est touché
    int16_t x, y;
    bool pressed = readTouch(&x, &y);
    touch.feed(x, y, pressed);
    ui.update();
}
```

- Au front d'appui, `feed()` cherche l'entrée de menu ou le widget navigable sous le point, le sélectionne et déclenche `select()` (`UI::activateAt`).
- Les coordonnées doivent être dans le repère de l'écran (mêmes axes que l'affichage, après rotation).

### Contrôleurs tactiles implémentés : GT911, GT9271, GT928, FT6336

Sur le chemin **MIPI-DSI / ESP32-P4** (voir la section suivante), Lucarne fournit un pilote concret pour quatre puces tactiles I2C, toutes utilisables sur le même bus I2C que le panneau :

| Puce | Classe | Fichier | Protocole |
| --- | --- | --- | --- |
| GT911 | `GT911Touch` | `src/input/LucarneTouchGT911.h` | Goodix (registre produit `0x8140`, statut/coordonnées `0x814E`/`0x814F`) |
| GT9271 | `GT9271Touch` | `src/input/LucarneTouchGoodix.h` | Identique au GT911 (même famille Goodix) |
| GT928 | `GT928Touch` | `src/input/LucarneTouchGoodix.h` | Identique au GT911 (même famille Goodix) |
| FT6336 (et FT6206/FT6236) | `FT6336Touch` | `src/input/LucarneTouchFT6336.h` | FocalTech FT6x06 (registres `0x00`-`0x08`) |

```cpp
#include <Lucarne.h>

GT911Touch touch;               // ou GT9271Touch / GT928Touch / FT6336Touch
TouchConfig cfg;
cfg.bus = TouchBus::I2c;
cfg.i2cAddr = 0x5D;     // 0x14 (Goodix backup) ou 0x38 (FT6336) selon le module
cfg.intPin = -1;
cfg.rstPin = -1;

touch.begin(cfg, panelWidth, panelHeight, /*i2cSda*/ 7, /*i2cScl*/ 8);

int16_t x, y;
bool pressed;
if (touch.poll(x, y, pressed)) {
    touchInput.feed(x, y, pressed);
}
```

`TouchConfig::swapXY` / `invertX` / `invertY` corrigent l'orientation du point tactile par rapport au panneau si nécessaire.

GT9271 et GT928 partagent exactement le même protocole registre que GT911 (confirmé sur les deux datasheets : même adresses I2C par défaut `0x5D`/`0x14`, mêmes registres `0x8140`/`0x814E`/`0x814F`) — `GT9271Touch`/`GT928Touch` ne diffèrent de `GT911Touch` que par la vérification souple de l'ID produit (le texte ASCII du registre `0x8140` change selon la puce). FT6336 utilise un protocole différent (registres 8 bits, adresse par défaut `0x38`), implémenté dans `FT6336Touch`.

D'autres IC tactiles I2C (GT967, GT9147, FT5x06, CST816, …) n'ont pas encore de classe dédiée. Si vous en avez besoin, écrivez votre propre lecture du contrôleur et appelez `TouchInput::feed()` vous-même, comme dans l'exemple générique ci-dessus.

---

## MIPI DSI / ESP32-P4

`MipiDisplay` (`src/display/LucarneMipiDsi.h`) pilote un panneau **MIPI-DSI** sur ESP32-P4, avec un framebuffer RGB565 en PSRAM et un flush via l'API `esp_lcd` d'Espressif.

```cpp
struct MipiDisplayConfig {
    int16_t panelWidth = 720;
    int16_t panelHeight = 1280;
    uint8_t laneCount = 2;
    uint16_t laneMbps = 700;
    uint16_t hsync = 20;
    uint16_t hbp = 20;
    uint16_t hfp = 40;
    uint16_t vsync = 4;
    uint16_t vbp = 10;
    uint16_t vfp = 24;
    uint8_t dpiClockMhz = 58;
    MipiPanelDriver driver = MipiPanelDriver::Ws5DsiTouchA_Hx8394;
    int8_t i2cSda = 7;
    int8_t i2cScl = 8;
    uint8_t blI2cAddr = 0x45;
    bool debug = false;
};
```

```cpp
MipiDisplay display;
MipiDisplayConfig cfg;   // valeurs par défaut = Waveshare 5-DSI-TOUCH-A (720×1280)

HalProfile hal;
hal.uiProfile = UiProfile::MipiHighRes;
hal.preferHwRotate = true;   // rotation 90° par blocs via le PPA

BufferOptions buffer;
buffer.mode = BufferMode::Full;
buffer.memory = BufferMemory::Psram;
buffer.hal = hal;
display.begin(cfg, buffer, /*rotation*/ 0);
ui.setHalProfile(hal);
```

- Le flush est découpé par région invalidée et passe par `esp_lcd_panel_draw_bitmap` avec `use_dma2d`. Avec une rotation 1 ou 3, chaque bloc est tourné par le PPA (`preferHwRotate`), sinon par le CPU.

- `i2cSda`/`i2cScl` définissent le bus I2C **partagé** entre le rétroéclairage (contrôlé via `blI2cAddr`, mettre `0` si le panneau n'a pas de contrôleur de rétroéclairage I2C) et le contrôleur tactile du panneau — un seul bus I2C suffit pour les deux.
- `driver` sélectionne l'IC du panneau MIPI. Quatre valeurs sont implémentées :

  | `MipiPanelDriver` | Panneau IC | Résolution courante | Source de l'init |
  | --- | --- | --- | --- |
  | `Ws5DsiTouchA_Hx8394` (défaut) | HX8394 | 720×1280, Waveshare 5-DSI-TOUCH-A | table constructeur Waveshare |
  | `Ili9881c` | ILI9881C | 800×1280 (générique) | init/timing de référence Espressif (`esp_lcd_ili9881c`) |
  | `Jd9365` | JD9365 | 800×1280 (panneaux 10.1") | init de référence Espressif (`esp_lcd_jd9365`) |
  | `Ek79007` | EK79007 | 1024×600, ESP32-P4-Function-EV-Board | init de référence Espressif (`esp_lcd_ek79007`) |

  Chaque panneau a ses propres timings DPI/porches — ajustez `panelWidth`/`panelHeight`/`hsync`/`hbp`/`hfp`/`vsync`/`vbp`/`vfp`/`laneCount`/`laneMbps`/`dpiClockMhz` selon la datasheet de votre module ; les valeurs par défaut de `MipiDisplayConfig` ciblent le HX8394/Waveshare. Voir `examples/LucarneUIP4MultiPanel/LucarneUIP4MultiPanel.ino` pour un jeu de valeurs de départ pour chacun des quatre panneaux.
- Exemple complet : `examples/LucarneUIP4/LucarneUIP4.ino` (HX8394 + `GT911Touch` + `TouchInput`), et `examples/LucarneUIP4MultiPanel/LucarneUIP4MultiPanel.ino` (les 4 panneaux × les 4 contrôleurs tactiles, sélectionnables via `#define` en tête de fichier).

### Panneaux et tactiles non génériques

L'init "vendor" livrée pour ILI9881C/JD9365/EK79007 est l'init de référence publiée par Espressif pour ces contrôleurs (générique, testée par compilation croisée sur ESP32-P4) — elle fonctionne pour les panneaux de référence associés, mais un module tiers utilisant le même IC peut nécessiter son propre réglage de gamma/alimentation, et surtout ses propres timings DPI (`hsync`/`hbp`/`hfp`/`vsync`/`vbp`/`vfp`/`dpiClockMhz`/`laneMbps`) si sa résolution ou son horloge de rafraîchissement diffère du panneau de référence — les presets de Lucarne Studio pour les résolutions qui ne correspondent pas exactement à une config de référence Espressif (800×1280 pour ILI9881C/JD9365, 1024×600 pour EK79007) recalculent une horloge DPI approximative à partir des mêmes marges (porches) ; c'est un point de départ, pas une garantie. Si votre écran reste noir, scintille ou défile avec l'init par défaut, il faut fournir votre propre table de commandes et/ou vos propres timings (contactez le fabricant du panneau). D'autres IC de panneau MIPI (par ex. NT35510, R63419, …) et d'autres contrôleurs tactiles I2C (GT967, FT5x06, CST816, …) n'ont pas encore de pilote — voir [`DISPLAY_ROADMAP.md`](DISPLAY_ROADMAP.md) pour le suivi.

Lucarne Studio (l'éditeur web) n'a pas encore de sélecteur de carte ESP32-P4/MIPI-DSI : ce chemin matériel se code aujourd'hui directement en C++ contre la bibliothèque `Lucarne`, sans passer par l'éditeur.

---

## Clavier virtuel

Aucun matériel dédié n'est nécessaire pour la saisie de texte : le clavier est entièrement dessiné à l'écran par `UI` et piloté par les mêmes entrées que la navigation (boutons, encodeur, ou tactile via `UI::activateAt`). Voir [`RUNTIME.md`](RUNTIME.md#textfield) pour l'API complète (`TextField`, `UI::configureKeyboard`).

```cpp
VirtualKeyboardOptions kb;
kb.enabled = true;
kb.dock = 0; // 0 = bas, 1 = haut
kb.layout = KeyboardLayout::Compact;
ui.configureKeyboard(kb);
```

Sur un projet 4 boutons (sans tactile), ouvrir un `TextField` (OK) affiche l'overlay clavier ; haut/bas déplacent la sélection parmi les touches, OK tape la touche surlignée, la touche **OK** du clavier ou le bouton retour valide et referme. Aucune broche supplémentaire n'est nécessaire par rapport à la navigation standard.

---

## Carte SD (images)

Les widgets **Image** en storage SD lisent des fichiers **RGB565** sur carte FAT32.

Bus SPI partagé avec l'écran : **MOSI**, **MISO**, **SCLK** communs ; **CS** séparés. Configurez les broches dans Studio (**Hardware**). L'export génère `Projet_setup.h` (`initSpiBus()`, `displayPins()`, `mountSdCard()`). Définissez `pins.miso` dès qu'une SD est utilisée.

```cpp
#include "Projet_setup.h"

projet::initSpiBus();
display.begin(projet::displayPins(), projet::displayOptions(), buffer, &SPI);
projet::mountSdCard();
```

Copiez les fichiers **Files (SD)** sur la carte (chemins `/assets/…`). Voir [`SD.md`](SD.md).

---

## Avec une UI générée

Si vous utilisez `Projet.h` exporté depuis l'éditeur, l'adaptateur d'entrée est déjà câblé selon la configuration choisie :

```cpp
projet::attachInput(ui);  // dans setup()
projet::update();         // dans loop() — boutons / encodeur
```

En tactile, appelez `projet::input.feed(x, y, pressed)` depuis votre pilote.
