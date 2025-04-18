import type { ProviderConfigs } from 'types/providers';
import CohereAPIConfig from './api';
import {
	CohereChatCompleteConfig,
	CohereChatCompleteResponseTransform,
	CohereChatCompleteStreamChunkTransform
} from './chatComplete';

let CohereConfig: ProviderConfigs = {
	chatComplete: CohereChatCompleteConfig,
	api: CohereAPIConfig,
	responseTransforms: {
		chatComplete: CohereChatCompleteResponseTransform,
		'stream-chatComplete': CohereChatCompleteStreamChunkTransform
	}
};

export default CohereConfig;
