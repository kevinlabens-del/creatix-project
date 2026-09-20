# Identité visuelle
Fond galaxie sombre, cartes vert sombre, contours néon bleu/violet, actions vert clair, NYXEL en bas à droite.
Le contenu de la carte est une scène 2D : liaisons sous les cartes, commandes au-dessus. Les cartes hors des limites logiques de world doivent rester visibles dans le viewport.


Le bouton Soutien appartient à la topbar (zone top-actions) : bouton sombre compact, cœur rose, texte « Soutenir » sur écran large et cœur seul sur mobile. Ne pas le positionner en bas à droite, zone réservée à NYXEL et aux commandes de zoom.


Tous les contrôles de la topbar doivent appartenir au même flux `.top-actions` : ❤ Soutien, plein écran, Centrer, Rechercher. Aucun contrôle ne doit être positionné en `fixed` par-dessus cette zone. Sous 430 px, le texte secondaire `PROJECT MAP` peut être masqué pour préserver les commandes.
