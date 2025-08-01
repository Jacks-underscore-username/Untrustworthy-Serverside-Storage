/** @type {import("../types.d").Node_type<import("../types.d").Node_data_topic>} */
export default {
  name: 'topic',
  renderPreview: (ctx, node) => {
    const data = node.data
    ctx.fillStyle = node.selected ? data.selectedColor : data.color
    ctx.strokeStyle = data.borderColor
    ctx.beginPath()
    ctx.arc(0, 0, (node.connections.length + 1) * 2, 0, Math.PI * 2)
    ctx.stroke()
    ctx.fill()
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = data.textColor
    ctx.fillText(data.name, 0, 0)
  },
  render: node => {},
  getPhysics: (ctx, node) => {
    return {
      pullForce: node.connections.length,
      pushForce: node.connections.length,
      targetDistance: (node.connections.length + 1) * 2 * 2,
      minDistance: (node.connections.length + 1) * 2
    }
  },
  containsPoint: (ctx, node, x, y) => {
    const distance = Math.sqrt((node.x - x) ** 2 + (node.y - y) ** 2)
    return distance < (node.connections.length + 1) * 2
  }
}
