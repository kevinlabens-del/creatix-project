# CR3@TIX MAP

Tableau de bord central de l’écosystème CR3@TIX.

Le déploiement GitHub Pages ajoute automatiquement NYXEL à gauche des boutons de
zoom. Le widget reste autonome dans `nyxel-widget/`; son adaptation à la carte se
trouve dans `nyxel-map.css`.

## CR3@TIX SOUTIEN

L’application mobile-first est publiée dans `soutien/`. Elle lit directement
le registre public Supabase de MAP et utilise `projects.json`, généré à chaque
déploiement, uniquement comme instantané de secours. Le backend sécurisé se
trouve dans `soutien-worker/`.

Les paiements réels sont désactivés par défaut. Consulte
[`soutien-worker/README.md`](soutien-worker/README.md) avant toute configuration
Stripe ou Cloudflare.
