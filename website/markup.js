/**
 * @param {string} hex
 * @return {string}
 */
const expandHex = hex => {
  const hasPound = hex.startsWith('#')
  hex = hasPound ? hex.slice(1) : hex
  if (hex.length === 3) return `${hasPound ? '#' : ''}${hex[0].repeat(2)}${hex[1].repeat(2)}${hex[2].repeat(2)}`
  if (hex.length === 4)
    return `${hasPound ? '#' : ''}${hex[0].repeat(2)}${hex[1].repeat(2)}${hex[2].repeat(2)}${hex[3].repeat(2)}`
  throw new Error('Uh oh')
}

class LocationAwareString {
  /** @type {{value: string, line: number, column: number}[]} */
  parts = []
  /**
   * @param {string} str
   * @param {number} [line]
   * @param {number} [column]
   * @param {string} [lineBreak]
   */
  constructor(str, line = -1, column = -1, lineBreak = undefined) {
    if (lineBreak !== undefined) {
      const splitParts = str.split(lineBreak)
      for (let index = 0; index < splitParts.length; index++) {
        if (index) this.parts.push({ value: lineBreak, line: -1, column: -1 })
        this.parts.push({ value: splitParts[index], line: line + index, column: index ? 0 : column })
      }
    } else this.parts.push({ value: str, line, column })
  }

  /**
   * @param {LocationAwareString} other
   * @returns {LocationAwareString}
   */
  add(other) {
    this.parts.push(...other.parts)
    return this
  }

  /**
   * @param {(LocationAwareString | string)[]} parts
   * @returns {LocationAwareString}
   */
  static of(...parts) {
    const mappedParts = parts
      .map(part => (part instanceof LocationAwareString ? part : new LocationAwareString(part)))
      .filter(part => part.length)
    if (!mappedParts.length) return new LocationAwareString('')
    const basePart = mappedParts.shift()
    if (basePart === undefined) throw new Error('Cannot create compound LAS from an empty array')
    for (const part of mappedParts)
      for (const subPart of part.parts)
        basePart.parts.push({ value: subPart.value, line: subPart.line, column: subPart.column })
    return basePart
  }

  /**
   * @param {string} str
   * @returns {LocationAwareString[]}
   */
  split(str) {
    /** @type {LocationAwareString[]} */
    const parts = []
    for (const part of this.parts) {
      let start = 0
      do {
        const end = part.value.indexOf(str, start)
        if (end === -1) {
          parts.push(new LocationAwareString(part.value.slice(start), part.line, part.column + start))
          break
        }
        parts.push(new LocationAwareString(part.value.slice(start, end + str.length), part.line, part.column + start))
        start = end + str.length
      } while (start < part.value.length)
    }
    const result = []
    let current = []
    for (const part of parts) {
      if (part.toString().endsWith(str)) {
        if (part.length > str.length) current.push(part.slice(0, part.length - str.length))
        result.push(LocationAwareString.of(...current))
        current = []
      } else if (parts.length > 0) current.push(part)
    }
    result.push(LocationAwareString.of(...current))
    {
      const a = JSON.stringify(result.map(part => part.toString()))
      const b = JSON.stringify(this.toString().split(str))
      if (a !== b) throw new Error(`Split failed: got ${a} but wanted ${b}`)
    }
    return result
  }

  /**
   * @param {number} start
   * @param {number} [stop]
   * @returns {LocationAwareString}
   */
  slice(start, stop) {
    let offset = 0
    const rawResult = []
    for (const part of this.parts) {
      if (offset + part.value.length >= start && (stop === undefined || offset < stop))
        rawResult.push(
          new LocationAwareString(
            part.value.slice(start - offset, stop === undefined ? undefined : stop - offset),
            part.line,
            part.column + start - offset
          )
        )
      offset += part.value.length
    }
    const result = LocationAwareString.of(...rawResult)
    {
      const a = result.toString()
      const b = this.toString().slice(start, stop)
      if (a !== b) throw new Error(`Slice failed: got ${a} but wanted ${b}`)
    }
    return result
  }

  /**
   * @param {string} str
   * @returns {boolean}
   */
  includes(str) {
    return this.toString().includes(str)
  }

  /**
   * @param {string} str
   * @returns {number}
   */
  indexOf(str) {
    return this.toString().indexOf(str)
  }

  /**
   * @returns {string}
   */
  toString() {
    return this.parts.reduce((prev, part) => `${prev}${part.value}`, '')
  }

  get length() {
    return this.toString().length
  }

  get start() {
    return this.parts.reduce((prev, part) => Math.min(prev, part.column), Number.POSITIVE_INFINITY)
  }

  get end() {
    return this.parts.reduce((prev, part) => Math.max(prev, part.column + part.value.length), Number.NEGATIVE_INFINITY)
  }

  get firstLine() {
    return this.parts.reduce((prev, part) => Math.min(prev, part.line), Number.POSITIVE_INFINITY)
  }

  /**
   * @returns {LocationAwareString}
   */
  inferLocations() {
    let lastLine = -1
    let lastColumn = -1
    for (const part of this.parts) {
      if (part.line === -1 && lastLine !== -1) part.line = lastLine
      if (part.column === -1 && lastColumn !== -1) part.column = lastColumn
      if (part.line !== -1) lastLine = part.line
      if (part.column !== -1) lastColumn = part.column + part.value.length
    }
    return this
  }
}

// @ts-expect-error
Array.prototype.lasJoin = function (separator) {
  if (
    this.some(x => x instanceof LocationAwareString) &&
    this.every(x => typeof x === 'string' || x instanceof LocationAwareString)
  )
    return LocationAwareString.of(...this.flatMap((part, index) => (index ? [separator ?? ', ', part] : part)))
  return Array.prototype.join.call(this, separator)
}

/**
 * @param {import('./types.d.js').CssStyleObj} defaultStyle
 * @param {import('./types.d.js').CssStyleObj} style
 * @param {number} scale
 * @returns {string}
 */
const cssRuleFromStyles = (defaultStyle, style, scale = 1) => {
  const out = []
  for (const [key, value] of Object.entries(style)) {
    // @ts-expect-error
    if (defaultStyle[key] !== style[key]) {
      if (key === 'color') out.push(`color:${value}`)
      else if (key === 'italic') out.push(`font-style:${value ? 'italic' : 'normal'}`)
      else if (key === 'bold') out.push(`font-weight:${value ? 'bold' : 'normal'}`)
      else if (key === 'size')
        if (scale === 1) out.push(`font-size:${value}`)
        else out.push(`font-size:calc(${value} * ${scale})`)
      else if (key === 'strike') out.push(`text-decoration: ${value ? 'line-through' : 'none'}`)
      else if (key === 'underline') out.push(`text-decoration: ${value ? 'underline' : 'none'}`)
    }
  }
  return `${out.join('; ')};`
}

/**
 * @param {string} message
 * @returns {string}
 */
const err = message => `Error parsing markup: ${message}`

// Some helper functions to make more readable code

/**
 * charAt + toLowerCase
 * @param {string} str
 * @param {number} i
 * @returns {string}
 */
const lca = (str, i) => str.charAt(i).toLowerCase()

/**
 * slice + toLowerCase
 * @param {string} str
 * @param {number} start
 * @param {number} stop
 * @returns {string}
 */
const ls = (str, start, stop) => str.slice(start, stop).toLowerCase()

// Used so I can check nextProp without it existing
const emptyString = new Array(2 ** 16).fill(' ').join('')

// The script injected into the output html
function script() {
  ;(() => {
    const wrapper = /** @type {HTMLDivElement | null | undefined} */ (document.currentScript?.parentNode)
    if (wrapper === null || wrapper === undefined) throw new Error('Missing wrapper')
    /**
     * @param {string} key
     * @param {any} value
     */
    const setValue = (key, value) => {
      const rawSavedData = sessionStorage.getItem('markup')
      const saveData = rawSavedData !== null ? JSON.parse(rawSavedData) : {}
      saveData[key] = value
      sessionStorage.setItem('markup', JSON.stringify(saveData))
    }
    /**
     * @param {string} key
     * @returns {any}
     */
    const getValue = key => {
      const rawSavedData = sessionStorage.getItem('markup')
      return (rawSavedData !== null ? JSON.parse(rawSavedData) : {})[key]
    }
    /**
     * @param {string} key
     */
    const removeKey = key => {
      const rawSavedData = sessionStorage.getItem('markup')
      const saveData = rawSavedData !== null ? JSON.parse(rawSavedData) : {}
      delete saveData[key]
      sessionStorage.setItem('markup', JSON.stringify(saveData))
    }
    document.addEventListener('DOMContentLoaded', () => {
      for (const folder of /** @type {HTMLDivElement[]}*/ (Array.from(wrapper.getElementsByClassName('folder')))) {
        if (getValue(`id_${folder.dataset.id}`) !== undefined) {
          const children = /** @type {HTMLDivElement[]} */ (/** @type {unknown} */ (folder.children))
          const open = getValue(`id_${folder.dataset.id}`)
          children[0].innerHTML = children[0].innerHTML.replace(open ? 'open' : 'close', open ? 'close' : 'open')
          children[1].style.display = open ? '' : 'none'
        }
      }
    })
    // @ts-expect-error
    if (window.markup === undefined)
      // @ts-expect-error
      window.markup = {
        /**
         * @param {any} event
         */
        folder: event => {
          event.stopPropagation()
          const folder = event.target.closest('.folder')
          const children = folder.children
          const open = children[1].style.display === 'none'
          children[0].innerHTML = children[0].innerHTML.replace(open ? 'open' : 'close', open ? 'close' : 'open')
          children[1].style.display = open ? '' : 'none'
          setValue(`id_${folder.dataset.id}`, open)
        }
      }
  })()
}
/**
 * @param {string} rawMarkup
 */
const splitMarkup = rawMarkup => {
  let temp

  temp =
    /** @type {LocationAwareString} */
    (
      new LocationAwareString(rawMarkup, 1, 0, '\n')
        .split('<')
        // @ts-expect-error
        .lasJoin('&lt')
    )

  temp =
    /** @type {LocationAwareString} */
    (
      temp
        .split('\n')
        .filter(line => line.slice(0, 10).toString() !== '|[COMMENT]')
        // @ts-expect-error
        .lasJoin('')
    )
  temp = temp
    .split('|[')
    .filter(part => part.toString() !== '')
    .flatMap(part => {
      if (part.slice(0, 1).toString() === '|') return LocationAwareString.of('|[', part.slice(1))
      if (part.includes(']')) return [[part.slice(0, part.indexOf(']'))], part.slice(part.indexOf(']') + 1)]
      return part
    })
    .reduce(
      /**
       * @param {(LocationAwareString | LocationAwareString[])[]} prev
       * @param {LocationAwareString | LocationAwareString[]} part
       * @returns {(LocationAwareString | LocationAwareString[])[]}
       */
      (prev, part) => {
        if (!Array.isArray(part)) {
          const last = prev[prev.length - 1]
          if (prev.length > 0 && last instanceof LocationAwareString) last.add(part)
          else prev.push(part)
          return prev
        }
        while (part.some(part => part.includes(' '))) part = part.flatMap(part => part.split(' '))
        let inPart = false
        part = part.reduce(
          /**
           * @param {LocationAwareString[]} subPrev
           * @param {LocationAwareString} subPart
           * @returns {LocationAwareString[]}
           */
          (subPrev, subPart) => {
            if (inPart) subPrev[subPrev.length - 1].add(subPart)
            else subPrev.push(subPart)
            if (subPart.indexOf('(') > -1) inPart = subPart.indexOf('(') > subPart.indexOf(')')
            else inPart = subPart.indexOf(')') === -1 && inPart
            return subPrev
          },
          []
        )
        part = part.filter(item => item.toString() !== '')
        if (part.length !== 0) prev.push(part)
        return prev
      },
      []
    )
    .filter(part => part.toString() !== '')

  return temp
}

let nextGlobalId = 0 // Used for anything that needs a unique identifier

const exports = {
  /** @type {import('./types.d.js').CssStyleObj} */
  defaultStyle: {
    color: '#0f0',
    italic: false,
    bold: false,
    size: 'medium',
    code: false,
    align: 'left',
    showMarkup: false,
    strike: false,
    underline: false
  },
  tabSize: 3,
  /**
   * @param {string} rawMarkup
   * @returns {string}
   */
  stripTags: rawMarkup =>
    splitMarkup(rawMarkup)
      .map(item => (item instanceof LocationAwareString ? item.toString() : item.map(item => item.toString())))
      .map(item =>
        typeof item === 'string'
          ? item
          : item
              .filter(subItem => subItem === 'break')
              .map(() => '<br>')
              .join('')
      )
      .join(''),
  /**
   * Translates markup into html.
   * @param {String} rawMarkup
   * @param {Number} scale
   * @param {String[]} classes any classes to add to the wrapper
   * @returns {{html: string, highlights: import('./types.d.js').MonacoHighlight[]}}
   */
  translate(rawMarkup, scale = 1, classes = []) {
    /** @type {import('./types.d.js').MonacoHighlight[]} */
    const highlights = []

    const markup = splitMarkup(rawMarkup)

    /** @type {import('./types.d.js').CssStyleObj} */
    const defaultStyle = { ...this.defaultStyle }

    /** @type {import('./types.d.js').CssStyleObj} */
    const style = { ...defaultStyle }

    let lastAlign

    const folds = []

    let needScript = false

    let html = ''

    let nextLine = ''

    for (const rawProps of markup) {
      const props = Array.isArray(rawProps) ? rawProps.map(prop => prop.toString()) : rawProps.toString()
      if (!Array.isArray(props)) {
        if (style.align !== lastAlign) {
          if (lastAlign !== undefined) html += '</div>'
          html += `<div style="text-align:${style.align};">`
          lastAlign = style.align
        }
        const cssRules = cssRuleFromStyles(defaultStyle, style, scale)
        let text = nextLine + props
        if (style.code) text = `<code>${text}</code>`
        if (cssRules.length === 1)
          //take the ; into account
          html += text
        else html += `<span style="${cssRules}">${text}</span>`
        nextLine = ''
      } else {
        if (style.showMarkup) nextLine += `|[${props.join(' ')}]`
        for (let index = 0; index < props.length; index++) {
          const prop = props[index]
          const nextProp = props[index + 1] ?? emptyString
          const lowerProp = prop.toLowerCase()

          if (lowerProp === 'color') {
            if (ls(nextProp, 0, 1) === '#') {
              //must be hex
              if (nextProp.length === 4)
                //is in format #rgb
                style.color = nextProp.toLowerCase()
              else if (nextProp.length === 5)
                if (ls(nextProp, 4, 5) === 'f')
                  //is in format #rgba
                  //check if alpha is needed
                  style.color = ls(nextProp, 0, 4)
                else style.color = nextProp.toLowerCase()
              else if (nextProp.length === 7)
                if (
                  lca(nextProp, 1) === lca(nextProp, 2) &&
                  lca(nextProp, 3) === lca(nextProp, 4) &&
                  lca(nextProp, 5) === lca(nextProp, 6)
                )
                  //is in format #rrggbb
                  //check if the color can be shortened
                  style.color = `#${lca(nextProp, 1)}${lca(nextProp, 3)}${lca(nextProp, 5)}`.toLowerCase()
                else style.color = nextProp.toLowerCase()
              else if (nextProp.length === 9)
                if (nextProp.slice(7, 9).toLowerCase() === 'ff')
                  if (
                    lca(nextProp, 1) === lca(nextProp, 2) &&
                    lca(nextProp, 3) === lca(nextProp, 4) &&
                    lca(nextProp, 5) === lca(nextProp, 6)
                  )
                    //is in format #rrggbbaa
                    //check if alpha is needed
                    //check if the color can be shortened
                    style.color = `#${lca(nextProp, 1)}${lca(nextProp, 3)}${lca(nextProp, 5)}`.toLowerCase()
                  else style.color = nextProp.slice(0, 7).toLowerCase()
                else if (
                  lca(nextProp, 1) === lca(nextProp, 2) &&
                  lca(nextProp, 3) === lca(nextProp, 4) &&
                  lca(nextProp, 5) === lca(nextProp, 6) &&
                  lca(nextProp, 7) === lca(nextProp, 8)
                )
                  //check if the color can be shortened
                  style.color =
                    `#${lca(nextProp, 1)}${lca(nextProp, 3)}${lca(nextProp, 5)}${lca(nextProp, 7)}`.toLowerCase()
                else style.color = nextProp.toLowerCase()
              else throw new Error(err('invalid hex code'))
            } else if (ls(nextProp, 0, 3) === 'rgb') {
              try {
                const digits = nextProp
                  .toLowerCase()
                  .slice(lca(nextProp, 3) === 'a' ? 5 : 4)
                  .split(')')[0]
                  .split(',')
                  .map(digit =>
                    Math.max(0, Math.min(255, Math.round(Number(digit.trim()))))
                      .toString(16)
                      .padStart(2, '0')
                  )
                  .filter((digit, index) => digit !== 'ff' || index !== 3)
                if (digits.every(digit => digit.charAt(0) === digit.charAt(1)))
                  style.color = `#${digits.reduce((acc, digit) => acc + digit.charAt(0), '')}`
                else style.color = `#${digits.reduce((acc, digit) => acc + digit, '')}`
              } catch {
                throw new Error(err('invalid rgb'))
              }
            } else style.color = defaultStyle.color
          } else if (lowerProp === 'italic') {
            if (['on', 'true'].includes(nextProp.toLowerCase())) style.italic = true
            else if (['off', 'false'].includes(nextProp.toLowerCase())) style.italic = false
            else style.italic = !style.italic
          } else if (lowerProp === 'bold') {
            if (['on', 'true'].includes(nextProp.toLowerCase())) style.bold = true
            else if (['off', 'false'].includes(nextProp.toLowerCase())) style.bold = false
            else style.bold = !style.bold
          } else if (lowerProp === 'space') {
            try {
              const count = Math.round(Number(nextProp))
              if (count > 0 && !Number.isNaN(count)) nextLine += new Array(count).fill('&nbsp;').join('')
              else nextLine += '&nbsp;'
            } catch {
              nextLine += '&nbsp;'
            }
          } else if (lowerProp === 'tab') {
            try {
              const count = Math.round(Number(nextProp) * this.tabSize)
              if (count > 0 && !Number.isNaN(count)) nextLine += new Array(count).fill('&nbsp;').join('')
              else nextLine += new Array(this.tabSize).fill('&nbsp;').join('')
            } catch {
              nextLine += new Array(this.tabSize).fill('&nbsp;').join('')
            }
          } else if (lowerProp === 'break') {
            if (Number(nextProp) > 0)
              nextLine += `<div style="display:block; height:${Number(nextProp)}em; line-height:${Number(nextProp)}em;"></div>`
            else nextLine += '<br>'
          } else if (lowerProp === 'size') {
            if (
              ['xx-small', 'x-small', 'smaller', 'small', 'medium', 'large', 'larger', 'x-large', 'xx-large'].includes(
                nextProp.toLowerCase()
              )
            )
              style.size = nextProp.toLowerCase()
            else if (Number(nextProp) > 0) style.size = `${Number(nextProp)}px`
            else style.size = defaultStyle.size
          } else if (lowerProp === 'code') {
            if (['on', 'true'].includes(nextProp.toLowerCase())) style.code = true
            else if (['off', 'false'].includes(nextProp.toLowerCase())) style.code = false
            else style.code = !style.code
          } else if (lowerProp === 'align') {
            if (['left', 'center', 'right'].includes(nextProp.toLowerCase())) style.align = nextProp.toLowerCase()
            else style.align = defaultStyle.align
          } else if (lowerProp === 'reset') {
            if (Object.keys(defaultStyle).includes(nextProp.toLowerCase()))
              // @ts-expect-error
              style[nextProp.toLowerCase()] = defaultStyle[nextProp.toLowerCase()]
            else
              for (const key of /** @type {(keyof import('./types.d.js').CssStyleObj)[]} */ (
                Object.keys(defaultStyle)
              )) {
                // @ts-expect-error
                style[key] = defaultStyle[key]
              }
          } else if (lowerProp === 'default') {
            if (nextProp.toLowerCase() === 'global')
              for (const key of /** @type {(keyof import('./types.d.js').CssStyleObj)[]} */ (Object.keys(style))) {
                // @ts-expect-error
                this.defaultStyle[key] = style[key]
              }
            for (const key of /** @type {(keyof import('./types.d.js').CssStyleObj)[]} */ (Object.keys(style))) {
              // @ts-expect-error
              defaultStyle[key] = style[key]
            }
          } else if (lowerProp === 'fold') {
            needScript = true
            if (['open', 'close'].includes(nextProp.toLowerCase())) {
              /** @type {number} */
              let foldId = folds.length + 1
              while (rawMarkup.includes(`fold_${foldId}`)) foldId++
              folds.push({
                id: foldId,
                style: { ...style },
                open: nextProp.toLowerCase() === 'open'
              })
              if (lastAlign !== undefined) html += '</div>'
              html += `fold_${foldId}`
              html += `<div style="text-align:${style.align};">`
            } else {
              if (lastAlign !== undefined) html += '</div>'
              lastAlign = undefined //to make the next line trigger a new block
              const fold = folds.pop()
              if (fold === undefined) throw new Error(err('Missing fold'))
              const content = html.split(`fold_${fold.id}`)[1]
              html = html.slice(0, html.indexOf(`fold_${fold.id}`))
              const cssRules = cssRuleFromStyles(defaultStyle, fold.style, scale)
              let text = `|[click to ${fold.open ? 'close' : 'open'}]`
              if (style.code) text = `<code>${text}</code>`
              if (cssRules.length !== 1) text = `<span style="${cssRules}">${text}</span>`

              html += `
                            <div class="folder" data-id=${nextGlobalId++}>
                                <div style="cursor: pointer; text-align:${fold.style.align};" onclick="window.markup.folder(event)">
                                    ${text}
                                </div>
                                <div ${fold.open ? '' : 'style="display:none;"'}>
                                    ${content}
                                </div>
                            </div>
                            `
            }
          } else if (lowerProp === 'image') {
            if (style.align !== lastAlign) {
              if (lastAlign !== undefined) html += '</div>'
              html += `<div style="text-align:${style.align};">`
              lastAlign = style.align
            }
            if (
              props.length > index + 1 &&
              Number.parseFloat(props[index + 2]) > 0 &&
              Number.parseFloat(props[index + 2]) !== 1
            )
              html += `<br><img src="./${nextProp}" alt="${nextProp}" style="width:${Number.parseFloat(props[index + 2]) * 100}%">`
            else html += `<br><img src="./${nextProp}" alt="${nextProp}">`
          } else if (lowerProp === 'showmarkup') {
            if (['on', 'true'].includes(nextProp.toLowerCase())) style.showMarkup = true
            else if (['off', 'false'].includes(nextProp.toLowerCase())) style.showMarkup = false
            else style.showMarkup = !style.showMarkup
          } else if (lowerProp === 'video') {
            if (style.align !== lastAlign) {
              if (lastAlign !== undefined) html += '</div>'
              html += `<div style="text-align:${style.align};">`
              lastAlign = style.align
            }
            if (
              props.length > index + 1 &&
              Number.parseFloat(props[index + 2]) > 0 &&
              Number.parseFloat(props[index + 2]) !== 1
            )
              html += `<br><video src="./${nextProp}" controls alt="${nextProp}" style="width:${Number.parseFloat(props[index + 2]) * 100}%"></video>`
            else html += `<br><video src="./${nextProp}" controls alt="${nextProp}"></video>`
          } else if (lowerProp === 'strike') {
            if (['on', 'true'].includes(nextProp.toLowerCase())) style.strike = true
            else if (['off', 'false'].includes(nextProp.toLowerCase())) style.strike = false
            else style.strike = !style.strike
          } else if (lowerProp === 'script' && nextProp !== undefined) {
            nextLine += `<script src="${nextProp}"></script>`
          } else if (lowerProp === 'link') {
            let url
            try {
              url = new URL(nextProp.trim())
            } catch (e) {}
            if (url !== undefined && ['http:', 'https:'].includes(url.protocol))
              nextLine += `<a href="${nextProp}" style="all:unset; cursor:pointer;">`
            else html += '</a>'
          } else if (lowerProp === 'underline') {
            if (['on', 'true'].includes(nextProp.toLowerCase())) style.underline = true
            else if (['off', 'false'].includes(nextProp.toLowerCase())) style.underline = false
            else style.underline = !style.underline
          }
        }
      }

      /** @type {LocationAwareString} */
      const locationAwareProp =
        // @ts-expect-error
        (rawProps instanceof LocationAwareString ? rawProps : rawProps.lasJoin('')).inferLocations()

      const currentStyle = { ...defaultStyle, ...style }

      if (locationAwareProp.start !== -1)
        highlights.push({
          start: locationAwareProp.start + 1,
          length: locationAwareProp.end - locationAwareProp.start,
          line: locationAwareProp.firstLine,
          type: {
            color: expandHex(currentStyle.color ?? ''),
            italic: !!currentStyle.italic,
            bold: !!currentStyle.bold,
            underline: !!currentStyle.underline
          }
        })
    }

    if (nextLine !== '') {
      if (style.align !== lastAlign) {
        if (lastAlign !== undefined) html += '</div>'
        html += `<div style="text-align:${style.align};">`
        lastAlign = style.align
      }
      const cssRules = cssRuleFromStyles(defaultStyle, style, scale)
      if (style.code) nextLine = `<code>${nextLine}</code>`
      if (cssRules.length === 1)
        //take the ; into account
        html += nextLine
      else html += `<span style="${cssRules}">${nextLine}</span>`
    }

    if (lastAlign !== undefined) html += '</div>'

    let wrapperStyle = cssRuleFromStyles({}, defaultStyle, scale)
    wrapperStyle += `${['margin:0', 'padding:0', 'word-wrap:break-word', 'width:100%', 'height:100%'].join('; ')};`

    const scriptString = script
      .toString()
      .slice(script.toString().indexOf('{') + 1)
      .split('\r\n')
      .reduce((acc, part) => `${acc}; ${part.split('//')[0]}`, '')
      .split('')
      .reduce((acc, part, index, arr) => {
        if (index >= arr.length - 3) return acc
        if (part === ' ' && acc.charAt(acc.length - 1) === ' ') return acc
        return acc + part
      }, '')
      .split('{; ')
      .join('{')
      .split('; }')
      .join('}')
      .split('; ')
      .reduce((acc, part) => {
        if (acc.slice(acc.length - 2) === '; ' && part === '') return acc
        return `${acc + part}; `
      }, '')

    return {
      html: `
        <div class="${['markup', ...classes].join(' ')}" style="${wrapperStyle}">${needScript ? `\r\n<script>${scriptString}</script>` : ''}
            ${html}
        </div>
        `,
      highlights
    }
  }
}

// @ts-expect-error
if (typeof module !== 'undefined' && module.exports) module.exports = exports
export default exports

/**
This markup uses tags in |[] clumps mixed with text to style. 
the text is evaluated from beginning to end, any text being rendered using the current style.
to change the style, add |[] with tags and values inside, this sets the style for everything after, until changes.
tags are evaluated by order they appear, in a |[].
tags are found by scanning for |[ and reading until ], and are separated by spaces.
to render a |[ you can put |[|, this will not read tags like normal.
you can put ] anywhere, and unless it is closing a tag area it will render.
the tags are below, items in the first column are the keywords, items in the second column are values to be used.
a !-> in the second column indicates the action that happens if non of the other options are there
values in the second column with a [] signify that you put a value there (but don't include the [])
values in the second column with a ?[] signify that the value is optional

 * color: -> sets the text color to the most efficient hex value that represents prop 1
 * * #[rgb] -> each range is in the value 0-f in base 16
 * * #[rgba]
 * * #[rrggbb]
 * * #[rrggbbaa]
 * * rgb([r],[g],[b]) -> each value is in the range 0-255
 * * rgb([r],[g],[b],[a])
 * * rgba([r],[g],[b])
 * * rgba([r],[g],[b],[a])
 * * !-> sets color to the default color
 * italic: -> sets whether text will be italic
 * * on | true
 * * off | false
 * * !-> toggles italics
 * bold: -> sets whether text will be bold
 * * on | true
 * * off | false
 * * !-> toggles bold text
 * space: -> adds [number] spaces using '&nbsp;' after
 * * [number]
 * * !-> defaults to 1
 * tabs: -> adds [number] spaces * tabSize (defaults to 3) after
 * * [number]
 * * !-> defaults to 1
 * break: -> used to make new lines
 * * [number] -> creates a break and then inserts a blank line of [number] lines in height, then second break
 * * !-> just adds <br>
 * size: -> sets the text size
 * * xx-small | x-small | smaller | small | medium | large | larger | x-large | xx-large -> uses the default sizes
 * * [number] -> (viewport width + viewport height) / 2 * [number], [number] is in the range [number] >= 0.02
 * * !-> sets size to the default size
 * code: -> sets whether text will be code using <code></code>
 * * on | true
 * * off | false
 * * !-> toggles code text
 * align: -> sets which direction text should align (changing align triggers a break)
 * * left | center | right
 * * !-> sets align to the default align
 * reset: 
 * * [property] -> sets [property] to the default [property]
 * * !-> resets the full style to the default style
 * default: -> changes the default used for many tags, but does not change the default retrospectively
 * * global -> sets the global default, this is the default used to generate the local (the default always used) default, also sets the local default 
 * * !-> sets the default style to the current style
 * fold: -> creates foldable content, with all content until the fold close being inside (fold triggers a break)
 * * open | close -> starts a fold that is open | closed at start
 * * !-> closes a fold
 * image: -> embeds an image in the next line
 * * [path] [size] -> size is relative to the div, so a size of 1 would fill the space, or a size of .5 could fit two images side by side
 * * [path] !-> defaults to 1
 * showMarkup: -> sets whether the markup tags will be hidden (defaults to false)
 * * on | true
 * * off | false
 * * !-> toggles
 * COMMENT: -> "comments" out the line, must be alone in the tag bracket, and the first thing in the line: |[COMMENT]
 * video: -> embeds a video in the next line
 * * [path] [size] -> size is relative to the div, so a size of 1 would fill the space, or a size of .5 could fit two videos side by side
 * * [path] !-> defaults to 1
 * strike: -> sets whether text will have strikethrough
 * * on | true
 * * off | false
 * * !-> toggles strikethrough
 * script: -> embeds a piece of live code
 * * [path] -> where to find the script
 * link: -> creates a link
 * * [url] -> starts the link block, and sets the link's url
 * * !-> closes the link block
 * underline: -> sets whether text will have underline
 * * on | true
 * * off | false
 * * !-> toggles underline

for example: to create 'before green it was boring' with 'green' being green you could use the following markup:
before |[color #0f0]green|[color] it was boring
the first tag clump sets the color to green (#0f0), the second clump resets color to the default
 */
