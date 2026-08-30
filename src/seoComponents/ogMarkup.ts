import type { OpenGraphLocale } from "@sovereignbase/utils";

/**
 * Generates Open Graph metadata markup.
 *
 * @param locale Open Graph locale, such as `fi_FI` or `en_US`.
 * @param siteName Site or application name.
 * @param title Page title.
 * @param description Page description.
 * @param url Canonical URL of the page.
 * @param imageUrl URL of the social sharing image.
 * @param imageAlt Alternative text for the social sharing image.
 * @param imageWidth Width of the social sharing image in pixels.
 * @param imageHeight Height of the social sharing image in pixels.
 */
export const ogMarkup = (
  locale: OpenGraphLocale,
  siteName: string,
  title: string,
  description: string,
  url: `https://${string}`,
  imageUrl: string,
  imageAlt: string,
  imageWidth: number = 1200,
  imageHeight: number = 630,
) => `
  <meta property="og:locale" content="${locale}" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="${siteName}" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:url" content="${url}" />
  <meta property="og:image" content="${imageUrl}" />
  <meta property="og:image:width" content="${imageWidth}" />
  <meta property="og:image:height" content="${imageHeight}" />
  <meta property="og:image:alt" content="${imageAlt}" />
`;
