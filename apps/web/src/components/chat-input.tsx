"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Mic, Square, Loader2, Send, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useVoiceRecorder } from "@/hooks/use-voice-recorder";

interface ChatInputProps {
	onSubmit: (message: string) => void;
	isLoading?: boolean;
	isStreaming?: boolean;
	onCancelStreaming?: () => void;
	placeholder?: string;
	className?: string;
	autoFocus?: boolean;
}

export function ChatInput({
	onSubmit,
	isLoading = false,
	isStreaming = false,
	onCancelStreaming,
	placeholder = "Envoyer un message...",
	className,
	autoFocus = true,
}: ChatInputProps) {
	const [input, setInput] = useState("");
	const textareaRef = useRef<HTMLTextAreaElement>(null);

	const {
		isRecording,
		isTranscribing,
		transcription,
		error,
		recordingTime,
		startRecording,
		stopRecording,
		cancelRecording,
		isSupported,
	} = useVoiceRecorder();

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

	// Handle transcription completion - put text directly into input field
	useEffect(() => {
		if (transcription && !isTranscribing && !isRecording) {
			setInput(transcription);
			// Focus the textarea so user can immediately edit or send
			setTimeout(() => {
				textareaRef.current?.focus();
				// Move cursor to end of text
				if (textareaRef.current) {
					const length = transcription.length;
					textareaRef.current.setSelectionRange(length, length);
				}
			}, 100);
		}
	}, [transcription, isTranscribing, isRecording]);

	// Handle voice recording
	const handleVoiceClick = async () => {
		if (isRecording) {
			stopRecording();
		} else {
			await startRecording();
		}
	};

	const handleCancelRecording = () => {
		cancelRecording();
		// Optionally clear input if user cancels
		// setInput("");
	};

	// Format recording time
	const formatTime = (ms: number) => {
		const seconds = Math.floor(ms / 1000);
		const minutes = Math.floor(seconds / 60);
		const remainingSeconds = seconds % 60;
		if (minutes > 0) {
			return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
		}
		return `${remainingSeconds}s`;
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
					disabled={isLoading || isRecording || isTranscribing}
					rows={1}
					className="min-h-[40px] max-h-[200px] resize-none border-none bg-transparent! p-2 focus-visible:ring-0 focus-visible:ring-offset-0"
				/>
				{isSupported && (
					<Button
						type="button"
						size="icon"
						variant={isRecording ? "destructive" : "ghost"}
						onClick={handleVoiceClick}
						disabled={isLoading || isTranscribing}
						className={cn("h-10 w-10 shrink-0", isRecording && "animate-pulse")}
						title={
							isRecording
								? "Arrêter l'enregistrement"
								: "Enregistrer un message vocal"
						}
					>
						{isRecording ? (
							<Square className="h-4 w-4" />
						) : isTranscribing ? (
							<Loader2 className="h-4 w-4 animate-spin" />
						) : (
							<Mic className="h-4 w-4" />
						)}
					</Button>
				)}
				{isStreaming && onCancelStreaming ? (
					<Button
						type="button"
						size="icon"
						variant="outline"
						onClick={onCancelStreaming}
						className="h-10 w-10 shrink-0"
					>
						<X className="h-4 w-4" />
					</Button>
				) : (
					<Button
						type="submit"
						size="icon"
						disabled={!input.trim() || isLoading || isRecording}
						className="h-10 w-10 shrink-0"
					>
						{isLoading ? (
							<Loader2 className="h-4 w-4 animate-spin" />
						) : (
							<Send className="h-4 w-4" />
						)}
					</Button>
				)}
			</div>
			{isRecording && (
				<div className="mt-2 flex items-center justify-center gap-2 text-sm text-muted-foreground">
					<div className="flex items-center gap-2">
						<div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
						<span>Enregistrement : {formatTime(recordingTime)}</span>
					</div>
					<Button
						type="button"
						variant="ghost"
						size="sm"
						onClick={handleCancelRecording}
						className="h-6 px-2 text-xs"
					>
						Annuler
					</Button>
				</div>
			)}
			{error && !isRecording && (
				<div className="mt-2 text-sm text-destructive text-center">{error}</div>
			)}
		</form>
	);
}
