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

1. Ouvrez `editor/index.html` dans **Chrome** ou **Edge** (l'API Web Serial est requise ; elle n'existe pas sur Firefox/Safari).
2. Fermez tout moniteur série qui occuperait le port (l'IDE Arduino, par exemple).
3. Cliquez sur **Live** dans la barre du haut, puis sélectionnez le port de la carte.

Le bouton devient vert quand la connexion est établie.

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

- **Bouton Live sans effet / erreur** : navigateur sans Web Serial. Utilisez Chrome ou Edge.
- **Port introuvable** : un moniteur série l'occupe. Fermez-le.
- **Écran noir après connexion** : vérifiez que le firmware de preview est bien flashé et que `USB CDC On Boot` est activé.
- **Couleurs étranges** : alignez `colorOrder` / `invert` du sketch sur votre écran (mêmes réglages que les autres exemples).
