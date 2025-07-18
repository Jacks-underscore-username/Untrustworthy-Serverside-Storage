import * as Security from './security.js'
document.addEventListener('DOMContentLoaded', async () => {
  const usernameElement = /** @type {HTMLInputElement} */ (document.getElementById('username'))
  const passwordElement = /** @type {HTMLInputElement} */ (document.getElementById('password'))
  const urlElement = /** @type {HTMLInputElement} */ (document.getElementById('url'))
  const serviceElement = /** @type {HTMLInputElement} */ (document.getElementById('service'))

  const connectForm = /** @type {HTMLFormElement} */ (document.getElementById('connect'))
  const saveButton = /** @type {HTMLButtonElement} */ (document.querySelector('#save > button'))
  const getButton = /** @type {HTMLButtonElement} */ (document.querySelector('#get > button'))
  const deleteButton = /** @type {HTMLButtonElement} */ (document.querySelector('#delete > button'))
  const indexButton = /** @type {HTMLButtonElement} */ (document.querySelector('#index > button'))

  const saveName = /** @type {HTMLInputElement} */ (document.querySelector('#save > .name'))
  const getName = /** @type {HTMLInputElement} */ (document.querySelector('#get > .name'))
  const deleteName = /** @type {HTMLInputElement} */ (document.querySelector('#delete > .name'))

  const saveContents = /** @type {HTMLTextAreaElement} */ (document.querySelector('#save > .contents'))
  const getContents = /** @type {HTMLTextAreaElement} */ (document.querySelector('#get > .contents'))
  const indexContents = /** @type {HTMLTextAreaElement} */ (document.querySelector('#index > .contents'))

  const apiWrapper = /** @type {HTMLDivElement} */ (document.getElementById('api'))

  /** @type {Awaited<ReturnType<import('./security.js').connectToServer>>| undefined} */
  let api = undefined

  for (const element of [usernameElement, passwordElement, urlElement, serviceElement]) {
    const toggle = /** @type {HTMLInputElement} */ (element.parentElement?.querySelector('input.toggle'))
    const key = element.id
    if (localStorage.getItem(key) !== null) {
      toggle.checked = true
      element.value = localStorage.getItem(key) ?? ''
    }
    toggle.addEventListener('change', () => {
      if (toggle.checked) localStorage.setItem(key, element.value)
      else localStorage.removeItem(key)
    })
    element.addEventListener('input', () => {
      if (toggle.checked) localStorage.setItem(key, element.value)
    })
  }

  connectForm.addEventListener('submit', event => {
    event.preventDefault()
    connectForm.remove()
    Security.connectToServer(
      new URL(urlElement.value.trim()),
      usernameElement.value.trim(),
      passwordElement.value.trim(),
      serviceElement.value.trim()
    ).then(result => {
      api = result
      apiWrapper.classList.add('ready')
    })
    clearOthers()
  })

  /**
   * @param {'save' | 'get' | 'delete' | 'index'} [self]
   */
  const clearOthers = self => {
    if (self !== 'save') {
      saveName.value = ''
      saveContents.value = ''
    }
    if (self !== 'get') {
      getName.value = ''
      getContents.value = ''
    }
    if (self !== 'delete') deleteName.value = ''
    if (self !== 'index') indexContents.value = ''
  }

  saveButton.addEventListener('click', () => {
    if (api === undefined) return
    if (saveName.value.trim().length === 0) {
      saveButton.classList.add('invalid')
      setTimeout(() => saveButton.classList.remove('invalid'), 1000)
    } else {
      api.saveFile(saveName.value.trim(), saveContents.value)
      saveName.value = ''
      saveContents.value = ''
      clearOthers('save')
    }
  })

  getButton.addEventListener('click', () => {
    if (api === undefined) return
    if (getName.value.trim().length === 0) {
      getButton.classList.add('invalid')
      setTimeout(() => getButton.classList.remove('invalid'), 1000)
    } else {
      api.getFile(getName.value.trim()).then(file => (getContents.value = file))
      getName.value = ''
      clearOthers('get')
    }
  })

  deleteButton.addEventListener('click', () => {
    if (api === undefined) return
    if (deleteName.value.trim().length === 0) {
      deleteButton.classList.add('invalid')
      setTimeout(() => deleteButton.classList.remove('invalid'), 1000)
    } else {
      api.deleteFile(deleteName.value.trim())
      deleteName.value = ''
      clearOthers('delete')
    }
  })

  indexButton.addEventListener('click', () => {
    if (api === undefined) return
    api.getIndex().then(index => (indexContents.value = JSON.stringify(index, undefined, 2)))
    clearOthers('index')
  })
})
