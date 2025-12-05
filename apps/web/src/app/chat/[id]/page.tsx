"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import type { UIMessage } from "ai";
import { trpc } from "@/utils/trpc";
import { ChatInput } from "@/components/chat-input";
import { ChatMessages, type ChatMessage } from "@/components/chat-messages";
import { nanoid } from "nanoid";
import { Loader2 } from "lucide-react";

export default function ConversationPage() {
	const params = useParams();
	const router = useRouter();
	const searchParams = useSearchParams();
	const queryClient = useQueryClient();
	const conversationId = params.id as string;
	const isPending = searchParams.get("pending") === "true";

	const [localMessages, setLocalMessages] = useState<ChatMessage[]>([]);
	const [isStreaming, setIsStreaming] = useState(false);
	const [hasSentInitial, setHasSentInitial] = useState(false);
	const messagesRef = useRef<ChatMessage[]>([]);

	// Keep messagesRef in sync
	useEffect(() => {
		messagesRef.current = localMessages;
	}, [localMessages]);

	// Get the correct tRPC query key for the conversation list
	const listQueryKey = trpc.conversation.list.queryKey();

	const { data: conversation, isLoading } = useQuery(
		trpc.conversation.get.queryOptions({ id: conversationId }),
	);

	type ConversationListItem = {
		id: string;
		title: string;
		createdAt: string;
		updatedAt: string;
	};

	const updateMessages = useMutation(
		trpc.conversation.updateMessages.mutationOptions({
			onMutate: async () => {
				// Cancel any outgoing refetches
				await queryClient.cancelQueries({
					queryKey: listQueryKey,
				});

				// Snapshot the previous value
				const previousConversations =
					queryClient.getQueryData<ConversationListItem[]>(listQueryKey);

				// Optimistically move this conversation to the top (it has a new message)
				queryClient.setQueryData<ConversationListItem[]>(
					listQueryKey,
					(old) => {
						if (!old) return old;
						const currentConv = old.find((c) => c.id === conversationId);
						if (!currentConv) return old;

						const others = old.filter((c) => c.id !== conversationId);
						return [
							{ ...currentConv, updatedAt: new Date().toISOString() },
							...others,
						];
					},
				);

				return { previousConversations };
			},
			onError: (_err, _variables, context) => {
				// Rollback on error
				if (context?.previousConversations) {
					queryClient.setQueryData(listQueryKey, context.previousConversations);
				}
			},
		}),
	);

	const saveAssistantMessage = useCallback(
		async (content: string, messageId: string) => {
			const assistantMessage: ChatMessage = {
				id: messageId,
				role: "assistant",
				content,
				createdAt: new Date().toISOString(),
			};

			const updatedMessages = [...messagesRef.current, assistantMessage];
			setLocalMessages(updatedMessages);
			setIsStreaming(false);

			await updateMessages.mutateAsync({
				conversationId,
				messages: updatedMessages,
			});
		},
		[conversationId, updateMessages],
	);

	const {
		messages: aiMessages,
		sendMessage,
		status,
		stop,
	} = useChat({
		transport: new DefaultChatTransport({
			api: `${process.env.NEXT_PUBLIC_SERVER_URL}/ai`,
		}),
		onFinish: async ({ message }) => {
			if (message.parts) {
				const content = message.parts
					.filter((p): p is { type: "text"; text: string } => p.type === "text")
					.map((p) => p.text)
					.join("");

				await saveAssistantMessage(content, message.id);
			}
		},
	});

	// Initialize local messages from database
	useEffect(() => {
		if (conversation?.messages) {
			setLocalMessages(conversation.messages as ChatMessage[]);
		}
	}, [conversation]);

	// Handle pending conversation - send first message to AI
	useEffect(() => {
		if (
			isPending &&
			!hasSentInitial &&
			conversation?.messages &&
			conversation.messages.length === 1 &&
			conversation.messages[0].role === "user"
		) {
			setHasSentInitial(true);
			setIsStreaming(true);

			// Remove the pending query param
			router.replace(`/chat/${conversationId}`, { scroll: false });

			// Send the first message to AI
			sendMessage({ text: conversation.messages[0].content });
		}
	}, [
		isPending,
		hasSentInitial,
		conversation,
		conversationId,
		router,
		sendMessage,
	]);

	// Redirect if conversation not found
	useEffect(() => {
		if (!isLoading && !conversation) {
			router.push("/chat");
		}
	}, [isLoading, conversation, router]);

	const handleSubmit = async (text: string) => {
		const userMessage: ChatMessage = {
			id: nanoid(),
			role: "user",
			content: text,
			createdAt: new Date().toISOString(),
		};

		const updatedMessages = [...localMessages, userMessage];
		setLocalMessages(updatedMessages);
		setIsStreaming(true);

		// Save user message to database
		await updateMessages.mutateAsync({
			conversationId,
			messages: updatedMessages,
		});

		// Send to AI
		sendMessage({ text });
	};

	const handleCancelStreaming = () => {
		if (status === "streaming") {
			setIsStreaming(false);
			stop();
		}
	};

	// Helper to extract text from message parts
	const getMessageText = (msg: UIMessage): string => {
		if (!msg.parts) return "";
		return msg.parts
			.filter((p): p is { type: "text"; text: string } => p.type === "text")
			.map((p) => p.text)
			.join("");
	};

	// Get streaming content from AI
	const streamingContent =
		status === "streaming" && aiMessages.length > 0
			? getMessageText(aiMessages[aiMessages.length - 1])
			: "";

	// Combine local messages with streaming response
	const displayMessages: ChatMessage[] = streamingContent
		? [
				...localMessages,
				{
					id: "streaming",
					role: "assistant" as const,
					content: streamingContent,
					createdAt: new Date().toISOString(),
				},
			]
		: localMessages;

	if (isLoading) {
		return (
			<div className="flex items-center justify-center h-full">
				<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
			</div>
		);
	}

	if (!conversation) {
		return null;
	}

	return (
		<div className="flex flex-col h-full">
			<ChatMessages
				messages={displayMessages}
				isLoading={isStreaming && !streamingContent}
			/>
			<div className="border-t bg-background p-4">
				<div className="mx-auto max-w-3xl">
					<ChatInput
						onSubmit={handleSubmit}
						isLoading={status === "streaming"}
						isStreaming={status === "streaming"}
						onCancelStreaming={handleCancelStreaming}
						placeholder="Envoyer un message..."
					/>
				</div>
			</div>
		</div>
	);
}
