# resend-templates-sync example

This example syncs a React Email component to a Resend template.

## Run it

From this directory:

```bash
npm install
cp .env.example .env
npm run sync
```

Set `RESEND_API_KEY` and `EMAIL_FROM` in `.env` before running the sync command.

The example uses `publish: false`, so the template is created or updated as a draft.
