import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ['react-markdown', 'remark-gfm', 'remark-parse', 'unified', 'bail', 'is-plain-obj', 'trough', 'vfile', 'unist-util-stringify-position', 'micromark', 'decode-named-character-reference', 'character-entities', 'mdast-util-from-markdown', 'mdast-util-to-string', 'mdast-util-gfm', 'mdast-util-gfm-autolink-literal', 'mdast-util-gfm-footnote', 'mdast-util-gfm-strikethrough', 'mdast-util-gfm-table', 'mdast-util-gfm-task-list-item', 'mdast-util-to-hast', 'hast-util-to-jsx-runtime', 'devlop', 'remark-rehype'],
};

export default nextConfig;
