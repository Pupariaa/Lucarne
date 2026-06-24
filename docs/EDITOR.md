# Lucarne Studio — guide de l'éditeur

Lucarne Studio est une application web statique qui permet de concevoir une interface visuellement, de simuler la navigation, puis d'exporter un header C++ prêt à intégrer.

## Ouvrir l'éditeur

Ouvrez `editor/index.html` dans un navigateur récent (Chrome, Edge, Firefox). Aucune installation ni build n'est nécessaire. Une connexion est utile uniquement pour charger des polices Google Fonts (sinon une police système de repli est utilisée).

Le projet courant est sauvegardé automatiquement dans le navigateur (stockage local). Les boutons `Save` / `Load` exportent et réimportent un fichier JSON.

## Barre d'outils

- **Nom du projet** — utilisé pour le nom du fichier exporté.
- **Écran (device)** — modèle d'écran cible (ST7789 1.69", 1.3" ; ST7735S 1.8", 1.44"). Détermine la résolution et la densité physique.
- **Rotation** — 0 / 90 / 180 / 270.
- **Blueprint / Simulate** — bascule entre la vue graphe et le simulateur.
- **Export .h** — ouvre la fenêtre d'export.
- **Save / Load / New** — gestion du projet JSON.

## Vue Blueprint

Chaque écran est un **nœud** avec une miniature en direct.

- **Déplacer** un nœud : glissez son en-tête. **Pan** : glissez le fond. **Zoom** : molette.
- **+ Screen** : ajoute un écran. **Fit** : recadre la vue.
- Chaque entrée de menu expose une **broche de sortie** (à droite du nœud). Tirez un lien depuis cette broche vers un autre nœud pour définir la cible de navigation de cette entrée.
- Cliquez un lien pour le sélectionner : l'inspecteur permet d'en changer la cible et la transition, ou de le supprimer.
- **Double-clic** sur un nœud : ouvre le Designer plein écran.

Le badge `START` indique l'écran de démarrage (modifiable dans l'inspecteur du nœud).

## Vue Designer

Édition plein écran d'un seul écran.

- **Palette** (à gauche) : ajoutez Label, Metric, Bar, Icon, Menu.
- **Canvas** : glissez pour déplacer, tirez la poignée en bas à droite pour redimensionner.
- **Calques** (en haut à droite) : sélection et suppression rapides.
- **Contrôles d'aperçu** (en bas) :
  - **Realistic 1:1** : affiche l'écran à sa densité physique réelle (selon la diagonale du modèle).
  - **Pixel grid** : superpose une grille d'un pixel écran.
  - **Zoom** : facteur d'agrandissement entier (rendu net, fidèle à l'écran réel).

## Inspecteur, Theme, Fonts, Data

Le panneau de droite a quatre onglets :

- **Inspector** — contextuel : propriétés du widget sélectionné (Designer), du nœud ou du lien (Blueprint), ou réglages du projet.
- **Theme** — couleurs, rayon, marge, hauteur de ligne, et choix des polices de corps et de titre.
- **Fonts** — gestion des polices (voir [FONTS.md](FONTS.md)).
- **Data** — clés de données (nom, type, valeur). Ces clés sont celles que vous alimenterez au runtime via `ui.setFloat(...)`, etc.

## Configuration de la navigation

Sélectionnez un nœud contenant un menu : l'inspecteur affiche **Navigation input**.

- **Buttons** — broches haut / bas / OK / retour.
- **Encoder** — broches A / B / bouton.
- **Touch** — pas de broche ; au runtime vous appellerez `projet::input.feed(x, y, pressed)` depuis votre pilote tactile.
- **Active low** — entrées actives à l'état bas (pull-ups internes), cas le plus courant.

Cette configuration est globale au projet (un seul jeu d'entrées physiques par appareil) et est traduite dans l'adaptateur d'entrées exporté.

## Vue Simulate

Teste la navigation réelle :

- Pad à l'écran ou flèches du clavier (`Entrée` = sélectionner, `Retour arrière` / `Échap` = revenir).
- Les transitions configurées (par lien ou par défaut) sont jouées comme sur l'appareil.

## Export

Le bouton **Export .h** génère :

- `Projet.h` — thème, écrans, widgets, liens et transitions, clés de données initiales, et l'adaptateur d'entrées.
- `Projet_fonts.h` — uniquement si des polices personnalisées sont utilisées (inclus automatiquement par `Projet.h`).

Copiez le contenu (bouton `Copy`) ou téléchargez le fichier (`Download`). Fermez la fenêtre via `Close`, un clic sur le fond, ou la touche `Échap`.

## Intégration dans votre croquis

Déposez les fichiers à côté de votre `.ino`. Le code généré expose l'espace de noms `projet` :

```cpp
#include <Lucarne.h>
#include "Projet.h"

using namespace lucarne;

ST7789 display;
UI ui(display);

void setup() {
    DisplayPins pins; pins.cs = 1; pins.dc = 2; pins.rst = 3; pins.mosi = 4; pins.sclk = 5;
    DisplayOptions options; options.panelWidth = 240; options.panelHeight = 280; options.spiMode = 3; options.invert = true;
    BufferOptions buffer; buffer.mode = BufferMode::Full; buffer.memory = BufferMemory::Auto;
    display.begin(pins, options, buffer);

    projet::build(ui);       // thème, écrans, widgets, transitions
    projet::attachInput(ui); // entrées physiques câblées selon l'éditeur
    ui.begin();
}

void loop() {
    projet::update();                  // lit les boutons / l'encodeur
    ui.setFloat("temp", readTemp());   // alimente les clés de données
    ui.update();
}
```

En **tactile**, remplacez `projet::update()` par vos lectures et appelez `projet::input.feed(x, y, pressed)` quand un point est disponible.

Après chaque modification dans l'éditeur, régénérez `Projet.h` : votre `.ino` reste inchangé.
