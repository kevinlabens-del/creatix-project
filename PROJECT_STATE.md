# État du projet
Version du correctif : 1.16.43 (20 septembre 2026).
Correctif : suppression du contexte preserve-3d et des hints de masquage/promotion GPU forcés ; ordre explicite liaisons, cartes, boutons.
Publication : workflow GitHub Pages sur push main, avec tests Soutien obligatoires.
Limite : navigateur de vérification distant ; pas d'accès au GPU du téléphone ayant produit les captures.

Dézoom mobile : minimum 5 % (anciennement 22 %) ; le recentrage peut désormais cadrer la carte sur les petits écrans.

SOUTIEN : vignette déplacée au-dessus du nœud central ; emplacement retiré de la colonne Applications.

2026-09-20 — Correction des connexions : SOUTIEN reliée directement à root par un lien vertical indépendant. Ses anciens enfants directs (dont MOVIES) rejoignent Applications ; les autres hiérarchies restent inchangées.


2026-09-20 — Bouton CR3@TIX Soutien ajouté à la topbar. Position : zone top-actions, avant les boutons Centrer/Rechercher. Variante mobile compacte cœur seul. Le composant est injecté dans l’artifact GitHub Pages et précaché par le service worker v1.16.39.


2026-09-20 — v1.16.40 — auto-update renforcé : vérification du service worker au chargement, au focus, au retour `pageshow`, au retour en ligne, au retour visible et toutes les 2 minutes si l’application reste ouverte. Objectif : éviter qu’une ancienne interface reste affichée après un déploiement réussi.


2026-09-20 — v1.16.41 — topbar sans chevauchement : le bouton plein écran n’est plus `fixed` au-dessus des autres contrôles ; il rejoint `.top-actions`. Ordre mobile final : ❤ Soutien, plein écran, Centrer, Rechercher. Sous 430 px CSS, le libellé `PROJECT MAP` est masqué afin de réserver l’espace nécessaire aux quatre commandes.


2026-09-20 — v1.16.42 — topbar mobile en deux lignes. Le nom complet `CR3@TIX PROJECT MAP` est restauré et ne doit plus être masqué. Les boutons Plein écran et Recherche sont supprimés de la version publiée. La deuxième ligne contient uniquement `❤ Soutenir` avec son libellé visible et `Centrer`. Le bouton Soutenir reste éloigné de NYXEL.


2026-09-20 — v1.16.43 — restauration du layout original de la topbar après régression v1.16.42. Suppression totale de `topbar-layout.css` du build et du cache. La hauteur/structure d’origine de la MAP est conservée. Boutons Plein écran et Recherche restent supprimés ; `❤ Soutenir` avec texte visible et `Centrer` utilisent la topbar d’origine sans modifier le viewport.
