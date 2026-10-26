# Lucarne Studio — guide de l'éditeur

Historique de l'évolution de l'interface : **[`EDITOR_HISTORY.md`](EDITOR_HISTORY.md)**.

Lucarne Studio est une application web statique : concevoir l'UI, simuler la navigation et l'interaction, et exporter un sketch Arduino prêt à compiler (`.ino`, headers C++, binaires d'assets).

Ouvrez `web/editor/` (ou `editor/` en local) → choisissez la version alignée sur votre lib firmware (ex. **0.3.0**).

## Barre d'outils

| Élément | Rôle |
|---------|------|
| **Undo / Redo** | Barre d'historique horizontale ; aussi `Ctrl+Z` / `Ctrl+Shift+Z` / `Ctrl+Y` |
| Nom du projet | Nom utilisé pour l'export et la sauvegarde |
| Device / taille | Modèle d'écran (ST7789, ST7735S, ST7796, ILI9342C, MIPI-DSI…) et résolution |
| Rotation | 0 / 90 / 180 / 270 |
| **Blueprint / Designer / Simulate** | Les trois modes (voir ci-dessous) |
| Vitesse Live | Débit série utilisé par le bouton **Live** |
| **Live** | Connexion USB série vers une carte déjà flashée (voir [`LIVE_PREVIEW.md`](LIVE_PREVIEW.md)) |
| **Flash receiver** | Ouvre l'assistant qui flashe le firmware de réception Live sur une carte vierge |
| **Export** | Génère le sketch `.ino`, les headers C++, et les fichiers SD/Volume |
| ⚙ **Project settings** | Ouvre la fenêtre de réglages (Theme / Fonts / Hardware / Assets / Data) |
| **File** (menu déroulant) | Projects / Save / Load / New project / **Welcome** / **Take the tour** / **Keyboard shortcuts** |
| **?** (aide) | Panneau des raccourcis clavier (aussi `?` ou `Shift+/` hors champ texte) |

## Welcome, tour et raccourcis

Au **premier lancement** (aucun projet autosauvegardé ni entrée dans le gestionnaire Projects), une fenêtre **Welcome** propose : nouvel assistant de projet, démo, projet vierge, ouverture d'un fichier `.lucarne.json`, projets récents enregistrés dans le navigateur, case **Show on startup**, et liens vers la visite guidée et la documentation.

- **File → Welcome** rouvre cet écran ; **File → Take the tour** lance la visite en 10 étapes (modes, Blueprint, inspecteur, Designer, Simulate, barre mémoire, réglages, Live, Export, historique).
- **File → Keyboard shortcuts** ou le bouton **?** de la barre (ou la touche **`?`**) affiche la liste des raccourcis.
- **`1` / `2` / `3`** basculent entre Blueprint, Designer et Simulate (hors champ texte).
- En largeur **≤ 1024 px**, l'**inspecteur** (#dock) devient un **tiroir** latéral : bouton panneau en bas à droite du stage, fermeture par Escape ou clic sur le canvas ; il s'ouvre aussi lors d'une sélection pour éditer sans perdre la place du graphe ou du simulateur.

## Les trois modes

### Blueprint

Vue graphe : les écrans sont des nœuds, les liens proviennent des entrées de menu et des cibles de navigation des boutons/formes. Double-clic sur un nœud ou bouton **Edit screen** dans l'inspecteur → Designer sur cet écran. Raccourcis : `+` / `-` zoom, `F` ajuster la vue, `Ctrl+C` / `Ctrl+V` copier-coller un écran. Badge **START** = écran de démarrage.

### Designer

Compose la mise en page d'un écran :

- **Palette** (gauche) — widgets disponibles, avec un champ de recherche ; redimensionnable et réductible.
- **Canvas** — zoom, ajustement à la fenêtre, grille, accroche (snap), et un mode **« Realistic 1:1 »** qui affiche l'écran à sa taille physique réelle (le navigateur ne pouvant pas lire le DPI réel du moniteur, un petit outil de **calibration d'écran** permet de le renseigner une fois).
- **Layers** (droite) — pile des widgets de l'écran, réordonnable par glisser-déposer pour changer le z-order (empilement) ; redimensionnable et réductible.
- **Inspecteur** — propriétés du widget, du nœud, du lien, ou du projet sélectionné.
- **Historique** — barre Undo/Redo commune à tout l'éditeur (widgets, écrans, liens).

### Simulate

Interagit avec l'UI comme sur l'appareil : modèles d'entrée D-pad, tactile, ou encodeur rotatif (le mode encodeur reproduit fidèlement `EncoderInput::update()` — rotation → suivant/précédent, appui court → sélection, appui long ≥ 500 ms → retour ; pas de gauche/droite ni de bouton retour dédié). Le clavier virtuel s'y simule aussi pour tester la saisie dans un `TextField`.

## Project settings (Theme / Fonts / Hardware / Assets / Data)

Les anciens onglets de dock au premier niveau sont remplacés par une seule fenêtre **Project settings** (bouton ⚙ dans la barre d'outils), avec une barre latérale d'icônes + description pour chaque section :

| Onglet | Contenu |
|--------|---------|
| **Theme** | Couleurs, rayon des coins, polices body/title |
| **Fonts** | Polices Google / TTF → `Projet_fonts.h` |
| **Hardware** | SPI/I2C, écran, MIPI-DSI, SD, partition interne, entrées (boutons/encodeur/tactile/clavier), Live Preview |
| **Assets** | Images, icônes, export d'icônes (flash / SD / volume / PSRAM) |
| **Data** | Clés `Store` (`setFloat`/`setInt`/…) et **clés calculées** |

### Hardware

- **SPI / I2C** — MOSI, MISO, SCLK (partagés écran + SD), et un bus I2C partagé dès que le tactile I2C ou un panneau MIPI est activé.
- **Display** — CS, DC, RST, BL, SPI Hz/mode, invert, RGB/BGR ; pour un projet MIPI-DSI (ESP32-P4), les champs deviennent ceux de `MipiDisplayConfig` (résolution panneau, lanes, timings DSI).
- **Touch** — aujourd'hui, Studio ne propose que ce que le firmware sait réellement piloter : **GT911** en I2C sur le bus partagé du panneau MIPI (ESP32-P4). Les autres contrôleurs tactiles ne sont plus proposés dans le sélecteur (voir [`HARDWARE.md`](HARDWARE.md)).
- **SD card** — activer seulement si vous utilisez des assets SD ; CS, dossier `/assets`.
- **Internal partition** — activer pour assets volume ; filesystem **FAT (FFat)**, label **`ffat`** si schéma Arduino `16M Flash (3MB APP/9.9MB FATFS)`.
- **Navigation** — boutons, encodeur, ou tactile (`projet::input.feed`) ; débounce des boutons configurable (`ButtonInput::setDebounce`).
- **Clavier virtuel** — activation, disposition (QWERTY/AZERTY plein/compact/minimal, Numeric, Hex), ancrage haut/bas.
- **UI source** — embarquée, URL JSON, ou SD (Live Preview).

Le **Design Rule Check** (DRC), accessible depuis Hardware, valide la carte choisie, l'assignation des GPIO, les broches SPI/I2C, les écrans, les cibles de navigation, les clés calculées, et les choix de stockage des assets (par ex. un asset en stockage PSRAM sur une carte sans PSRAM, ou un stockage SD/Volume alors que le périphérique correspondant est désactivé dans Hardware) — les erreurs/avertissements sont regroupés par catégorie avant export. Le DRC bloque aussi (erreur) les familles d'écran OLED/matriciel et le stockage d'image **Web**, aujourd'hui non supportés par le firmware.

### Assets

Guide détaillé : **[`ASSETS.md`](ASSETS.md)**.

- Import PNG (alpha) ou BMP 24/32 bits.
- **Storage** par image : Flash, Flash (RLE), SD card, Internal partition, PSRAM. (Le stockage **Web** a été retiré du sélecteur : aucun chargeur HTTP n'existe dans le firmware.)
- Seules les images **placées sur un écran** sont exportées, à la résolution max utilisée. Une image surdimensionnée peut être exportée en mode **Native** (rognée à la zone visible plutôt que redimensionnée).
- Icônes : packs Tabler, Streamline/Glyphs, Fluent Emoji (statique ou APNG) ; **Icon export** définit la destination globale (flash / SD / volume / PSRAM) pour toutes les icônes du projet ; **Opaque bake** pré-compose une icône animée sur son fond statique pour un rendu opaque plus rapide.

### Data — clés et clés calculées

- Déclarez les clés `Store` utilisées par les widgets (type, valeur initiale).
- **Clés calculées** : formule dérivée d'autres clés (`Watts = Voltage * Current`, grammaire `+ - * / ( )`), avec validation du graphe de dépendances (références inconnues, cycles) directement dans l'onglet. Aperçu recalculé en direct dans **Simulate**. À l'export, une fonction `projet::recomputeCalcs(UI &ui)` est générée ; voir [`RUNTIME.md`](RUNTIME.md#touches-calculées-calc-keys) pour l'intégration côté sketch.

## New Project — assistant de création

**File → New project** ouvre un assistant multi-étapes qui guide la création d'un projet entièrement configuré :

1. Nom du projet et gabarit de départ (vierge ou template).
2. Écran (panneau + rotation).
3. Carte / MCU cible.
4. Méthode d'entrée (boutons, encodeur rotatif, tactile) et options associées (actif-bas, clavier virtuel, carte SD).
5. Récapitulatif avec GPIO auto-assignés avant création.

## Assistant GPIO

Depuis Hardware, l'assistant GPIO permet de choisir un MCU/devkit (ESP32, ESP32-S2/S3, ESP32-C3/C6, RP2040/RP2350, quelques cartes Arduino ESP32-S3/RP2040) et assigne automatiquement des broches optimales et sans conflit pour tous les périphériques configurés du projet (écran SPI/I2C, tactile, SD, boutons), en évitant les broches réservées (strapping, flash, PSRAM, USB) de la carte choisie.

## File — gestion de projet

- **Projects** — liste des projets enregistrés dans le navigateur (`localStorage`) : renommer, supprimer, changer de projet.
- **Save** — télécharge le projet en `.lucarne.json` (un auto-save local existe aussi).
- **Load** — recharge un `.lucarne.json`.
- **New project** — ouvre l'assistant de création décrit ci-dessus.

## Barre de mémoire

En bas de la fenêtre, une estimation en direct de l'usage flash / stockage interne / PSRAM par rapport aux limites réelles de la carte sélectionnée, avec avertissements en cas de dépassement (et désactivation de la carte dans le sélecteur si le projet ne peut objectivement pas y tenir).

## Export

Le bouton **Export** génère :

| Onglet | Contenu |
|--------|---------|
| **Headers** | Un `.ino` prêt à compiler (généré par `buildInoSketch()` : initialisation des bus, `display.begin()` avec les broches/options exportées, `projet::build`/`attachInput`, `ui.configureKeyboard`, `BufferMemory` PSRAM si la carte en a, emplacements commentés pour code capteur/callback/clé calculée), plus `Projet.h`, `Projet_setup.h`, `LucarneUserConfig.h`, `Projet_fonts.h`, `Projet_images.h`, `Projet_icons.h` |
| **Files** | `assets/**/*.rgb565`, `.alpha`, `SD_MANIFEST.txt`, `VOLUME_MANIFEST.txt` (selon le stockage des assets) |

Un résumé « quoi faire ensuite » s'affiche au-dessus de la liste de fichiers (renommer le `.ino` et son dossier, où placer le dossier `assets/` selon les manifestes). Téléchargement : copier un header, **Download all** en zip pour les binaires.

Grâce au `.ino` généré, un nouveau projet exporté n'a **aucun code à écrire à la main** pour tourner : `setup()`/`loop()` sont déjà complets pour les familles `spi_rgb` et `mipi_dsi`.

### Intégration sketch (référence, déjà dans le `.ino` exporté)

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
    projet::recomputeCalcs(ui);
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

## Live Preview et Flash receiver

Guide détaillé : **[`LIVE_PREVIEW.md`](LIVE_PREVIEW.md)**.

- **Live** — connecte l'éditeur en USB série à une carte **déjà flashée** avec un firmware de réception Live, pour prévisualiser en direct sur écran physique ce qui est conçu dans Designer/Simulate.
- **Flash receiver** — assistant séparé (WebSerial + `esptool-js`) qui flashe directement, depuis le navigateur, un firmware de réception précompilé sur une carte **ESP32-S3 vierge** (deux préréglages : ST7789 240×280, ST7796 320×480 avec PSRAM OPI) — utile pour obtenir une carte prête pour **Live** sans passer par l'IDE Arduino.

Après chaque modification Studio en mode Live, les changements s'affichent immédiatement sur la carte (widgets, thème, données, navigation dans Simulate).
