import type { ComponentType } from "react";
import type { Resend } from "resend";

export type PublishMode = boolean | "created" | "updated" | "all";

export type TemplateVariable =
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

export interface TemplateConfig<Props = Record<string, unknown>> {
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

export interface SyncOptions {
    resend: Resend;
    publish?: PublishMode;
}

export interface SyncedTemplate {
    id: string;
    name: string;
    alias: string | null;
}

export interface SyncResult {
    created: SyncedTemplate[];
    updated: SyncedTemplate[];
    published: SyncedTemplate[];
    errors: Array<{ name: string; error: Error }>;
}
