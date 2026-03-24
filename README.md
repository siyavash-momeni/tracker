# Tracker

Application Next.js de suivi d’habitudes avec :
- authentification utilisateur (Clerk),
- abonnements premium (Stripe),
- base de données PostgreSQL (Neon + Prisma),
- emails automatiques (Resend),
- notifications push web,
- tableau d’administration (`/admin`).

## Stack technique

- Next.js 16 (App Router)
- React 19 + TypeScript
- Prisma + PostgreSQL (Neon)
- Clerk (auth + metadata RBAC)
- Stripe (Checkout, webhook, portail client)
- Resend (emails)
- OpenAI (génération du contenu email quotidien)
- Web Push (VAPID)

## Fonctionnalités principales

- Gestion d’habitudes (création, suivi, stats)
- Notes utilisateur
- Dashboard de statistiques
- Abonnement premium (mensuel / annuel)
- Synchronisation Stripe via webhook
- Emails hebdomadaires automatiques
- Emails quotidiens IA automatiques
- Notifications push quotidiennes
- Interface admin protégée (`/admin`) avec vue des utilisateurs
- Toggle admin pour accorder/retirer `premiumGranted` par utilisateur

## Prérequis

- Node.js 20+
- npm
- Une base PostgreSQL (Neon recommandé)
- Comptes / clés : Clerk, Stripe, Resend, OpenAI (si email IA utilisé)

## Lancer le projet en local

1. Installer les dépendances :

```bash
npm install
```

2. Créer le fichier d’environnement à partir du template :

```bash
cp .env.exemple .env
```

3. Renseigner les variables dans `.env` (voir section dédiée ci-dessous).

4. Générer Prisma Client + appliquer les migrations :

```bash
npx prisma generate
npx prisma migrate dev
```

5. Démarrer le serveur de développement :

```bash
npm run dev
```

6. Ouvrir l’application :

- http://localhost:3000

## Scripts disponibles

- `npm run dev` : lance Next.js en développement
- `npm run build` : génère Prisma Client puis build Next.js
- `npm run start` : lance l’app buildée
- `npm run lint` : lance ESLint

## Variables d’environnement

Créer `.env` à partir de `.env.exemple`.

### Authentification Clerk

- `CLERK_WEBHOOK_SIGNING_SECRET` : vérification signature webhook Clerk
- `CLERK_SECRET_KEY` : clé serveur Clerk
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` : clé publique Clerk

### Base de données (Neon)

- `DATABASE_URL` : URL PostgreSQL utilisée par Prisma

### Stripe (billing)

- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` : clé publique Stripe (frontend)
- `STRIPE_SECRET_KEY` : clé privée Stripe (backend)
- `STRIPE_WEBHOOK_SECRET` : secret de signature webhook Stripe
- `STRIPE_PRICE_MONTHLY_ID` : Price ID mensuel
- `STRIPE_PRICE_YEARLY_ID` : Price ID annuel
- `APP_URL` : URL publique de l’application (retours Checkout / portail)

### Emails (Resend + OpenAI)

- `CRON_WEEKLY_EMAIL_SECRET` : secret cron email hebdomadaire
- `EMAIL_FROM` : expéditeur email (ex: `tracker <no-reply@tracker.app>`)
- `RESEND_API_KEY` : clé Resend
- `CRON_DAILY_AI_EMAIL_SECRET` : secret cron email IA quotidien
- `OPENAI_API_KEY` : clé OpenAI
- `SHOW_EMAIL_TEST_ACTIONS` : active les boutons de test email dans settings

### Notifications push

- `CRON_DAILY_PUSH_SECRET` : secret cron push quotidien
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` : clé publique VAPID (frontend)
- `VAPID_PRIVATE_KEY` : clé privée VAPID (backend)
- `VAPID_SUBJECT` : contact VAPID (`mailto:...`)

## Intégrations externes

### Clerk

Rôle : authentification, session utilisateur, RBAC admin via metadata.

- Utilisé côté serveur (`auth`, `currentUser`) et côté client (`useUser`).
- L’accès admin repose sur `publicMetadata.role === "admin"`.

Configurer un admin dans Clerk Dashboard > User > Metadata > Public metadata :

```json
{
  "role": "admin"
}
```

### Stripe

Rôle : gestion des abonnements premium.

- Endpoint de création checkout : `POST /api/stripe/checkout`
- Webhook de sync : `POST /api/stripe/webhook`
- Portail client : `POST /api/stripe/portal`
- Événements gérés :
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.payment_failed`

### Neon

Rôle : hébergement PostgreSQL.

- Prisma lit/écrit via `DATABASE_URL`.
- Les migrations sont versionnées dans `prisma/migrations`.

### Resend

Rôle : envoi des emails produits (hebdo / quotidien IA).

- Email hebdomadaire : `GET /api/cron/weekly-email`
- Email quotidien IA : `GET /api/cron/daily-ai-email`
- Les endpoints de cron sont protégés par secret (`x-cron-secret` ou `Authorization: Bearer ...`).

## Cron et tests manuels

### Hebdomadaire

- Endpoint : `GET /api/cron/weekly-email`
- Auth : `CRON_WEEKLY_EMAIL_SECRET`
- Test ciblé : `GET /api/cron/weekly-email?testTo=ton-email@domaine.com`

### Quotidien IA

- Endpoint : `GET /api/cron/daily-ai-email`
- Auth : `CRON_DAILY_AI_EMAIL_SECRET`
- Test ciblé : `GET /api/cron/daily-ai-email?testTo=ton-email@domaine.com`

### Push quotidien

- Endpoint : `GET /api/cron/daily-push`
- Auth : `CRON_DAILY_PUSH_SECRET`

## Administration (`/admin`)

- Route UI : `GET /admin`
- API listage users : `GET /api/admin/users`
- API toggle premium manuel : `PATCH /api/admin/users/{userId}/premium`
- Accès strictement réservé aux utilisateurs admin Clerk.

Informations visibles dans l’interface :
- email
- date d’inscription
- statut d’abonnement
- rôle utilisateur (via metadata Clerk pour l’accès)
- état premium accordé (`premiumGranted`)

## Notes utiles

- Le projet utilise les routes API Next.js (`app/api/**`).
- Le build exécute `prisma generate` automatiquement.
- En preview/dev Clerk, les adresses email OAuth peuvent être masquées/sanitisées selon la config Clerk.
