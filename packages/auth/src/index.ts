import { betterAuth, type BetterAuthOptions } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@repo/db";
import * as schema from "@repo/db/schema/auth";

const isProduction = process.env.NODE_ENV === "production";

export const auth = betterAuth<BetterAuthOptions>({
	database: drizzleAdapter(db, {
		provider: "pg",
		schema: schema,
	}),
	trustedOrigins: [process.env.CORS_ORIGIN || ""],
	emailAndPassword: {
		enabled: true,
	},
	socialProviders: {
		google: {
			clientId: process.env.GOOGLE_CLIENT_ID || "",
			clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
		},
	},
	advanced: {
		defaultCookieAttributes: {
			sameSite: isProduction ? "none" : "lax",
			secure: isProduction,
			httpOnly: true,
		},
	},
});
