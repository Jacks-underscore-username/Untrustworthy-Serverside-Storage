/** @type {import("../pageManager").Page} */
export default {
  name: 'login',
  title: 'Login',
  /**
   * @param {import('../pageManager.js').PageApi} pageApi
   */
  load: pageApi => {
    const usernameElement = /** @type {HTMLInputElement} */ (document.getElementById('username'))
    const passwordElement = /** @type {HTMLInputElement} */ (document.getElementById('password'))
    const urlElement = /** @type {HTMLInputElement} */ (document.getElementById('url'))
    const serviceElement = /** @type {HTMLInputElement} */ (document.getElementById('service'))

    const connectForm = /** @type {HTMLFormElement} */ (document.getElementById('connect'))

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
      pageApi.rawUss
        .connectToServer(
          new URL(urlElement.value.trim()),
          usernameElement.value.trim(),
          passwordElement.value.trim(),
          serviceElement.value.trim()
        )
        .then(result => {
          pageApi.setVfs(result)
          pageApi.goto('demo')
        })
    })
  }
}
