/**
 * @typedef {Object} PageApi
 * @prop {(name: string) => void} goto
 * @prop {import('./security.js')} rawUss
 * @prop {import('./security.js').VFS} vfs
 * @prop {(vfs: import('./security.js').VFS) => void} setVfs
 * @prop {Page[]} allPages
 * @prop {import('./shared.js')} shared
 */

/**
 * @typedef {Object} Page
 * @prop {string} name
 * @prop {string} title
 * @prop {(api: PageApi) => void} load
 * @prop {() => void} [stop]
 * @prop {string} [icon]
 */

import homePage from './pages/home.js'
import loginPage from './pages/login.js'
import demoPage from './pages/demo.js'

import * as uss from './security.js'

import * as shared from './shared.js'

/** @type {import('./security.js').VFS | undefined} */
let vfs = undefined

/** @type {Page[]} */
const pages = [homePage, loginPage, demoPage]

/** @type {Object<string, string>} */
const pageContents = {}

/**
 * @param {string} filePath
 * @returns {string}
 */
const loadTextFileSync = filePath => {
  const xhr = new XMLHttpRequest()
  xhr.open('GET', filePath, false)
  try {
    xhr.send()
    if (xhr.status >= 200 && xhr.status < 300) return xhr.responseText
    throw new Error(`Error loading file synchronously: HTTP status ${xhr.status}`)
  } catch (error) {
    throw new Error(`Network error during synchronous file load: ${error}`)
  }
}

for (const page of pages) pageContents[page.name] = loadTextFileSync(`./pages/${page.name}.html`)

window.addEventListener('popstate', event => {
  event.preventDefault()
  console.log(event)
})

const body = document.body
const titleElement = /** @type {HTMLTitleElement} */ (document.getElementById('title'))

/**
 * @param {Page} page
 */
const loadPage = page => {
  const link = document.createElement('a')
  link.href = page.name
  link.addEventListener('click', event => event.preventDefault())
  link.click()
  window.history.pushState(page.name, '', page.name)
  body.innerHTML = pageContents[page.name]
  const cssLink = document.createElement('link')
  cssLink.href = `./pages/${page.name}.css`
  cssLink.rel = 'stylesheet'
  body.appendChild(cssLink)
  page.load({
    rawUss: uss,
    get vfs() {
      if (vfs === undefined) {
        loadPage(loginPage)
        throw new Error('Cannot use VFS yet')
      }
      return vfs
    },
    setVfs: x => (vfs = x),
    goto: pageName => loadPage(pages.find(page => page.name === pageName) ?? loginPage),
    allPages: pages,
    shared
  })
}

window.history.replaceState({ someState: true }, '', document.location.href)

window.addEventListener('popstate', event => {
  if (event.state) loadPage(pages.find(page => page.name === event.state) ?? loginPage)
})

loadPage(loginPage)
