/** @type {import("../types.d").Node_type<import("../types.d").Node_data_plaintext>} */
export default {
  name: 'plaintext',
  renderPreview: (ctx, node) => {
    const data = node.data
    ctx.fillStyle = node.selected ? data.selectedColor : data.color
    ctx.strokeStyle = data.borderColor
    const textWidth = ctx.measureText(data.name).width
    ctx.beginPath()
    ctx.arc(0, 0, (textWidth / 2) * 1.5, 0, Math.PI * 2)
    ctx.stroke()
    ctx.fill()
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = data.textColor
    ctx.fillText(data.name, 0, 0)
  },
  render: node => {},
  getPhysics: (ctx, node) => {
    const textWidth = ctx.measureText(node.data.name).width

    return { pullForce: 1, pushForce: 1, targetDistance: textWidth * 1.5 * 2, minDistance: textWidth * 1.5 }
  },
  containsPoint: (ctx, node, x, y) => {
    const textWidth = ctx.measureText(node.data.name).width
    const distance = Math.sqrt((node.x - x) ** 2 + (node.y - y) ** 2)
    return distance < (textWidth / 2) * 1.5
  }
}
