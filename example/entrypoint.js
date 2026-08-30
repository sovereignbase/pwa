const language = document.documentElement.lang
const content = (await import(`/i18n/${language}.js`)).default
const main = document.createElement('main')
const image = document.createElement('img')
image.alt = ''
image.height = 128
image.src = '/assets/logo.svg'
image.width = 128
const heading = document.createElement('h1')
heading.textContent = content.title
const description = document.createElement('p')
description.textContent = content.description
main.append(image, heading, description)
document.body.replaceChildren(main)
document.documentElement.dataset.ready = 'true'
