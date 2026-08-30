/**
 * Generates basic document head markup.
 *
 * @param title Document title.
 * @param author Document author.
 * @param description Document description.
 * @param iconUrl URL of the document icon.
 */
export const basicMarkup = (
  title: string,
  author: string,
  description: string,
  iconUrl: string,
) => `
  <meta charset="UTF-8" />
  <title>${title}</title>
  <meta name="author" content="${author}" />
  <meta name="description" content="${description}" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />

  <link rel="icon" href="${iconUrl}" />
`;
