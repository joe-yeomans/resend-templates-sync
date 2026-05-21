# resend-templates-sync

Sync React Email components to Resend templates.

This package is for apps that want to use React Email but do not have a TypeScript or React runtime in the backend.

For example, a Rails, Laravel, Django, Phoenix, Go, or .NET backend can send Resend template emails while the templates themselves live in a small TypeScript project. Run `resend-templates-sync` as a build, deploy, or release step, then send emails from your backend using Resend template IDs, aliases, and variables.

No rendering React inside your backend. No checked-in generated HTML. No custom script glued to your application runtime.

## Installation

```bash
npm install resend-templates-sync
```

## Usage

Create your email templates with React Email, then sync them to Resend:

```tsx
import { Resend } from "resend";
import { sync } from "resend-templates-sync";
import WelcomeEmail from "./emails/welcome";

const resend = new Resend(process.env.RESEND_API_KEY);

const result = await sync(resend, [
    {
        name: "Welcome Email",
        alias: "welcome-email",
        component: WelcomeEmail,
        props: {
            name: "Ada",
        },
        subject: "Welcome to Acme",
        from: "Acme <hello@acme.com>",
        variables: [
            {
                key: "CUSTOMER_NAME",
                type: "string",
                fallbackValue: "there",
            },
        ],
    },
]);

console.log(result.created);
console.log(result.updated);
console.log(result.published);
console.log(result.errors);
```

After syncing, your backend can send email through Resend using the template alias and variables, without needing to know anything about React Email.

For example, any backend that can make an HTTP request can send the published template:

```bash
curl -X POST "https://api.resend.com/emails" \
  -H "Authorization: Bearer re_xxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "from": "Acme <hello@acme.com>",
    "to": ["user@example.com"],
    "template": {
      "id": "welcome-email",
      "variables": {
        "CUSTOMER_NAME": "Ada"
      }
    }
  }'
```

`template.id` can be the published template ID or alias. When sending with a template, do not also send `html`, `text`, or `react`.

## API

### `sync(resendOrOptions, templates)`

Creates or updates Resend templates from React Email components. This is usually run from a TypeScript script in CI, during deployment, or manually before releasing backend changes that depend on new email templates.

```ts
await sync(resend, templates);
await sync({ resend, publish: true }, templates);
```

#### Options

The first argument can be an initialized Resend client, or an options object when you want to configure publishing.

```ts
interface SyncOptions {
    resend: Resend;
    publish?: boolean | "created" | "updated" | "all";
}
```

- `resend`: an initialized Resend client.
- `publish`: optionally publish templates after syncing.

Publish behavior:

- `false` or omitted: do not publish.
- `true` or `"all"`: publish created and updated templates.
- `"created"`: publish only newly created templates.
- `"updated"`: publish only updated templates.

#### Templates

```ts
interface TemplateConfig<Props = Record<string, unknown>> {
    name: string;
    component: ComponentType<Props>;
    props?: Props;
    subject?: string;
    text?: string;
    alias?: string;
    from?: string;
    replyTo?: string[] | string;
    variables?: TemplateVariable[];
}
```

Templates are matched by `alias` when provided, then by `name`.

`component` is rendered to HTML with `@react-email/render`. The rendered HTML is sent to Resend as the template body.

```ts
type TemplateVariable =
    | {
          key: string;
          type: "string";
          fallbackValue?: string | null;
      }
    | {
          key: string;
          type: "number";
          fallbackValue?: number | null;
      };
```

#### Result

```ts
interface SyncResult {
    created: SyncedTemplate[];
    updated: SyncedTemplate[];
    published: SyncedTemplate[];
    errors: Array<{ name: string; error: Error }>;
}

interface SyncedTemplate {
    id: string;
    name: string;
    alias: string | null;
}
```

Template-level failures are collected in `errors` so the remaining templates can continue syncing.

## Behavior

1. Lists existing Resend templates using cursor pagination.
2. Matches templates by `alias` first, then `name`.
3. Renders each React Email component to HTML.
4. Creates missing templates and updates existing templates.
5. Optionally publishes created or updated templates.
6. Returns a summary of created, updated, published, and failed templates.

## Limitations

- Templates are never deleted from Resend.
- Publishing is opt-in.
- The package does not run live API tests against Resend.
- Your application backend still sends emails through Resend; this package only syncs template definitions.

## Example

See [`example`](./example) for a minimal project that syncs a React Email component to Resend.

## License

MIT
