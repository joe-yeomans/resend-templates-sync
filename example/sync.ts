import "dotenv/config";

import { Resend } from "resend";
import { sync } from "resend-templates-sync";
import WelcomeEmail from "./emails/welcome.js";

const apiKey = process.env.RESEND_API_KEY;
const from = process.env.EMAIL_FROM;

if (!apiKey) {
    throw new Error("RESEND_API_KEY is required");
}

if (!from) {
    throw new Error("EMAIL_FROM is required");
}

const resend = new Resend(apiKey);

const result = await sync(resend, [
    {
        name: "Welcome Email",
        alias: "welcome-email",
        component: WelcomeEmail,
        props: {
            name: "Ada",
        },
        subject: "Welcome to Acme",
        from,
        variables: [
            {
                key: "CUSTOMER_NAME",
                type: "string",
                fallbackValue: "there",
            },
        ],
    },
]);

console.log(JSON.stringify(result, null, 2));
