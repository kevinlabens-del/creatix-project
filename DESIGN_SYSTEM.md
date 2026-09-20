# Identité visuelle
Fond galaxie sombre, cartes vert sombre, contours néon bleu/violet, actions vert clair, NYXEL en bas à droite.
Le contenu de la carte est une scène 2D : liaisons sous les cartes, commandes au-dessus. Les cartes hors des limites logiques de world doivent rester visibles dans le viewport.


Le bouton Soutien appartient à la topbar (zone top-actions) : bouton sombre compact, cœur rose et texte « Soutenir » visible sur toutes les tailles. Ne pas le positionner en bas à droite, zone réservée à NYXEL et aux commandes de zoom.


Tous les contrôles de la topbar doivent appartenir au même flux `.top-actions` : ❤ Soutien, plein écran, Centrer, Rechercher. Aucun contrôle ne doit être positionné en `fixed` par-dessus cette zone. Sous 430 px, le texte secondaire `PROJECT MAP` peut être masqué pour préserver les commandes.


Mobile v1.16.42 : topbar en deux lignes. Ligne 1 = identité complète `CR3@TIX PROJECT MAP`. Ligne 2 = actions utiles `❤ Soutenir` et Centrer. Ne jamais masquer `PROJECT MAP` pour gagner de la place ; supprimer ou déplacer les commandes secondaires à la place.


La topbar MAP conserve sa géométrie d’origine sur toutes les tailles. Ne pas la transformer en grid/deux lignes et ne pas modifier sa hauteur pour ajouter une action. Les actions autorisées publiquement sont `❤ Soutenir` et Centrer ; le nom complet `CR3@TIX PROJECT MAP` reste visible.
