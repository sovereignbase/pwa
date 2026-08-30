/**
 * Generates Twitter Card metadata markup.
 *
 * @param title Page title.
 * @param description Page description.
 * @param url Canonical URL of the page.
 * @param imageUrl URL of the social sharing image.
 * @param imageAlt Alternative text for the social sharing image.
 * @param site Twitter/X handle of the site.
 * @param creator Twitter/X handle of the content creator.
 */
export const twitterMarkup = (
  title: string,
  description: string,
  url: `https://${string}`,
  imageUrl: string,
  imageAlt: string,
  site: `@${string}`,
  creator: `@${string}`,
) => `
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${description}" />
  <meta name="twitter:url" content="${url}" />
  <meta name="twitter:image" content="${imageUrl}" />
  <meta name="twitter:image:alt" content="${imageAlt}" />
  <meta name="twitter:site" content="${site}" />
  <meta name="twitter:creator" content="${creator}" />
`;
