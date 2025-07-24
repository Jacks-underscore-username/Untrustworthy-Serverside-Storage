/**
 * @param {import("./pageManager").Page[]} allPages
 */
export const createNavBar = allPages => {
  const wrapper = document.createElement('div')
  wrapper.id = 'nav_bar'
  for (const page of allPages) {
    const pageElement = document.createElement('div')
    pageElement.classList.add('item')
    pageElement.textContent = page.title
    if (page.icon !== undefined) {
      const icon = document.createElement('div')
      icon.classList.add('icon')
      icon.innerHTML = page.icon
      pageElement.appendChild(icon)
    }
    wrapper.appendChild(pageElement)
  }
  if (document.body.firstChild === null) document.body.appendChild(wrapper)
  else document.body.insertBefore(wrapper, document.body.firstChild)
}
