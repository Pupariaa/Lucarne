# Polices anti-aliasées

Pour un rendu net malgré la basse résolution des écrans, Lucarne utilise des polices **anti-aliasées** : chaque glyphe est stocké en niveaux de gris (couverture 8 bits par pixel), puis mélangé au fond au moment du dessin.

## Format

```cpp
typedef struct {
    uint32_t coverageOffset; // décalage dans le tableau de couverture
    uint8_t  width, height;
    uint8_t  xAdvance;
    int8_t   xOffset, yOffset;
} AAGlyph;

typedef struct {
    const uint8_t *coverage;  // couverture 8 bpp, ligne par ligne, par glyphe
    const AAGlyph *glyph;
    uint16_t first, last;     // plage de codes ASCII
    uint8_t  yAdvance;        // interligne
    uint8_t  pixelSize;       // taille nominale
} AAFont;
```

Le mélange par pixel est `out = lerp(fond, couleur, couverture)`. Le fond est fourni par le widget (la surface qu'il vient de remplir), donc le rendu AA fonctionne aussi bien en mode direct qu'en mode framebuffer, sans relecture de l'écran.

## Polices fournies

Deux polices dérivées de **Fira Sans** (SIL Open Font License) sont incluses :

- `LucarneFontBody` (~15 px)
- `LucarneFontTitle` (~24 px)

Elles sont déclarées dans `src/ui/fonts/LucarneFontDefault.h` et exposées via `Lucarne.h`.

```cpp
Theme theme;
theme.font = &LucarneFontBody;
theme.fontTitle = &LucarneFontTitle;
ui.setTheme(theme);
```

Sans police AA (`theme.font == nullptr`), le runtime retombe sur une fonte 5×7 bitmap intégrée.

## Polices personnalisées (éditeur)

Dans l'onglet **Fonts** de Lucarne Studio :

- **Add Google font** — saisissez une famille (ex. `Roboto`, `Inter`), une taille et une graisse, puis `Add`.
- **Upload TTF/OTF** — importez un fichier de police et une taille.

L'éditeur rastérise la police via le canvas du navigateur (le canal alpha sert de couverture). Assignez ensuite les polices de **corps** et de **titre** dans l'onglet **Theme**. À l'export, chaque police personnalisée est écrite dans `Projet_fonts.h` au format `AAFont`, et `Projet.h` l'inclut automatiquement.

## Coût flash

La couverture 8 bpp occupe de la flash : compter environ `largeur × hauteur` octets par glyphe. Pour limiter l'empreinte :

- restreignez-vous aux deux tailles utiles (corps + titre) ;
- la plage de caractères est ASCII imprimable (32–126) ;
- évitez de multiplier les familles personnalisées.

À titre indicatif, les deux polices par défaut pèsent ~23 Ko de couverture.

## Régénérer la police par défaut

La police par défaut est générée hors-ligne par un script Node à partir d'un fichier TTF.

```bash
cd scripts
npm install
# télécharger une police TTF (ex. Fira Sans), puis :
node gen_aafont.js fonts/FiraSans-Regular.ttf ../src/ui/fonts/LucarneFontDefault.h
```

Le script `scripts/gen_aafont.js` rastérise les caractères ASCII en deux tailles (corps et titre) et écrit le header `AAFont`. Le dossier `scripts/node_modules` est ignoré par Git.
