"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { trpc } from "@/utils/trpc";
import { ChatInput } from "@/components/chat-input";
import { nanoid } from "nanoid";

type ConversationListItem = {
	id: string;
	title: string;
	createdAt: string;
	updatedAt: string;
};

export default function ChatHomePage() {
	const router = useRouter();
	const queryClient = useQueryClient();
	const [isCreating, setIsCreating] = useState(false);

	// Get the correct tRPC query key for the conversation list
	const listQueryKey = trpc.conversation.list.queryKey();

	const createConversation = useMutation(
		trpc.conversation.create.mutationOptions({
			onMutate: async (newConversation) => {
				// Cancel any outgoing refetches
				await queryClient.cancelQueries({
					queryKey: listQueryKey,
				});

				// Snapshot the previous value
				const previousConversations =
					queryClient.getQueryData<ConversationListItem[]>(listQueryKey);

				// Optimistically add the new conversation to the list
				// We use a temporary ID that will be replaced by the real one
				const optimisticConversation: ConversationListItem = {
					id: `temp-${nanoid()}`,
					title: newConversation.title,
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString(),
				};

				queryClient.setQueryData<ConversationListItem[]>(
					listQueryKey,
					(old) => [optimisticConversation, ...(old || [])],
				);

				return {
					previousConversations,
					optimisticId: optimisticConversation.id,
				};
			},
			onError: (_err, _newConversation, context) => {
				// Rollback on error
				if (context?.previousConversations) {
					queryClient.setQueryData(listQueryKey, context.previousConversations);
				}
			},
			onSuccess: (data, _variables, context) => {
				// Replace the optimistic conversation with the real one
				queryClient.setQueryData<ConversationListItem[]>(
					listQueryKey,
					(old) =>
						old?.map((conv) =>
							conv.id === context?.optimisticId
								? {
										id: data.id,
										title: data.title,
										createdAt: String(data.createdAt),
										updatedAt: String(data.updatedAt),
									}
								: conv,
						) || [],
				);
			},
		}),
	);

	const handleSubmit = async (text: string) => {
		if (isCreating) return;
		setIsCreating(true);

		const userMessageId = nanoid();
		const userMessage = {
			id: userMessageId,
			role: "user" as const,
			content: text,
			createdAt: new Date().toISOString(),
		};

		const title = text.slice(0, 30) + (text.length > 30 ? "..." : "");

		try {
			const conversation = await createConversation.mutateAsync({
				title,
				initialMessage: userMessage,
			});

			// Navigate to conversation page - it will handle the AI call
			router.push(`/${conversation.id}?pending=true`);
		} catch (error) {
			console.error("Failed to create conversation:", error);
			setIsCreating(false);
		}
	};

	return (
		<div className="flex flex-col items-center justify-center h-full px-4">
			<div className="w-full max-w-2xl space-y-8">
				<div className="text-center space-y-2">
					<h1 className="text-3xl font-bold tracking-tight">
						How can I help you today?
					</h1>
				</div>

				<ChatInput
					onSubmit={handleSubmit}
					isLoading={isCreating}
					placeholder="Ask me anything..."
					className="w-full"
				/>
			</div>
		</div>
	);
}
