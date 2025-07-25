/** @type {import("../pageManager").Page} */
export default {
  name: 'raw',
  icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960"><path d="m480-400-80-80 80-80 80 80-80 80Zm-85-235L295-735l185-185 185 185-100 100-85-85-85 85ZM225-295 40-480l185-185 100 100-85 85 85 85-100 100Zm510 0L635-395l85-85-85-85 100-100 185 185-185 185ZM480-40 295-225l100-100 85 85 85-85 100 100L480-40Z"/></svg>',
  load: pageApi => {
    pageApi.shared.createNavBar(pageApi.allPages)

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
      if (saveName.value.trim().length === 0) {
        saveButton.classList.add('invalid')
        setTimeout(() => saveButton.classList.remove('invalid'), 1000)
      } else {
        pageApi.vfs.saveFile(saveName.value.trim(), saveContents.value)
        saveName.value = ''
        saveContents.value = ''
        clearOthers('save')
      }
    })

    getButton.addEventListener('click', () => {
      if (getName.value.trim().length === 0) {
        getButton.classList.add('invalid')
        setTimeout(() => getButton.classList.remove('invalid'), 1000)
      } else {
        pageApi.vfs.getFile(getName.value.trim()).then(file => (getContents.value = file))
        getName.value = ''
        clearOthers('get')
      }
    })

    deleteButton.addEventListener('click', () => {
      if (deleteName.value.trim().length === 0) {
        deleteButton.classList.add('invalid')
        setTimeout(() => deleteButton.classList.remove('invalid'), 1000)
      } else {
        pageApi.vfs.deleteFile(deleteName.value.trim())
        deleteName.value = ''
        clearOthers('delete')
      }
    })

    indexButton.addEventListener('click', () => {
      pageApi.vfs.getIndex().then(index => (indexContents.value = JSON.stringify(index, undefined, 2)))
      clearOthers('index')
    })
  }
}
