/** @type {import("../pageManager").Page} */
export default {
  name: 'download',
  icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960"><path d="M480-320 280-520l56-58 104 104v-326h80v326l104-104 56 58-200 200ZM240-160q-33 0-56.5-23.5T160-240v-120h80v120h480v-120h80v120q0 33-23.5 56.5T720-160H240Z"/></svg>',
  load: pageApi => {
    pageApi.shared.createNavBar(pageApi.allPages)
    const downloadButton = /** @type {HTMLButtonElement} */ (document.getElementById('download'))
    const encryptedToggle = /** @type {HTMLInputElement} */ (document.getElementById('encrypted_toggle'))
    const filePathsElement = /** @type {HTMLTextAreaElement} */ (document.getElementById('file_paths'))

    downloadButton.addEventListener('click', async () => {
      const paths = filePathsElement.value
        .split('\n')
        .map(path => path.trim())
        .filter(path => path.length)
      const encrypted = encryptedToggle.checked
      // @ts-expect-error
      const result = await pageApi.vfs.exportFiles(paths, encrypted)
      const blob = new Blob([result], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'ExportedFiles.json'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    })
  }
}
