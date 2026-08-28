# CR3@TIX SOUTIEN — Worker sécurisé

API Cloudflare Workers + D1 pour le mode TEST Stripe Checkout de CR3@TIX SOUTIEN.

## Séparation des responsabilités

- GitHub Pages affiche l’interface et ne contient aucun secret.
- Le Worker valide le projet et le montant, puis crée la session Stripe.
- Stripe héberge la saisie bancaire.
- D1 ne confirme une contribution qu’après webhook Stripe signé.
- Le mode réel exige trois verrous serveur : `PAYMENT_MODE=live`, `ALLOW_LIVE_PAYMENTS=yes` et un `LEGAL_APPROVAL_ID` documenté.

## Flux de confiance

1. Le navigateur envoie un identifiant UUID unique, le projet MAP et le montant.
2. Le Worker revalide origine, UUID, bornes, consentement et projet auprès de MAP.
3. D1 réserve l’identifiant d’idempotence avant l’appel au prestataire.
4. Stripe Checkout héberge toute saisie de carte.
5. Le retour navigateur n’accorde aucun statut payé.
6. Seul un événement Stripe signé, non rejoué et dont montant/devise/session correspondent à D1 fait passer la contribution à `paid`.

Les numéros de carte et cryptogrammes ne transitent dans aucune route CR3@TIX.

## Développement local

```bash
npm ci
cp .dev.vars.example .dev.vars
npm run db:local
npm run dev
npm run check
```

Ne jamais committer `.dev.vars`, une clé Stripe, un secret webhook, un mot de passe ou un jeton Cloudflare.

## Déploiement Cloudflare en mode verrouillé

Prérequis : compte Cloudflare authentifié dans Wrangler.

```bash
npx wrangler d1 create cr3atix-soutien-db
```

Reporter l’identifiant retourné dans `wrangler.jsonc`, puis :

```bash
npx wrangler d1 migrations apply cr3atix-soutien-db --remote
npx wrangler secret put SESSION_SECRET
npx wrangler secret put RATE_LIMIT_SALT
npx wrangler secret put ADMIN_PASSWORD_PEPPER
npx wrangler secret put ADMIN_PASSWORD_HASH
npm run deploy
```

`SESSION_SECRET` et `RATE_LIMIT_SALT` doivent être différents et aléatoires. Le
mot de passe administrateur doit contenir au moins 14 caractères. Il est vérifié
par HMAC-SHA-256 avec un pepper aléatoire de 256 bits : le pepper et le résultat
HMAC sont stockés séparément comme secrets Worker (`ADMIN_PASSWORD_PEPPER` et
`ADMIN_PASSWORD_HASH`). Aucun des deux ne doit être écrit dans le dépôt.

Pour une configuration manuelle, générer le pepper avec `openssl rand -hex 32`,
puis lancer `npm run hash-admin` en transmettant uniquement
`CR3ATIX_ADMIN_PASSWORD` et `ADMIN_PASSWORD_PEPPER` dans l’environnement local.
Le workflow de production effectue cette opération et charge les secrets avec le
code dans une même version Cloudflare. La connexion reste limitée à cinq essais
par minute et la session expire après 30 minutes. Cette vérification légère évite
le dépassement des 10 ms CPU du forfait Workers Free rencontré avec PBKDF2.

Après déploiement, reporter l’URL exacte du Worker dans `soutien/config.js`. Le
frontend devient alors capable d’afficher santé, statistiques et administration,
mais `PAYMENT_MODE=disabled` continue de refuser toute création de paiement.

## Activation Stripe TEST

Ne créer un compte Stripe qu’après avoir vérifié l’éligibilité du bénéficiaire
réel. Les conditions Stripe visent une entreprise (y compris entrepreneur
individuel), une entité publique ou un organisme à but non lucratif, sous
réserve d’approbation ; certaines collectes de fonds sont restreintes. Un
particulier français sans statut ne doit donc pas être supposé éligible.

Après acceptation explicite du compte, utiliser exclusivement les identifiants de test :

```bash
npx wrangler secret put STRIPE_SECRET_KEY
npx wrangler secret put STRIPE_WEBHOOK_SECRET
```

Configurer dans Stripe un webhook vers
`https://<worker>/v1/webhooks/stripe` pour les événements :

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`
- `checkout.session.expired`
- `payment_intent.payment_failed`
- `charge.refunded`

Passer ensuite `PAYMENT_MODE` à `test` dans `wrangler.jsonc` et redéployer. Une
clé commençant par `sk_live_` n’est pas acceptée pour ce mode.

Ne définir `TURNSTILE_SECRET_KEY` qu’après avoir connecté un widget Turnstile au
frontend ; sinon les checkouts seront volontairement refusés.

## Passage TEST → RÉEL

Le code exige simultanément :

- `PAYMENT_MODE=live` ;
- une clé Stripe `sk_live_` et le secret du webhook live ;
- le secret `ALLOW_LIVE_PAYMENTS=yes` ;
- un `LEGAL_APPROVAL_ID` d’au moins huit caractères documentant la validation ;
- les mentions d’identité, contact, conservation et droits complétées dans le frontend.

Ces verrous techniques ne remplacent pas la validation fiscale, sociale,
réglementaire et contractuelle. Pour une personne physique en France, ne pas les
ouvrir avant une position adaptée aux faits (notamment rescrit ou conseil
professionnel), les déclarations nécessaires et l’acceptation du prestataire.

## Administration et conservation

Les sessions administrateur expirent après 30 minutes et seul leur condensat est
stocké. Les exports CSV neutralisent les formules de tableur. Une tâche planifiée
supprime les jetons expirés et les traces anti-abus courtes ; les transactions ne
sont pas supprimées automatiquement, afin de permettre une politique de
conservation conforme aux obligations réellement applicables avant le réel.
