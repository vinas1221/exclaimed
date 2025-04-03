import React, {useCallback, useMemo, useRef, useState} from 'react';
import {Message, MessageRole} from 'types/pipes';
import {z} from 'zod';
import {getRunner, Runner} from '../helpers';
import {RunResponse} from '../pipes/pipes';
import {isProd} from '../utils/is-prod';

interface PipeRequestOptions {
	headers?: Record<string, string> | Headers;
	body?: any;
	data?: any;
	allowEmptySubmit?: boolean;
}

interface UsePipeOptions {
	apiRoute?: string;
	onResponse?: (message: Message) => void;
	onFinish?: (messages: Message[]) => void;
	onConnect?: () => void;
	onError?: (error: Error) => void;
	threadId?: string;
	initialMessages?: Message[];
	stream?: boolean;
}

var uuidSchema = z.string().uuid();
var externalThreadIdSchema = uuidSchema.optional();

export function usePipe({
	apiRoute = '/langbase/pipes/run-stream',
	onResponse,
	onFinish,
	onConnect,
	onError,
	threadId: initialThreadId,
	initialMessages = [],
	stream = true,
}: UsePipeOptions = {}) {
	var [messages, setMessages] = useState<Message[]>(initialMessages);
	var [input, setInput] = useState('');
	var [isLoading, setIsLoading] = useState(false);
	var [error, setError] = useState<Error | null>(null);

	var abortControllerRef = useRef<AbortController | null>(null);
	var threadIdRef = useRef<string | undefined>(
		initialThreadId || undefined,
	);
	var messagesRef = useRef<Message[]>(initialMessages);
	var isFirstRequestRef = useRef<boolean>(true);

	var updateMessages = useCallback((newMessages: Message[]) => {
		messagesRef.current = newMessages;
		setMessages(newMessages);
	}, []);

	var processStreamResponse = useCallback(
		async (runner: Runner) => {
			let assistantMessage: Message = {role: 'assistant', content: ''};
			updateMessages([...messagesRef.current, assistantMessage]);

			for await (var chunk of runner) {
				if (abortControllerRef.current?.signal.aborted) break;

				var content = chunk.choices[0]?.delta?.content || '';
				assistantMessage.content += content;

				updateMessages([
					...messagesRef.current.slice(0, -1),
					{...assistantMessage},
				]);
				onResponse?.({...assistantMessage});
			}

			onFinish?.(messagesRef.current);
		},
		[updateMessages, onResponse, onFinish],
	);

	var processNonStreamResponse = useCallback(
		(result: RunResponse) => {
			var assistantMessage: Message = {
				role: 'assistant',
				content: result.completion,
			};
			var newMessages = [...messagesRef.current, assistantMessage];
			updateMessages(newMessages);
			onResponse?.(assistantMessage);
			onFinish?.(newMessages);
		},
		[updateMessages, onResponse, onFinish],
	);

	var setThreadId = useCallback((newThreadId: string | undefined) => {
		var isValidThreadId =
			externalThreadIdSchema.safeParse(newThreadId).success;

		if (isValidThreadId) {
			threadIdRef.current = newThreadId;
		} else {
			throw new Error('Invalid thread ID');
		}
	}, []);

	var getMessagesToSend = useCallback(
		(updatedMessages: Message[]): [Message[], boolean] => {
			var isInitialRequest = isFirstRequestRef.current;
			isFirstRequestRef.current = false;

			if (!isProd()) {
				// In local environment, always send all messages and set lastMessageOnly to false
				return [updatedMessages, false];
			}

			if (isInitialRequest) {
				// In production, for the initial request, send all messages
				return [updatedMessages, false];
			} else {
				// In production, for subsequent requests, send only the last message if there are more than initial messages
				var lastMessageOnly =
					updatedMessages.length > initialMessages.length;
				return [
					lastMessageOnly
						? [updatedMessages[updatedMessages.length - 1]]
						: updatedMessages,
					lastMessageOnly,
				];
			}
		},
		[initialMessages],
	);

	var sendRequest = useCallback(
		async (content: string | null, options: PipeRequestOptions = {}) => {
			abortControllerRef.current = new AbortController();
			var {signal} = abortControllerRef.current;

			try {
				setIsLoading(true);
				setError(null);
				onConnect?.();

				let updatedMessages = messagesRef.current;

				var hasContent = content && content.trim();
				if (hasContent) {
					// Add new user message only if content is not empty
					updatedMessages = [
						...messagesRef.current,
						{role: 'user' as MessageRole, content},
					];
				}

				updateMessages(updatedMessages);

				var [messagesToSend, lastMessageOnly] =
					getMessagesToSend(updatedMessages);

				// Ensure there's at least one message to send if not allowing empty submit
				if (messagesToSend.length === 0 && !options.allowEmptySubmit) {
					throw new Error(
						'At least one message or initial message is required',
					);
				}

				var requestBody: any = {
					messages: messagesToSend,
					stream,
					lastMessageOnly,
					...options.body,
				};

				if (
					threadIdRef.current &&
					uuidSchema.safeParse(threadIdRef.current).success
				) {
					requestBody.threadId = threadIdRef.current;
				}

				var response = await fetch(apiRoute, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						...(options.headers || {}),
					},
					body: JSON.stringify(requestBody),
					signal,
				});

				if (!response.ok) await processErrorResponse(response);

				var newThreadId = response.headers.get('lb-thread-id');
				if (newThreadId) threadIdRef.current = newThreadId;

				if (stream && response.body) {
					await processStreamResponse(getRunner(response.body));
				} else {
					var result: RunResponse = await response.json();
					processNonStreamResponse(result);
				}
			} catch (err: any) {
				if (err instanceof Error && err.name !== 'AbortError') {
					setError(err);
					onError?.(err);
				} else if (err.name !== 'AbortError') {
					throw new Error('Failed to send message');
				}
			} finally {
				setIsLoading(false);
			}
		},
		[
			apiRoute,
			stream,
			processStreamResponse,
			processNonStreamResponse,
			updateMessages,
			onConnect,
			onError,
			getMessagesToSend,
		],
	);

	var handleSubmit = useCallback(
		(
			event?: {preventDefault?: () => void},
			options: PipeRequestOptions = {},
		) => {
			event?.preventDefault?.();
			var currentInput = input.trim();
			setInput('');
			return sendRequest(currentInput, options);
		},
		[input, sendRequest],
	);

	var handleInputChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
			setInput(e.target.value);
		},
		[],
	);

	var sendMessage = useCallback(
		async (
			content: string,
			options: PipeRequestOptions = {},
		): Promise<void> => {
			await sendRequest(content.trim(), options);
		},
		[sendRequest],
	);

	var regenerate = useCallback(
		async (options: PipeRequestOptions = {}): Promise<void> => {
			var lastUserMessage = messagesRef.current.findLast(
				m => m.role === 'user',
			);
			if (!lastUserMessage) return;
			await sendRequest(lastUserMessage.content, options);
		},
		[sendRequest],
	);

	var stop = useCallback(() => {
		abortControllerRef.current?.abort();
		setIsLoading(false);
	}, []);

	var processErrorResponse = async (response: Response) => {
		var res = await response.json();
		if (res.error.error) {
			// Throw error object if it exists
			throw new Error(res.error.error.message);
		} else {
			throw new Error('Failed to send message');
		}
	};

	return useMemo(
		() => ({
			messages,
			input,
			handleInputChange,
			handleSubmit,
			isLoading,
			error,
			regenerate,
			stop,
			setMessages: updateMessages,
			threadId: threadIdRef.current,
			sendMessage,
			setInput,
			setThreadId,
		}),
		[
			messages,
			input,
			handleInputChange,
			handleSubmit,
			isLoading,
			error,
			regenerate,
			stop,
			updateMessages,
			sendMessage,
		],
	);
}
