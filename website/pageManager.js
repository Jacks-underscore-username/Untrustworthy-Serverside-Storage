import editorPage from './pages/editor.js'
import explorerPage from './pages/explorer.js'
import homePage from './pages/home.js'
import loginPage from './pages/login.js'
import rawPage from './pages/raw.js'
import graphPage from './pages/graph.js'

import plaintextNode from './nodes/plaintext.js'
import topicNode from './nodes/topic.js'

import * as uss from './security.js'

import * as shared from './shared.js'
import markup from './markup.js'

/** @type {Object<string, boolean>} */
const TEST_FLAGS = {
  AUTO_LOGIN: true,
  KEEP_PAGE: true,
  SKIP_HISTORY: true,
  DISABLE_TEST_FLAGS: false
}
if (TEST_FLAGS.DISABLE_TEST_FLAGS) for (const key of Object.keys(TEST_FLAGS)) TEST_FLAGS[key] = false

/** @type {import('./types.d.js').VFS | undefined} */
let vfs = undefined

/** @type {import('./types.d.js').Page[]} */
const pages = [homePage, loginPage, rawPage, explorerPage, editorPage, graphPage]

/** @type {Object<string, string>} */
const pageContents = {}

/** @type {import('./types.d.js').Node_type<any>[]} */
const nodeTypes = [plaintextNode, topicNode]

/** @type {import('./types.d.js').Page | undefined} */
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

/** @type {import('./types.d.js').PageApi} */
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
  markup,
  nodeTypes,
  TEST_FLAGS
}

/** @type {string | undefined} */
let targetPage = undefined
if (TEST_FLAGS.KEEP_PAGE && localStorage.getItem('last_page')) targetPage = localStorage.getItem('last_page') ?? ''
else localStorage.removeItem('last_page')

/**
 * @param {import('./types.d.js').Page} page
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
