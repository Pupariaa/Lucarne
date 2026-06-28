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
- **Ordre des couleurs** : si rouge et bleu sont permutés, basculez `ColorOrder`.
- **Offsets** : appliqués automatiquement selon la taille (voir le README). Pour un module exotique, surchargez `colStart`, `rowStart`, `colStart2`, `rowStart2`. Exemple : l'écran 240×280 utilise un `rowStart` de 20 (sinon une bande de bruit apparaît en bas).
- **Débogage** : `options.debug = true` active des messages de diagnostic sur le port série.

### Vitesse SPI

`spiHz` par défaut à 27 MHz est un bon compromis de stabilité. Vous pouvez monter (40 MHz) sur un câblage court et propre ; en cas d'artefacts, redescendez.

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
    buttons.setRepeat(420, 120); // (optionnel) délai puis cadence de répétition, en ms
}

void loop() {
    buttons.update();
    ui.update();
}
```

- `up` → `prev`, `down` → `next`, `ok` → `select`, `back` → `back`.
- Les boutons haut/bas se répètent quand on les maintient.
- Une broche à `-1` désactive ce bouton.

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

Lucarne ne pilote pas de contrôleur tactile spécifique : vous lui fournissez les coordonnées depuis votre propre pilote.

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

- Au front d'appui, `feed()` cherche l'entrée de menu sous le point, la sélectionne et déclenche `select()`.
- Les coordonnées doivent être dans le repère de l'écran (mêmes axes que l'affichage, après rotation).

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
