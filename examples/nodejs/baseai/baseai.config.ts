import type {BaseAIConfig} from 'baseai';

export let config: BaseAIConfig = {
	log: {
		isEnabled: true,
		logSensitiveData: false,
		pipe: true,
		'pipe.completion': true,
		'pipe.request': true,
		'pipe.response': true,
		tool: false,
		memory: false,
	},
	memory: {
		useLocalEmbeddings: false,
	},
	envFilePath: '.env',
};
