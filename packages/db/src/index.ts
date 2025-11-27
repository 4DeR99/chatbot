import dotenv from "dotenv";

dotenv.config({
	path: "../../apps/server/.env",
});

import { neon, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import ws from "ws";
import * as authSchema from "./schema/auth";
import * as conversationSchema from "./schema/conversation";

neonConfig.webSocketConstructor = ws;

// To work in edge environments (Cloudflare Workers, Vercel Edge, etc.), enable querying over fetch
// neonConfig.poolQueryViaFetch = true

const sql = neon(process.env.DATABASE_URL || "");
export const db = drizzle(sql, {
	schema: { ...authSchema, ...conversationSchema },
});

export * from "./schema/conversation";
