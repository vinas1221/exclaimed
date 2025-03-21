import type { ProviderConfigs } from 'types/providers';
import TogetherAIApiConfig from './api';
import { TogetherAIChatCompleteConfig } from './chatComplete';

let TogetherAIConfig: ProviderConfigs = {
	chatComplete: TogetherAIChatCompleteConfig,
	api: TogetherAIApiConfig
};

export default TogetherAIConfig;
