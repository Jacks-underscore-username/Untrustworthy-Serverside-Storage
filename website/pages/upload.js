/** @type {import("../pageManager").Page} */
export default {
  name: 'upload',
  icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960"><path d="M440-320v-326L336-542l-56-58 200-200 200 200-56 58-104-104v326h-80ZM240-160q-33 0-56.5-23.5T160-240v-120h80v120h480v-120h80v120q0 33-23.5 56.5T720-160H240Z"/></svg>',
  load: pageApi => {
    pageApi.shared.createNavBar(pageApi.allPages)
    const uploadButton = /** @type {HTMLButtonElement} */ (document.getElementById('upload'))
    const encryptedToggle = /** @type {HTMLInputElement} */ (document.getElementById('encrypted_toggle'))
    const fileInput = /** @type {HTMLInputElement} */ (document.getElementById('file_input'))

    uploadButton.addEventListener('click', async () => {
      const file = fileInput.files?.[0]
      if (!file) return
      const data = await file.text()
      const encrypted = encryptedToggle.checked
      // @ts-expect-error
      const result = await pageApi.vfs.importFiles(data, encrypted)
      const message = `Uploaded ${result.length} file${result.length === 1 ? '' : 's'}: ${result.map(path => `\n${path}`).join('')}`
      console.log(message)
      alert(message)
    })
  }
}
