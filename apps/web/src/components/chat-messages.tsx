"use client";

import { useEffect, useRef } from "react";
import { Response } from "@/components/response";
import { cn } from "@/lib/utils";
import { User, Bot } from "lucide-react";

export interface ChatMessage {
	id: string;
	role: "user" | "assistant";
	content: string;
	createdAt: string;
	metadata?: Record<string, unknown>;
}

interface ChatMessagesProps {
	messages: ChatMessage[];
	isLoading?: boolean;
}

export function ChatMessages({ messages, isLoading }: ChatMessagesProps) {
	const messagesEndRef = useRef<HTMLDivElement>(null);

	// biome-ignore lint/correctness/useExhaustiveDependencies: we need to trigger this scroll when the messages change
	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [messages]);

	return (
		<div className="flex-1 overflow-y-auto">
			<div className="mx-auto max-w-3xl px-4 py-8 space-y-6">
				{messages.map((message) => (
					<div
						key={message.id}
						className={cn(
							"flex gap-4",
							message.role === "user" ? "justify-end" : "justify-start",
						)}
					>
						{message.role === "assistant" && (
							<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
								<Bot className="h-4 w-4" />
							</div>
						)}
						<div
							className={cn(
								"rounded-2xl px-4 py-3 max-w-[85%]",
								message.role === "user"
									? "bg-primary text-primary-foreground"
									: "bg-muted",
							)}
						>
							{message.role === "assistant" ? (
								<Response>{message.content}</Response>
							) : (
								<p className="whitespace-pre-wrap">{message.content}</p>
							)}
						</div>
						{message.role === "user" && (
							<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
								<User className="h-4 w-4" />
							</div>
						)}
					</div>
				))}

				{isLoading && (
					<div className="flex gap-4 justify-start">
						<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
							<Bot className="h-4 w-4" />
						</div>
						<div className="rounded-2xl px-4 py-3 bg-muted">
							<div className="flex gap-1">
								<span className="w-2 h-2 bg-foreground/50 rounded-full animate-bounce" />
								<span className="w-2 h-2 bg-foreground/50 rounded-full animate-bounce [animation-delay:0.1s]" />
								<span className="w-2 h-2 bg-foreground/50 rounded-full animate-bounce [animation-delay:0.2s]" />
							</div>
						</div>
					</div>
				)}

				<div ref={messagesEndRef} />
			</div>
		</div>
	);
}
