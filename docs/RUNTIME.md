# Runtime UI — référence

Ce document décrit la couche UI haut niveau : thème, liaison de données, écrans, widgets, navigation et transitions. Tout vit dans l'espace de noms `lucarne`.

## Vue d'ensemble

```
Display  ──>  UI  ──>  Screen  ──>  Widget(s)
                │
                ├── Theme  (couleurs, polices, métriques)
                └── Store  (valeurs liées par clés nommées)
```

- On crée un `UI` en lui passant le `Display`.
- On déclare des `Screen`, on y ajoute des `Widget`.
- On affiche un écran avec `ui.show(...)`, puis on appelle `ui.update()` en boucle.
- Les widgets lisent leurs valeurs dans le `Store` via des clés ; on met à jour ces valeurs avec `ui.setFloat(...)`, etc.

---

## UI

```cpp
UI ui(display);

void setTheme(const Theme &theme);
const Theme &theme() const;
const Theme &activeTheme() const;

void setTransition(Transition def, uint16_t durationMs = 220);

void show(Screen *screen);                                   // affiche sans empiler
void navigate(Screen *screen, Transition t = Transition::Inherit); // empile + transition
void back();                                                 // dépile (transition inversée)
Screen *current() const;

void next();    // sélection suivante dans le menu actif
void prev();    // sélection précédente
void select();  // entre dans la cible de l'entrée sélectionnée
Menu *activeMenu() const;

void begin();      // premier rendu
void update();     // redessine si nécessaire (données ou écran « dirty »)
void render();     // force un rendu
void invalidate(); // marque l'UI à redessiner

void setFloat(const char *key, float v);
void setInt(const char *key, long v);
void setBool(const char *key, bool v);
void setString(const char *key, const char *v);

Store &store();
Display &display();
```

`navigate()` empile l'écran courant (pile de 8) ; `back()` revient en arrière en jouant la transition inverse. Le menu « actif » est le premier `Menu` trouvé sur l'écran courant.

`activeTheme()` renvoie le thème de l'écran courant s'il a un override (`Screen::setTheme`), sinon le thème global de l'UI.

---

## Theme

```cpp
struct Theme {
    uint16_t background;   // fond d'écran
    uint16_t surface;      // fond des cartes (Metric, lignes de menu)
    uint16_t surfaceEdge;  // bordure des cartes
    uint16_t text;         // texte principal
    uint16_t textDim;      // texte secondaire
    uint16_t primary;      // accent / sélection
    uint16_t success;
    uint16_t warning;
    uint16_t danger;
    int16_t  radius;       // rayon des coins arrondis
    int16_t  padding;      // marge interne
    int16_t  rowHeight;    // hauteur d'une ligne de menu
    const AAFont *font;       // police de corps (nullptr => fonte 5x7)
    const AAFont *fontTitle;  // police de titre
    uint8_t  textSize;     // taille de la fonte 5x7 de repli
};
```

Les couleurs se construisent avec `color565(r, g, b)`.

---

## Store (liaison de données)

```cpp
void setFloat(const char *key, float v);
void setInt(const char *key, long v);
void setBool(const char *key, bool v);
void setString(const char *key, const char *v);

float       getFloat(const char *key, float def = 0.0f) const;
long        getInt(const char *key, long def = 0) const;
bool        getBool(const char *key, bool def = false) const;
const char *getString(const char *key, const char *def = "") const;

ValueType typeOf(const char *key) const;
bool      has(const char *key) const;
```

- Capacité : 32 clés ; chaînes jusqu'à 24 caractères.
- Toute écriture marque le store « dirty » ; `ui.update()` ne redessine que dans ce cas.
- On passe en général par `ui.setFloat(...)` plutôt que par le `Store` directement.

---

## Screen

```cpp
Screen screen("Nom");   // le nom est optionnel
void add(Widget *widget);     // ajoute en fin (ordre = z-order)
const char *name() const;

void setTheme(const Theme &theme);  // override du thème global pour cet écran
void clearTheme();                  // revient au thème UI
const Theme *customTheme() const;
```

Un widget ajouté en dernier est dessiné par-dessus les précédents. Lors d'un `navigate()`, l'UI utilise `activeTheme()` : thème custom de l'écran s'il est défini, sinon `ui.theme()`.

---

## Widgets

Tous les widgets partagent une position `x, y` et, selon le type, une taille `w, h`. `setBounds(x, y, w, h)` et `setVisible(bool)` sont communs.

### Label

```cpp
Label(int16_t x, int16_t y, const char *text, TextAlign align = TextAlign::Left);

void setText(const char *text);
void setColor(uint16_t color);      // sinon Theme::text
void clearColor();
void setSize(uint8_t size);         // taille de la fonte 5x7 de repli
void setAlign(TextAlign align);     // Left, Center, Right
void setFont(const AAFont *font);   // sinon Theme::font ; pour un titre : &LucarneFontTitle
void setBackground(uint16_t bg);    // fond pour le mélange anti-aliasé (sinon Theme::background)
```

Sans `w/h` (via `setBounds`), le label s'auto-dimensionne. Avec une boîte, l'alignement se fait dans cette boîte.

### Metric

```cpp
Metric(int16_t x, int16_t y, int16_t w, int16_t h,
       const char *label, const char *key, const char *unit = "");

void setDecimals(uint8_t decimals); // décimales pour un float
void setAccent(uint16_t color);     // barre d'accent à gauche
void clearAccent();
```

Affiche une carte « étiquette ─ valeur » lue depuis `key` (suffixée de `unit`). Un `bool` s'affiche `ON`/`OFF`.

### Bar

```cpp
Bar(int16_t x, int16_t y, int16_t w, int16_t h,
    const char *key, float min = 0.0f, float max = 1.0f);

void setRange(float min, float max);
void setColor(uint16_t color);      // sinon Theme::primary
void clearColor();
void setShowValue(bool show);       // affiche le pourcentage au centre
```

Jauge horizontale remplie selon `(valeur - min) / (max - min)`.

### Icon

```cpp
Icon(int16_t x, int16_t y, int16_t w = 0, int16_t h = 0);

void setIcon(IconId id);
void setIconRef(const char *ref);
void setScale(uint8_t scale);
void setColor(uint16_t color);
void clearColor();
```

Icônes 16×16 monochromes via `setIcon(IconId)` ou `setIcon(iconFromName("thermo"))`.

Pour les icônes exportées depuis Studio (Tabler, Fluent, couleur, APNG animé), utilisez `setIconRef("nom")`. Les références animées (`emoji:…`) sont rafraîchies automatiquement par `ui.update()` via un patch partiel de l'écran.

```cpp
lucarne::setIconAnimSpeedPercent(135);  // 100 = vitesse export ; >100 = plus lent
```

À appeler dans `projet::build()` ou `setup()` avant `ui.begin()`.

### Menu

```cpp
Menu(int16_t x, int16_t y, int16_t w, int16_t h);

void addItem(const char *label, const char *iconRef = nullptr,
             Screen *target = nullptr, Transition transition = Transition::Inherit);
void clearItems();

void setActiveFill(uint16_t color);
void setActiveText(uint16_t color);
void setInactiveFill(uint16_t color);
void setInactiveText(uint16_t color);
void setInactiveEdge(uint16_t color);
void clearActiveFill();
void clearActiveText();
void clearInactiveFill();
void clearInactiveText();
void clearInactiveEdge();

void moveNext();
void movePrev();
void setSelected(int index);
int  selectedIndex() const;
int  itemCount() const;
const char *itemIcon(uint8_t index) const;
const char *itemBadge(uint8_t index) const;
Screen     *selectedTarget() const;
Transition  selectedTransition() const;
const char *selectedLabel() const;
```

Couleurs par ligne : si non définies (`clear*`), le menu utilise `Theme::primary`, `Theme::text`, `Theme::surface`, etc.

Le menu défile automatiquement quand la sélection sort de la zone visible. Jusqu'à 16 entrées. Une entrée sans `target` ne navigue pas : gérez l'action vous-même via `ui.activeMenu()->selectedLabel()` après un `select`.

### Image

```cpp
Image(int16_t x, int16_t y, int16_t w, int16_t h, const ImageAsset *asset);
void setAsset(const ImageAsset *asset);
```

Affiche un bitmap RGB565. Deux modes :

- **Flash** — `ImageAsset::data` pointe vers des pixels PROGMEM (export Studio par défaut).
- **SD** — `storage == ImageStorage::Sd`, `data == nullptr`, `source` = chemin sur la carte (ex. `"/assets/img_abc.rgb565"`). Nécessite `SD.begin()` / `mountSdCard()` avant le premier rendu. Voir [`SD.md`](SD.md).
- **Volume** — `storage == ImageStorage::Volume`, fichiers binaires sur une partition flash interne (FFat, LittleFS ou SPIFFS). `mountVolume()` / `initStorage()` avant le premier rendu. Voir [`VOLUME.md`](VOLUME.md).

Les images SD et Volume sont mises en cache RAM (jusqu'à **2 MB** par défaut sur modules 8 MB PSRAM, moins sur 2 MB PSRAM) ou lues par rangées si plus grandes. `setSdCacheMaxBytes()` pour ajuster.

```cpp
lucarne::releaseSdImageCache();
```

À appeler après démontage ou remplacement de fichiers sur la SD ou la partition volume.

```cpp
bool imageAssetDrawReady(const ImageAsset *asset);
void screenPrefetchAssets(Screen *screen, uint8_t animMaxFramesPerIcon = 0);
```

`screenPrefetchAssets` charge en avance les icônes et images fichier (SD / volume) avant l'affichage d'un écran ; appelé automatiquement par `UI::show` / `navigate`. `animMaxFramesPerIcon` limite le préchargement des frames animées (0 = toutes).

---

## Icônes disponibles

`home`, `settings`, `wifi`, `bluetooth`, `battery`, `thermo`, `drop`, `fan`, `bell`, `chart`, `power`, `sun`, `lock`, `check`, `cross`, `arrow_up`, `arrow_down`, `arrow_left`, `arrow_right`, `play`, `pause`, `plus`, `minus`.

Utilisez `iconFromName("nom")` pour obtenir l'`IconId` correspondant (`none` ou un nom inconnu renvoie `IconId::None`).

---

## Transitions

```cpp
enum class Transition { Inherit, None, SlideLeft, SlideRight, SlideUp, SlideDown, Fade, Push, Cover };
```

- `Inherit` : utilise la transition par défaut de l'UI (`setTransition`).
- Les transitions animées nécessitent `BufferMode::Full` et assez de mémoire pour un second framebuffer ; sinon, changement instantané.
- `back()` joue automatiquement l'inverse de la transition d'aller.

```cpp
ui.setTransition(Transition::SlideLeft, 220); // défaut + durée (ms)
ui.navigate(&settings, Transition::Fade);     // transition explicite
```

---

## Boucle type

```cpp
void loop() {
    input.update();                  // si vous utilisez un adaptateur d'entrée
    ui.setFloat("temp", readTemp()); // alimentation des données
    ui.update();                     // rendu si nécessaire
}
```
