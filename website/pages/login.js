/** @type {import("../pageManager").Page} */
export default {
  name: 'login',
  icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960"><path d="M480-120v-80h280v-560H480v-80h280q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H480Zm-80-160-55-58 102-102H120v-80h327L345-622l55-58 200 200-200 200Z"/></svg>',
  load: pageApi => {
    pageApi.shared.createNavBar(pageApi.allPages)

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

    const clickFunc = () => {
      pageApi.rawUss
        .connectToServer(
          new URL(urlElement.value.trim()),
          usernameElement.value.trim(),
          passwordElement.value.trim(),
          serviceElement.value.trim()
        )
        .then(result => {
          connectForm.remove()
          pageApi.setVfs(result)
        })
    }
    connectForm.addEventListener('submit', event => {
      event.preventDefault()
      clickFunc()
    })

    if (pageApi.TEST_FLAGS.AUTO_LOGIN) {
      pageApi.TEST_FLAGS.AUTO_LOGIN = false
      clickFunc()
    }
  }
}
