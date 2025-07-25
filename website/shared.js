import pageApi from './pageManager.js'

/**
 * @param {import("./pageManager").Page[]} allPages
 */
export const createNavBar = allPages => {
  const oldWrapper = document.getElementById('nav_bar')
  if (oldWrapper) oldWrapper.remove()
  const wrapper = document.createElement('div')
  wrapper.id = 'nav_bar'
  wrapper.classList.add('s-s')
  for (const page of allPages) {
    const pageElement = document.createElement('div')
    pageElement.classList.add('button')
    if (page.icon) pageElement.innerHTML = page.icon
    pageElement.classList.add('item')
    const span = document.createElement('span')
    span.textContent = page.name[0].toUpperCase() + page.name.slice(1)
    if (pageElement.firstChild === null) pageElement.appendChild(span)
    else pageElement.insertBefore(span, pageElement.firstChild)
    pageElement.addEventListener('click', () => pageApi.goto(page.name))
    wrapper.appendChild(pageElement)
  }
  if (document.body.firstChild === null) document.body.appendChild(wrapper)
  else document.body.insertBefore(wrapper, document.body.firstChild)
}
