"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatInputProps {
	onSubmit: (message: string) => void;
	isLoading?: boolean;
	placeholder?: string;
	className?: string;
	autoFocus?: boolean;
}

export function ChatInput({
	onSubmit,
	isLoading = false,
	placeholder = "Send a message...",
	className,
	autoFocus = true,
}: ChatInputProps) {
	const [input, setInput] = useState("");
	const textareaRef = useRef<HTMLTextAreaElement>(null);

	useEffect(() => {
		if (autoFocus && textareaRef.current) {
			textareaRef.current.focus();
		}
	}, [autoFocus]);

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		const trimmed = input.trim();
		if (!trimmed || isLoading) return;
		onSubmit(trimmed);
		setInput("");
	};

	const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			handleSubmit(e);
		}
	};

	return (
		<form onSubmit={handleSubmit} className={cn("relative", className)}>
			<div className="relative flex items-end gap-2 rounded-xl border bg-background p-2 shadow-sm">
				<Textarea
					ref={textareaRef}
					value={input}
					onChange={(e) => setInput(e.target.value)}
					onKeyDown={handleKeyDown}
					placeholder={placeholder}
					disabled={isLoading}
					rows={1}
					className="min-h-[44px] max-h-[200px] resize-none border-0 bg-transparent p-2 focus-visible:ring-0 focus-visible:ring-offset-0"
				/>
				<Button
					type="submit"
					size="icon"
					disabled={!input.trim() || isLoading}
					className="h-10 w-10 shrink-0"
				>
					<Send className="h-4 w-4" />
				</Button>
			</div>
		</form>
	);
}
