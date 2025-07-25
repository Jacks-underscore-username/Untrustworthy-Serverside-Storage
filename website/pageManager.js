/**
 * @typedef {Object} PageApi
 * @prop {(name: string) => void} goto
 * @prop {import('./security.js')} rawUss
 * @prop {import('./security.js').VFS} vfs
 * @prop {(vfs: import('./security.js').VFS) => void} setVfs
 * @prop {Page[]} allPages
 * @prop {import('./shared.js')} shared
 * @prop {Object<string, boolean>} TEST_FLAGS
 */

/**
 * @typedef {Object} Page
 * @prop {string} name
 * @prop {(api: PageApi) => void} load
 * @prop {() => void} [stop]
 * @prop {string} [icon]
 */

import homePage from './pages/home.js'
import loginPage from './pages/login.js'
import rawPage from './pages/raw.js'
import explorerPage from './pages/explorer.js'

import * as uss from './security.js'

import * as shared from './shared.js'

/** @type {Object<string, boolean>} */
const TEST_FLAGS = {
  AUTO_LOGIN: true,
  KEEP_PAGE: true,
  SKIP_HISTORY: true,
  DISABLE_TEST_FLAGS: true
}
if (TEST_FLAGS.DISABLE_TEST_FLAGS) for (const key of Object.keys(TEST_FLAGS)) TEST_FLAGS[key] = false

/** @type {import('./security.js').VFS | undefined} */
let vfs = undefined

/** @type {Page[]} */
const pages = [homePage, loginPage, rawPage, explorerPage]

/** @type {Object<string, string>} */
const pageContents = {}

/** @type {Page | undefined} */
let lastPage = undefined

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

const pageWrapper = /** @type {HTMLDivElement}*/ (document.getElementById('page'))

/** @type {PageApi} */
const pageApi = {
  rawUss: uss,
  get vfs() {
    if (vfs === undefined) {
      loadPage(loginPage)
      throw new Error('Cannot use VFS yet')
    }
    return vfs
  },
  setVfs: x => {
    vfs = x
    if (targetPage !== undefined) {
      const realTargetPage = pages.find(page => page.name === targetPage)
      if (realTargetPage !== undefined) {
        targetPage = undefined
        loadPage(realTargetPage)
      }
    }
  },
  goto: pageName => loadPage(pages.find(page => page.name === pageName) ?? loginPage),
  allPages: pages,
  shared,
  TEST_FLAGS
}

/** @type {string | undefined} */
let targetPage = undefined
if (TEST_FLAGS.KEEP_PAGE && localStorage.getItem('last_page')) targetPage = localStorage.getItem('last_page') ?? ''
else localStorage.removeItem('last_page')

/**
 * @param {Page} page
 */
const loadPage = page => {
  if (lastPage !== undefined && lastPage.stop !== undefined) lastPage.stop()
  lastPage = page
  if (TEST_FLAGS.KEEP_PAGE) localStorage.setItem('last_page', page.name)
  const link = document.createElement('a')
  link.href = page.name
  link.addEventListener('click', event => event.preventDefault())
  link.click()
  if (!TEST_FLAGS.SKIP_HISTORY) window.history.pushState(page.name, '', page.name)
  pageWrapper.innerHTML = pageContents[page.name]
  const cssLink = document.createElement('link')
  cssLink.href = `./pages/${page.name}.css`
  cssLink.rel = 'stylesheet'
  pageWrapper.appendChild(cssLink)
  page.load(pageApi)
}

if (!TEST_FLAGS.SKIP_HISTORY) window.history.replaceState({ someState: true }, '', document.location.href)
if (!TEST_FLAGS.SKIP_HISTORY)
  window.addEventListener('popstate', event => {
    if (event.state) loadPage(pages.find(page => page.name === event.state) ?? loginPage)
  })

loadPage(loginPage)

export default pageApi
