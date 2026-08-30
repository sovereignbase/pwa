import type { JSONLDMarkup } from '../.types/index.js'

/**
 * Generates Schema.org JSON-LD markup describing a website,
 * its web application, the current localized page, and publisher.
 */
export const jsonLDMarkup = ({
  site,
  application,
  page,
  organization,
}: JSONLDMarkup) => {
  const siteId = `${site.url}#website`
  const applicationId = `${application.url}#application`
  const organizationId = `${organization.url}#organization`
  const pageId = `${page.url}#webpage`

  const data = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': siteId,
        name: site.name,
        url: site.url,
        publisher: {
          '@id': organizationId,
        },
      },

      {
        '@type': 'WebApplication',
        '@id': applicationId,
        name: application.name,
        url: application.url,
        inLanguage: application.inLanguage,

        ...(application.applicationCategory
          ? { applicationCategory: application.applicationCategory }
          : {}),

        ...(application.operatingSystem
          ? { operatingSystem: application.operatingSystem }
          : {}),

        ...(application.browserRequirements
          ? { browserRequirements: application.browserRequirements }
          : {}),

        ...(application.featureList
          ? { featureList: application.featureList }
          : {}),

        ...(application.screenshot
          ? { screenshot: application.screenshot }
          : {}),

        publisher: {
          '@id': organizationId,
        },
      },

      {
        '@type': 'WebPage',
        '@id': pageId,
        name: page.name,
        description: page.description,
        url: page.url,
        inLanguage: page.inLanguage,

        isPartOf: {
          '@id': siteId,
        },

        mainEntity: {
          '@id': applicationId,
        },
      },

      {
        '@type': 'Organization',
        '@id': organizationId,
        name: organization.name,
        url: organization.url,
        logo: {
          '@type': 'ImageObject',
          url: organization.logo,
        },
      },
    ],
  }

  return `
  <script type="application/ld+json">
${JSON.stringify(data, null, 2).replaceAll('<', '\\u003c')}
  </script>
`
}
