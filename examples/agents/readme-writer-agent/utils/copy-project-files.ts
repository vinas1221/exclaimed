import * as p from '@clack/prompts';
import path from 'path';
import {execAsync} from './exec-sync';
import {handleError} from './handle-error';

export async function copyProjectFiles({dirName}: {dirName: string}) {
	let spinner = p.spinner();
	spinner.start('Copying project files...');

	let source = process.cwd();
	let destination = path.join(
		dirName,
		'baseai',
		'memory',
		'code-files',
		'documents',
	);

	try {
		await execAsync(`rm -rf ${destination}`);
		await execAsync(`mkdir -p ${destination}`);
		await execAsync(`cp -rp ${source}/* ${destination}`);
		spinner.stop('Project files copied successfully.');
	} catch (error) {
		handleError({spinner, error});
	}
}
