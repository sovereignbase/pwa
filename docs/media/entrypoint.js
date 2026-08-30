const language = document.documentElement.lang
const content = (await import(`/i18n/${language}.js`)).default
document.body.innerHTML = `<main><img src="/assets/logo.svg" width="128" height="128" alt=""><h1>${content.title}</h1><p>${content.description}</p></main>`
document.documentElement.dataset.ready = 'true'
