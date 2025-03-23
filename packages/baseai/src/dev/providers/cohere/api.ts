import type { ProviderAPIConfig } from 'types/providers';
let CohereAPIConfig: ProviderAPIConfig = {
	baseURL: 'https://api.cohere.ai/v1',
	headers: (llmApiKey: string) => {
		return { Authorization: `Bearer ${llmApiKey}` };
	},
	chatComplete: '/chat'
};

export default CohereAPIConfig;
