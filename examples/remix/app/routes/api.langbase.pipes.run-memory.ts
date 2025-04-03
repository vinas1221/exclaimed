import type {ActionFunction} from '@remix-run/node';
import getPipeWithMemory from '~/../baseai/pipes/pipe-with-memory';
import {Pipe} from '@baseai/core';

export let action: ActionFunction = async ({request}) => {
	let runOptions = await request.json();
	console.log('runOptions:', runOptions);

	// 1. Initiate the Pipe.
	let pipe = new Pipe(getPipeWithMemory());

	// 2. Run the pipe with user messages and other run options.
	let {stream} = await pipe.run(runOptions);

	// 3. Return the ReadableStream directly.
	return new Response(stream, {
		status: 200,
	});
};
