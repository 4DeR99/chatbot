import { protectedProcedure, publicProcedure, router } from "../index";
import { conversationRouter } from "./conversation";

export const appRouter = router({
	healthCheck: publicProcedure.query(() => {
		return "OK";
	}),
	privateData: protectedProcedure.query(({ ctx }) => {
		return {
			message: "This is private",
			user: ctx.session.user,
		};
	}),
	conversation: conversationRouter,
});
export type AppRouter = typeof appRouter;
