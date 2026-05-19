import { render } from "@react-email/render";
import React from "react";
import type { Resend } from "resend";
import type { SyncOptions, SyncResult, SyncedTemplate, TemplateConfig } from "./types.js";

interface ExistingTemplate {
  id: string;
  name: string;
  alias: string | null;
}

export async function sync(options: SyncOptions, templates: TemplateConfig[]): Promise<SyncResult> {
  const result: SyncResult = {
    created: [],
    updated: [],
    published: [],
    errors: [],
  };

  const existingTemplates = await listTemplates(options.resend);

  for (const template of templates) {
    try {
      const html = await render(React.createElement(template.component, template.props ?? {}));
      const existingTemplate = findExistingTemplate(existingTemplates, template);

      if (existingTemplate) {
        const response = await options.resend.templates.update(existingTemplate.id, {
          html,
          subject: template.subject,
          text: template.text,
          alias: template.alias,
          from: template.from,
          replyTo: template.replyTo,
          variables: template.variables,
        });

        if (response.error) {
          throw new Error(response.error.message);
        }

        const syncedTemplate = toSyncedTemplate(response.data.id, template, existingTemplate);

        result.updated.push(syncedTemplate);

        if (shouldPublish(options.publish, "updated")) {
          await publishTemplate(options.resend, syncedTemplate, result);
        }
      } else {
        const response = await options.resend.templates.create({
          name: template.name,
          html,
          subject: template.subject,
          text: template.text,
          alias: template.alias,
          from: template.from,
          replyTo: template.replyTo,
          variables: template.variables,
        });

        if (response.error) {
          throw new Error(response.error.message);
        }

        const syncedTemplate = toSyncedTemplate(response.data.id, template);

        result.created.push(syncedTemplate);

        if (shouldPublish(options.publish, "created")) {
          await publishTemplate(options.resend, syncedTemplate, result);
        }
      }
    } catch (error) {
      result.errors.push({
        name: template.name,
        error: toError(error),
      });
    }
  }

  return result;
}

async function listTemplates(resend: Resend): Promise<ExistingTemplate[]> {
  const templates: ExistingTemplate[] = [];
  let after: string | undefined;

  do {
    const response = await resend.templates.list({ limit: 100, after });

    if (response.error) {
      throw new Error(response.error.message);
    }

    const page = response.data.data.map((template) => ({
      id: template.id,
      name: template.name,
      alias: template.alias,
    }));

    templates.push(...page);
    after = response.data.has_more ? page.at(-1)?.id : undefined;
  } while (after);

  return templates;
}

function findExistingTemplate(templates: ExistingTemplate[], template: TemplateConfig) {
  if (template.alias) {
    const matchingAlias = templates.find(
      (existingTemplate) => existingTemplate.alias === template.alias,
    );

    if (matchingAlias) {
      return matchingAlias;
    }
  }

  return templates.find((existingTemplate) => existingTemplate.name === template.name);
}

function shouldPublish(publish: SyncOptions["publish"], operation: "created" | "updated") {
  return publish === true || publish === "all" || publish === operation;
}

async function publishTemplate(resend: Resend, template: SyncedTemplate, result: SyncResult) {
  const response = await resend.templates.publish(template.id);

  if (response.error) {
    throw new Error(response.error.message);
  }

  result.published.push(template);
}

function toSyncedTemplate(
  id: string,
  template: TemplateConfig,
  existingTemplate?: ExistingTemplate,
): SyncedTemplate {
  return {
    id,
    name: template.name,
    alias: template.alias ?? existingTemplate?.alias ?? null,
  };
}

function toError(error: unknown) {
  if (error instanceof Error) {
    return error;
  }

  return new Error(String(error));
}

export * from "./types.js";
