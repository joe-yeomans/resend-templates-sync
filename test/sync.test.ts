import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import type { Resend } from "resend";
import { sync } from "../src/index.js";

interface MockTemplate {
    id: string;
    name: string;
    alias: string | null;
}

interface ResendError {
    name: string;
    message: string;
    statusCode: number;
}

function WelcomeEmail({ name }: { name: string }) {
    return React.createElement("p", null, "Hello ", name);
}

function mockResend(options?: {
    pages?: MockTemplate[][];
    createError?: ResendError;
    updateError?: ResendError;
    publishError?: ResendError;
}) {
    const calls = {
        list: [] as Array<{ limit: number; after?: string }>,
        create: [] as unknown[],
        update: [] as Array<{ id: string; payload: unknown }>,
        publish: [] as string[],
    };

    const pages = options?.pages ?? [[]];
    let pageIndex = 0;

    const resend = {
        templates: {
            list: async (params: { limit: number; after?: string }) => {
                calls.list.push(params);

                const page = pages[pageIndex] ?? [];
                pageIndex += 1;

                return {
                    data: {
                        object: "list",
                        data: page,
                        has_more: pageIndex < pages.length,
                    },
                    error: null,
                };
            },
            create: async (payload: unknown) => {
                calls.create.push(payload);

                if (options?.createError) {
                    return {
                        data: null,
                        error: options.createError,
                    };
                }

                return {
                    data: {
                        object: "template",
                        id: "tpl_created",
                    },
                    error: null,
                };
            },
            update: async (id: string, payload: unknown) => {
                calls.update.push({ id, payload });

                if (options?.updateError) {
                    return {
                        data: null,
                        error: options.updateError,
                    };
                }

                return {
                    data: {
                        object: "template",
                        id,
                    },
                    error: null,
                };
            },
            publish: async (id: string) => {
                calls.publish.push(id);

                if (options?.publishError) {
                    return {
                        data: null,
                        error: options.publishError,
                    };
                }

                return {
                    data: {
                        object: "template",
                        id,
                    },
                    error: null,
                };
            },
        },
    };

    return {
        resend: resend as unknown as Resend,
        calls,
    };
}

test("creates a missing template", async () => {
    const { resend, calls } = mockResend();

    const result = await sync({ resend }, [
        {
            name: "Welcome Email",
            alias: "welcome-email",
            component: WelcomeEmail,
            props: { name: "Ada" },
            subject: "Welcome",
            from: "Acme <hello@example.com>",
            variables: [{ key: "CUSTOMER_NAME", type: "string", fallbackValue: "there" }],
        },
    ]);

    assert.equal(calls.create.length, 1);
    assert.equal(calls.update.length, 0);
    assert.equal(calls.publish.length, 0);
    assert.deepEqual(result.created, [
        {
            id: "tpl_created",
            name: "Welcome Email",
            alias: "welcome-email",
        },
    ]);
    assert.deepEqual(result.updated, []);
    assert.deepEqual(result.published, []);
    assert.deepEqual(result.errors, []);

    const payload = calls.create[0] as { html: string; variables: unknown };
    assert.match(payload.html, /Hello/);
    assert.match(payload.html, /Ada/);
    assert.deepEqual(payload.variables, [
        { key: "CUSTOMER_NAME", type: "string", fallbackValue: "there" },
    ]);
});

test("updates an existing template by alias before name", async () => {
    const { resend, calls } = mockResend({
        pages: [[{ id: "tpl_existing", name: "Old Welcome Name", alias: "welcome-email" }]],
    });

    const result = await sync({ resend }, [
        {
            name: "Welcome Email",
            alias: "welcome-email",
            component: WelcomeEmail,
            props: { name: "Ada" },
        },
    ]);

    assert.equal(calls.create.length, 0);
    assert.deepEqual(
        calls.update.map((call) => call.id),
        ["tpl_existing"],
    );
    assert.deepEqual(result.updated, [
        {
            id: "tpl_existing",
            name: "Welcome Email",
            alias: "welcome-email",
        },
    ]);
});

test("falls back to matching by name", async () => {
    const { resend, calls } = mockResend({
        pages: [[{ id: "tpl_existing", name: "Welcome Email", alias: null }]],
    });

    const result = await sync({ resend }, [
        {
            name: "Welcome Email",
            component: WelcomeEmail,
            props: { name: "Ada" },
        },
    ]);

    assert.equal(calls.create.length, 0);
    assert.deepEqual(
        calls.update.map((call) => call.id),
        ["tpl_existing"],
    );
    assert.deepEqual(result.updated, [
        {
            id: "tpl_existing",
            name: "Welcome Email",
            alias: null,
        },
    ]);
});

test("lists templates with cursor pagination", async () => {
    const { resend, calls } = mockResend({
        pages: [
            [{ id: "tpl_page_1", name: "Other Email", alias: "other-email" }],
            [{ id: "tpl_page_2", name: "Welcome Email", alias: "welcome-email" }],
        ],
    });

    const result = await sync({ resend }, [
        {
            name: "Welcome Email",
            alias: "welcome-email",
            component: WelcomeEmail,
            props: { name: "Ada" },
        },
    ]);

    assert.deepEqual(calls.list, [
        { limit: 100, after: undefined },
        { limit: 100, after: "tpl_page_1" },
    ]);
    assert.deepEqual(
        calls.update.map((call) => call.id),
        ["tpl_page_2"],
    );
    assert.equal(result.errors.length, 0);
});

test("publishes created and updated templates when publish is true", async () => {
    const { resend, calls } = mockResend({
        pages: [[{ id: "tpl_existing", name: "Existing Email", alias: "existing-email" }]],
    });

    const result = await sync({ resend, publish: true }, [
        {
            name: "Existing Email",
            alias: "existing-email",
            component: WelcomeEmail,
            props: { name: "Ada" },
        },
        {
            name: "New Email",
            alias: "new-email",
            component: WelcomeEmail,
            props: { name: "Ada" },
        },
    ]);

    assert.deepEqual(calls.publish, ["tpl_existing", "tpl_created"]);
    assert.deepEqual(result.published, [
        { id: "tpl_existing", name: "Existing Email", alias: "existing-email" },
        { id: "tpl_created", name: "New Email", alias: "new-email" },
    ]);
});

test("can publish only created templates", async () => {
    const { resend, calls } = mockResend({
        pages: [[{ id: "tpl_existing", name: "Existing Email", alias: "existing-email" }]],
    });

    await sync({ resend, publish: "created" }, [
        {
            name: "Existing Email",
            alias: "existing-email",
            component: WelcomeEmail,
            props: { name: "Ada" },
        },
        {
            name: "New Email",
            alias: "new-email",
            component: WelcomeEmail,
            props: { name: "Ada" },
        },
    ]);

    assert.deepEqual(calls.publish, ["tpl_created"]);
});

test("can publish only updated templates", async () => {
    const { resend, calls } = mockResend({
        pages: [[{ id: "tpl_existing", name: "Existing Email", alias: "existing-email" }]],
    });

    await sync({ resend, publish: "updated" }, [
        {
            name: "Existing Email",
            alias: "existing-email",
            component: WelcomeEmail,
            props: { name: "Ada" },
        },
        {
            name: "New Email",
            alias: "new-email",
            component: WelcomeEmail,
            props: { name: "Ada" },
        },
    ]);

    assert.deepEqual(calls.publish, ["tpl_existing"]);
});

test("collects template API errors and continues syncing", async () => {
    const { resend, calls } = mockResend({
        createError: {
            name: "validation_error",
            message: "Invalid template",
            statusCode: 422,
        },
    });

    const result = await sync({ resend }, [
        {
            name: "API Error Email",
            component: WelcomeEmail,
            props: { name: "Ada" },
        },
        {
            name: "Another API Error Email",
            component: WelcomeEmail,
            props: { name: "Grace" },
        },
    ]);

    assert.equal(calls.create.length, 2);
    assert.deepEqual(result.created, []);
    assert.deepEqual(
        result.errors.map((error) => [error.name, error.error.message]),
        [
            ["API Error Email", "Invalid template"],
            ["Another API Error Email", "Invalid template"],
        ],
    );
});

test("throws when templates cannot be listed", async () => {
    const resend = {
        templates: {
            list: async () => ({
                data: null,
                error: {
                    name: "application_error",
                    message: "Could not list templates",
                    statusCode: 500,
                },
            }),
        },
    } as unknown as Resend;

    await assert.rejects(
        () =>
            sync({ resend }, [
                {
                    name: "Welcome Email",
                    component: WelcomeEmail,
                    props: { name: "Ada" },
                },
            ]),
        /Could not list templates/,
    );
});
