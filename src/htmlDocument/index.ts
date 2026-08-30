import { DocumentMarkupOptions } from "../.types/index.js";
import { cspHash } from "../cspHash/index.js";
import * as seo from "../seoComponents/index.js";
/**
 * Generates a complete HTML document for a web application.
 *
 * Supports:
 * - localized document language,
 * - application and theme metadata,
 * - Web App Manifest integration,
 * - favicon and Apple/Safari application icons,
 * - critical inline styles,
 * - inline ES module initialization,
 * - arbitrary additional head markup.
 */
export const documentMarkup = async ({
  language,
  title,
  applicationName,
  themeColor,
  nonce,
  bodyMarkup = "",
  headMarkup = "",
  stylesheet = "",
  entrypoint = "",
  iconUrl,
  appleTouchIconUrl,
  maskIconUrl,
  manifestUrl,
  maskIconColor = themeColor,
  colorScheme = "light dark",
  appleStatusBarStyle = "black-translucent",
}: DocumentMarkupOptions): Promise<string> => `<!DOCTYPE html>
<html lang="${language}">
  <head>
    <meta charset="UTF-8" />
    <title>${title}</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />

    <meta name="application-name" content="${applicationName}" />
    <meta name="color-scheme" content="${colorScheme}" />
    <meta name="theme-color" content="${themeColor}" />

    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-title" content="${applicationName}" />
    <meta
      name="apple-mobile-web-app-status-bar-style"
      content="${appleStatusBarStyle}"
    />

    ${iconUrl ? `<link rel="icon" href="${iconUrl}" />` : ""}
    ${
      appleTouchIconUrl ?
        `<link rel="apple-touch-icon" sizes="180x180" href="${appleTouchIconUrl}" />`
      : ""
    }
    ${
      maskIconUrl ?
        `<link rel="mask-icon" href="${maskIconUrl}" color="${maskIconColor}" />`
      : ""
    }
    ${manifestUrl ? `<link rel="manifest" href="${manifestUrl}" />` : ""}

${seo.jsonLDMarkup({ site, application, page, organization })}
${seo.languageLinksMarkup}({})


    

    ${headMarkup}

    ${
      stylesheet ?
        `<style integrity="${await cspHash(stylesheet)}">
${stylesheet}
    </style>`
      : ""
    }

  </head>
  <body>
${bodyMarkup}
${
  entrypoint ?
    `<script type="module" integrity="${await cspHash(entrypoint)}">
${entrypoint}
    </script>`
  : ""
}
  </body>
</html>`;
