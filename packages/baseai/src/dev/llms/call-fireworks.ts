import { dlog } from '../utils/dlog';
import transformToProviderRequest from '../utils/provider-handlers/transfrom-to-provider-request';
import { handleProviderRequest } from '../utils/provider-handlers/provider-request-handler';
import { FIREWORKS_AI } from '../data/models';

import { handleLlmError } from './utils';
import type { ModelParams } from 'types/providers';
import type { Message, Pipe } from 'types/pipe';

export async function callFireworks({
	pipe,
	messages,
	llmApiKey,
	stream
}: {
	pipe: Pipe;
	llmApiKey: string;
	stream: boolean;
	messages: Message[];
}) {
	try {
		let modelParams = buildModelParams(pipe, stream, messages);

		// Transform params according to provider's format
		let transformedRequestParams = transformToProviderRequest({
			provider: FIREWORKS_AI,
			params: modelParams,
			fn: 'chatComplete'
		});
		dlog('Fireworks request params', transformedRequestParams);

		// Fireworks llama-3.1 405b behaves weirdly with stop value. Bug on their side. Omitting it.
		if (modelParams?.model === 'llama-v3p1-405b-instruct')
			delete transformedRequestParams['stop'];

		let providerOptions = { provider: FIREWORKS_AI, llmApiKey };

		return await handleProviderRequest({
			providerOptions,
			inputParams: modelParams,
			endpoint: 'chatComplete',
			transformedRequestParams
		});
	} catch (error: any) {
		handleLlmError({ error, provider: FIREWORKS_AI });
	}
}

function buildModelParams(
	pipe: Pipe,
	stream: boolean,
	messages: Message[]
): ModelParams {
	// Create model strings for Fireworks AI
	let pipeModel = pipe.model.split(':')[1];
	let model =
		pipeModel === 'yi-large'
			? 'accounts/yi-01-ai/models/yi-large'
			: `accounts/fireworks/models/${pipeModel}`;
	let {
		top_p,
		max_tokens,
		temperature,
		presence_penalty,
		frequency_penalty,
		stop
	} = pipe;
	return {
		messages,
		stream,
		model,
		top_p,
		max_tokens,
		temperature,
		presence_penalty,
		frequency_penalty,
		stop
	};
}
