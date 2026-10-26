# Live preview (USB)

Le live preview affiche en temps réel, sur un vrai écran, ce que vous concevez dans Lucarne Studio. L'éditeur calcule le rendu (pixel-exact) et envoie le framebuffer à l'ESP32 par USB ; la carte ne fait que décoder et afficher. Aucune interaction n'a lieu côté carte.

Deux fonctions distinctes de la barre d'outils s'appuient sur ce mécanisme, à ne pas confondre :

- **Live** — se connecte en USB série à une carte **déjà flashée** avec un firmware de réception Live, pour afficher en direct ce qui est conçu dans Studio. C'est le sujet principal de ce document.
- **Flash receiver** — assistant séparé qui **flashe** ce firmware de réception sur une carte ESP32-S3 vierge, directement depuis le navigateur. Voir [Flash receiver (WebSerial)](#flash-receiver-webserial) plus bas.

Cette fonction est totalement à part : elle n'utilise que l'API publique du `Display` et ne modifie pas le moteur de rendu. Elle est réservée à l'itération de design ; le firmware final reste celui généré (`Projet.h`).

## Matériel

- Un ESP32-S3 (ou toute cible avec USB CDC natif).
- Un écran Lucarne câblé normalement.
- Un câble USB reliant la carte au PC.

## 1. Flasher le firmware de preview

Ouvrez `examples/LucarnePreview/LucarnePreview.ino`, ajustez les broches et options d'écran en haut (comme pour les autres exemples), puis flashez-le.

Sur ESP32-S3, dans les options de carte de l'IDE Arduino, activez **USB CDC On Boot: Enabled** : ainsi `Serial` correspond au port USB CDC natif auquel l'éditeur se connecte.

Important : ne faites aucun `Serial.print` dans ce sketch. Le port transporte le protocole binaire de preview ; tout octet superflu corromprait le flux. Laissez donc `options.debug = false`.

## Flash receiver (WebSerial)

Alternative à la compilation manuelle ci-dessus : le bouton **Flash receiver** de la barre d'outils ouvre un assistant qui flashe, directement depuis le navigateur (WebSerial + [`esptool-js`](https://github.com/espressif/esptool-js), sans passer par l'IDE Arduino), un firmware de réception Live précompilé sur une carte **ESP32-S3** vierge.

Les firmwares précompilés (protocole INFO v6) sont :

| Préréglage | Cible | Écran |
|------------|-------|-------|
| `esp32s3-st7789` | ESP32-S3 | ST7789 240×280 SPI |
| `esp32s3-st7796` | ESP32-S3, PSRAM OPI, flash 16 Mo | ST7796 320×480 SPI |
| `esp32s3-st7735` | ESP32-S3 | ST7735 SPI |
| `esp32s3-ili9342` | ESP32-S3 | ILI9342 SPI |
| `esp32s3-oled-i2c` | ESP32-S3 | SSD1306 I2C |
| `esp32s3-ssd1315-i2c` | ESP32-S3 | SSD1315 I2C |
| `esp32s3-hd44780` | ESP32-S3 | HD44780 4 bits |
| `esp32c3-st7789` | ESP32-C3 | ST7789 SPI |
| `esp32-st7789` | ESP32 | ST7789 SPI |
| `esp32p4-st7789` | ESP32-P4 | ST7789 SPI |

L'assistant demande un port série (Web Serial), synchronise/détecte la puce, puis écrit l'image précompilée (bootloader + partitions + app) avec une barre de progression. Les broches figées dans ces préréglages ne sont qu'un point de départ : une fois la carte connectée en **Live**, Studio envoie automatiquement la configuration réelle du projet via le message `HWCONFIG` (voir [Protocole](#protocole)), donc le binaire précompilé fonctionne quel que soit le câblage exact du projet, sans reflash.

Chaque ligne du tableau correspond au sketch `examples/LucarnePreview` (ou sa variante OLED / HD44780) compilé pour cette cible. L'assistant évite cette compilation.

## 2. Se connecter depuis l'éditeur

1. Ouvrez `editor/index.html` dans **Chrome** ou **Edge** sur PC (l'API Web Serial est requise ; elle n'existe pas sur Firefox/Safari).
2. Fermez tout moniteur série qui occuperait le port (l'IDE Arduino, par exemple).
3. Branchez la carte en **USB** (pas Bluetooth).
4. Cliquez sur **Live**, puis choisissez le port **USB** de la carte :
   - ESP32-S3 : souvent « USB Serial », « USB JTAG/serial », ou un COM avec fabricant Espressif.
   - **Ne sélectionnez pas** un port « Bluetooth » — il ne parle pas le protocole Live.
5. Si la liste filtrée est vide, le navigateur propose ensuite tous les ports : prenez le COM qui apparaît quand vous branchez/débranchez le câble USB.

Le bouton devient vert quand la carte a répondu au handshake (firmware `LucarnePreview` détecté).

## 3. Utiliser

Une fois connecté, l'écran reflète :

- l'écran ouvert dans le **Designer** (double-clic sur un nœud du blueprint) ;
- vos **modifications en direct** (déplacement de widget, couleurs, texte, thème, données) ;
- la **navigation dans le simulateur** (les changements d'écran s'affichent sur la carte).

Pour afficher une page précise : ouvrez-la dans le Designer, ou naviguez jusqu'à elle dans le simulateur.

## Détails techniques

- Transport : USB CDC. L'éditeur utilise l'API Web Serial.
- Le framebuffer est compressé en RLE (RGB565) avant envoi ; les aplats des UI se compressent fortement, donc chaque trame ne pèse en général que quelques Ko.
- Les trames sont coalescées côté éditeur : si l'USB n'a pas fini d'envoyer, seule la trame la plus récente est conservée. Pas d'accumulation de retard.
- Côté carte, le firmware décode la trame directement dans le framebuffer via l'API publique (`fillRect`), puis pousse la zone modifiée avec `display()`. Aucune allocation supplémentaire.
- Débit typique : quelques images par seconde en plein écran, largement suffisant pour le design. Les transitions du simulateur sont envoyées au fil de l'eau (avec drop des images en trop).

## Protocole

Paquet : `'L' 'P' type(1) flags(1) len(4 LE) payload(len) checksum(1 = XOR du payload)`.

| Type | Sens | Payload |
|------|------|---------|
| `0x01` HELLO | hôte -> carte | vide ; déclenche un INFO |
| `0x02` INFO | carte -> hôte | version(1), driver(1), width(2 LE), height(2 LE). v5+ ajoute maxFramePayload(2 LE), caps(1), reserved(1) — caps bit0 framebuffer plein, bit1 blit ligne directe. v6 accuse réception d'une frame après le rafraîchissement de la dalle |
| `0x03` PING | hôte -> carte | vide ; déclenche un INFO, comme HELLO |
| `0x04` SETUP | hôte -> carte | panelW(2 LE), panelH(2 LE), rotation(1) — taille native + rotation 0..3, appliquée via `Display::applyPanelConfig()` |
| `0x05` LOAD_REQ | hôte -> carte | chemin UTF-8 ; la carte lit le fichier (ex. sur SD) et répond par des paquets LOAD |
| `0x06` LOAD | carte -> hôte | flags(1), data… — bit0 = dernier chunk, bit1 = erreur |
| `0x07` HWCONFIG | hôte -> carte | cs(1) dc(1) rst(1) mosi(1) miso(1) sclk(1) bl(1) [int8, -1 = inutilisé], spiHz(4 LE), spiMode(1), colorOrder(1, 0=RGB/1=BGR), invert(1), panelW(2 LE), panelH(2 LE), rotation(1), blActiveLow(1, 0=HIGH=100 %, 1=LOW=100 %) — 20 octets (19 sans polarité BCK, défaut false) |
| `0x08` HWCONFIG_OLED | hôte -> carte | sda(1) scl(1) rst(1) addr(1), panelW(2 LE), panelH(2 LE), rotation(1), invert(1) — 12 octets |
| `0x09` HWCONFIG_MATRIX | hôte -> carte | rs, en, d4, d5, d6, d7, rw, bl (8 × int8), cols(1), rows(1), panelW(2 LE), panelH(2 LE), reserved(4), rotation(1), blActiveLow(1), reserved(1) — 21 octets |
| `0x10` FRAME | hôte -> carte | x(2), y(2), w(2), h(2), enc(1), data. Le bit 0 de `flags` demande l'affichage de la dalle après cette bande ; l'ACK part après ce rafraîchissement |
| `0x11` ACK | carte -> hôte | status(1) |

Encodages de trame : `enc = 0` brut RGB565 LE ; `enc = 1` RLE, suite de paires `[count(2 LE)][value(2 LE)]`. L'éditeur choisit RLE ou brut selon la taille la plus petite par bande.

## Compatibilité cartes et écrans

Le protocole Live est **indépendant du panneau** : `HWCONFIG` repasse par `Display::begin()` avec les broches et options de l'onglet Hardware (SPI RGB, ST7789/ST7796/ST7735/ILI9342, etc.). Un même firmware `LucarnePreview.ino` suffit si vous compilez pour votre MCU.

| Cible | Receiver précompilé | Vitesse Live conseillée | Notes |
|--------|---------------------|-------------------------|--------|
| ESP32-S3 + SPI TFT, OLED ou HD44780 | Oui | Turbo 2M / Realtime 3M (ST7796) | Flash receiver ou IDE |
| ESP32 / ESP32-C3 + ST7789 | Oui (`esp32-st7789`, `esp32c3-st7789`) | Fast–Turbo selon câblage | USB CDC On Boot |
| ESP32-P4 + ST7789 | Oui (`esp32p4-st7789`) | Turbo | MIPI : compiler le sketch, pas de binaire précompilé |
| RP2040 / RP2350 | Non | Balanced–Fast | TinyUSB Serial |
| ATmega32U4 | Non | Safe 115200 | Petits écrans, bandes courtes |

Studio adapte la taille des paquets (`live-profiles.js`) au baud, au MCU du projet Hardware et au champ INFO `maxFramePayload` (protocole v5). Après une erreur ou un changement d'écran, un **rafraîchissement plein écran** est envoyé pour éviter les images partielles figées.

### `HWCONFIG` — reconfiguration à chaud des broches

Studio envoie ce paquet juste après la connexion **Live** (avant la première `SETUP`/trame), avec les broches et options exactes de l'onglet Hardware du projet. Côté carte, `LivePreview::setReconfigureHandler(fn)` enregistre une fonction qui reçoit `DisplayPins`/`DisplayOptions` décodés et ré-exécute `Display::begin()` avec ces valeurs, avant de répondre par un `ACK` :

- `status = 0` — reconfiguration appliquée avec succès.
- `status = 1` — aucun handler enregistré (le paquet est accepté mais ignoré ; la carte garde ses broches compilées en dur).
- `status = 2` — `begin()` a échoué avec ces paramètres.

Ce mécanisme permet à un unique binaire précompilé (voir [Flash receiver](#flash-receiver-webserial)) de fonctionner avec n'importe quel câblage GPIO du projet, sans reflash : chaque édition d'une broche/option dans l'onglet Hardware pendant une session Live ré-envoie ce paquet.

### Variante SD (`LucarneLiveSD.h`)

`src/tools/LucarneLiveSD.h` fournit `liveLoadFromSd(path, preview)`, une implémentation prête à l'emploi du handler `LOAD_REQ` qui lit un fichier sur carte SD et le renvoie par blocs de 512 octets via `sendLoadChunk` :

```cpp
#include <Lucarne.h>
#include <LucarneLivePreview.h>
#include <LucarneLiveSD.h>

LivePreview preview(display, Serial);
preview.setLoadHandler(lucarne::liveLoadFromSd); // répond aux LOAD_REQ depuis la carte SD
```

Utile pour un firmware de preview qui sert aussi des assets SD (icônes/images) à la demande de l'éditeur plutôt que de tout embarquer.

## Dépannage

Lucarne Live utilise **USB** (câble), pas le Bluetooth. Sur Windows, ignorez les ports nommés « Bluetooth » ou « Standard Serial over Bluetooth ».

- **Bouton Live sans effet / erreur** : navigateur sans Web Serial. Utilisez Chrome ou Edge sur PC (pas Firefox/Safari). Le site doit être en `https://` ou `localhost`.
- **Liste de ports vide** : câble USB branché, pilote installé, carte alimentée. Débranchez/rebranchez. Essayez un autre câble (data, pas charge seule).
- **Port introuvable / annulé** : un moniteur série l'occupe déjà le port — fermez le moniteur série Arduino avant Live.
- **Connexion puis déconnexion immédiate** : mauvais port (souvent Bluetooth au lieu de USB), ou firmware absent. Flashez `LucarnePreview.ino` avec **USB CDC On Boot: Enabled**.
- **« Device did not answer »** : le port ouvert n'est pas Lucarne Preview (autre sketch, autre carte) ou le moniteur série envoie encore des données.
- **Vitesse série** : la valeur du menu (Turbo = 2 000 000 par défaut) doit correspondre à `Serial.begin(...)` dans `LucarnePreview.ino`.
- **Écran noir après connexion** : vérifiez que le firmware de preview est bien flashé et que `USB CDC On Boot` est activé.
- **Couleurs étranges** : alignez `colorOrder` / `invert` du sketch sur votre écran (mêmes réglages que les autres exemples).
