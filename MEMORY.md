# Mémoire du projet
MAP est une carte panoramique de projets, avec zoom, fond galaxie, cadres néon et widget NYXEL.
Hébergement : GitHub Pages, branche main. Les données publiques sont chargées par remote-admin.js ; ne pas les remplacer pour un correctif visuel.
Le 20 septembre 2026, signalement de vignettes partiellement coupées pendant les déplacements sur Android. Correctif v1.16.35 : rendu plat et caméra 2D.

Version 1.16.36 : limite de dézoom abaissée de 22 % à 5 % pour recentrage, boutons/molette et pincement mobile.

2026-09-20 — À la demande de Kev, SOUTIEN est positionnée au-dessus de la vignette centrale CR3@TIX, à la même abscisse et 370 px plus haut. Placement recalculé après chaque chargement des projets.

2026-09-20 — Correction des connexions : SOUTIEN reliée directement à root par un lien vertical indépendant. Ses anciens enfants directs (dont MOVIES) rejoignent Applications ; les autres hiérarchies restent inchangées.


2026-09-20 — Le bouton ❤ Soutenir est intégré à la barre du haut de CR3@TIX Project Map, dans la zone top-actions, avant Centrer/Rechercher. Sur mobile ≤ 600 px, seul le cœur reste visible pour préserver l’espace. NYXEL reste en bas à droite : le bouton Soutien ne doit jamais être replacé dans cette zone.


2026-09-20 — v1.16.40 : auto-update vérifié au focus, pageshow, online, retour visible et toutes les 2 minutes afin que les clients déjà ouverts récupèrent rapidement les nouveaux déploiements.


2026-09-20 — v1.16.41 : tous les contrôles du haut partagent `top-actions`. Le plein écran ne flotte plus au-dessus du bouton Soutien. Sous 430 px, `PROJECT MAP` est masqué pour préserver les quatre commandes.


2026-09-20 — v1.16.42 : nom complet `CR3@TIX PROJECT MAP` toujours visible. Sur mobile, topbar en deux lignes ; deuxième ligne = `❤ Soutenir` + Centrer. Plein écran et Recherche retirés. Le libellé Soutenir ne doit plus être masqué.


2026-09-20 — v1.16.43 : ne jamais modifier la hauteur de la topbar de MAP. La tentative deux lignes a cassé le cadrage. Topbar originale conservée ; seules les commandes inutiles sont supprimées. `❤ Soutenir` garde son texte et cohabite avec Centrer.
