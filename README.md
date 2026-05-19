# resend-templates-sync

Sync React Email components to Resend templates.

Use this when you want template definitions to live in source control instead of manually copying HTML into the Resend dashboard.

## Installation

```bash
npm install resend-templates-sync
```

## Usage

```tsx
import { Resend } from "resend";
import { sync } from "resend-templates-sync";
import WelcomeEmail from "./emails/welcome";

const resend = new Resend(process.env.RESEND_API_KEY);

const result = await sync(
  {
    resend,
    publish: false,
  },
  [
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
  ],
);

console.log(result.created);
console.log(result.updated);
console.log(result.published);
console.log(result.errors);
```

## API

### `sync(options, templates)`

Creates or updates Resend templates from React Email components.

```ts
await sync(options, templates);
```

#### Options

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

## Example

See [`example`](./example) for a minimal project that syncs a React Email component to Resend.

## License

MIT
