import type { BCP47LanguageTag } from "@sovereignbase/utils";

type URLPath = `/${string}`;

export interface DocumentMarkupOptions {
  /** Language of the document. */
  language: BCP47LanguageTag;

  /** Document title. */
  title: string;

  /** Application name used by installed/mobile browser UI. */
  applicationName: string;

  /** Theme color used by supported browser chrome. */
  themeColor: string;

  /** CSP nonce applied to inline styles and scripts. */
  nonce: string;

  /** Complete markup rendered inside `<body>`. */
  bodyMarkup: string;

  /** Additional markup inserted into `<head>`. */
  headMarkup?: string;

  /** Critical CSS rendered inline during initial document load. */
  eagerStyles?: string;

  /** JavaScript module rendered inline into the document. */
  moduleScript?: string;

  /** Favicon URL. */
  iconUrl?: URLPath;

  /** Apple touch icon URL. */
  appleTouchIconUrl?: URLPath;

  /** Safari pinned-tab mask icon URL. */
  maskIconUrl?: URLPath;

  /** Web App Manifest URL. */
  manifestUrl?: URLPath;

  /** Safari pinned-tab icon color. Defaults to `themeColor`. */
  maskIconColor?: string;

  /** Preferred document color schemes. */
  colorScheme?: "light" | "dark" | "light dark" | "dark light";

  /** Apple standalone status bar appearance. */
  appleStatusBarStyle?: "default" | "black" | "black-translucent";
}

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
export const documentMarkup = ({
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
}: DocumentMarkupOptions): string => `<!DOCTYPE html>
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

    ${headMarkup}

    ${
      stylesheet ?
        `<style id="eager" nonce="${nonce}">
${stylesheet}
    </style>`
      : ""
    }
    ${
      entrypoint ?
        `<script type="module" nonce="${nonce}">
${entrypoint}
    </script>`
      : ""
    }
  </head>
  <body>
${bodyMarkup}
  </body>
</html>`;
