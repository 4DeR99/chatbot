/** biome-ignore-all lint/suspicious/noExplicitAny: we need to use any to avoid type errors */
/** biome-ignore-all lint/suspicious/useIterableCallbackReturn: we need to use the return value of the callback */
"use client";

import { useState, useRef, useCallback } from "react";

// TypeScript definitions for Web Speech API
interface SpeechRecognition extends EventTarget {
	continuous: boolean;
	interimResults: boolean;
	lang: string;
	start: () => void;
	stop: () => void;
	abort: () => void;
	onresult: ((event: SpeechRecognitionEvent) => void) | null;
	onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
	onend: (() => void) | null;
}

interface SpeechRecognitionEvent {
	resultIndex: number;
	results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
	length: number;
	item(index: number): SpeechRecognitionResult;
	[index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
	length: number;
	item(index: number): SpeechRecognitionAlternative;
	[index: number]: SpeechRecognitionAlternative;
	isFinal: boolean;
}

interface SpeechRecognitionAlternative {
	transcript: string;
	confidence: number;
}

interface SpeechRecognitionErrorEvent {
	error: string;
	message: string;
}

declare global {
	interface Window {
		SpeechRecognition: {
			new (): SpeechRecognition;
		};
		webkitSpeechRecognition: {
			new (): SpeechRecognition;
		};
	}
}

export interface UseVoiceRecorderReturn {
	isRecording: boolean;
	isTranscribing: boolean;
	transcription: string | null;
	error: string | null;
	recordingTime: number;
	startRecording: () => Promise<void>;
	stopRecording: () => void;
	cancelRecording: () => void;
	isSupported: boolean;
}

const MAX_RECORDING_TIME = 60000; // 60 seconds
const RECORDING_UPDATE_INTERVAL = 100; // Update time every 100ms

export function useVoiceRecorder(): UseVoiceRecorderReturn {
	const [isRecording, setIsRecording] = useState(false);
	const [isTranscribing, setIsTranscribing] = useState(false);
	const [transcription, setTranscription] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [recordingTime, setRecordingTime] = useState(0);

	const mediaRecorderRef = useRef<MediaRecorder | null>(null);
	const audioChunksRef = useRef<Blob[]>([]);
	const streamRef = useRef<MediaStream | null>(null);
	const recognitionRef = useRef<SpeechRecognition | null>(null);
	const timeIntervalRef = useRef<NodeJS.Timeout | null>(null);
	const startTimeRef = useRef<number | null>(null);
	const transcriptRef = useRef<string>("");
	const isRecordingRef = useRef<boolean>(false);

	// Check if browser supports required APIs
	const isSupported =
		typeof window !== "undefined" &&
		typeof navigator !== "undefined" &&
		!!navigator.mediaDevices?.getUserMedia &&
		!!window.MediaRecorder &&
		(!!window.SpeechRecognition || !!(window as any).webkitSpeechRecognition);

	const cleanup = useCallback(() => {
		// Stop media recorder
		if (mediaRecorderRef.current?.state !== "inactive") {
			mediaRecorderRef.current?.stop();
		}

		// Stop recognition
		if (recognitionRef.current) {
			recognitionRef.current.stop();
			recognitionRef.current = null;
		}

		// Stop media stream
		if (streamRef.current) {
			streamRef.current.getTracks().forEach((track) => track.stop());
			streamRef.current = null;
		}

		// Clear time interval
		if (timeIntervalRef.current) {
			clearInterval(timeIntervalRef.current);
			timeIntervalRef.current = null;
		}

		audioChunksRef.current = [];
		setRecordingTime(0);
		startTimeRef.current = null;
	}, []);

	const startRecording = useCallback(async () => {
		if (!isSupported) {
			setError("Voice recording is not supported in your browser");
			return;
		}

		try {
			setError(null);
			setTranscription(null);
			audioChunksRef.current = [];

			// Request microphone access
			const stream = await navigator.mediaDevices.getUserMedia({
				audio: {
					echoCancellation: true,
					noiseSuppression: true,
					autoGainControl: true,
				},
			});

			streamRef.current = stream;

			// Initialize MediaRecorder
			const mimeType = MediaRecorder.isTypeSupported("audio/webm")
				? "audio/webm"
				: MediaRecorder.isTypeSupported("audio/mp4")
					? "audio/mp4"
					: "";

			const mediaRecorder = new MediaRecorder(stream, {
				mimeType: mimeType || undefined,
			});

			mediaRecorderRef.current = mediaRecorder;

			// Collect audio chunks
			mediaRecorder.ondataavailable = (event) => {
				if (event.data.size > 0) {
					audioChunksRef.current.push(event.data);
				}
			};

			// Start recording
			mediaRecorder.start();
			isRecordingRef.current = true;
			setIsRecording(true);

			// Start time tracking
			startTimeRef.current = Date.now();
			timeIntervalRef.current = setInterval(() => {
				if (startTimeRef.current) {
					const elapsed = Date.now() - startTimeRef.current;
					setRecordingTime(elapsed);

					// Auto-stop at max time
					if (elapsed >= MAX_RECORDING_TIME) {
						stopRecording();
					}
				}
			}, RECORDING_UPDATE_INTERVAL);

			// Initialize Speech Recognition for real-time transcription
			const SpeechRecognition =
				window.SpeechRecognition || (window as any).webkitSpeechRecognition;

			if (SpeechRecognition) {
				const recognition = new SpeechRecognition();
				recognition.continuous = true;
				recognition.interimResults = true;
				recognition.lang = navigator.language || "en-US";

				transcriptRef.current = "";

				recognition.onresult = (event: SpeechRecognitionEvent) => {
					let interimTranscript = "";
					let finalTranscript = "";

					for (let i = event.resultIndex; i < event.results.length; i++) {
						const transcript = event.results[i][0].transcript;
						if (event.results[i].isFinal) {
							finalTranscript += transcript + " ";
						} else {
							interimTranscript += transcript;
						}
					}

					// Update stored transcript with final results
					if (finalTranscript) {
						transcriptRef.current += finalTranscript;
					}

					// Update UI with current transcript (final + interim)
					const currentTranscript = transcriptRef.current + interimTranscript;
					if (currentTranscript.trim()) {
						setTranscription(currentTranscript.trim());
					}
				};

				recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
					console.error("Speech recognition error:", event.error);
					if (event.error === "no-speech") {
						// This is common during recording, don't show as error yet
						return;
					}
					if (event.error !== "aborted") {
						setError(`Speech recognition error: ${event.error}`);
					}
				};

				recognition.onend = () => {
					// If we're still recording, restart recognition
					if (isRecordingRef.current && streamRef.current) {
						try {
							recognition.start();
						} catch (err) {
							// Recognition might already be starting or stopped
							console.log("Recognition restart:", err);
						}
					}
				};

				recognitionRef.current = recognition;
				recognition.start();
			}
		} catch (err) {
			console.error("Error starting recording:", err);
			cleanup();
			if (err instanceof Error) {
				if (
					err.name === "NotAllowedError" ||
					err.name === "PermissionDeniedError"
				) {
					setError(
						"Microphone permission denied. Please allow microphone access.",
					);
				} else if (
					err.name === "NotFoundError" ||
					err.name === "DevicesNotFoundError"
				) {
					setError("No microphone found. Please connect a microphone.");
				} else {
					setError(`Failed to start recording: ${err.message}`);
				}
			} else {
				setError("Failed to start recording. Please try again.");
			}
			setIsRecording(false);
		}
	}, [isSupported, cleanup]);

	const stopRecording = useCallback(() => {
		if (!isRecording) return;

		isRecordingRef.current = false;
		setIsRecording(false);

		// Clear time interval
		if (timeIntervalRef.current) {
			clearInterval(timeIntervalRef.current);
			timeIntervalRef.current = null;
		}

		// Stop media recorder
		if (
			mediaRecorderRef.current &&
			mediaRecorderRef.current.state !== "inactive"
		) {
			mediaRecorderRef.current.stop();
		}

		// Stop recognition
		if (recognitionRef.current) {
			recognitionRef.current.stop();
		}

		// Wait for MediaRecorder to finish
		if (mediaRecorderRef.current) {
			mediaRecorderRef.current.onstop = () => {
				// Stop recognition
				if (recognitionRef.current) {
					recognitionRef.current.stop();
					recognitionRef.current = null;
				}

				// Clean up stream
				if (streamRef.current) {
					streamRef.current.getTracks().forEach((track) => track.stop());
					streamRef.current = null;
				}

				// Use the transcript we captured during recording
				setIsTranscribing(true);

				// Give a small delay to ensure final transcript is captured
				setTimeout(() => {
					const finalTranscript = transcriptRef.current.trim();
					setTranscription(finalTranscript || null);
					setIsTranscribing(false);

					if (!finalTranscript) {
						setError("No speech detected. Please try again.");
					} else {
						setError(null);
					}
				}, 500);
			};
		}
	}, [isRecording]);

	const cancelRecording = useCallback(() => {
		isRecordingRef.current = false;
		cleanup();
		setIsRecording(false);
		setIsTranscribing(false);
		setTranscription(null);
		setError(null);
		setRecordingTime(0);
		transcriptRef.current = "";
	}, [cleanup]);

	return {
		isRecording,
		isTranscribing,
		transcription,
		error,
		recordingTime,
		startRecording,
		stopRecording,
		cancelRecording,
		isSupported,
	};
}
