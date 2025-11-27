import { relations } from "drizzle-orm";
import { pgTable, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { user } from "./auth";

export type Message = {
	id: string;
	role: "user" | "assistant";
	content: string;
	createdAt: string;
	metadata?: Record<string, unknown>;
};

export const conversation = pgTable(
	"conversation",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		title: text("title").notNull(),
		messages: jsonb("messages").$type<Message[]>().notNull().default([]),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [index("conversation_userId_idx").on(table.userId)],
);

export const conversationRelations = relations(conversation, ({ one }) => ({
	user: one(user, {
		fields: [conversation.userId],
		references: [user.id],
	}),
}));
