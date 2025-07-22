{
  const testText = document.createElement('span')
  testText.textContent = '0'
  // @ts-expect-error
  document.currentScript.insertAdjacentElement('afterend', testText)
  const font = window.getComputedStyle(testText).font
  const canvas = document.createElement('canvas')
  // @ts-expect-error
  document.currentScript.insertAdjacentElement('afterend', canvas)
  canvas.style.verticalAlign = 'middle'
  const pixelRatio = window.devicePixelRatio
  const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'))
  testText.remove()
  const targetWidth = 600
  const targetHeight = 205
  const linesDown = 3
  const linesAcross = 3
  let pageWidth
  /** @type {number} */
  let width
  /** @type {number} */
  let height
  /** @type {number} */
  let scale
  /** @type {string} */
  let fontName
  /** @type {number} */
  let fontSize
  /** @type {string} */
  let borderColor
  let baseBorderColor
  let borderOpacity
  /** @type {number} */
  let borderWidth
  const resize = () => {
    // @ts-expect-error
    ;[baseBorderColor, borderOpacity] = getComputedStyle(document.documentElement)
      .getPropertyValue('--background-dark')
      .match(/#([0-9a-f]*) r g b \/ ([0-9]*)/)
      .slice(1, 3)
    if (baseBorderColor.length < 6)
      baseBorderColor = baseBorderColor
        .split('')
        .map(char => `${char}${char}`)
        .join('')
        .slice(0, 6)
    if (borderOpacity.length === 1) borderOpacity = `${borderOpacity}${borderOpacity}`
    borderColor = `#${baseBorderColor}${borderOpacity}`
    borderWidth = Number.parseFloat(
      // @ts-expect-error
      getComputedStyle(document.getElementById('post'))
        .getPropertyValue('border-width')
        .match(/([0-9.]*)/)[1]
    )

    width = targetWidth + borderWidth * linesDown
    height = targetHeight + borderWidth * linesAcross

    pageWidth =
      // @ts-expect-error
      document.getElementById('post').getElementsByClassName('markup')[0].getBoundingClientRect().width

    // @ts-expect-error
    fontSize = font.match(/([0-9]*)/)[1]

    const maxScale = pageWidth / width
    const idealScale = width / (fontSize / 0.03)

    scale = Math.min(maxScale, idealScale)

    const pixelScale = Math.max(pixelRatio, scale)

    canvas.width = width * pixelScale
    canvas.height = height * pixelScale
    canvas.style.width = `${width * scale}px`
    canvas.style.height = `${height * scale}px`
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.scale(pixelScale, pixelScale)
    // @ts-expect-error
    fontName = font.match(/[0-9]*px "(.*)"/)[1]
    ctx.font = `${fontSize}px ${fontName}`
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
  }
  window.addEventListener('resize', resize)
  resize()

  /**
   * @template T
   * @typedef {T | (() => T)} ValOrFunc<T>
   *
   * @typedef {{prop: string, distance: ValOrFunc<number>, time: {start: number, end: number}}} Animation_transition
   *
   * @typedef {Object} Animation_entry_base
   * @prop {{start: number, end: number}} time
   * @prop {Animation_transition<any> | Animation_transition<any>[]} [transition]
   * @typedef {Object} Animation_entry_text
   * @prop {ValOrFunc<'text'>} type
   * @prop {ValOrFunc<string>} text
   * @prop {ValOrFunc<number>} x
   * @prop {ValOrFunc<number>} y
   * @prop {ValOrFunc<string>} color
   * @prop {ValOrFunc<CanvasRenderingContext2D["textAlign"]>} textAlign
   * @prop {ValOrFunc<CanvasRenderingContext2D["textBaseline"]>} textBaseline
   * @prop {ValOrFunc<boolean>} bold
   * @prop {ValOrFunc<boolean>} italic
   * @prop {ValOrFunc<number>} size
   * @typedef {Object} Animation_entry_rect
   * @prop {ValOrFunc<'rect'>} type
   * @prop {ValOrFunc<number>} x
   * @prop {ValOrFunc<number>} y
   * @prop {ValOrFunc<number>} width
   * @prop {ValOrFunc<number>} height
   * @prop {ValOrFunc<string>} color
   * @prop {ValOrFunc<boolean>} fill
   * @typedef {Object} Animation_entry_circle
   * @prop {ValOrFunc<'circle'>} type
   * @prop {ValOrFunc<number>} x
   * @prop {ValOrFunc<number>} y
   * @prop {ValOrFunc<number>} radius
   * @prop {ValOrFunc<string>} color
   * @prop {ValOrFunc<boolean>} fill
   * @typedef {Object} Animation_entry_triangle
   * @prop {ValOrFunc<'triangle'>} type
   * @prop {ValOrFunc<number>} x
   * @prop {ValOrFunc<number>} y
   * @prop {ValOrFunc<number>} radius
   * @prop {ValOrFunc<number>} angle
   * @prop {ValOrFunc<string>} color
   * @prop {ValOrFunc<boolean>} fill
   *
   * @typedef {(Animation_entry_text<any> | Animation_entry_rect<any> | Animation_entry_circle<any> | Animation_entry_triangle<any>) & Animation_entry_base<any>} Animation_entry
   */

  const COLORS = ['#f00', '#f60', '#ff0', '#6f0', '#0f0', '#0f6', '#0ff', '#06f', '#00f', '#60f', '#f0f', '#f06']

  /**
   * @typedef {Object} Shape
   * @prop {'square' | 'circle' | 'triangle'} type
   * @prop {string} color
   * @prop {boolean} fill
   */

  /**
   * @returns {Shape}
   */
  let randomShape = () => {
    throw new Error('Do not generate shapes before render')
  }

  /**
   * @param {number} x
   * @returns {Shape[]}
   */
  const xRandomShapes = x => new Array(x).fill(0).map(() => randomShape())

  /**
   * @param {...ValOrFunc<number>} args
   * @returns {() => number}
   */
  const addVOFs =
    (...args) =>
    () =>
      args.reduce(
        /**
         * @param {number} prev
         * @param {ValOrFunc<number>} arg
         * @param {number} index
         * @returns {number}
         */
        (prev, arg, index) => (index === 0 ? prev : prev + (typeof arg === 'function' ? arg() : arg)),
        typeof args[0] === 'function' ? args[0]() : args[0]
      )

  /**
   * @param {...ValOrFunc<number>} args
   * @returns {() => number}
   */
  const subtractVOFs =
    (...args) =>
    () =>
      args.reduce(
        /**
         * @param {number} prev
         * @param {ValOrFunc<number>} arg
         * @param {number} index
         * @returns {number}
         */
        (prev, arg, index) => (index === 0 ? prev : prev - (typeof arg === 'function' ? arg() : arg)),
        typeof args[0] === 'function' ? args[0]() : args[0]
      )

  /**
   * @param {...ValOrFunc<number>} args
   * @returns {() => number}
   */
  const divideVOFs =
    (...args) =>
    () =>
      args.reduce(
        /**
         * @param {number} prev
         * @param {ValOrFunc<number>} arg
         * @param {number} index
         * @returns {number}
         */
        (prev, arg, index) => (index === 0 ? prev : prev / (typeof arg === 'function' ? arg() : arg)),
        typeof args[0] === 'function' ? args[0]() : args[0]
      )

  /**
   * @param {...ValOrFunc<number>} args
   * @returns {() => number}
   */
  const multiplyVOFs =
    (...args) =>
    () =>
      args.reduce(
        /**
         * @param {number} prev
         * @param {ValOrFunc<number>} arg
         * @param {number} index
         * @returns {number}
         */
        (prev, arg, index) => (index === 0 ? prev : prev * (typeof arg === 'function' ? arg() : arg)),
        typeof args[0] === 'function' ? args[0]() : args[0]
      )

  /**
   * @template T
   * @param {ValOrFunc<T>} x
   * @returns {T}
   */
  let getValue = x => {
    throw new Error('Do not open ValOrFunc types before rendering')
  }

  /**
   * @param {ValOrFunc<number>} x
   * @param {ValOrFunc<number>} y
   * @param {ValOrFunc<number>} size
   * @param {Shape} shape
   * @param {Animation_entry<any>["time"]} time
   * @param {Animation_entry<any>["transition"]} transition
   * @returns {Animation_entry<any>}
   */
  const expandShape = (x, y, size, shape, time, transition) => {
    if (shape.type === 'square')
      return {
        type: 'rect',
        time,
        transition,
        fill: shape.fill,
        color: shape.color,
        x: subtractVOFs(x, divideVOFs(size, 2)),
        y: subtractVOFs(y, divideVOFs(size, 2)),
        width: size,
        height: size
      }
    if (shape.type === 'circle')
      return {
        type: 'circle',
        time,
        transition,
        fill: shape.fill,
        color: shape.color,
        x,
        y,
        radius: divideVOFs(size, 2)
      }
    if (shape.type === 'triangle')
      return {
        type: 'triangle',
        time,
        transition,
        fill: shape.fill,
        color: shape.color,
        x,
        y,
        radius: divideVOFs(size, 2),
        angle: 0
      }
    throw new Error('Invalid shape type')
  }

  /** @type {Shape} */
  let username
  /** @type {Shape} */
  let password
  /** @type {Shape[]} */
  let seed
  /** @type {Shape[]} */
  let token

  const generateExample = () => {
    username = randomShape()
    password = randomShape()
    seed = xRandomShapes(3)
    token = xRandomShapes(3)
  }

  /** @type {ValOrFunc<Animation_entry<any> | Animation_entry<any>[]>[]} */
  const animation = [
    {
      time: { start: 0, end: 0 },
      type: 'text',
      size: 1,
      x: () => (width / 4) * 3,
      y: 100,
      text: 'Client',
      color: '#0f0',
      textAlign: 'center',
      textBaseline: 'middle',
      bold: true,
      italic: true
    },
    {
      time: { start: 0, end: 0 },
      type: 'text',
      size: 1,
      x: () => width / 4,
      y: 100,
      text: 'Server',
      color: '#0f0',
      textAlign: 'center',
      textBaseline: 'middle',
      bold: true,
      italic: true
    },
    {
      time: { start: 50, end: 150 },
      type: 'text',
      size: 1,
      x: () => width / 2,
      y: 62.5,
      color: '#fff',
      text: 'The user inputs their username / password',
      textAlign: 'center',
      textBaseline: 'middle',
      bold: false,
      italic: false
    },
    () =>
      [
        [],
        [
          {
            prop: 'x',
            time: { start: 200, end: 225 },
            distance: () => (width / 2) * -1
          }
        ]
      ].flatMap(
        /**
         * @param {Animation_transition<any>[]} transition
         * @returns {Animation_entry<any>[]}
         */
        transition => [
          {
            transition,
            time: { start: 100, end: 0 },
            type: 'text',
            size: 0.75,
            x: () => width / 2 + 15,
            y: 125,
            color: '#fff',
            text: 'Username:',
            textAlign: 'left',
            textBaseline: 'middle',
            bold: false,
            italic: false
          },
          expandShape(() => width - 15, 125, 15, username, { start: 100, end: 0 }, transition)
        ]
      ),
    () =>
      /** @type {[Shape, number][]} */
      ([
        [username, 0],
        [password, 25]
      ]).flatMap(
        /**
         * @param {[Shape, number]} param0
         * @returns {Animation_entry<any>[]}
         */
        ([shape, yOffset]) =>
          /** @type {Animation_transition<any>[][]} */
          ([
            [],
            [
              {
                prop: 'x',
                time: { start: 500, end: 520 },
                distance: -30
              },
              { prop: 'y', time: { start: 500, end: 520 }, distance: 75 - yOffset }
            ]
          ]).flatMap(
            /**
             * @param {Animation_transition<any>[]} transition
             * @returns {Animation_entry<any>}
             */
            transition =>
              expandShape(
                () => width - 15,
                125 + yOffset,
                15,
                shape,
                { start: 100, end: transition.length ? 520 : 0 },
                transition
              )
          )
      ),
    {
      time: { start: 100, end: 0 },
      type: 'text',
      size: 0.75,
      x: () => width / 2 + 15,
      y: 150,
      color: '#fff',
      text: 'Password:',
      textAlign: 'left',
      textBaseline: 'middle',
      bold: false,
      italic: false
    },
    {
      time: { start: 150, end: 250 },
      type: 'text',
      size: 1,
      x: () => width / 2,
      y: 62.5,
      color: '#fff',
      text: 'The user asks for their seed from the server',
      textAlign: 'center',
      textBaseline: 'middle',
      bold: false,
      italic: false
    },
    {
      time: { start: 250, end: 350 },
      type: 'text',
      size: 1,
      x: () => width / 2,
      y: 62.5,
      color: '#fff',
      text: 'The server remembers their seed / token',
      textAlign: 'center',
      textBaseline: 'middle',
      bold: false,
      italic: false
    },
    {
      time: { start: 300, end: 0 },
      type: 'text',
      size: 0.75,
      x: 15,
      y: 150,
      color: '#fff',
      text: 'Stored auth token:',
      textAlign: 'left',
      textBaseline: 'middle',
      bold: false,
      italic: false
    },
    () =>
      token.map((shape, index) =>
        expandShape(() => width / 2 - 15 - index * 30, 150, 15, shape, { start: 300, end: 0 }, [])
      ),
    () =>
      [
        [],
        [
          {
            prop: 'x',
            time: { start: 400, end: 425 },
            distance: () => width / 2
          }
        ],
        [
          {
            prop: 'x',
            time: { start: 400, end: 425 },
            distance: () => width / 2
          },
          { prop: 'y', time: { start: 500, end: 520 }, distance: 25 }
        ]
      ].flatMap(
        /**
         * @param {Animation_transition<any>[]} transition
         * @returns {Animation_entry<any>[]}
         */
        transition => [
          .../** @type {Animation_entry<any>[]} */ (
            transition.length > 1
              ? []
              : [
                  {
                    transition,
                    time: { start: 300, end: 0 },
                    type: 'text',
                    size: 0.75,
                    x: 15,
                    y: 175,
                    color: '#fff',
                    text: 'User seed:',
                    textAlign: 'left',
                    textBaseline: 'middle',
                    bold: false,
                    italic: false
                  }
                ]
          ),
          ...seed.flatMap((shape, index) =>
            expandShape(
              () => width / 2 - 15 - index * 30,
              175,
              15,
              shape,
              { start: 300, end: transition.length > 1 ? 520 : 0 },
              transition.length > 1
                ? [...transition, { prop: 'x', time: { start: 500, end: 520 }, distance: (index - 1) * 30 }]
                : transition
            )
          )
        ]
      ),
    {
      time: { start: 350, end: 450 },
      type: 'text',
      size: 1,
      x: () => width / 2,
      y: 62.5,
      color: '#fff',
      text: 'And sends the stored seed over',
      textAlign: 'center',
      textBaseline: 'middle',
      bold: false,
      italic: false
    },
    {
      time: { start: 450, end: 550 },
      type: 'text',
      size: 1,
      x: () => width / 2,
      y: 62.5,
      color: '#fff',
      text: 'The client then hashes it all together',
      textAlign: 'center',
      textBaseline: 'middle',
      bold: false,
      italic: false
    },
    () =>
      [
        [],
        [
          {
            prop: 'x',
            time: { start: 600, end: 625 },
            distance: () => (width / 2) * -1
          }
        ]
      ].flatMap(
        /**
         * @param {Animation_transition<any>[]} transition
         * @returns {Animation_entry<any>[]}
         */
        transition => [
          {
            transition,
            time: { start: 500, end: 0 },
            type: 'text',
            size: 0.75,
            x: () => width / 2 + 15,
            y: 200,
            color: '#fff',
            text: 'Auth token:',
            textAlign: 'left',
            textBaseline: 'middle',
            bold: false,
            italic: false
          },
          ...token.flatMap((shape, index) =>
            expandShape(() => width - 45, 200, 15, shape, { start: 520, end: 0 }, [
              ...transition,
              { prop: 'x', time: { start: 520, end: 525 }, distance: (index - 1) * 30 * -1 }
            ])
          )
        ]
      ),
    {
      time: { start: 550, end: 650 },
      type: 'text',
      size: 1,
      x: () => width / 2,
      y: 62.5,
      color: '#fff',
      text: 'And sends it to the server',
      textAlign: 'center',
      textBaseline: 'middle',
      bold: false,
      italic: false
    },
    {
      time: { start: 650, end: 800 },
      type: 'text',
      size: 1,
      x: () => width / 2,
      y: 62.5,
      color: '#fff',
      text: 'Now the user is authenticated and can access their files',
      textAlign: 'center',
      textBaseline: 'middle',
      bold: false,
      italic: false
    }
  ]

  /**
   * @template T
   * @param {T} obj
   * @returns {T}
   */
  const clone = obj => {
    if (obj === null || typeof obj !== 'object' || 'isActiveClone' in obj) return obj

    const temp = obj.constructor()

    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        // @ts-expect-error
        obj.isActiveClone = null
        temp[key] = clone(obj[key])
        // @ts-expect-error
        // biome-ignore lint/performance/noDelete: <explanation>
        delete obj.isActiveClone
      }
    }
    return temp
  }

  // @ts-expect-error
  getValue = x => (typeof x === 'function' ? x() : x)

  randomShape = () => ({
    // @ts-expect-error
    type: ['square', 'circle', 'triangle'][Math.floor(Math.random() * 3)],
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    fill: Math.random() < 0.5
  })

  generateExample()

  const totalAnimationTime = animation.reduce((prev, vofEntries) => {
    let entries = getValue(vofEntries)
    if (!Array.isArray(entries)) entries = [entries]
    return Math.max(
      prev,
      ...entries.flatMap(entry => [
        entry.time.start,
        entry.time.end,
        entry.transition === undefined
          ? 0
          : (Array.isArray(entry.transition) ? entry.transition : [entry.transition]).reduce(
              (prev, transition) => Math.max(prev, transition.time.start, transition.time.end),
              0
            )
      ])
    )
  }, 0)

  let animationTime = 0

  const render = () => {
    ctx.clearRect(0, 0, width, height)
    ctx.fillStyle = ctx.strokeStyle = borderColor
    ctx.fillRect(0, 0, width, height)
    ctx.lineWidth = borderWidth * 2
    ctx.lineCap = 'butt'
    ctx.strokeRect(0, 0, width, height)

    ctx.lineWidth = borderWidth

    ctx.beginPath()
    ctx.moveTo(width / 2, borderWidth + 75)
    ctx.lineTo(width / 2, height - borderWidth)
    ctx.stroke()

    ctx.beginPath()
    ctx.moveTo(borderWidth, borderWidth + 75)
    ctx.lineTo(width - borderWidth, borderWidth + 75)
    ctx.stroke()

    ctx.lineWidth /= 2

    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'

    ctx.font = `bold ${fontSize * 1.5}px ${fontName}`
    ctx.fillStyle = '#fff'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('Repeat user authentication', width / 2, 25 + borderWidth)
    for (const vofEntries of animation) {
      let entries = getValue(vofEntries)
      if (!Array.isArray(entries)) entries = [entries]
      for (let entry of entries)
        if (entry.time.start <= animationTime && (entry.time.end > animationTime || entry.time.end === 0)) {
          entry = clone(entry)

          // @ts-expect-error
          for (const [key, value] of Object.entries(entry)) if (typeof value === 'function') entry[key] = value()

          if (entry.transition !== undefined) {
            const transitions = Array.isArray(entry.transition) ? entry.transition : [entry.transition]
            for (const transition of transitions)
              if (transition.time.start <= animationTime)
                // @ts-expect-error
                entry[transition.prop] +=
                  (Math.min(animationTime - transition.time.start, transition.time.end - transition.time.start) *
                    getValue(transition.distance)) /
                  (transition.time.end - transition.time.start)
          }
          ctx.beginPath()
          ctx.fillStyle = ctx.strokeStyle = getValue(entry.color)
          if (getValue(entry.type) === 'text') {
            const textEntry = /** @type {Animation_entry_text<any>} */ (entry)
            ctx.font = `${getValue(textEntry.bold) ? 'bold ' : ''}${getValue(textEntry.italic) ? 'italic ' : ''}${fontSize * getValue(textEntry.size)}px ${fontName}`
            ctx.textAlign = getValue(textEntry.textAlign)
            ctx.textBaseline = getValue(textEntry.textBaseline)
            ctx.fillText(getValue(textEntry.text), getValue(textEntry.x), getValue(textEntry.y), width - 30)
          } else if (getValue(entry.type) === 'rect') {
            const rectEntry = /** @type {Animation_entry_rect<any>} */ (entry)
            ctx.rect(
              getValue(rectEntry.x),
              getValue(rectEntry.y),
              getValue(rectEntry.width),
              getValue(rectEntry.height)
            )
          } else if (getValue(entry.type) === 'circle') {
            const circleEntry = /** @type {Animation_entry_circle<any>} */ (entry)
            ctx.arc(getValue(circleEntry.x), getValue(circleEntry.y), getValue(circleEntry.radius), 0, Math.PI * 2)
          } else if (getValue(entry.type) === 'triangle') {
            const triangleEntry = /** @type {Animation_entry_triangle<any>} */ (entry)
            const x = getValue(triangleEntry.x)
            const y = getValue(triangleEntry.y)
            const radius = getValue(triangleEntry.radius)
            let angle = getValue(triangleEntry.angle)
            const p1x = x + Math.sin((angle * Math.PI) / 180) * radius
            const p1y = y + Math.cos((angle * Math.PI) / 180) * radius
            angle += 360 / 3
            const p2x = x + Math.sin((angle * Math.PI) / 180) * radius
            const p2y = y + Math.cos((angle * Math.PI) / 180) * radius
            angle += 360 / 3
            const p3x = x + Math.sin((angle * Math.PI) / 180) * radius
            const p3y = y + Math.cos((angle * Math.PI) / 180) * radius
            ctx.moveTo(p1x, p1y)
            ctx.lineTo(p2x, p2y)
            ctx.lineTo(p3x, p3y)
            ctx.lineTo(p1x, p1y)
          }
          if (getValue(entry.type) !== 'text') {
            const nonTextEntry = /** @type {Exclude<Animation_entry<any>, Animation_entry_text<any>>} */ (entry)
            nonTextEntry.fill ? ctx.fill() : ctx.stroke()
          }
        }
    }

    animationTime++
    if (animationTime > totalAnimationTime) {
      animationTime = 0
      generateExample()
    }
  }

  setInterval(render, 1000 / 30)
  render()
}
