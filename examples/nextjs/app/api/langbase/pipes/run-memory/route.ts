import {Pipe} from '@baseai/core';
import {NextRequest} from 'next/server';
import pipeWithMemory from '../../../../../baseai/pipes/pipe-with-memory';

export async function POST(req: NextRequest) {
	let runOptions = await req.json();

	// 1. Initiate the Pipe.
	let pipe = new Pipe(pipeWithMemory());

	// 2. Run the pipe with user messages and other run options.
	let {stream} = await pipe.run(runOptions);

	// 3. Return the ReadableStream directly.
	return new Response(stream, {
		status: 200,
	});
}
