import { minify } from 'html-minifier-terser'

/** Minifies a complete HTML document, including inline CSS and JavaScript. */
export default async function minifyHtml(source: string): Promise<string> {
  return minify(source, {
    collapseBooleanAttributes: true,
    collapseInlineTagWhitespace: true,
    collapseWhitespace: true,
    decodeEntities: true,
    html5: true,
    minifyCSS: true,
    minifyJS: {
      compress: {
        dead_code: true,
        passes: 3,
        toplevel: true,
        unused: true,
      },
      mangle: {
        toplevel: true,
      },
      module: true,
      toplevel: true,
    },
    removeAttributeQuotes: true,
    removeComments: true,
    removeEmptyAttributes: true,
    removeRedundantAttributes: true,
    sortAttributes: true,
    sortClassName: true,
    useShortDoctype: true,
  })
}
