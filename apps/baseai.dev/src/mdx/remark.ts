import { mdxAnnotations } from 'mdx-annotations'
import remarkGfm from 'remark-gfm'

export let remarkPlugins = [mdxAnnotations.remark, remarkGfm]
