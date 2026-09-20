# Architecture
ZIP historique → extraction _site → surcharges JS/CSS racine et adaptations du workflow → manifeste des projets → artifact GitHub Pages.
app.js extrait gère les cartes, la caméra et les gestes. auto-layout.js gère la disposition. remote-admin.js gère les données et l'administration. cosmic-background.css définit le fond et la composition 2D. neon-cards.js ajoute les cadres.
Les dossiers soutien/ et soutien-worker/ sont des composants existants indépendants ; leur suite de tests bloque le déploiement en cas d'échec.
