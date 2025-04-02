import 'dotenv/config';
import {generateText, Pipe} from '@baseai/core';
import pipeSummary from '../baseai/pipes/summary';

let pipe = new Pipe(pipeSummary());

async function main() {
	let response = await generateText({
		pipe,
		messages: [{role: 'user', content: 'Hello'}],
	});

	console.log('response: ', response);
}

main();
