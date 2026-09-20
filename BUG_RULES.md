# Prévention des régressions
Ne pas réintroduire preserve-3d, backface-visibility:hidden ou translate3d sur la caméra MAP : les surfaces coplanaires sont suspectées de provoquer les coupures intermittentes observées sur Android.
Ne pas appliquer overflow:hidden aux couches world/nodes/plusLayer : des descendants peuvent avoir des coordonnées négatives. Seul le viewport doit découper la scène à l'écran.
Les couches transparentes plein écran ne doivent pas bloquer les cartes : pointer-events:none sur les conteneurs, auto sur les cartes et boutons.
À chaque correction du rendu, incrémenter la version du cache généré dans le workflow.

Garder la même limite minimale pour fit(), zoomAt() et le pincement ; vérifier le cadrage sur un viewport de 360 px avec des projets à coordonnées négatives.


Le bouton ❤ Soutenir de MAP doit rester dans la topbar, dans la zone top-actions, et non en bas de l’écran : NYXEL et les commandes de zoom occupent déjà la zone basse droite. Sur mobile, le libellé « Soutenir » doit rester visible. Si l’espace manque, utiliser une topbar en deux lignes plutôt que masquer `PROJECT MAP` ou le texte du bouton Soutien. Vérifier que le script est copié/injecté par le workflow ZIP et présent dans le cache PWA.


Une MAP déjà ouverte peut rester sur l’ancien DOM même si GitHub Pages contient la nouvelle version. L’auto-update doit vérifier le service worker au chargement, au focus, sur `pageshow`, au retour en ligne/visible et périodiquement. Conserver `updateViaCache:'none'` et recharger sur `controllerchange`.


Ne jamais repositionner le plein écran en `fixed` au-dessus de la topbar : il peut recouvrir le bouton Soutien. Tous les contrôles d’en-tête doivent partager `.top-actions`. Sous 430 px, réduire l’encombrement de la marque avant de masquer une commande interactive.


Les boutons Plein écran et Recherche ont été retirés de la topbar publique v1.16.42 car ils n’apportent pas assez de valeur sur mobile. Ne pas les réintroduire sans demande explicite. Le nom `CR3@TIX PROJECT MAP` doit toujours rester visible en entier.
