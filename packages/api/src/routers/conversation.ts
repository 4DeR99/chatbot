import { z } from "zod";
import { protectedProcedure, router } from "../index";
import { db, conversation, type Message } from "@repo/db";
import { eq, and, desc } from "drizzle-orm";

function generateId(): string {
	return crypto.randomUUID();
}

const messageSchema = z.object({
	id: z.string(),
	role: z.enum(["user", "assistant"]),
	content: z.string(),
	createdAt: z.string(),
	metadata: z.record(z.string(), z.unknown()).optional(),
});

export const conversationRouter = router({
	list: protectedProcedure.query(async ({ ctx }) => {
		const conversations = await db
			.select({
				id: conversation.id,
				title: conversation.title,
				createdAt: conversation.createdAt,
				updatedAt: conversation.updatedAt,
			})
			.from(conversation)
			.where(eq(conversation.userId, ctx.session.user.id))
			.orderBy(desc(conversation.updatedAt));

		return conversations;
	}),

	get: protectedProcedure
		.input(z.object({ id: z.string() }))
		.query(async ({ ctx, input }) => {
			const [result] = await db
				.select()
				.from(conversation)
				.where(
					and(
						eq(conversation.id, input.id),
						eq(conversation.userId, ctx.session.user.id),
					),
				);

			return result ?? null;
		}),

	create: protectedProcedure
		.input(
			z.object({
				title: z.string(),
				initialMessage: messageSchema.optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const id = generateId();
			const messages: Message[] = input.initialMessage
				? [input.initialMessage]
				: [];

			const [result] = await db
				.insert(conversation)
				.values({
					id,
					userId: ctx.session.user.id,
					title: input.title,
					messages,
				})
				.returning();

			return result;
		}),

	addMessage: protectedProcedure
		.input(
			z.object({
				conversationId: z.string(),
				message: messageSchema,
			}),
		)
		.mutation(async ({ ctx, input }) => {
			// First get existing conversation
			const [existing] = await db
				.select()
				.from(conversation)
				.where(
					and(
						eq(conversation.id, input.conversationId),
						eq(conversation.userId, ctx.session.user.id),
					),
				);

			if (!existing) {
				throw new Error("Conversation not found");
			}

			const updatedMessages = [...(existing.messages || []), input.message];

			const [result] = await db
				.update(conversation)
				.set({
					messages: updatedMessages,
					updatedAt: new Date(),
				})
				.where(eq(conversation.id, input.conversationId))
				.returning();

			return result;
		}),

	updateMessages: protectedProcedure
		.input(
			z.object({
				conversationId: z.string(),
				messages: z.array(messageSchema),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const [result] = await db
				.update(conversation)
				.set({
					messages: input.messages,
					updatedAt: new Date(),
				})
				.where(
					and(
						eq(conversation.id, input.conversationId),
						eq(conversation.userId, ctx.session.user.id),
					),
				)
				.returning();

			return result;
		}),

	delete: protectedProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) => {
			await db
				.delete(conversation)
				.where(
					and(
						eq(conversation.id, input.id),
						eq(conversation.userId, ctx.session.user.id),
					),
				);

			return { success: true };
		}),
});
