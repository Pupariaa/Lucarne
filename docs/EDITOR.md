# Lucarne Studio — guide de l'éditeur

Lucarne Studio est une application web statique : concevoir l'UI, simuler la navigation, exporter du C++ (`Projet.h`, binaires assets).

Ouvrez `web/editor/` (ou `editor/` en local) → choisissez la version alignée sur votre lib firmware (ex. **0.2.0**).

## Barre d'outils

| Élément | Rôle |
|---------|------|
| Nom du projet | Fichier export / JSON |
| Device | Modèle d'écran (ST7789, ST7735S) et résolution |
| Rotation | 0 / 90 / 180 / 270 |
| Blueprint / Simulate | Graphe de navigation vs test interactif |
| Export .h | Headers + fichiers binaires |
| Save / Load / New | Projet `.lucarne.json` (le navigateur garde aussi un auto-save) |

## Vues

### Blueprint

Écrans = nœuds. Liens depuis les entrées de menu. Double-clic = Designer. Badge **START** = écran de démarrage.

### Designer

Palette widgets, canvas, calques. **Realistic 1:1** = taille physique réelle. **Pixel grid** = grille 1 px.

### Inspecteur (onglets droits)

| Onglet | Contenu |
|--------|---------|
| Inspector | Widget, nœud, lien, ou projet |
| Theme | Couleurs, radius, polices body/title |
| Fonts | Polices Google / TTF → `Projet_fonts.h` |
| Hardware | SPI, écran, SD, **partition interne**, entrées, Live Preview |
| Assets | Images, icônes, **Icon export** (flash / SD / volume) |
| Data | Clés `ui.setFloat` / `setInt` / … |

## Assets — images, icônes animées, opaque bake

Guide détaillé : **[`ASSETS.md`](ASSETS.md)**.

### Images

- Import PNG (alpha) ou BMP 24/32 bits.
- **Storage** par image : Flash, SD, Internal partition, Web.
- Seules les images **placées sur un écran** sont exportées, à la résolution max utilisée.

### Icônes

- Packs : Tabler, Streamline/Glyphs, **Fluent Emoji** (statique ou APNG).
- **Icon export** (Assets) : destination globale flash / SD / volume pour toutes les icônes du projet.
- Widget **Icon** : échelle = résolution d'export des emojis animés.

### Opaque bake (pré-traitement)

Sur un widget **Icon** emoji (inspecteur) : option **Opaque bake**.

- Fusionne la transparence de chaque frame sur le fond **statique** sous l'icône.
- Export : RGB565 opaque, pas de `.alpha` → moins de fichiers, draw plus rapide.
- Nécessite une image de fond fixe ; pas deux emojis animés qui se chevauchent sur le même écran.

## Hardware

- **SPI** — MOSI, MISO, SCLK (partagé écran + SD).
- **Display** — CS, DC, RST, BL, SPI Hz/mode, invert, RGB/BGR.
- **SD card** — activer seulement si vous utilisez des assets SD ; CS, dossier `/assets`.
- **Internal partition** — activer pour assets volume ; filesystem **FAT (FFat)**, label **`ffat`** si schéma Arduino `16M Flash (3MB APP/9.9MB FATFS)`.
- **Navigation** — boutons, encodeur, ou tactile (`projet::input.feed`).
- **UI source** — embedded, URL JSON, ou SD (Live Preview).

## Export

Modale **Export .h** :

| Onglet | Contenu |
|--------|---------|
| **Headers** | `Projet.h`, `Projet_setup.h`, `LucarneUserConfig.h`, `Projet_fonts.h`, `Projet_images.h`, `Projet_icons.h` |
| **Files** | `assets/**/*.rgb565`, `.alpha`, `SD_MANIFEST.txt`, `VOLUME_MANIFEST.txt` |

Téléchargement : copier un header, **Download all** zip pour les binaires.

### Intégration sketch

```cpp
#include <Lucarne.h>
#include "Projet.h"
#include "Projet_setup.h"

using namespace lucarne;

ST7789 display;
UI ui(display);

void setup() {
    Serial.begin(115200);
    BufferOptions buffer;
    buffer.mode = BufferMode::Full;

    projet::initSpiBus();
    projet::initStorage();
    display.begin(projet::displayPins(), projet::displayOptions(), buffer, &SPI);

    projet::build(ui);
    projet::attachInput(ui);
    ui.begin();
}

void loop() {
    projet::update();
    ui.update();
}
```

### Partition interne (FFat)

1. Export **Files** → dézipper `assets/` dans `sketch/data/`.
2. Arduino **Partition Scheme** → entrée avec **FATFS** dans le nom.
3. Plugin [arduino-ffat-upload](https://github.com/r-iki/arduino-ffat-upload).
4. Ordre : **Upload sketch** → **Upload FFAT** (pas d'erase all flash sans refaire FFAT).

Détails : [`VOLUME.md`](VOLUME.md).

### Carte SD

Copier `assets/` à la racine FAT32. Détails : [`SD.md`](SD.md).

## Simulate

Pad ou flèches clavier. Teste navigation et transitions comme sur l'appareil.

Après chaque modification Studio : régénérer les headers ; le `.ino` reste stable si vous n'y touchez pas.
