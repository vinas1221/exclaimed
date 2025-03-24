import { z } from 'zod';

export let memoryNameSchema = z
	.string()
	.min(3, 'Memory name must be at least 3 characters long')
	.max(50, 'Memory name must not exceed 50 characters')
	.regex(
		/^[a-zA-Z0-9.-]+$/,
		'Memory name can only contain letters, numbers, dots, and hyphens'
	);

export let docNameSchema = z.string().trim().min(1);

export let memoryDocSchema = z.object({
	memoryName: memoryNameSchema,
	documentName: docNameSchema
});

export let gitConfigSchema = z.object({
	enabled: z.boolean(),
	include: z
		.array(z.string().trim().min(1, 'Include pattern must not be empty'))
		.min(1, 'At least one include pattern must be specified')
		.describe('Glob patterns to include files in the memory'),
	gitignore: z.boolean().optional().default(true),
	deployedAt: z.string().trim().optional().default(''),
	embeddedAt: z.string().trim().optional().default('')
});

export let documentSchema = z.object({
	meta: z
		.function()
		.args(
			z.object({
				name: z.string(),
				size: z.string(),
				content: z.string(),
				blob: z.instanceof(Blob),
				path: z.string(),
			})
		)
		.returns(z.record(z.string()))
		.optional()
});

export let memoryConfigSchema = z.object({
	name: z.string(),
	description: z.string().optional(),
	git: gitConfigSchema,
	documents: documentSchema.optional()
});

export type GitConfigI = z.infer<typeof gitConfigSchema>;

export type MemoryConfigI = z.infer<typeof memoryConfigSchema>;
export type DocumentConfigI = z.infer<typeof documentSchema>;

export type MemoryI = MemoryConfigI;
