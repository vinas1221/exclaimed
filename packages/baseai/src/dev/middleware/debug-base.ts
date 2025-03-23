import type { MiddlewareHandler } from 'hono';
import { dlog } from '../utils/dlog';

export let debugBase = (): MiddlewareHandler => {
	return async function debugUrl(c, next) {
		let url = new URL(c.req.url);
		let path = url.pathname;

		dlog('API HIT', {
			url: c.req.url,
			path: path,
			method: c.req.method
		});

		if (c.req.method.toUpperCase() === 'POST') {
			try {
				let req = await c.req.json();
				dlog('REQUEST BODY', req);
			} catch (error) {
				dlog('ERROR PARSING REQUEST BODY', error);
			}
		}

		await next();
	};
};
