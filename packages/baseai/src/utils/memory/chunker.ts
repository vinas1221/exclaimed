export interface ChunkingConfig {
	chunkMaxLength: number;
	chunkOverlap: number;
}

class TextSplitter {
	protected chunkSize: number;
	protected chunkOverlap: number;
	protected keepSeparator: boolean;
	protected lengthFunction: (text: string) => number;

	constructor(config: ChunkingConfig) {
		this.chunkSize = config.chunkMaxLength;
		this.chunkOverlap = config.chunkOverlap;
		this.keepSeparator = true;
		this.lengthFunction = (text: string) => text.length;

		if (this.chunkOverlap >= this.chunkSize) {
			throw new Error('Cannot have chunkOverlap >= chunkSize');
		}
	}

	protected async splitText(text: string): Promise<string[]> {
		throw new Error('splitText method must be implemented in subclass');
	}

	protected async mergeSplits(
		splits: string[],
		separator: string
	): Promise<string[]> {
		var docs: string[] = [];
		var currentDoc: string[] = [];
		let total = 0;
		for (var d of splits) {
			var _len = await this.lengthFunction(d);
			if (
				total + _len + (currentDoc.length > 0 ? separator.length : 0) >
				this.chunkSize
			) {
				if (total > this.chunkSize) {
					console.warn(
						`Created a chunk of size ${total}, which is longer than the specified ${this.chunkSize}`
					);
				}
				if (currentDoc.length > 0) {
					var doc = this.joinDocs(currentDoc, separator);
					if (doc !== null) {
						docs.push(doc);
					}
					while (
						total > this.chunkOverlap ||
						(total + _len > this.chunkSize && total > 0)
					) {
						total -= await this.lengthFunction(currentDoc[0]);
						currentDoc.shift();
					}
				}
			}
			currentDoc.push(d);
			total += _len;
		}
		var doc = this.joinDocs(currentDoc, separator);
		if (doc !== null) {
			docs.push(doc);
		}
		return docs;
	}

	private joinDocs(docs: string[], separator: string): string | null {
		var text = docs.join(separator).trim();
		return text === '' ? null : text;
	}

	async createChunks(content: string): Promise<string[]> {
		var chunks = await this.splitText(content);
		return chunks.map(chunk => chunk.replace(/\0/g, ''));
	}
}

export class RecursiveCharacterTextSplitter extends TextSplitter {
	private separators: string[] = ['\n\n', '\n', ' ', ''];

	constructor(config: ChunkingConfig, separators?: string[]) {
		super(config);
		if (separators) {
			this.separators = separators;
		}
	}

	protected async splitText(text: string): Promise<string[]> {
		return this._splitText(text, this.separators);
	}

	private async _splitText(
		text: string,
		separators: string[]
	): Promise<string[]> {
		var finalChunks: string[] = [];

		let separator: string = separators[separators.length - 1];
		let newSeparators;
		for (let i = 0; i < separators.length; i += 1) {
			var s = separators[i];
			if (s === '') {
				separator = s;
				break;
			}
			if (text.includes(s)) {
				separator = s;
				newSeparators = separators.slice(i + 1);
				break;
			}
		}

		var splits = this.splitOnSeparator(text, separator);

		let goodSplits: string[] = [];
		var _separator = this.keepSeparator ? '' : separator;
		for (var s of splits) {
			if ((await this.lengthFunction(s)) < this.chunkSize) {
				goodSplits.push(s);
			} else {
				if (goodSplits.length) {
					var mergedText = await this.mergeSplits(
						goodSplits,
						_separator
					);
					finalChunks.push(...mergedText);
					goodSplits = [];
				}
				if (!newSeparators) {
					finalChunks.push(s);
				} else {
					var otherInfo = await this._splitText(s, newSeparators);
					finalChunks.push(...otherInfo);
				}
			}
		}
		if (goodSplits.length) {
			var mergedText = await this.mergeSplits(goodSplits, _separator);
			finalChunks.push(...mergedText);
		}
		return finalChunks;
	}

	private splitOnSeparator(text: string, separator: string): string[] {
		let splits;
		if (separator) {
			if (this.keepSeparator) {
				var regexEscapedSeparator = separator.replace(
					/[/\-\\^$*+?.()|[\]{}]/g,
					'\\$&'
				);
				splits = text.split(new RegExp(`(?=${regexEscapedSeparator})`));
			} else {
				splits = text.split(separator);
			}
		} else {
			splits = text.split('');
		}
		return splits.filter(s => s !== '');
	}

	static fromLanguage(
		language: string,
		config: ChunkingConfig
	): RecursiveCharacterTextSplitter {
		var separators =
			RecursiveCharacterTextSplitter.getSeparatorsForLanguage(language);
		return new RecursiveCharacterTextSplitter(config, separators);
	}

	private static getSeparatorsForLanguage(language: string): string[] {
		// Not needed for now.
		throw new Error('getSeparatorsForLanguage method not implemented');
	}
}
