const fontSize = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(
  // @ts-expect-error
  navigator.userAgent || navigator.vendor || window.opera
)
  ? 50
  : 25

let [width, height] = [0, 0]

let [lastWidth, lastHeight] = [0, 0]

const lineWidth = fontSize / 3

let file = ''
let fakeFile = ''
let fileLength = 0

const chars = '<>-=+|'.split('')

fetch('../../mem.json')
  .then(response => response.json())
  .then(data => {
    file = Object.values(data.orderedLines)
      .filter(file => file.join('   ').length > 1_000)
      .toSorted(() => Math.random() * 2 - 1)[0]
      .join('   ')
    fileLength = file.length
    file += file
    fakeFile = new Array(fileLength)
      .fill(0)
      .map(() => chars[Math.floor(Math.random() * chars.length)])
      .join('')
  })
  .catch(error => {
    console.error('Error fetching mem for stats:', error)
  })

/** @typedef {{ x: number, y: number, radius: number }} Circle */
/** @type {Circle[]} */
const circles = []

/** @type {{start: Circle, end: Circle, distance: number}[]} */
const path = []

/**
 * @param {{x1: number, y1: number, x2: number, y2: number}} segment -
 * @param {{x: number, y: number, radius: number}} circle
 * @returns {boolean}
 */
function doesLineSegmentHitCircle(segment, circle) {
  // 1. Check if either endpoint is inside the circle
  const distSqStart =
    (segment.x1 - circle.x) * (segment.x1 - circle.x) + (segment.y1 - circle.y) * (segment.y1 - circle.y)
  const distSqEnd =
    (segment.x2 - circle.x) * (segment.x2 - circle.x) + (segment.y2 - circle.y) * (segment.y2 - circle.y)

  if (distSqStart <= circle.radius * circle.radius || distSqEnd <= circle.radius * circle.radius) {
    return true
  }

  // 2. Check for the closest point on the line to the circle's center
  // Vector from start to end of the segment
  const segmentVecX = segment.x2 - segment.x1
  const segmentVecY = segment.y2 - segment.y1

  // Vector from start of the segment to the circle's center
  const startToCenterVecX = circle.x - segment.x1
  const startToCenterVecY = circle.y - segment.y1

  // Calculate the projection of startToCenterVec onto segmentVec
  // t is the parameter that indicates where the closest point lies on the line
  // t = (startToCenterVec . segmentVec) / |segmentVec|^2
  const dotProduct = startToCenterVecX * segmentVecX + startToCenterVecY * segmentVecY
  const segmentLengthSq = segmentVecX * segmentVecX + segmentVecY * segmentVecY

  // Handle zero-length segments (start and end points are the same)
  if (segmentLengthSq === 0) {
    return distSqStart <= circle.radius * circle.radius
  }

  const t = dotProduct / segmentLengthSq

  // Clamp t to be between 0 and 1, ensuring the closest point is within the segment
  const closestPointOnLineX = segment.x1 + t * segmentVecX
  const closestPointOnLineY = segment.y1 + t * segmentVecY

  let closestX, closestY
  if (t < 0) {
    // Closest point is the start of the segment
    closestX = segment.x1
    closestY = segment.y1
  } else if (t > 1) {
    // Closest point is the end of the segment
    closestX = segment.x2
    closestY = segment.y2
  } else {
    // Closest point is somewhere on the segment
    closestX = closestPointOnLineX
    closestY = closestPointOnLineY
  }

  // 3. Calculate the distance from the closest point on the segment to the circle's center
  const distSqClosest = (closestX - circle.x) * (closestX - circle.x) + (closestY - circle.y) * (closestY - circle.y)

  // If this distance is less than or equal to the circle.radius squared, there's an intersection
  return distSqClosest <= circle.radius * circle.radius
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {CanvasRenderingContext2D} ctx
 */
function start(canvas, ctx) {
  let valid, tries
  let count = Math.floor(Math.random() * 10) + 5
  do {
    tries = 0
    do {
      valid = true
      circles.splice(0, circles.length)
      path.splice(0, path.length)
      for (let index = 0; index < count; index++) {
        const radius = 25 * 4
        circles.push({
          x: Math.floor(Math.random() * (canvas.width - radius * 2) + radius),
          y: Math.floor(Math.random() * (canvas.height - radius * 2) + radius),
          radius
        })
      }

      /** @type {Circle[]} */
      const connectedCircles = []
      let currentCircle = circles[Math.floor(Math.random() * circles.length)]
      let lastCircle = currentCircle
      connectedCircles.push(currentCircle)
      while (connectedCircles.length < circles.length) {
        const nextCircle = circles
          .filter(c => c !== lastCircle && c !== currentCircle)
          .toSorted(() => Math.random() * 2 - 1)[0]
        path.push({
          start: currentCircle,
          end: nextCircle,
          distance: Math.sqrt((currentCircle.x - nextCircle.x) ** 2 + (currentCircle.y - nextCircle.y) ** 2)
        })
        if (!connectedCircles.includes(nextCircle)) connectedCircles.push(nextCircle)
        lastCircle = currentCircle
        currentCircle = nextCircle
      }

      for (const circle of circles) {
        circle.radius =
          path.reduce((prev, part) => prev + (part.start === circle ? 1 : 0) + (part.end === circle ? 1 : 0), 0) * 25
        if (
          circle.x - circle.radius * 1.25 < 0 ||
          circle.y - circle.radius * 1.25 < 0 ||
          circle.x + circle.radius * 1.25 > canvas.width ||
          circle.y + circle.radius * 1.25 > canvas.height
        )
          valid = false
      }

      for (let a = 0; a < circles.length - 1; a++)
        for (let b = a + 1; b < circles.length; b++) {
          const distance = Math.sqrt((circles[a].x - circles[b].x) ** 2 + (circles[a].y - circles[b].y) ** 2)
          if (distance <= (circles[a].radius + circles[b].radius) * 1.25) valid = false
        }
      for (const part of path)
        for (const circle of circles) {
          if (part.start === circle || part.end === circle) continue
          if (
            doesLineSegmentHitCircle(
              { x1: part.start.x, y1: part.start.y, x2: part.end.x, y2: part.end.y },
              { x: circle.x, y: circle.y, radius: circle.radius * 1.25 + fontSize }
            )
          )
            valid = false
        }

      for (const partA of path)
        for (const partB of path) {
          if (partA === partB) continue
          if (partA.start === partB.end && partA.end === partB.start) valid = false
          if (partA.start === partB.start && partA.end === partB.end) valid = false
        }
    } while (!valid && tries++ < 1_000)
  } while (!valid && count--)
}

let charOffset = 0
let fileOffset = 0

/**
 * @param {HTMLCanvasElement} canvas
 * @param {CanvasRenderingContext2D} ctx
 */
export function update(canvas, ctx) {
  if (lastWidth !== window.innerWidth || lastHeight !== innerHeight || !file.length) {
    width = canvas.width = window.innerWidth
    height = canvas.height = window.innerHeight
    ctx.font = `${fontSize}px 'Fira Code', Monospace`
    ctx.textBaseline = 'middle'
    start(canvas, ctx)
  }
  lastWidth = window.innerWidth
  lastHeight = window.innerHeight

  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  const charWidth = ctx.measureText('0').width
  const totalCharCount = path.reduce(
    (prev, part) => prev + Math.ceil((part.distance - part.start.radius - part.end.radius) / charWidth + 1),
    0
  )

  charOffset++
  if (charOffset === 10) {
    charOffset = 0
    fileOffset++
    if (fileOffset + totalCharCount > fileLength && fileOffset > fileLength) fileOffset -= fileLength
  }

  ctx.shadowColor = '#0f0'
  ctx.shadowBlur = 15
  let encrypted = false
  let offset = 0
  for (const part of path) {
    ctx.save()
    ctx.translate(part.start.x, part.start.y)
    const angle = Math.atan2(part.end.y - part.start.y, part.end.x - part.start.x)
    ctx.rotate(angle)
    ctx.fillStyle = '#0f0'
    const charCount = Math.ceil((part.distance - part.start.radius - part.end.radius) / charWidth + 1)
    const text = (encrypted ? fakeFile : file).slice(fileOffset + offset, fileOffset + offset + charCount)
    offset += charCount
    ctx.fillText(text, part.start.radius + charWidth * (1 - charOffset / 10) - charWidth, 0)
    ctx.restore()
    encrypted = !encrypted
  }
  ctx.shadowBlur = 0

  ctx.strokeStyle = '#0f0'
  ctx.fillStyle = '#000'
  ctx.lineWidth = 5
  for (let a = 0; a < circles.length; a++) {
    const circleA = circles[a]
    ctx.beginPath()
    ctx.arc(circleA.x, circleA.y, circleA.radius, 0, Math.PI * 2)
    ctx.stroke()
    ctx.fill()
  }
}

//includeInHomeBackgrounds
