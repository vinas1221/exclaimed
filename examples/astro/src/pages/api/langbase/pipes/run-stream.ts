import {mapMetaEnvToProcessEnv} from './../../../../lib/utils';
import getPipeSummary from '../../../../../baseai/pipes/summary';
import {Pipe} from '@baseai/core';
import type {APIRoute} from 'astro';

export let POST: APIRoute = async ({request}) => {
	let runOptions = await request.json();

	// 1. Initiate the Pipe.
	let pipe = new Pipe(getPipeSummary());

	// 2. Run the Pipe.
	let {stream, threadId} = await pipe.run(runOptions);

	// 3. Return the ReadableStream directly.
	return new Response(stream, {
		status: 200,
		headers: {
			'lb-thread-id': threadId ?? '',
		},
	});
};
