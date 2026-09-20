# Vérifications
Reconstruire _site en exécutant le bloc « Prepare site from ZIP » du workflow deploy-pages.yml.
Lancer `node --test tests/map-rendering.test.mjs` puis les contrôles de syntaxe du build.
Après publication : inspecter les styles calculés (flat, visible, auto), zoomer/dézoomer, déplacer dans les deux axes et recentrer ; vérifier les cartes et leurs interactions.
Tester idéalement également sur le téléphone Android signalant le défaut. Le navigateur distant ne reproduit pas exactement son pilote graphique.

Test mobile automatisé : viewport 360 × 700, carte étendue avec coordonnées négatives, cadrage complet, limite à 5 % et retour au zoom avant.
