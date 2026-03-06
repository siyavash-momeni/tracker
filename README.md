## Variables d'environnement

Pour configurer le projet, tu dois créer un fichier `.env` à partir du template fourni `.env.exemple`.
 - "DATABASE_URL=" se trouve dans la bdd Neon

### Variables pour l'envoi hebdomadaire d'email

- `CRON_WEEKLY_EMAIL_SECRET=` : secret partagé entre le scheduler et l'API cron
- `RESEND_API_KEY=` : clé API Resend
- `EMAIL_FROM=` : adresse expéditrice (ex: `Kusari <no-reply@kusari.app>`)

### Variables pour l'envoi quotidien IA

- `CRON_DAILY_AI_EMAIL_SECRET=` : secret partagé pour le cron quotidien IA
- `OPENAI_API_KEY=` : clé API OpenAI utilisée pour générer le message quotidien

### Cron hebdomadaire

Planifier un appel hebdomadaire vers:

- `GET /api/cron/weekly-email`

Le secret doit être envoyé soit:

- dans le header `x-cron-secret`, ou
- dans `Authorization: Bearer <CRON_WEEKLY_EMAIL_SECRET>`

### Envoi test

Pour valider l'intégration Resend, appeler:

- `GET /api/cron/weekly-email?testTo=ton-email@domaine.com`

avec le même secret de cron.

### Cron quotidien IA

Planifier un appel quotidien vers:

- `GET /api/cron/daily-ai-email`

Le secret doit être envoyé soit:

- dans le header `x-cron-secret`, ou
- dans `Authorization: Bearer <CRON_DAILY_AI_EMAIL_SECRET>`

### Envoi test (quotidien IA)

Pour valider l'intégration OpenAI + Resend, appeler:

- `GET /api/cron/daily-ai-email?testTo=ton-email@domaine.com`

avec le secret `CRON_DAILY_AI_EMAIL_SECRET`.
