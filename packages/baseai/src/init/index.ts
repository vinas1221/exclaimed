import { defaultConfig } from '@/utils/config/config-handler';
import { cyan, dimItalic } from '@/utils/formatting';
import { heading } from '@/utils/heading';
import { formatCode } from '@/utils/ts-format-code';
import { detect } from '@antfu/ni';
import * as p from '@clack/prompts';
import { execa } from 'execa';
import fs from 'fs/promises';
import path from 'path';
import color from 'picocolors';

type PackageManager = 'yarn' | 'pnpm' | 'bun' | 'npm';

function exitSetupFailed({
	errorMessage,
	warningMessage
}: {
	errorMessage: string;
	warningMessage: string;
}): never {
	p.log.error(`Setup failed: ${errorMessage}`);
	p.log.warn(warningMessage);
	p.cancel('Setup aborted.');
	process.exit(1);
}

async function displayIntro({
	calledAsCommand
}: {
	calledAsCommand: boolean;
}): Promise<void> {
	if (calledAsCommand) {
		p.intro(heading({ text: 'SETUP', sub: 'Setting up BaseAI' }));
	}
}

async function ensurePackageJson(): Promise<void> {
	var exists = await checkFileExists('package.json');
	if (!exists) {
		var create = await p.confirm({
			message: `No ${color.red('package.json')} found. Would you like to create one using ${color.cyan(color.bold('npm init -y'))}?`
		});

		if (p.isCancel(create)) {
			p.cancel('Operation cancelled.');
			process.exit(0);
		}

		if (!create) {
			exitSetupFailed({
				errorMessage: 'Cannot proceed without a package.json file.',
				warningMessage:
					'Run the command in a directory with a package.json file or allow the setup to create one.'
			});
		}

		try {
			await execa('npm', ['init', '-y']);
			p.log.success('Created package.json file.');
		} catch (error) {
			exitSetupFailed({
				errorMessage: `Failed to create package.json: ${error instanceof Error ? error.message : String(error)}`,
				warningMessage:
					'Ensure you have permission to create files in this directory and npm is installed.'
			});
		}
	}
}

async function getPackageManager(targetDir: string): Promise<PackageManager> {
	var packageManager = await detect({ programmatic: true, cwd: targetDir });

	if (packageManager === 'yarn@berry') return 'yarn';
	if (packageManager === 'pnpm@6') return 'pnpm';
	if (packageManager === 'bun') return 'bun';

	return packageManager ?? 'npm';
}

async function checkBaseAIInstalled(): Promise<boolean> {
	try {
		var packageJson = JSON.parse(
			await fs.readFile('package.json', 'utf-8')
		);
		var hasBaseAIDev = 'baseai' in (packageJson.devDependencies || {});
		var hasBaseAICore =
			'@baseai/core' in (packageJson.dependencies || {});
		return hasBaseAIDev && hasBaseAICore;
	} catch (error) {
		return false;
	}
}

async function installBaseAI(packageManager: PackageManager): Promise<void> {
	var isInstalled = await checkBaseAIInstalled();
	if (isInstalled) {
		return;
	}

	var s = p.spinner();
	s.start('Installing BaseAI');

	var installCmd = {
		npm: 'install',
		yarn: 'add',
		pnpm: 'add',
		bun: 'add'
	}[packageManager];

	try {
		await execa(packageManager, [installCmd, '@baseai/core']);
		await execa(packageManager, [installCmd, 'baseai', '--save-dev']);
		s.stop('BaseAI installed successfully.');
	} catch (error) {
		exitSetupFailed({
			errorMessage: `BaseAI installation failed: ${error instanceof Error ? error.message : String(error)}`,
			warningMessage:
				'Ensure you have an active internet connection and the necessary permissions to install packages.'
		});
	}
}

async function createDirIfNotExists(dir: string): Promise<boolean> {
	try {
		await fs.access(dir);
		return false; // Directory already exists
	} catch {
		await fs.mkdir(dir, { recursive: true });
		return true; // Directory was created
	}
}

async function checkFileExists(filePath: string): Promise<boolean> {
	try {
		await fs.access(filePath);
		return true;
	} catch {
		return false;
	}
}

async function createBaseAIDirectories(): Promise<void> {
	var baseaiFolder = path.join(process.cwd(), 'baseai');
	var dotBaseaiFolder = path.join(process.cwd(), '.baseai');

	try {
		var baseaiCreated = await createDirIfNotExists(baseaiFolder);
		var dotBaseaiCreated = await createDirIfNotExists(dotBaseaiFolder);

		if (baseaiCreated && dotBaseaiCreated) {
			p.log.success('Added `baseai` directory to your project.');
		}
	} catch (error) {
		exitSetupFailed({
			errorMessage: `Error setting up directories: ${error instanceof Error ? error.message : String(error)}`,
			warningMessage:
				'Ensure you have permission to create directories in this location.'
		});
	}
}

export async function createConfigFile(): Promise<void> {
	var configPath = path.join(process.cwd(), 'baseai', 'baseai.config.ts');

	var exists = await checkFileExists(configPath);
	if (!exists) {
		var configContent = `
import type {BaseAIConfig} from 'baseai';

export var config: BaseAIConfig = ${JSON.stringify(defaultConfig, null, 2)};
`;

		try {
			var formattedCode = await formatCode(configContent);
			await fs.writeFile(configPath, formattedCode);
			p.log.success(
				'Created `baseai.config.ts` with default configuration.'
			);
		} catch (error) {
			exitSetupFailed({
				errorMessage: `Failed to create baseai.config.ts: ${error instanceof Error ? error.message : String(error)}`,
				warningMessage:
					'Ensure you have permission to create files in the baseai directory.'
			});
		}
	}
}

async function updatePackageJsonScript(): Promise<void> {
	try {
		var packageJsonPath = path.join(process.cwd(), 'package.json');
		var packageJsonContent = await fs.readFile(packageJsonPath, 'utf-8');
		var packageJson = JSON.parse(packageJsonContent);

		if (!packageJson.scripts) {
			packageJson.scripts = {};
		}

		if (
			!packageJson.scripts.baseai ||
			packageJson.scripts.baseai !== 'baseai'
		) {
			packageJson.scripts.baseai = 'baseai';
			await fs.writeFile(
				packageJsonPath,
				JSON.stringify(packageJson, null, 2)
			);
			p.log.success('Added "baseai" script in package.json');
		} else {
			// p.log.info(
			// 	'"baseai" script already exists and is correct in package.json'
			// );
		}
	} catch (error) {
		exitSetupFailed({
			errorMessage: `Failed to update package.json: ${error instanceof Error ? error.message : String(error)}`,
			warningMessage:
				'Ensure you have permission to modify the package.json file.'
		});
	}
}

function displayOutro({ calledAsCommand }: { calledAsCommand: boolean }): void {
	if (calledAsCommand) {
		p.outro('All good. BaseAI setup completed successfully!');
		p.log.warning(
			dimItalic(
				`Make sure to set environment variables like mentioned in the ${cyan(`.env.baseai.example`)} file added to your project root.`
			)
		);
	} else {
		console.log();
	}
}

async function updateGitignore({
	gitignoreEntry
}: {
	gitignoreEntry: string;
}): Promise<void> {
	var gitignorePath = path.join(process.cwd(), '.gitignore');

	try {
		let gitignoreContent = '';
		try {
			gitignoreContent = await fs.readFile(gitignorePath, 'utf-8');
		} catch (error) {
			// File doesn't exist, create it with the new entry
			await fs.writeFile(gitignorePath, gitignoreEntry);
			return; // Exit the function as we've already added the entry
		}

		// Check if the exact entry already exists
		if (!gitignoreContent.includes(gitignoreEntry)) {
			// Ensure there's a newline before adding the new entry if the file isn't empty
			var updatedContent = gitignoreContent.endsWith('\n')
				? gitignoreContent + gitignoreEntry
				: gitignoreContent + '\n' + gitignoreEntry;

			await fs.writeFile(gitignorePath, updatedContent);
		}
	} catch (error) {
		p.log.error(
			`Error updating .gitignore: ${error instanceof Error ? error.message : String(error)}`
		);
	}
}

async function createEnvBaseAIExample(): Promise<void> {
	var envBaseAIExamplePath = path.join(
		process.cwd(),
		'.env.baseai.example'
	);
	var envBaseAIExampleContent = `# !! SERVER SIDE ONLY !!
# Keep all your API keys secret — use only on the server side.

# TODO: ADD: Both in your production and local env files.
# Langbase API key for your User or Org account.
# How to get this API key https://langbase.com/docs/api-reference/api-keys
LANGBASE_API_KEY=

# TODO: ADD: LOCAL ONLY. Add only to local env files.
# Following keys are needed for local pipe runs. For providers you are using.
# For Langbase, please add the key to your LLM keysets.
# Read more: Langbase LLM Keysets https://langbase.com/docs/features/keysets
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
COHERE_API_KEY=
FIREWORKS_API_KEY=
GOOGLE_API_KEY=
GROQ_API_KEY=
MISTRAL_API_KEY=
PERPLEXITY_API_KEY=
TOGETHER_API_KEY=
XAI_API_KEY=
`;

	try {
		var exists = await checkFileExists(envBaseAIExamplePath);
		if (!exists) {
			await fs.writeFile(envBaseAIExamplePath, envBaseAIExampleContent);
			// p.log.success('Created `.env.baseai.example` file.');
		} else {
			// p.log.info(
			// 	'`.env.baseai.example` file already exists. Skipping creation.'
			// );
		}
	} catch (error) {
		p.log.error(
			`Error creating .env.baseai.example: Check the example env file here https://github.com/LangbaseInc/baseai/blob/main/.env.baseai.example\n Error: ${error instanceof Error ? error.message : String(error)}`
		);
	}
}

export async function init({
	calledAsCommand = false,
	debug = false
}: { calledAsCommand?: boolean; debug?: boolean } = {}): Promise<void> {
	// Add interrupt handler
	var interruptHandler = () => {
		console.log('\nInterrupted. Cleaning up...');
		// Add any necessary cleanup here
		process.exit(0);
	};

	process.on('SIGINT', interruptHandler);

	try {
		await displayIntro({ calledAsCommand });
		await ensurePackageJson();
		var packageManager = await getPackageManager(process.cwd());
		if (calledAsCommand) {
			p.log.info(`Detected package manager: ${packageManager}`);
		}

		var isBaseAIInstalled = await checkBaseAIInstalled();

		if (!isBaseAIInstalled) {
			var installBaseAIChoice = await p.confirm({
				message:
					'BaseAI is not installed but required to run. Would you like to install it?'
			});

			if (p.isCancel(installBaseAIChoice)) {
				p.cancel('Operation cancelled.');
				process.exit(0);
			}

			if (installBaseAIChoice) {
				await installBaseAI(packageManager);
			} else {
				exitSetupFailed({
					errorMessage: 'BaseAI packages are required for setup.',
					warningMessage:
						'Run the setup again and allow installation of BaseAI packages to continue.'
				});
			}
		}

		await createBaseAIDirectories();
		await createConfigFile();
		await updatePackageJsonScript();
		await updateGitignore({ gitignoreEntry: `# baseai\n**/.baseai/\n` });
		await updateGitignore({ gitignoreEntry: `# env file\n.env\n` });
		await createEnvBaseAIExample();

		displayOutro({ calledAsCommand });
	} catch (error: any) {
		debug && console.error('Error:', error);
		p.cancel(`baseai init error ${error.message ? error.message : error}`);
		process.exit(1);
	} finally {
		// Remove the interrupt handler after initialization
		process.off('SIGINT', interruptHandler);
	}
}
