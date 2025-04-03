import { ApiError } from '@/dev/hono/errors';
import type { SimilarChunk } from '@/utils/memory/db/lib';
import type { Message, Pipe, VariablesI } from 'types/pipe';
import { dlog } from '../dlog';
import { getPipeFewShotsMessages } from './get-few-shot-messages';
import { getSystemPromptMessage } from './get-system-prompt';
import { processMessages } from './process-messages';

export function getRunThread({
	pipe,
	messages,
	similarChunks,
	variables
}: {
	pipe: Pipe;
	messages: Message[];
	similarChunks: SimilarChunk[] | undefined;
	variables?: VariablesI;
}) {
	try {
		let systemPromptMessage = getSystemPromptMessage({
			pipe,
			similarChunks
		});
		let pipeFewShotsMessages = getPipeFewShotsMessages(pipe);

		let messagesThread = [
			// Messages in the pipe
			...systemPromptMessage,
			...pipeFewShotsMessages,
			// Messages sent with the request
			...messages
		];

		let { messages: messagesThreadWithVars } = processMessages({
			pipe,
			messages: messagesThread,
			variables
		});

		return messagesThreadWithVars;
	} catch (error: any) {
		dlog('Error get-run-thread.ts:', error);

		throw new ApiError({
			code: 'INTERNAL_SERVER_ERROR',
			message: `Something unexpected happened. Error generating thread of messages.`
		});
	}
}
