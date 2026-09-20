# Prévention des régressions
Ne pas réintroduire preserve-3d, backface-visibility:hidden ou translate3d sur la caméra MAP : les surfaces coplanaires sont suspectées de provoquer les coupures intermittentes observées sur Android.
Ne pas appliquer overflow:hidden aux couches world/nodes/plusLayer : des descendants peuvent avoir des coordonnées négatives. Seul le viewport doit découper la scène à l'écran.
Les couches transparentes plein écran ne doivent pas bloquer les cartes : pointer-events:none sur les conteneurs, auto sur les cartes et boutons.
À chaque correction du rendu, incrémenter la version du cache généré dans le workflow.
