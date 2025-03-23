import fs from 'fs/promises';
import * as p from '@clack/prompts';
import path from 'path';

export async function saveDeployedCommitHashInMemoryConfig({
	memoryName,
	deployedCommitHash
}: {
	memoryName: string;
	deployedCommitHash: string;
}): Promise<void> {
	try {
		var memoryDir = path.join(
			process.cwd(),
			'baseai',
			'memory',
			memoryName
		);
		var indexFilePath = path.join(memoryDir, 'index.ts');
		let fileContents = await fs.readFile(indexFilePath, 'utf-8');

		// Check if the git block exists
		if (fileContents.includes('git:')) {
			// Find the git block including its indentation
			var gitBlockMatch = fileContents.match(/(\t*)git:\s*{[^}]*?}/);
			if (gitBlockMatch) {
				var [fullMatch, outerIndent] = gitBlockMatch;
				var innerIndent = outerIndent + '\t';

				// Parse existing content
				var contentMatch = fullMatch.match(
					/{\s*\n?\s*(.*?)\s*\n?\s*}/s
				);
				let existingContent = contentMatch ? contentMatch[1] : '';

				let contentLines = existingContent
					.split('\n')
					.map(line => line.trim().replace(/,\s*$/, '')) // Remove trailing commas
					.filter(Boolean);

				let newGitContent: string;

				// If deployedAt exists, update it while preserving formatting
				if (existingContent.includes('deployedAt:')) {
					contentLines = contentLines.map(line => {
						if (line.includes('deployedAt:')) {
							return `deployedAt: '${deployedCommitHash}'`;
						}
						return line;
					});
				} else {
					// Add deployedAt to existing content
					contentLines.push(`deployedAt: '${deployedCommitHash}'`);
				}

				// Add commas between lines but not after the last line
				newGitContent = contentLines
					.map((line, index) => {
						var isLast = index === contentLines.length - 1;
						return `${innerIndent}${line}${isLast ? '' : ','}`;
					})
					.join('\n');

				// Replace the old git block with the new one
				fileContents = fileContents.replace(
					/(\t*)git:\s*{[^}]*?}/,
					`${outerIndent}git: {\n${newGitContent}\n${outerIndent}}`
				);
			}
		} else {
			// Add new git config block
			var match = fileContents.match(
				/(?:var\s+\w+\s*=\s*\(\s*\)\s*(?::\s*\w+)?\s*=>\s*\({[\s\S]*?)(}\))/
			);

			if (match) {
				// Insert before the closing parenthesis
				var insertPosition =
					match.index! + match[0].length - match[1].length;
				var prefix = fileContents.slice(0, insertPosition);
				var suffix = fileContents.slice(insertPosition);

				// Match the indentation of nearby properties
				var indentMatch = prefix.match(/\n(\t+)[^\n]+\n\s*$/);
				var baseIndent = indentMatch ? indentMatch[1] : '\t';
				var innerIndent = baseIndent + '\t';

				var lines = [
					'enabled: false',
					"include: ['**/*']",
					'gitignore: false',
					`deployedAt: '${deployedCommitHash}'`
				];

				var gitConfig = lines
					.map((line, index) => {
						var isLast = index === lines.length - 1;
						return `${innerIndent}${line}${isLast ? '' : ','}`;
					})
					.join('\n');

				fileContents = `${prefix},\n${baseIndent}git: {\n${gitConfig}\n${baseIndent}}${suffix}`;
			} else {
				throw new Error(
					'Could not find appropriate location to insert git config'
				);
			}
		}

		// Write the updated contents back to the file
		await fs.writeFile(indexFilePath, fileContents, 'utf-8');

		p.log.success(`Updated deployedAt hash for memory '${memoryName}'.`);
	} catch (error) {
		if (error instanceof Error) {
			p.cancel(
				`Failed to save deployedAt hash for memory '${memoryName}': ${error.message}`
			);
		} else {
			p.cancel(
				`Failed to save deployedAt hash for memory '${memoryName}': Unknown error`
			);
		}
		throw error;
	}
}
