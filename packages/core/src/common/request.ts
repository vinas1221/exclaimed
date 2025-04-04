import {handleResponseStream} from 'src/helpers';
import {APIConnectionError, APIError} from './errors';

interface RequestOptions {
	endpoint: string;
	method: string;
	headers?: Record<string, string>;
	body?: any;
	stream?: boolean;
	rawResponse?: boolean;
}

interface RequestConfig {
	apiKey?: string;
	baseUrl: string;
	timeout?: number;
	llmKey?: string;
}

interface SendOptions extends RequestOptions {
	endpoint: string;
}

interface MakeRequestParams {
	url: string;
	options: RequestOptions;
	headers: Record<string, string>;
}

interface HandleGenerateResponseParams {
	response: Response;
	isChat: boolean;
	threadId: string | null;
	rawResponse: boolean;
}

export class Request {
	private config: RequestConfig;

	constructor(config: RequestConfig) {
		this.config = config;
	}

	private async send<T>({endpoint, ...options}: SendOptions): Promise<T> {
		const url = this.buildUrl({endpoint});
		const headers = this.buildHeaders({headers: options.headers});

		let response: Response;
		try {
			response = await this.makeRequest({
				url,
				options: {...options, endpoint},
				headers,
			});
		} catch (error) {
			throw new APIConnectionError({
				cause: error instanceof Error ? error : undefined,
			});
		}

		if (!response.ok) {
			await this.handleErrorResponse({response});
		}

		const threadId = response.headers.get('lb-thread-id');

		if (options.body?.stream) {
			return handleResponseStream({
				response,
				rawResponse: options.body.rawResponse,
			}) as T;
		}

		return this.handleRunResponse({
			response,
			isChat: options.body?.chat,
			threadId,
			rawResponse: options.body?.rawResponse ?? false,
		});
	}

	private buildUrl({endpoint}: {endpoint: string}): string {
		return `${this.config.baseUrl}${endpoint}`;
	}

	private buildHeaders({
		headers,
	}: {
		headers?: Record<string, string>;
	}): Record<string, string> {
		return {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${this.config.apiKey}`,
			'LB-LLM-Key': this.config.llmKey ?? '',
			...headers,
		};
	}

	private async makeRequest({
		url,
		options,
		headers,
	}: MakeRequestParams): Promise<Response> {
		const resp = await fetch(url, {
			method: options.method,
			headers,
			body: JSON.stringify(options.body),
			...(this.config.timeout && {
				signal: AbortSignal.timeout(this.config.timeout),
			}),
		});
		return resp;
	}

	private async handleErrorResponse({
		response,
	}: {
		response: Response;
	}): Promise<never> {
		let errorBody;
		try {
			errorBody = await response.json();
		} catch {
			errorBody = await response.text();
		}
		throw APIError.generate(
			response.status,
			errorBody,
			response.statusText,
			Object.fromEntries(response.headers.entries()),
		);
	}

	private async handleRunResponse({
		response,
		isChat,
		threadId,
		rawResponse,
	}: HandleGenerateResponseParams): Promise<any> {
		const generateResponse = await response.json();
		const buildResponse = generateResponse.raw
			? {
					completion: generateResponse.completion,
					...generateResponse.raw,
				}
			: generateResponse;

		const result: any = {
			...buildResponse,
		};

		result.threadId = threadId;

		if (rawResponse) {
			result.rawResponse = {
				headers: Object.fromEntries(response.headers.entries()),
			};
		}

		return result;
	}

	async post<T>(options: Omit<RequestOptions, 'method'>): Promise<T> {
		// logger('Request.post.options');
		// logger(options, {depth: null, colors: true});

		return this.send<T>({...options, method: 'POST'});
	}

	async get<T>(options: Omit<RequestOptions, 'method' | 'body'>): Promise<T> {
		return this.send<T>({...options, method: 'GET'});
	}

	async put<T>(options: Omit<RequestOptions, 'method'>): Promise<T> {
		return this.send<T>({...options, method: 'PUT'});
	}

	async delete<T>(
		options: Omit<RequestOptions, 'method' | 'body'>,
	): Promise<T> {
		return this.send<T>({...options, method: 'DELETE'});
	}
}
