# CR3@TIX SOUTIEN — Worker PayPal sécurisé

API Cloudflare Workers + D1 de CR3@TIX SOUTIEN. Le frontend reste sur GitHub
Pages et ne contient aucun secret ni aucune donnée bancaire.

## Architecture de confiance

1. Le navigateur choisit un projet issu de CR3@TIX MAP et envoie un UUID unique.
2. Le Worker revalide l’origine, le projet, le montant, l’anonymat et le consentement.
3. D1 crée une intention `pending` avant de produire le formulaire PayPal.
4. Le navigateur transmet directement ce formulaire HTTPS à PayPal.
5. Le retour navigateur n’accorde jamais le statut `paid`.
6. PayPal envoie une IPN au Worker ; celui-ci renvoie le corps exact à PayPal
   avec `cmd=_notify-validate` et exige la réponse `VERIFIED`.
7. Le Worker contrôle ensuite le bénéficiaire, l’identifiant de transaction,
   l’UUID, la facture, le projet, la devise et le montant avant confirmation.

Les événements sont idempotents. Les doublons, relectures, champs critiques
dupliqués et incohérences de montant sont rejetés. Les numéros de carte et les
cryptogrammes ne transitent dans aucune route CR3@TIX.

## Développement local

```bash
npm ci
cp .dev.vars.example .dev.vars
npm run db:local
npm run check
npm run dev
```

Ne jamais committer `.dev.vars`, un mot de passe, un secret administrateur ou
un jeton Cloudflare.

## Modes de paiement

- `disabled` : aucun paiement ; projets, statistiques et admin restent disponibles.
- `test` : PayPal Sandbox avec un compte personnel Sandbox.
- `live` : PayPal réel, uniquement si `ALLOW_LIVE_PAYMENTS=yes` est aussi défini.

Secrets GitHub Actions prévus :

- `PAYPAL_BUSINESS_ID` : Payer ID PayPal du bénéficiaire, de préférence à une adresse email ;
- `PAYPAL_RECEIVER_ID` : Payer ID attendu dans l’IPN ;
- `PAYPAL_RECEIVER_EMAIL` : alternative lorsque PayPal ne fournit qu’une adresse ;
- `SOUTIEN_PAYMENT_MODE` : `disabled`, `test` ou `live` ;
- `ALLOW_LIVE_PAYMENTS` : `yes` seulement pour une activation réelle volontaire.

Le `PAYPAL_BUSINESS_ID` est nécessairement envoyé au navigateur dans le
formulaire PayPal ; il ne doit pas être confondu avec un mot de passe ou une clé
d’API. Aucun secret PayPal permettant de prendre le contrôle du compte n’est
utilisé par cette intégration.

L’URL IPN est placée dans chaque formulaire (`notify_url`) :
`https://cr3atix-soutien-api.creatixprojet.workers.dev/v1/webhooks/paypal`.

## Compte personnel et activation réelle

Le Donate SDK PayPal documente l’utilisation d’un compte personnel via le champ
`business`. L’éligibilité réelle reste toutefois décidée par PayPal selon le
compte et l’usage. Le workflow garde donc le réel fermé tant que les deux verrous
`SOUTIEN_PAYMENT_MODE=live` et `ALLOW_LIVE_PAYMENTS=yes` ne sont pas présents.

Ce choix technique ne garantit ni absence d’impôt, ni absence de déclaration,
ni absence future de statut professionnel. Si PayPal exige un compte Business
ou un numéro d’entreprise, le mode réel doit rester désactivé.

## Administration

Le mot de passe administrateur est vérifié par HMAC-SHA-256 avec un pepper
aléatoire. Les sessions expirent après 30 minutes, les exports CSV neutralisent
les formules de tableur et aucune adresse IP brute n’est conservée dans les
transactions.
