/**
 * @type {import("../pageManager").Page}
 */
export default {
  name: 'explorer',
  icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960"><path d="M160-160q-33 0-56.5-23.5T80-240v-480q0-33 23.5-56.5T160-800h240l80 80h320q33 0 56.5 23.5T880-640H447l-80-80H160v480l96-320h684L837-217q-8 26-29.5 41.5T760-160H160Zm84-80h516l72-240H316l-72 240Zm0 0 72-240-72 240Zm-84-400v-80 80Z"/></svg>',
  load: pageApi => {
    pageApi.shared.createNavBar(pageApi.allPages)

    const vfs = pageApi.vfs

    const explorerElement = /** @type {HTMLDivElement} */ (document.getElementById('explorer'))

    const editorNameElement = /** @type {HTMLInputElement} */ (document.getElementById('name'))
    const editorContentElement = /** @type {HTMLTextAreaElement} */ (document.getElementById('textarea'))

    editorNameElement.addEventListener('change', () => {
      if (currentFilePath !== undefined && editorNameElement.value.trim().length) {
        const splitPath = currentFilePath.split('/')
        const currentName = splitPath.pop()
        if (editorNameElement.value.trim() !== currentName) {
          const newPath = vfs.joinPaths(...splitPath, editorNameElement.value.trim())
          console.log(`Changing ${currentFilePath} to ${newPath}`)
          console.log(editorContentElement.value)
          pageApi.vfs.saveFile(newPath, editorContentElement.value)
          pageApi.vfs.deleteFile(currentFilePath)
          currentFilePath = newPath
          generate()
        }
      }
    })

    /** @type {string | undefined} */
    let currentFilePath = undefined

    const generate = async () => {
      const index = await pageApi.vfs.getIndex()
      explorerElement.innerHTML = ''
      generateFolder(explorerElement, '', index, '')
    }

    /**
     * @param {HTMLDivElement} parent
     * @param {string} name
     * @param {import("../security").Index} index
     * @param {string} path
     */
    const generateFolder = (parent, name, index, path) => {
      path = vfs.joinPaths(path, name)
      const wrapper = document.createElement('div')
      wrapper.classList.add('folder_wrapper', 'bordered')
      const title = document.createElement('div')
      title.classList.add('title')
      title.textContent = name
      wrapper.appendChild(title)
      const contents = document.createElement('div')
      contents.classList.add('folder_contents')
      wrapper.appendChild(contents)
      for (const [key, value] of Object.entries(index.contents)) {
        if (value.type === 'file') generateFile(contents, key, path)
        if (value.type === 'folder') generateFolder(contents, key, value, path)
      }
      parent.appendChild(wrapper)
    }

    /**
     * @param {HTMLDivElement} parent
     * @param {string} name
     * @param {string} path
     */
    const generateFile = (parent, name, path) => {
      const element = document.createElement('div')
      element.classList.add('file')
      element.textContent = name
      element.addEventListener('click', async () => {
        const data = await pageApi.vfs.getFile(vfs.joinPaths(path, name))
        editorNameElement.value = name
        editorContentElement.value = data
        currentFilePath = vfs.joinPaths(path, name)
      })
      parent.appendChild(element)
    }

    generate()
  }
}
