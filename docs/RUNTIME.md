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

void next();    // sélection suivante dans le menu actif / le groupe de focus
void prev();    // sélection précédente
void select();  // entre dans la cible de l'entrée sélectionnée / active le widget focalisé
void activateAt(int16_t x, int16_t y); // active le widget sous ce point (tactile)
Menu *activeMenu() const;

// Transforme un Button en champ numérique éditable au D-pad : select() bascule
// le mode édition, next()/prev() ajustent la valeur stockée par `step` (bornée
// à [minV, maxV]).
void registerField(Button *button, const char *key, float step, float minV, float maxV,
                   uint8_t decimals = 2, const char *label = nullptr, const char *unit = nullptr);
void refreshField(Button *button);
void refreshFields();
bool isEditingField() const;

// Clavier virtuel à l'écran pour les widgets TextField. Voir la section TextField.
void configureKeyboard(const VirtualKeyboardOptions &opts);
bool isEditingText() const;

uint8_t pollMenuAction();          // consomme l'action déclenchée par un Button/Shape « callback »
bool hasMenuAction() const;

void begin();      // premier rendu
void update();     // redessine les seules régions invalidées
void render();     // force un rendu plein écran
void invalidate(); // invalide tout l'écran
void invalidateRect(int16_t x, int16_t y, int16_t w, int16_t h); // invalide une zone
void invalidateWidget(Widget *widget);                          // invalide la boîte d'un widget
void setRenderStrategy(RenderStrategy strategy); // Auto (régions) ou ForceFullRedraw

bool bindValue(const char *key, Widget *widget, ValueFormatter format = nullptr,
               uint8_t decimals = 1, const char *unit = nullptr);
void unbindValue(Widget *widget);
void rebuildBindings();

void setHalProfile(const HalProfile &profile);
const HalProfile &halProfile() const;

void setFloat(const char *key, float v);
void setInt(const char *key, long v);
void setBool(const char *key, bool v);
void setString(const char *key, const char *v);

Store &store();
Display &display();
```

`navigate()` empile l'écran courant (pile de 8) ; `back()` revient en arrière en jouant la transition inverse. Le menu « actif » est le premier `Menu` trouvé sur l'écran courant.

`activeTheme()` renvoie le thème de l'écran courant s'il a un override (`Screen::setTheme`), sinon le thème global de l'UI.

`back()` referme d'abord, dans l'ordre, le clavier virtuel s'il est ouvert, puis un champ `Button` en cours d'édition (`registerField`), avant de dépiler un écran — voir [Navigation par focus](#navigation-par-focus).

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

- Capacité : 160 clés par défaut (`Store::CAPACITY`, macro `LUCARNE_STORE_CAPACITY`) ; chaînes jusqu'à 64 caractères (`Store::STRLEN`, fixe).
- La capacité se configure projet par projet en définissant `LUCARNE_STORE_CAPACITY` dans `LucarneUserConfig.h` **avant** que `<Lucarne.h>` ne soit inclus (utile pour les gros projets multi-écrans qui dépassent 160 clés, ou pour réduire l'empreinte RAM sur une cible contrainte).
- Chaque écriture marque **la clé** « dirty » (`isKeyDirty`). `ui.update()` invalide uniquement les widgets liés aux clés modifiées, puis redessine leurs boîtes ; le reste de l'écran n'est pas retouché.
- `ui.store().setFloat/Int/Bool/String(key, v, false)` écrit sans marquer la clé.
- On passe en général par `ui.setFloat(...)` plutôt que par le `Store` directement.
- Le patch des valeurs est limité à une fois toutes les 50 ms (`LUCARNE_TELEMETRY_MIN_INTERVAL_MS`).

### Bindings

Les widgets de l'écran courant déclarent leurs clés (`Widget::storeKeys`) : Label lié, Metric, Bar, Gauge, Button (`registerField`), Slider, Switch, Clock, Date, Battery, Status, TextField, Graph en mode `Keys`, DynamicImage. La table est reconstruite automatiquement à chaque `show` / `navigate` (auto-scan), il n'y a rien à déclarer pour ces widgets.

`ui.bindValue(key, &widget, format, decimals, unit)` ajoute une liaison explicite, utile pour un `Label` qui doit afficher une valeur du store :

```cpp
ui.bindValue("temp", &tempLabel, nullptr, 1, "C"); // "23.4 C"
ui.bindValue("status", &statusLabel);               // chaîne telle quelle
```

Le formateur par défaut écrit un float avec `decimals` décimales, un entier tel quel, un booléen en `ON`/`OFF`, une chaîne telle quelle, puis ajoute l'unité précédée d'une espace. Un `ValueFormatter` personnalisé reçoit la `ValueBinding` et écrit dans `binding.text` (`LUCARNE_BINDING_TEXT_LEN` octets).

Capacités : `LUCARNE_MAX_VALUE_BINDINGS` (16, 4 sur AVR) liaisons explicites, `LUCARNE_MAX_AUTO_BINDINGS` (96, 16 sur AVR) liaisons auto-scan.

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
void setTextTransparent(bool transparent);
void setSize(uint8_t size);         // taille de la fonte 5x7 de repli
void setAlign(TextAlign align);     // Left, Center, Right
void setFont(const AAFont *font);   // sinon Theme::font ; pour un titre : &LucarneFontTitle
void setSpacing(int8_t spacing);
void clearSpacing();
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
void setLabelFont(const AAFont *font);
void setLabelColor(uint16_t color);
void setLabelTransparent(bool transparent);
void setLabelSize(uint8_t size);
void setLabelSpacing(int8_t spacing);
void setValueFont(const AAFont *font);
void setValueColor(uint16_t color);
void setValueTransparent(bool transparent);
void setValueSize(uint8_t size);
void setValueSpacing(int8_t spacing);
```

Affiche une carte « étiquette ─ valeur » lue depuis `key` (suffixée de `unit`). Un `bool` s'affiche `ON`/`OFF`. Les styles `Label*`/`Value*` permettent une police/couleur/taille/espacement indépendants pour l'étiquette et la valeur.

### Bar

```cpp
Bar(int16_t x, int16_t y, int16_t w, int16_t h,
    const char *key, float min = 0.0f, float max = 1.0f);

void setRange(float min, float max);
void setColor(uint16_t color);      // sinon Theme::primary
void clearColor();
void setShowValue(bool show);       // affiche le pourcentage au centre
void setValueFont(const AAFont *font);
void setValueColor(uint16_t color);
void setValueSize(uint8_t size);
void setValueSpacing(int8_t spacing);
```

Jauge horizontale remplie selon `(valeur - min) / (max - min)`. Les setters `Value*` stylent le texte du pourcentage affiché quand `setShowValue(true)`.

### Icon

```cpp
Icon(int16_t x, int16_t y, const char *ref, uint8_t scale = 1);

void setIconRef(const char *ref);
const char *iconRef() const;
void setScale(uint8_t scale);
uint8_t scaleTenths() const;
void setColor(uint16_t color);
void clearColor();
void setTransparent(bool transparent);
```

Le widget identifie toujours son icône par une **référence texte** (`ref`), pas par un enum : `"home"`, `"thermo"`, etc. pour les 23 icônes intégrées 16×16 monochromes (liste ci-dessous), ou un nom exporté par Studio (Tabler, Fluent, couleur, APNG animé). `iconFromName("nom")` reste disponible comme utilitaire pour valider/convertir un nom d'icône intégrée en `IconId`, mais n'est plus nécessaire pour construire ou peupler un `Icon` — `setIconRef("home")` fonctionne directement.

Les références animées (`emoji:…`) sont rafraîchies automatiquement par `ui.update()` via un patch partiel de l'écran.

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
const ImageAsset *asset() const;
void setScaleMode(ImageScaleMode mode);        // Fit (défaut) ou Native
void setSourceOffset(int16_t ox, int16_t oy);  // décalage source en mode Native
```

Affiche un bitmap RGB565 depuis un `ImageAsset` :

```cpp
enum class ImageStorage : uint8_t { Flash = 0, Sd, Web, Psram, FlashRle, Volume };

struct ImageAsset {
    const uint16_t *data;   // pixels (Flash / FlashRle uniquement)
    const uint8_t  *alpha;  // canal alpha optionnel
    int16_t width;
    int16_t height;
    ImageStorage storage;
    const char *source;     // chemin fichier (Sd / Volume / Psram)
};
```

#### Stockage des images

- **Flash** — `data` pointe vers des pixels PROGMEM non compressés (export Studio par défaut).
- **FlashRle** — pixels PROGMEM compressés en RLE (`LucarneImageRle.cpp`), décodés à la volée au dessin ; réduit la taille de `Projet_images.h` pour les images avec de grands aplats.
- **Sd** — `data == nullptr`, `source` = chemin sur la carte (ex. `"/assets/img_abc.rgb565"`). Nécessite `SD.begin()` / `mountSdCard()` avant le premier rendu. Voir [`SD.md`](SD.md).
- **Volume** — fichiers binaires sur une partition flash interne (FFat, LittleFS ou SPIFFS). `mountVolume()` / `initStorage()` avant le premier rendu. Voir [`VOLUME.md`](VOLUME.md).
- **Psram** — même format fichier que Sd/Volume, mais l'asset est entièrement chargé en PSRAM au démarrage plutôt que mis en cache/relu à la demande : les redessins réutilisent directement le buffer PSRAM, sans accès disque, pour les images redessinées souvent (fonds d'écran, sprites animés). Nécessite une carte avec PSRAM.
- **Web** — valeur d'énumération présente mais **non implémentée** : aucun chargeur HTTP n'existe dans le firmware. Ne pas utiliser ; Lucarne Studio ne propose plus ce choix dans le sélecteur de stockage des assets.

Les images `Sd`, `Volume` et `Psram` supportent un fichier `.alpha` optionnel à côté du `.rgb565` (même base de nom) pour la transparence — voir [`SD.md`](SD.md) et [`ASSETS.md`](ASSETS.md).

Les images fichier (`Sd`/`Volume`) non-`Psram` sont mises en cache RAM à la demande (jusqu'à **2 MB** par défaut sur modules 8 MB PSRAM, moins sur 2 MB PSRAM) ou lues par rangées si plus grandes. `setSdCacheMaxBytes()` pour ajuster.

`ImageScaleMode::Native` dessine l'image à sa taille réelle (1:1) au lieu de la redimensionner à `w × h` ; si l'image est plus grande que le widget, elle est simplement rognée à la zone visible (`setSourceOffset` pour choisir la portion affichée) au lieu d'être mise à l'échelle. Utile pour des sprites ou icônes en pixel-art où un redimensionnement introduirait du flou.

```cpp
lucarne::releaseSdImageCache();
```

À appeler après démontage ou remplacement de fichiers sur la SD ou la partition volume.

```cpp
bool imageAssetDrawReady(const ImageAsset *asset);
void screenPrefetchAssets(Screen *screen, uint8_t animMaxFramesPerIcon = 0);
```

`screenPrefetchAssets` charge en avance les icônes et images fichier (SD / volume) avant l'affichage d'un écran ; appelé automatiquement par `UI::show` / `navigate`. `animMaxFramesPerIcon` limite le préchargement des frames animées (0 = toutes).

### Button

```cpp
Button(int16_t x, int16_t y, int16_t w, int16_t h, const char *label);

void setLabel(const char *label);
void setIconRef(const char *ref);
const char *iconRef() const;
void setNavigate(Screen *target, Transition t = Transition::Inherit);
void setCallback(uint8_t actionId);
void setColor(uint16_t fill, uint16_t text);
void setFillTransparent(bool transparent);
void setTextColorTransparent(bool transparent);
void setTextTransparent(bool transparent);
void setTextFont(const AAFont *font);
void setTextColor(uint16_t color);
void setTextSize(uint8_t size);
void setTextSpacing(int8_t spacing);
void setTextAlign(TextAlign align);
void setFocused(bool focused);  // piloté par UI (navigation focus)
bool focused() const;
void setEditing(bool editing);  // piloté par UI::registerField
bool editing() const;

Screen *navigateTarget() const;
Transition navigateTransition() const;
uint8_t callbackActionId() const;
bool isCallback() const;
bool hitTest(int16_t px, int16_t py) const;
```

Bouton rectangulaire avec libellé et icône optionnelle. Deux usages exclusifs :

- **Navigation** — `setNavigate(&autreEcran)` : `select()` (OK) navigue vers l'écran cible.
- **Callback** — `setCallback(actionId)` : `select()` place `actionId` dans la file consultée par `ui.pollMenuAction()` / `ui.hasMenuAction()`, sans navigation automatique.

Un `Button` fait partie du groupe de focus D-pad (voir [Navigation par focus](#navigation-par-focus)) : `setFocused`/`focused()` sont pilotés par `UI`, pas à appeler manuellement en usage normal. `UI::registerField` transforme un `Button` en champ numérique éditable au D-pad (voir la section `UI` ci-dessus).

### Switch

```cpp
Switch(int16_t x, int16_t y, int16_t w, int16_t h, const char *label, const char *key);

void setLabel(const char *label);
void setKey(const char *key);
const char *key() const;
void setTextFont(const AAFont *font);
void setTextColor(uint16_t color);
void setTextTransparent(bool transparent);
void setTextSize(uint8_t size);
void setTextSpacing(int8_t spacing);
void toggle(Store &store);
void setFocused(bool focused);
bool focused() const;
```

Interrupteur on/off : lit/écrit un booléen dans `key`. `toggle(store)` inverse la valeur stockée. Intégré au groupe de focus D-pad : une fois le `Switch` sélectionné, `select()` (OK) appelle `toggle()` sur le `Store` de l'UI.

### Slider

```cpp
Slider(int16_t x, int16_t y, int16_t w, int16_t h, const char *key, float minV, float maxV);

void setKey(const char *key);
void setRange(float minV, float maxV);
void setColor(uint16_t c);
void clearColor();
```

Piste horizontale + curseur rond ; position proportionnelle à `(valeur - min) / (max - min)`. La valeur est lue dans `key` (float).

Le `Slider` fait partie du groupe de focus D-pad : une fois sélectionné, les entrées de navigation ajustent la valeur stockée par pas et la bornent à `[min, max]`, avec redessin immédiat — un contrôle interactif au même titre qu'un champ `registerField`, pas un simple affichage.

### Chart

```cpp
static const uint8_t MAX_KEYS = 8;

Chart(int16_t x, int16_t y, int16_t w, int16_t h);

void setKey(uint8_t index, const char *key);   // index 0..7
void setRange(float minV, float maxV);
void setColor(uint16_t c);
void clearColor();
```

Trace une polyligne reliant jusqu'à 8 valeurs `Store` nommées via `setKey(index, key)`, réparties uniformément sur la largeur du widget — un instantané multi-métriques (comparaison de plusieurs valeurs courantes), **pas** une série temporelle (pour ça, voir `Graph`). Nécessite au moins 2 clés définies pour dessiner quoi que ce soit.

### Graph

```cpp
enum class GraphType : uint8_t { Line, Bar, Area, Sparkline };
enum class GraphMode : uint8_t { Stream, Keys };

static const uint8_t MAX_KEYS = 8;
static const uint8_t MAX_CAPACITY = 64;

Graph(int16_t x, int16_t y, int16_t w, int16_t h);

void setType(GraphType type);
GraphType type() const;
void setMode(GraphMode mode);
GraphMode mode() const;
void setKey(uint8_t index, const char *key);   // mode Keys, index 0..7
void setStreamKey(const char *key);            // informatif uniquement, n'alimente pas le tampon
const char *streamKey() const;
void setCapacity(uint8_t capacity);            // mode Stream, 2..64 (défaut 32)
void setRange(float minV, float maxV);
void setColor(uint16_t c);
void clearColor();
void setGrid(bool grid);
void push(float value);                        // mode Stream : ajoute un échantillon
void clear();                                   // mode Stream : vide le tampon
uint8_t count() const;
```

Deux modes :

- **Stream** (défaut) — tampon circulaire interne. Appelez `push(value)` (par exemple depuis `loop()`) à chaque nouvelle mesure ; `setCapacity` fixe la profondeur d'historique (2 à 64 échantillons). `setStreamKey` ne fait que mémoriser une clé à titre indicatif : elle n'alimente pas automatiquement le tampon, c'est à l'appelant d'appeler `push()`.
- **Keys** — trace directement jusqu'à 8 valeurs `Store` courantes (`setKey(index, key)`), une par point, sans historique.

Type de tracé : `Line`, `Bar`, `Area` (ligne + remplissage sous la courbe), ou `Sparkline` (sans cadre ni quadrillage, pour une intégration compacte dans une carte). `setGrid(true)` (défaut) affiche un quadrillage de repère pour `Line`/`Bar`/`Area`.

### Gauge

```cpp
Gauge(int16_t x, int16_t y, int16_t w, int16_t h, const char *label, const char *key,
      float minV, float maxV);

void setAccent(uint16_t c);
void clearAccent();
void setLabelFont(const AAFont *font);
void setLabelColor(uint16_t color);
void setLabelTransparent(bool transparent);
void setLabelSize(uint8_t size);
void setLabelSpacing(int8_t spacing);
void setValueFont(const AAFont *font);
void setValueColor(uint16_t color);
void setValueTransparent(bool transparent);
void setValueSize(uint8_t size);
void setValueSpacing(int8_t spacing);
```

Jauge circulaire (demi-cercle 180°) : cercle de fond, puis arc rempli proportionnel à `(valeur - min) / (max - min)` — l'arc n'est dessiné que si `setAccent` a été appelé. Libellé au-dessus du cercle, valeur numérique formatée (une décimale) sous le cercle.

### List

```cpp
static const uint8_t MAX_ITEMS = 12;

List(int16_t x, int16_t y, int16_t w, int16_t h);

void addItem(const char *label);
void setItemStyle(uint8_t index, const TextStyle &style);
void setTextFont(const AAFont *font);
void setTextColor(uint16_t color);
void setTextTransparent(bool transparent);
void setTextSize(uint8_t size);
void setTextSpacing(int8_t spacing);
void clearItems();
int itemCount() const;
```

Liste de lignes de texte (jusqu'à 12 entrées) ; contrairement à `Menu`, pas d'icônes ni de cible de navigation par ligne — juste du texte, avec `setItemStyle(index, style)` pour une police/couleur/taille par ligne. Le nombre de lignes visibles dépend de `theme.rowHeight` et de la hauteur du widget.

Intégrée au groupe de focus D-pad, la `List` défile et met en surbrillance ses lignes : haut/bas déplacent la sélection/position de défilement, OK confirme la ligne surlignée — un contrôle de sélection interactif, pas un simple affichage statique.

### Shape

```cpp
enum class ShapeKind : uint8_t { Rect, Circle, Triangle };

Shape(int16_t x, int16_t y, int16_t w, int16_t h, ShapeKind kind);

void setKind(ShapeKind kind);
ShapeKind kind() const;
void setFill(uint16_t color);
void setFillTransparent(bool transparent);
void setStroke(uint16_t color);
void setStrokeTransparent(bool transparent);
void setStrokeWidth(uint8_t width);
void setLabel(const char *label);
void setTextColor(uint16_t color);
void setTextSize(uint8_t size);
void setTextFont(const AAFont *font);
void setTextTransparent(bool transparent);
void setNavigate(Screen *target, Transition t = Transition::Inherit);
void setCallback(uint8_t actionId);
void setGroup(const char *group);
const char *group() const;
void setSelected(bool selected);
bool selected() const;
void setActiveFill(uint16_t color);
void setActiveStroke(uint16_t color);
void setActiveText(uint16_t color);
void clearActiveFill();
void clearActiveStroke();
void clearActiveText();
bool isNavigable() const;

Screen *navigateTarget() const;
Transition navigateTransition() const;
uint8_t callbackActionId() const;
bool isCallback() const;
bool hitTest(int16_t px, int16_t py) const;
```

Primitive géométrique (rectangle, cercle, triangle) avec remplissage/contour indépendants et un libellé optionnel superposé. Comme `Button`, une `Shape` peut porter une cible de navigation (`setNavigate`) ou un callback (`setCallback`) ; `isNavigable()` renvoie `true` dès que l'un des deux est défini — c'est ce qui la rend sélectionnable au D-pad ou au tactile (utile pour des tuiles cliquables ou des barres d'icônes dessinées comme formes plutôt que comme `Button`).

`setGroup("nom")` reste éditable (regroupement logique dans l'inspecteur Studio), mais aujourd'hui **toutes** les formes navigables d'un écran entrent dans le même groupe de focus D-pad, quel que soit leur `group`.

`setActiveFill`/`setActiveStroke`/`setActiveText` définissent l'apparence en focus ; sans eux, seul le contour change de couleur pour indiquer le focus.

### Battery

```cpp
Battery(int16_t x, int16_t y, int16_t w, int16_t h, const char *levelKey, bool showPercent = true);

void setShowPercent(bool show);
void setChargingKey(const char *key);
void setLowThreshold(uint8_t pct);
```

Icône de batterie : niveau (float, 0–100) lu dans `levelKey`. Couleur du remplissage : `theme.success` au-dessus de 40 %, `theme.warning` entre `lowThreshold` (défaut 20) et 40 %, `theme.danger` en dessous ; `theme.primary` si `chargingKey` (bool) est vrai. `showPercent` affiche le pourcentage centré (uniquement si le widget fait au moins 36×14 px).

### Clock

```cpp
Clock(int16_t x, int16_t y, int16_t w, int16_t h, const char *hourKey, const char *minuteKey,
      const char *secondKey = nullptr, ClockFormat format = ClockFormat::Hm);

void setTimeKey(const char *key);      // chaîne préformatée, prioritaire sur hour/minute/second
void setFormat(ClockFormat format);    // Hm, Hms, hm12
void setTextStyle(const TextStyle &style);
```

Deux modes : `hourKey`/`minuteKey`/`secondKey` (int) formatés selon `format` (`Hm` = `HH:MM`, `Hms` = `HH:MM:SS` si `secondKey` fourni, `hm12` = 12 h avec `AM`/`PM`) ; ou `setTimeKey(key)` qui affiche directement une chaîne déjà formatée par l'appelant (prioritaire dès que la clé existe et est de type `String`).

### Date

```cpp
Date(int16_t x, int16_t y, int16_t w, int16_t h, const char *dayKey, const char *monthKey,
     const char *yearKey, DateFormat format = DateFormat::DmySlash);

void setDateKey(const char *key);      // chaîne préformatée, prioritaire sur day/month/year
void setFormat(DateFormat format);     // DmySlash, YmdDash, MdySlash, DmyDot
void setTextStyle(const TextStyle &style);
```

Même principe que `Clock` : `dayKey`/`monthKey`/`yearKey` (int, jour/mois bornés à 1–31/1–12) formatés selon `format` (`DmySlash` = `JJ/MM/AAAA`, `YmdDash` = `AAAA-MM-JJ`, `MdySlash` = `MM/JJ/AAAA`, `DmyDot` = `JJ.MM.AAAA`), ou `setDateKey(key)` pour une chaîne préformatée prioritaire.

### Status

```cpp
Status(int16_t x, int16_t y, int16_t w, int16_t h, const char *wifiKey = nullptr,
       const char *rssiKey = nullptr, const char *bluetoothKey = nullptr);
```

Icônes d'état réseau, dessinées côte à côte de gauche à droite selon les clés fournies :

- **Wifi** (`wifiKey`, bool) — 4 barres de signal ; le nombre de barres actives vient de `rssiKey` (int, dBm) : ≥ −50 dBm → 4 barres, ≥ −60 → 3, ≥ −70 → 2, sinon 1.
- **Bluetooth** (`bluetoothKey`, bool) — glyphe stylisé, coloré si actif sinon atténué.

Pas de setters de couleur dédiés : actif utilise `theme.text`, inactif `theme.textDim`.

### DynamicImage

```cpp
DynamicImage(int16_t x, int16_t y, int16_t w, int16_t h, const char *pathKey, ImageStorage storage,
             int16_t imgWidth, int16_t imgHeight);

void setPathKey(const char *key);
void setStorage(ImageStorage storage);
void setScaleMode(ImageScaleMode mode);          // Fit ou Native
void setSourceOffset(int16_t ox, int16_t oy);    // décalage source en mode Native
void setSourceSize(int16_t imgW, int16_t imgH);
void setPathOverride(const char *path);          // fige un chemin fixe, ignore pathKey
```

Comme `Image`, mais le chemin du fichier est **dynamique** : lu dans `pathKey` (`Store`, type `String`) à chaque redessin plutôt que fixé à la construction — utile pour une pochette, un avatar, ou toute image dont le fichier change selon l'état de l'application. `storage` doit être un stockage fichier (`Sd`, `Volume`, ou `Psram`) : le widget construit toujours son `ImageAsset` avec `data == nullptr`, en s'appuyant uniquement sur `source` (le chemin résolu), donc `Flash`/`FlashRle` n'ont pas de sens ici.

`setPathOverride(path)` force un chemin fixe indépendamment de `pathKey` (prioritaire) ; passer `nullptr` ou une chaîne vide annule l'override.

### TextField

```cpp
enum class Kind : uint8_t { Text, Numeric, Integer, Hex, Password };

TextField(int16_t x, int16_t y, int16_t w, int16_t h);

void setKey(const char *key);
const char *key() const;
void setLabel(const char *label);            // libellé flottant au-dessus du champ
const char *label() const;
void setPlaceholder(const char *placeholder);
const char *placeholder() const;
void setMaxLen(uint8_t maxLen);              // défaut 32
uint8_t maxLen() const;
void setInputKind(Kind kind);
Kind inputKind() const;

void setTextFont(const AAFont *font);
void setTextColor(uint16_t color);
void setTextTransparent(bool transparent);
void setTextSize(uint8_t size);
void setTextSpacing(int8_t spacing);

void setFocused(bool focused);   // piloté par UI
bool focused() const;
void setEditing(bool editing);   // piloté par UI (clavier ouvert)
bool editing() const;
void setLiveText(const char *text);
const char *liveText() const;
```

Champ de saisie texte/numérique. La valeur est lue/écrite dans `key` (`String` pour `Text`/`Password`/`Hex`, `Int` pour `Integer`, `Float` pour `Numeric`). `Kind::Password` masque l'affichage avec des `*`, au repos comme en édition.

#### Clavier virtuel

Une fois le `TextField` focalisé (voir [Navigation par focus](#navigation-par-focus)), `select()` (OK) ouvre un clavier virtuel dessiné par `UI` en overlay, ancré en haut ou en bas de l'écran :

```cpp
enum class KeyboardLayout : uint8_t {
    Full, Compact, Minimal, FullAzerty, CompactAzerty, MinimalAzerty, Numeric, Hex,
};

struct VirtualKeyboardOptions {
    bool enabled = false;
    uint8_t dock = 0;             // 0 = bas, 1 = haut
    KeyboardLayout layout = KeyboardLayout::Compact;
};

void configureKeyboard(const VirtualKeyboardOptions &opts); // sur UI
bool isEditingText() const;                                  // sur UI
```

- La disposition effective est suggérée automatiquement depuis `inputKind()` : `Numeric`/`Integer` → clavier `Numeric`, `Hex` → clavier `Hex`, sinon la disposition QWERTY/AZERTY configurée par `layout`.
- `next()`/`prev()` (haut/bas ou molette) déplacent la sélection parmi les touches ; `select()` tape la touche surlignée ; la touche **OK** du clavier ou `back()` referme l'overlay et valide la saisie dans `key`.
- Les touches de bascule **`^`** (majuscules/symboles) et **`123`** (numérique) changent effectivement de disposition — ce ne sont pas de simples touches décoratives.
- Fonctionne aussi au tactile : taper une touche ou la zone de l'overlay est géré par `UI::activateAt(x, y)`.
- `setLiveText`/`liveText()` reflètent le texte en cours de saisie ; utilisés en interne par l'overlay, exposés pour un rendu personnalisé si besoin.

Appelez `ui.configureKeyboard(opts)` (une fois, avant ou après `ui.begin()`) pour définir la disposition et l'ancrage par défaut du clavier.

---

## Navigation par focus

Depuis l'ajout de `TextField`, `Slider` et `List`, `UI` gère une **liste de focus unique par écran** couvrant tous les widgets interactifs, parcourue avec les mêmes commandes qu'un `Menu` :

- Widgets couverts : `Shape` navigable (`isNavigable()`), `Button`, `Switch`, `TextField`, `Slider`, `List`.
- Entrées : Haut/Bas/Gauche/Droite déplacent le focus (ou ajustent la valeur du widget focalisé quand il est en mode édition — `Slider`, `List`, champ `registerField`) ; **OK** (`select()`) active le widget focalisé (navigation, callback, bascule `Switch`, ouverture du clavier `TextField`, entrée en édition d'un `Slider`) ; **Retour** (`back()`) referme le clavier virtuel, ou une édition de champ, ou dépile l'écran.
- Le même mécanisme pilote les `Menu` et le clavier virtuel : `select()`/`back()` s'adaptent selon qu'un clavier ou un champ est actif (voir `UI::back()` ci-dessus).
- Chaque widget focalisable expose `setFocused(bool)`/`focused()` (ou l'équivalent pour `Shape` : `setSelected`/`selected()`) : ces méthodes sont pilotées par `UI`, à ne pas appeler manuellement en usage courant.

Ce focus group unique remplace l'ancienne navigation limitée aux seules `Shape` : n'importe quel mélange de formes, boutons, interrupteurs, champs de texte, curseurs et listes sur un même écran est traversable au D-pad, à l'encodeur rotatif, ou au tactile.

## Touches calculées (calc keys)

Le Store peut contenir des clés **calculées** définies dans l'onglet **Data** de Lucarne Studio (ex. `Watts = Voltage * Current`). L'export génère une fonction `projet::recomputeCalcs(UI &ui)` qui relit/réécrit les clés du `Store` selon les formules configurées ; appelez-la une fois par itération de `loop()`, avant `ui.update()` :

```cpp
void loop() {
    projet::update();
    projet::recomputeCalcs(ui);
    ui.update();
}
```

Le graphe de dépendances et la grammaire de formule (`+ - * / ( )`) sont validés côté éditeur ; voir [`EDITOR.md`](EDITOR.md) pour le détail de l'onglet Data.

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
- `back()` joue automatiquement l'inverse de la transition d'aller.
- Durée par défaut 180 ms, 6 pas au maximum.

```cpp
ui.setTransition(Transition::SlideLeft, 220); // défaut + durée (ms)
ui.navigate(&settings, Transition::Fade);     // transition explicite
```

Les transitions sont rendues **par bandes** : les deux écrans sont dessinés bande par bande dans deux `StripeCanvas`, composés puis envoyés. Elles coûtent deux bandes de RAM, jamais un framebuffer complet, et fonctionnent en `Full` comme en `Partial`. Le nombre de bandes dépend du profil : 8 (Tiny, LowRam), 12 (Psram), 16 (MipiHighRes).

Matrice appliquée par le firmware (et grisée à l'identique dans Lucarne Studio) :

| Situation | Transitions effectives |
|-----------|------------------------|
| `BufferMode::None`, OLED, HD44780 | None |
| Profil `Tiny` | Fade, sinon None |
| Profil `LowRam` | Slide et Fade ; Push et Cover deviennent None |
| Profils `Psram`, `MipiHighRes` | toutes |

Le chemin « rich » (deux framebuffers complets, composition plein écran) n'est utilisé que si `HalProfile.preferRichTransitions` et `allowRichTransitions` sont vrais, en `BufferMode::Full`, avec un profil `Psram` ou `MipiHighRes`, et si les deux allocations réussissent. Sinon, le moteur par bandes prend le relais.

---

## Rendu : régions invalidées, modes de buffer, profils HAL

### Régions invalidées

`update()` collecte les invalidations (widgets modifiés, clés du store, clavier virtuel, barre de splash) dans une liste de 8 rectangles au plus (`LUCARNE_MAX_DIRTY_RECTS`). Deux rectangles sont fusionnés quand leur union ne dépasse pas leur surface cumulée de plus de 35 % ; au-delà de 8, tout est fusionné. Pour chaque rectangle, l'écran est redessiné avec un clip (`Screen::drawClipped`) puis seul ce rectangle est envoyé à l'écran. `setRenderStrategy(RenderStrategy::ForceFullRedraw)` revient à un rendu plein écran à chaque changement.

### Modes de buffer

```cpp
enum class BufferMode { None, Partial, Full };

struct BufferOptions {
    BufferMode mode;            // Full par défaut
    BufferMemory memory;        // Auto, Internal, Psram
    uint32_t maxBytes;          // 0 = pas de limite ; au-delà, Full passe en Partial
    uint16_t partialLineCount;  // hauteur des bandes en Partial (0 = auto)
    HalProfile hal;
};
```

- `Full` : un framebuffer RGB565 complet. Si l'allocation échoue ou dépasse `maxBytes`, le driver passe automatiquement en `Partial`, puis en `None` si même les bandes ne tiennent pas.
- `Partial` : pas de framebuffer complet. Chaque région est rendue par bandes de `partialLineCount` lignes (par défaut `max(10, hauteur/10)`, 50 sur MIPI) dans un `StripeCanvas`, puis envoyée. Avec un flush asynchrone, la bande N+1 est dessinée pendant que la DMA envoie la bande N (ping-pong). Les images avec alpha restent correctes, la lecture de pixels étant possible dans la bande.
- `None` : écriture directe sur le bus. C'est le mode natif des OLED (page buffer 1 bpp interne) et du HD44780 (grille de caractères).

### Profils HAL

```cpp
enum class UiProfile { Tiny, LowRam, Psram, MipiHighRes };

struct HalProfile {
    HalBackend backend;          // Auto, Arduino, EspIdf, Stm32Cube, Wch
    UiProfile uiProfile;         // LowRam par défaut
    uint16_t stripeLines;        // 0 = auto
    bool allowRichTransitions;   // forcé à false en Tiny et LowRam
    bool preferRichTransitions;  // false par défaut : transitions par bandes
    bool preferHwRotate;         // rotation PPA sur ESP32-P4
    bool jpegDecodeHw;
    uint32_t capsOverride;
};
```

Le profil se passe au driver (`buffer.hal`) et à l'UI (`ui.setHalProfile(hal)`). Sur ESP32, un profil `Psram` ou `MipiHighRes` sans PSRAM détectée est rabaissé en `LowRam`. Lucarne Studio résout ce profil automatiquement depuis la carte (section **Rendering / HAL** de l'onglet Hardware) et l'émet dans `Projet_setup.h`.

### Flush asynchrone

| Plateforme | Mécanisme | Condition |
|------------|-----------|-----------|
| ESP32 (Arduino) | `spi_master` IDF, morceaux de 32 000 octets, file de 4 | bus `SPI` par défaut |
| RP2040 / RP2350 | canal DMA pico-sdk vers le SPI | toujours |
| STM32 (backend Cube) | `HAL_SPI_Transmit_DMA` | `halStm32SetSpi(&hspi)` avec un `hdmatx` lié |
| CH32V (backend WCH) | DMA1 vers `SPI1` ou `SPI2` | `halWchSetSpi(SPI2)` pour le second bus |
| ESP32-P4 MIPI | `esp_lcd_panel_draw_bitmap` avec `use_dma2d` | toujours |

L'UI attend la fin du transfert avant de rendre la main (fin de `update()`), et avant tout accès à la carte SD (`halFlushWait()`), de sorte que le code utilisateur ne voit jamais un transfert en cours. `LUCARNE_DISABLE_ASYNC_FLUSH` force le chemin synchrone.

---

## Boucle type

```cpp
void loop() {
    input.update();                  // si vous utilisez un adaptateur d'entrée
    ui.setFloat("temp", readTemp()); // alimentation des données
    ui.update();                     // rendu si nécessaire
}
```
