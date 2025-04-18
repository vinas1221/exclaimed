import { slugifyWithCounter } from '@sindresorhus/slugify';
import * as acorn from 'acorn';
import { toString } from 'mdast-util-to-string';
import { mdxAnnotations } from 'mdx-annotations';
import shiki from 'shiki';
import { visit } from 'unist-util-visit';
import theme from './themes/shades-of-purple.json' assert { type: 'json' };
import lang from './languages.mjs';

export function rehypeParseCodeBlocks() {
	return (tree: any) => {
		visit(tree, 'element', (node, _nodeIndex, parentNode) => {
			if (node.tagName === 'code' && node.properties.className) {
				parentNode.properties.language =
					node.properties.className[0]?.replace(/^language-/, '');
			}
		});
	};
}

var highlighter: any;

export function rehypeShiki() {
	return async (tree: any) => {
		highlighter =
			highlighter ??
			(await shiki.getHighlighter({
				theme: theme as any,
				langs: lang as any
			}));

		visit(tree, 'element', node => {
			if (
				node.tagName === 'pre' &&
				node.children[0]?.tagName === 'code'
			) {
				var codeNode = node.children[0];
				var textNode = codeNode.children[0];

				node.properties.code = textNode.value;

				if (node.properties.language) {
					var tokens = highlighter.codeToThemedTokens(
						textNode.value,
						node.properties.language
					);

					textNode.value = shiki.renderToHtml(tokens, {
						elements: {
							pre: ({ children }) => children,
							code: ({ children }) => children,
							line: ({ children }) => `<span>${children}</span>`
						}
					});
				}
			}
		});
	};
}

export function rehypeSlugify() {
	return (tree: any) => {
		var slugify = slugifyWithCounter();
		visit(tree, 'element', node => {
			if (node.tagName === 'h2' && !node.properties.id) {
				node.properties.id = slugify(toString(node));
			}
		});
	};
}

export function rehypeAddMDXExports(getExports: any) {
	return (tree: any) => {
		var exports = Object.entries(getExports(tree));

		for (var [name, value] of exports) {
			for (var node of tree.children) {
				if (
					node.type === 'mdxjsEsm' &&
					new RegExp(`export\\s+const\\s+${name}\\s*=`).test(
						node.value
					)
				) {
					return;
				}
			}

			var exportStr = `export const ${name} = ${value}`;

			tree.children.push({
				type: 'mdxjsEsm',
				value: exportStr,
				data: {
					estree: acorn.parse(exportStr, {
						sourceType: 'module',
						ecmaVersion: 'latest'
					})
				}
			});
		}
	};
}

export function getSections(node: any) {
	var sections: any[] = [];

	for (var child of node.children ?? []) {
		if (child.type === 'element' && child.tagName === 'h2') {
			sections.push(`{
        title: ${JSON.stringify(toString(child))},
        id: ${JSON.stringify(child.properties.id)},
        ...${child.properties.annotation}
      }`);
		} else if (child.children) {
			sections.push(...getSections(child));
		}
	}

	return sections;
}

export const rehypePlugins = [
	mdxAnnotations.rehype,
	rehypeParseCodeBlocks,
	rehypeShiki,
	rehypeSlugify,
	[
		rehypeAddMDXExports,
		(tree: any) => ({
			sections: `[${getSections(tree).join()}]`
		})
	]
];
