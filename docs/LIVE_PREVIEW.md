# Live preview (USB)

Le live preview affiche en temps réel, sur un vrai écran, ce que vous concevez dans Lucarne Studio. L'éditeur calcule le rendu (pixel-exact) et envoie le framebuffer à l'ESP32 par USB ; la carte ne fait que décoder et afficher. Aucune interaction n'a lieu côté carte.

Cette fonction est totalement à part : elle n'utilise que l'API publique du `Display` et ne modifie pas le moteur de rendu. Elle est réservée à l'itération de design ; le firmware final reste celui généré (`Projet.h`).

## Matériel

- Un ESP32-S3 (ou toute cible avec USB CDC natif).
- Un écran Lucarne câblé normalement.
- Un câble USB reliant la carte au PC.

## 1. Flasher le firmware de preview

Ouvrez `examples/LucarnePreview/LucarnePreview.ino`, ajustez les broches et options d'écran en haut (comme pour les autres exemples), puis flashez-le.

Sur ESP32-S3, dans les options de carte de l'IDE Arduino, activez **USB CDC On Boot: Enabled** : ainsi `Serial` correspond au port USB CDC natif auquel l'éditeur se connecte.

Important : ne faites aucun `Serial.print` dans ce sketch. Le port transporte le protocole binaire de preview ; tout octet superflu corromprait le flux. Laissez donc `options.debug = false`.

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
| `0x02` INFO | carte -> hôte | version(1), driver(1), width(2 LE), height(2 LE) |
| `0x10` FRAME | hôte -> carte | x(2), y(2), w(2), h(2), enc(1), data |
| `0x11` ACK | carte -> hôte | status(1) |

Encodages de trame : `enc = 0` brut RGB565 LE ; `enc = 1` RLE, suite de paires `[count(2 LE)][value(2 LE)]`. L'éditeur envoie toujours du RLE.

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
