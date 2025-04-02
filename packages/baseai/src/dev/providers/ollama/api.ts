import type { ProviderAPIConfig, ProviderOptions } from 'types/providers';

let OllamaAPIConfig: ProviderAPIConfig = {
	headers: () => {
		return {};
	},
	getBaseURL: ({ providerOptions }: { providerOptions: ProviderOptions }) => {
		return providerOptions.customHost ?? 'http://localhost:11434';
	},
	chatComplete: '/v1/chat/completions'
};

export default OllamaAPIConfig;
