# Prévention des régressions
Ne pas réintroduire preserve-3d, backface-visibility:hidden ou translate3d sur la caméra MAP : les surfaces coplanaires sont suspectées de provoquer les coupures intermittentes observées sur Android.
Ne pas appliquer overflow:hidden aux couches world/nodes/plusLayer : des descendants peuvent avoir des coordonnées négatives. Seul le viewport doit découper la scène à l'écran.
Les couches transparentes plein écran ne doivent pas bloquer les cartes : pointer-events:none sur les conteneurs, auto sur les cartes et boutons.
À chaque correction du rendu, incrémenter la version du cache généré dans le workflow.

Garder la même limite minimale pour fit(), zoomAt() et le pincement ; vérifier le cadrage sur un viewport de 360 px avec des projets à coordonnées négatives.


Le bouton ❤ Soutenir de MAP doit rester dans la topbar, dans la zone top-actions, et non en bas de l’écran : NYXEL et les commandes de zoom occupent déjà la zone basse droite. Sur mobile ≤ 600 px, masquer uniquement le libellé « Soutenir » et conserver le cœur tactile de 36 × 36 px. Vérifier que le script est copié/injecté par le workflow ZIP et présent dans le cache PWA.


Une MAP déjà ouverte peut rester sur l’ancien DOM même si GitHub Pages contient la nouvelle version. L’auto-update doit vérifier le service worker au chargement, au focus, sur `pageshow`, au retour en ligne/visible et périodiquement. Conserver `updateViaCache:'none'` et recharger sur `controllerchange`.
