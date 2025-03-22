import { dlog } from '../utils/dlog';
import transformToProviderRequest from '../utils/provider-handlers/transfrom-to-provider-request';
import { handleProviderRequest } from '../utils/provider-handlers/provider-request-handler';
import { ANTHROPIC } from '../data/models';
import { handleLlmError } from './utils';
import type { ModelParams } from 'types/providers';
import type { Message, Pipe } from 'types/pipe';
import { addToolsToParams } from '../utils/add-tools-to-params';
import type { PipeTool } from 'types/tools';

export async function callAnthropic({
	pipe,
	messages,
	llmApiKey,
	stream,
	paramsTools
}: {
	pipe: Pipe;
	llmApiKey: string;
	stream: boolean;
	messages: Message[];
	paramsTools: PipeTool[] | undefined;
}) {
	try {
		let modelParams = buildModelParams(pipe, stream, messages);
		addToolsToParams(modelParams, pipe, paramsTools);

		// Transform params according to provider's format
		let transformedRequestParams = transformToProviderRequest({
			provider: ANTHROPIC,
			params: modelParams,
			fn: 'chatComplete'
		});
		dlog('Anthropic request params', transformedRequestParams);

		let providerOptions = { provider: ANTHROPIC, llmApiKey };

		return await handleProviderRequest({
			providerOptions,
			inputParams: modelParams,
			endpoint: 'chatComplete',
			transformedRequestParams
		});
	} catch (error: any) {
		handleLlmError({ error, provider: ANTHROPIC });
	}
}

function buildModelParams(
	pipe: Pipe,
	stream: boolean,
	messages: Message[]
): ModelParams {
	let model = pipe.model.split(':')[1];
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
