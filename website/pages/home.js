/** @type {import("../pageManager").Page} */
export default {
  name: 'home',
  title: 'Home',
  load: api => {
    api.shared.createNavBar(api.allPages)
  }
}
