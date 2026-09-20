# Demandes
2026-09-20 — Kev demande de trouver pourquoi certaines vignettes sont coupées par intermittence, corriger et republier creatix-project. Trois captures Android fournies.
Périmètre : rendu de la carte et renouvellement du cache de l'application ; conserver contenus et identité visuelle.

2026-09-20 — Kev demande de pouvoir dézoomer davantage sur mobile pour voir toute la carte. Dézoom minimum de 5 %, applicable aux trois chemins de zoom.

2026-09-20 — À la demande de Kev, SOUTIEN est positionnée au-dessus de la vignette centrale CR3@TIX, à la même abscisse et 370 px plus haut. Placement recalculé après chaque chargement des projets.

2026-09-20 — Correction des connexions : SOUTIEN reliée directement à root par un lien vertical indépendant. Ses anciens enfants directs (dont MOVIES) rejoignent Applications ; les autres hiérarchies restent inchangées.


2026-09-20 — Kev demande d’ajouter le bouton CR3@TIX Soutien à CR3@TIX Project en évitant toute interférence avec NYXEL. Choix : intégration dans la barre supérieure top-actions, avant Centrer/Rechercher ; libellé complet sur écran large, cœur seul sur mobile. Ajout au pipeline ZIP, au cache PWA et aux tests de rendu.


2026-09-20 — Kev signale ne pas voir le nouveau bouton malgré un déploiement réussi. Vérification de l’artefact Pages : bouton et cache v1.16.39 bien présents ; la capture correspond à un client déjà ouvert sur l’ancien DOM. Action : v1.16.40, auto-update renforcé au focus/pageshow/online/visible et toutes les 2 minutes.


2026-09-20 — Nouvelle capture mobile : le bouton Soutien reste invisible. Diagnostic sur l’artefact publié : le bouton plein écran était `position:fixed; right:101px`, exactement au-dessus de la place du cœur Soutien injecté dans `.top-actions`. Correction v1.16.41 : plein écran déplacé dans `.top-actions`, libellé PROJECT MAP masqué sous 430 px pour garantir quatre commandes visibles.


2026-09-20 — Kev refuse le compromis cœur seul + nom tronqué. Décision v1.16.42 : topbar mobile en deux lignes, nom complet `CR3@TIX PROJECT MAP`, bouton `❤ Soutenir` avec texte visible, bouton Centrer conservé, Plein écran et Recherche supprimés.


2026-09-20 — Capture montrant une régression sévère après v1.16.42 : cadrage MAP cassé, grosse carte seule visible. Diagnostic : la topbar à deux lignes a modifié la géométrie du viewport. v1.16.43 : rollback du layout à deux lignes, suppression de topbar-layout.css, retour à la topbar originale ; Soutenir + Centrer uniquement.
