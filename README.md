# Lucarne

**SDK complet pour concevoir et piloter des interfaces sur petits écrans SPI (ST7789, ST7735S) avec Arduino / ESP32, sans dépendance Adafruit.**

Lucarne couvre toute la chaîne, de la conception visuelle au rendu sur l'écran :

1. **Moteur graphique embarqué** — pilotes SPI maison, framebuffer configurable, primitives de dessin, polices.
2. **Runtime UI** — widgets, écrans, navigation par menus, transitions animées, liaison de données, polices anti-aliasées.
3. **Lucarne Studio** — un éditeur web (blueprint à nœuds) pour dessiner ses écrans, les relier, simuler la navigation, puis **exporter un header C++** prêt à déposer dans le projet.

---

## Sommaire

- [Fonctionnalités](#fonctionnalités)
- [Installation](#installation)
- [Démarrage rapide : afficher du texte](#démarrage-rapide--afficher-du-texte)
- [Construire une interface en code](#construire-une-interface-en-code)
- [Données dynamiques (liaison de valeurs)](#données-dynamiques-liaison-de-valeurs)
- [Menus, navigation et transitions](#menus-navigation-et-transitions)
- [Contrôles physiques](#contrôles-physiques)
- [Lucarne Studio (éditeur web)](#lucarne-studio-éditeur-web)
- [Intégrer une UI générée](#intégrer-une-ui-générée)
- [Polices anti-aliasées](#polices-anti-aliasées)
- [Écrans supportés](#écrans-supportés)
- [Gestion mémoire et buffering](#gestion-mémoire-et-buffering)
- [Exemples fournis](#exemples-fournis)
- [Structure du dépôt](#structure-du-dépôt)
- [Documentation détaillée](#documentation-détaillée)
- [Crédits et licence](#crédits-et-licence)

---

## Fonctionnalités

- Pilotes ST7789 et ST7735S autonomes (séquence d'init, rotation, offsets, ordre des couleurs, inversion, mode SPI).
- Framebuffer RGB565 optionnel avec rafraîchissement par zone modifiée (dirty-rect), allocation PSRAM / RAM interne / plafond mémoire, transferts compatibles DMA.
- Primitives complètes : pixels, lignes, rectangles (arrondis), cercles, triangles, bitmaps.
- Runtime UI : `Theme`, `Store` (liaison de données par clés nommées), widgets `Label`, `Metric`, `Bar`, `Icon`, `Menu`.
- Navigation par pile d'écrans avec transitions animées (slide, fade, push, cover).
- Polices anti-aliasées (niveaux de gris 8 bpp) pour un texte net malgré la basse résolution.
- Entrées physiques prêtes à l'emploi : boutons, encodeur rotatif, tactile.
- Éditeur web sans installation : conception visuelle, simulateur pixel-exact, export `.h`.

---

## Installation

La bibliothèque est compatible **Arduino IDE** et **PlatformIO**.

- **Arduino IDE** : copier le dépôt dans `Documents/Arduino/libraries/Lucarne`, puis `#include <Lucarne.h>`.
- **PlatformIO** : placer le dépôt dans `lib/Lucarne/` du projet (ou l'ajouter en dépendance via `lib_deps`).

L'en-tête unique `Lucarne.h` donne accès à tout le SDK. Tout vit dans l'espace de noms `lucarne`.

---

## Démarrage rapide : afficher du texte

```cpp
#include <Lucarne.h>

using namespace lucarne;

ST7789 display;

void setup() {
    DisplayPins pins;
    pins.cs = 1;
    pins.dc = 2;
    pins.rst = 3;
    pins.mosi = 4;
    pins.sclk = 5;
    pins.bl = -1; // rétroéclairage câblé en dur, sinon mettre la broche

    DisplayOptions options;
    options.panelWidth = 240;
    options.panelHeight = 280;
    options.rotation = 0;
    options.spiHz = 27000000;
    options.spiMode = 3;     // beaucoup de modules ST7789 exigent le mode 3
    options.colorOrder = ColorOrder::RGB;
    options.invert = true;   // souvent nécessaire sur ST7789

    BufferOptions buffer;
    buffer.mode = BufferMode::Full;
    buffer.memory = BufferMemory::Auto;

    display.begin(pins, options, buffer);

    display.fillScreen(color565(0, 0, 0));
    display.setTextColor(color565(255, 255, 255));
    display.setTextSize(2);
    display.setCursor(20, 20);
    display.print("Hello Lucarne");
    display.display(); // pousse le framebuffer vers l'écran
}

void loop() {}
```

> En mode `BufferMode::Full`, les primitives dessinent en RAM ; `display()` n'envoie que la zone modifiée. En mode `BufferMode::None`, chaque primitive écrit directement sur l'écran et `display()` est sans effet.

---

## Construire une interface en code

Une interface Lucarne se compose de trois objets : un `Theme` (couleurs, polices), un ou plusieurs `Screen` qui contiennent des widgets, et un contrôleur `UI` qui orchestre le rendu et la navigation.

```cpp
#include <Lucarne.h>

using namespace lucarne;

ST7789 display;
UI ui(display);

Screen dashboard("Dashboard");

Label   title(0, 14, "Dashboard", TextAlign::Center);
Metric  temp(14, 56, 212, 34, "Temp", "temp", "C");
Metric  hum(14, 96, 212, 34, "Humidite", "hum", "%");
Label   loadLabel(16, 146, "CPU load");
Bar     loadBar(14, 166, 212, 20, "load", 0.0f, 1.0f);

void setup() {
    // ... display.begin(...) comme plus haut ...

    Theme theme;
    theme.font = &LucarneFontBody;       // police de corps anti-aliasée fournie
    theme.fontTitle = &LucarneFontTitle; // police de titre anti-aliasée fournie
    ui.setTheme(theme);

    title.setBounds(0, 14, 240, 28);
    title.setFont(&LucarneFontTitle);
    temp.setAccent(color565(246, 183, 55));
    loadBar.setShowValue(true);

    dashboard.add(&title);
    dashboard.add(&temp);
    dashboard.add(&hum);
    dashboard.add(&loadLabel);
    dashboard.add(&loadBar);

    ui.setFloat("temp", 23.4f);
    ui.setFloat("hum", 48.0f);
    ui.setFloat("load", 0.32f);

    ui.show(&dashboard);
    ui.begin();
}

void loop() {
    ui.setFloat("temp", readTemperature());
    ui.update(); // ne redessine que si une donnée ou l'écran a changé
}
```

Les widgets disponibles (`Label`, `Metric`, `Bar`, `Icon`, `Menu`) et leur API complète sont décrits dans [docs/RUNTIME.md](docs/RUNTIME.md).

---

## Données dynamiques (liaison de valeurs)

Les widgets ne stockent pas leurs valeurs : ils lisent une **clé nommée** dans le `Store` du contrôleur. On met à jour la donnée, l'UI se redessine.

```cpp
ui.setFloat("temp", 21.7f);
ui.setInt("rssi", -62);
ui.setBool("fan", true);
ui.setString("mode", "AUTO");
```

- `Metric("Temp", "temp", "C")` affiche la clé `temp` suivie de l'unité `C`.
- `Bar(..., "load", 0, 1)` affiche un ratio à partir de la clé `load`.
- Un `bool` s'affiche `ON` / `OFF`, une chaîne telle quelle.

Le `Store` accepte jusqu'à 32 clés. `ui.update()` ne déclenche un rendu que lorsqu'une clé liée a changé (suivi « dirty »).

---

## Menus, navigation et transitions

Un `Menu` contient des entrées ; chacune peut pointer vers un autre écran et choisir sa transition.

```cpp
Screen home("Home");
Screen settings("Settings");
Menu   menu(12, 24, 216, 230);

menu.addItem("Capteurs",   iconFromName("thermo"),   &dashboard, Transition::SlideLeft);
menu.addItem("Reglages",   iconFromName("settings"), &settings,  Transition::Fade);
menu.addItem("A propos",   iconFromName("home"));     // sans cible : action gerée par votre code

home.add(&menu);

ui.setTransition(Transition::SlideLeft, 220); // transition par défaut + durée (ms)
ui.show(&home);
```

Navigation au runtime :

- `ui.next()` / `ui.prev()` — déplacent la sélection dans le menu actif.
- `ui.select()` — entre dans l'écran cible de l'entrée sélectionnée (avec sa transition).
- `ui.back()` — revient à l'écran précédent (transition inversée automatiquement).

Transitions disponibles : `None`, `SlideLeft`, `SlideRight`, `SlideUp`, `SlideDown`, `Fade`, `Push`, `Cover`. Les transitions animées nécessitent le mode framebuffer (`BufferMode::Full`) ; sans mémoire suffisante, Lucarne bascule en changement instantané.

---

## Contrôles physiques

Lucarne câble directement des entrées physiques sur la navigation (`next` / `prev` / `select` / `back`). Trois adaptateurs sont fournis.

**Boutons** (4 broches, anti-rebond + répétition) :

```cpp
ButtonInput buttons;

void setup() {
    // ... ui ...
    // pins : haut, bas, OK, retour — actif à l'état bas avec pull-ups internes
    buttons.begin(25, 26, 27, 14, true);
    buttons.attach(&ui);
}

void loop() {
    buttons.update();
    ui.update();
}
```

**Encodeur rotatif** (rotation = next/prev, appui = select, appui long = back) :

```cpp
EncoderInput encoder;
encoder.begin(25, 26, 27); // A, B, bouton
encoder.attach(&ui);
// dans loop : encoder.update();
```

**Tactile** (votre pilote fournit les coordonnées) :

```cpp
TouchInput touch;
touch.attach(&ui);
// quand votre contrôleur tactile a un point :
touch.feed(x, y, pressed); // sélectionne l'entrée de menu touchée
```

Le câblage détaillé (broches, pull-ups, schémas) est dans [docs/HARDWARE.md](docs/HARDWARE.md).

---

## Lucarne Studio (éditeur web)

L'éditeur est une application web statique : ouvrez simplement `editor/index.html` dans un navigateur (aucune installation, aucun build).

Flux de travail :

1. **Blueprint** — chaque écran est un nœud avec une miniature en direct. Chaque entrée de menu expose une **broche de sortie** ; on tire un lien de cette broche vers un autre écran pour définir la navigation. Double-clic sur un nœud pour l'éditer.
2. **Designer** — placez et redimensionnez les widgets (Label, Metric, Bar, Icon, Menu), réglez leurs propriétés, le thème, les données. Aperçu pixel-exact, mode « Realistic 1:1 » (densité physique de l'écran) et grille de pixels.
3. **Fonts** — choisissez une police Google Fonts ou importez un TTF/OTF ; l'éditeur la rastérise en niveaux de gris. Assignez les polices de corps et de titre.
4. **Simulate** — testez la navigation (pad à l'écran ou flèches du clavier) avec les transitions réelles.
5. **Export .h** — génère `Projet.h` (et `Projet_fonts.h` si vous utilisez des polices personnalisées) ainsi que l'adaptateur d'entrées câblé selon votre configuration.

Le projet est sauvegardé automatiquement dans le navigateur, et exportable/importable en JSON (`Save` / `Load`).

Le guide complet de l'éditeur est dans [docs/EDITOR.md](docs/EDITOR.md).

---

## Intégrer une UI générée

L'export produit un ou deux fichiers à déposer **à côté de votre `.ino`** (ou dans le dossier du projet) :

- `Projet.h` — thème, écrans, widgets, liens de navigation et transitions, adaptateur d'entrées.
- `Projet_fonts.h` — uniquement si vous avez ajouté des polices personnalisées (référencé automatiquement par `Projet.h`).

Tout le contenu généré vit dans l'espace de noms `projet`, qui expose trois fonctions : `build(UI&)`, `attachInput(UI&)` et `update()`.

```cpp
#include <Lucarne.h>
#include "Projet.h"   // exporté depuis Lucarne Studio

using namespace lucarne;

ST7789 display;
UI ui(display);

void setup() {
    DisplayPins pins;
    pins.cs = 1; pins.dc = 2; pins.rst = 3; pins.mosi = 4; pins.sclk = 5;

    DisplayOptions options;
    options.panelWidth = 240;
    options.panelHeight = 280;
    options.spiMode = 3;
    options.invert = true;

    BufferOptions buffer;
    buffer.mode = BufferMode::Full;
    buffer.memory = BufferMemory::Auto;

    display.begin(pins, options, buffer);

    projet::build(ui);       // thème + écrans + widgets + transitions
    projet::attachInput(ui); // boutons/encodeur câblés selon l'éditeur
    ui.begin();
}

void loop() {
    projet::update(); // lit les entrées physiques configurées
    ui.update();      // redessine si nécessaire

    // Alimentez les données liées avec vos vraies mesures :
    ui.setFloat("temp", readTemperature());
    ui.setFloat("load", readCpuLoad());
}
```

À retenir :

- **Vous** gérez `display.begin(...)` (broches et options propres à votre matériel) — l'éditeur ne connaît pas votre câblage écran.
- Les **clés de données** définies dans l'onglet *Data* de l'éditeur sont alimentées via `ui.setFloat` / `setInt` / `setBool` / `setString`.
- En **tactile**, appelez `projet::input.feed(x, y, pressed)` depuis votre pilote (voir [docs/EDITOR.md](docs/EDITOR.md)).
- Régénérez simplement `Projet.h` après chaque modification dans l'éditeur ; votre `.ino` n'a pas à changer.

---

## Polices anti-aliasées

Lucarne fournit deux polices anti-aliasées prêtes à l'emploi, dérivées de **Fira Sans** :

- `LucarneFontBody` (corps, ~15 px)
- `LucarneFontTitle` (titre, ~24 px)

Elles s'assignent via le thème :

```cpp
Theme theme;
theme.font = &LucarneFontBody;
theme.fontTitle = &LucarneFontTitle;
ui.setTheme(theme);
```

Si aucune police AA n'est définie, le runtime retombe sur une fonte 5×7 intégrée. Les polices personnalisées se créent dans l'éditeur (Google Fonts ou import TTF) et sont exportées dans `Projet_fonts.h`. Détails et coût flash : [docs/FONTS.md](docs/FONTS.md).

---

## Écrans supportés

`panelWidth` / `panelHeight` correspondent à la définition native (rotation 0). Les offsets sont appliqués automatiquement selon la taille et peuvent être surchargés via `DisplayOptions::colStart`, `rowStart`, `colStart2`, `rowStart2`.

### ST7789

| Taille | Définition | colStart / rowStart |
|--------|-----------|---------------------|
| 1.14" | 135 × 240 | 52 / 40 |
| 1.30" | 240 × 240 | 0 / 0 |
| 1.47" | 172 × 320 | 34 / 0 |
| 1.54" | 240 × 240 | 0 / 0 |
| 1.69" | 240 × 280 | 0 / 20 |
| 1.90" | 170 × 320 | 35 / 0 |
| 2.0"–2.8" | 240 × 320 | 0 / 0 |

### ST7735S

| Taille | Définition | colStart / rowStart |
|--------|-----------|---------------------|
| 0.96" | 80 × 160 | 26 / 1 |
| 1.44" | 128 × 128 | 2 / 1 |
| 1.8" | 128 × 160 | 0 / 0 |

> Le mode SPI se règle avec `DisplayOptions::spiMode` (0 à 3). Beaucoup de modules ST7789 exigent le mode 3 : un écran reste totalement noir si le mode est incorrect. `invert = true` est fréquent sur ST7789.

---

## Gestion mémoire et buffering

Le mode de rendu se choisit à l'init via `BufferOptions` :

- `BufferMode::Full` — framebuffer RGB565 complet ; `display()` ne pousse que la zone modifiée. Requis pour les transitions animées.
- `BufferMode::None` — aucun framebuffer, écriture directe sur l'écran. RAM minimale.

Mémoire du framebuffer :

- `BufferMemory::Auto` — PSRAM si disponible, sinon RAM interne.
- `BufferMemory::PSRAM` — force la PSRAM.
- `BufferMemory::Internal` — force la RAM interne.

`BufferOptions::maxBytes` plafonne l'allocation : au-delà, Lucarne bascule automatiquement en mode direct (`None`).

---

## Exemples fournis

| Exemple | Description |
|---------|-------------|
| `examples/HelloLucarne` | Bases du moteur graphique (texte, primitives). |
| `examples/LucarneDiag` | Diagnostic d'écran (bandes de couleurs, offsets). |
| `examples/LucarneUI` | Tableau de bord avec widgets et données animées. |
| `examples/LucarneMenu` | Menu + navigation + transitions + boutons + polices AA. |

---

## Structure du dépôt

```
Lucarne/
├── src/
│   ├── Lucarne.h            # en-tête unique
│   ├── core/                # couleur, fontes, types, Gfx
│   ├── display/             # Display + pilotes ST7789 / ST7735S
│   └── ui/                  # Theme, Store, widgets, UI, transitions, entrées, polices
├── editor/                  # Lucarne Studio (application web)
├── examples/                # croquis Arduino
├── scripts/                 # outils Node (génération de polices/icônes)
└── docs/                    # documentation détaillée
```

---

## Documentation détaillée

- [docs/RUNTIME.md](docs/RUNTIME.md) — Theme, Store, widgets, écrans, navigation, transitions (référence d'API).
- [docs/EDITOR.md](docs/EDITOR.md) — guide complet de Lucarne Studio et de l'export.
- [docs/HARDWARE.md](docs/HARDWARE.md) — câblage des écrans et des contrôles physiques.
- [docs/FONTS.md](docs/FONTS.md) — polices anti-aliasées, création et régénération.

---

## Crédits et licence

- Police par défaut : **Fira Sans** (SIL Open Font License), rastérisée en niveaux de gris.
- Le code de la bibliothèque est fourni tel quel ; voir le dépôt pour la licence applicable.
