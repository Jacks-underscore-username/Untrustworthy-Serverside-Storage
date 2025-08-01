/** @type {import('../types.d.js').Page} */
export default {
  name: 'graph',
  icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960"><path d="M480-80q-50 0-85-35t-35-85q0-5 .5-11t1.5-11l-83-47q-16 14-36 21.5t-43 7.5q-50 0-85-35t-35-85q0-50 35-85t85-35q24 0 45 9t38 25l119-60q-3-23 2.5-45t19.5-41l-34-52q-7 2-14.5 3t-15.5 1q-50 0-85-35t-35-85q0-50 35-85t85-35q50 0 85 35t35 85q0 20-6.5 38.5T456-688l35 52q8-2 15-3t15-1q17 0 32 4t29 12l66-54q-4-10-6-20.5t-2-21.5q0-50 35-85t85-35q50 0 85 35t35 85q0 50-35 85t-85 35q-17 0-32-4.5T699-617l-66 55q4 10 6 20.5t2 21.5q0 50-35 85t-85 35q-24 0-45.5-9T437-434l-118 59q2 9 1.5 18t-2.5 18l84 48q16-14 35.5-21.5T480-320q50 0 85 35t35 85q0 50-35 85t-85 35ZM200-320q17 0 28.5-11.5T240-360q0-17-11.5-28.5T200-400q-17 0-28.5 11.5T160-360q0 17 11.5 28.5T200-320Zm160-400q17 0 28.5-11.5T400-760q0-17-11.5-28.5T360-800q-17 0-28.5 11.5T320-760q0 17 11.5 28.5T360-720Zm120 560q17 0 28.5-11.5T520-200q0-17-11.5-28.5T480-240q-17 0-28.5 11.5T440-200q0 17 11.5 28.5T480-160Zm40-320q17 0 28.5-11.5T560-520q0-17-11.5-28.5T520-560q-17 0-28.5 11.5T480-520q0 17 11.5 28.5T520-480Zm240-200q17 0 28.5-11.5T800-720q0-17-11.5-28.5T760-760q-17 0-28.5 11.5T720-720q0 17 11.5 28.5T760-680Z"/></svg>',
  load: async pageApi => {
    const FRICTION = 0.25
    const CENTER_PULL = 0.01
    const MIN_MOVE = 0.1

    const newButton = /** @type {HTMLButtonElement} */ (document.getElementById('new_button'))
    const editButton = /** @type {HTMLButtonElement} */ (document.getElementById('edit_button'))
    const deleteButton = /** @type {HTMLButtonElement} */ (document.getElementById('delete_button'))
    const openButton = /** @type {HTMLButtonElement} */ (document.getElementById('open_button'))
    const connectButton = /** @type {HTMLButtonElement} */ (document.getElementById('connect_button'))
    const disconnectButton = /** @type {HTMLButtonElement} */ (document.getElementById('disconnect_button'))

    const canvas = /** @type {HTMLCanvasElement | null} */ (document.getElementById('graph_canvas'))
    if (canvas === null) throw new Error('Missing element')
    const ctx = canvas.getContext('2d')
    if (ctx === null) throw new Error('Uh oh')

    let scale = 1
    let x = 0
    let y = 0

    /** @type {import('../types.d.js').Graph_index} */
    let lastIndex

    /**
     * @returns {Promise<import('../types.d.js').Graph_index>}
     */
    const getGraphIndex = async () => (lastIndex = await pageApi.vfs.getFile('graph_index.json'))

    const saveGraphIndex = (() => {
      let needsToSave = false
      let isSaving = false
      /** @type {import('../types.d.js').Graph_index} */
      let index
      const save = async () => {
        if (isSaving) {
          needsToSave = true
          return
        }
        needsToSave = false
        isSaving = true
        await pageApi.vfs.saveFile('graph_index.json', index)
        isSaving = false
        if (needsToSave) save()
      }
      /**
       * @param {import('../types.d.js').Graph_index} graphIndex
       */
      return graphIndex => {
        lastIndex = graphIndex
        index = graphIndex
        save()
      }
    })()

    if (!(await pageApi.vfs.doesFileExist('graph_index.json')))
      await saveGraphIndex({
        nodes: [],
        nextNodeId: 0,
        unusedNodeIds: []
      })
    else await getGraphIndex()

    /**
     * @param {number | import('../types.d.js').Graph_node<any>} x1n1
     * @param {number | import('../types.d.js').Graph_node<any>} y1n2
     * @param {number} [x2]
     * @param {number} [y2]
     * @returns {number}
     */
    const getDistance = (x1n1, y1n2, x2, y2) => {
      const t1 = typeof x1n1
      const t2 = typeof y1n2
      if (t1 !== t2) throw new Error('Invalid args')
      if (t1 !== 'number' && t2 !== 'number') {
        // @ts-expect-error
        x2 = y1n2.x
        // @ts-expect-error
        y2 = y1n2.y
        // @ts-expect-error
        ;[x1n1, y1n2] = [x1n1.x, x1n1.y]
      }
      // @ts-expect-error
      return Math.sqrt((x1n1 - x2) ** 2 + (y1n2 - y2) ** 2)
    }

    /**
     * @template T
     * @param {import('../types.d.js').Graph_node<T>} node
     * @returns {import('../types.d.js').Node_type<T>}
     */
    const getType = node => {
      const type = pageApi.nodeTypes.find(type => type.name === node.type)
      if (type === undefined) throw new Error(`Unknown node type: "${node.type}"`)
      return type
    }

    /**
     * @param {number} id
     * @returns {import('../types.d.js').Graph_node<any>}
     */
    const getNode = id => {
      const node = lastIndex.nodes.find(node => node.id === id)
      if (node === undefined) throw new Error(`Missing node ${id}`)
      return node
    }

    const update = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      const changes = []
      for (const node of lastIndex.nodes) {
        const minDistance = getType(node).getPhysics(ctx, node).minDistance
        const force = {
          x: 0,
          y: 0
        }
        const angleToCenter = Math.atan2(node.x, node.y)
        force.x -= Math.sin(angleToCenter) * CENTER_PULL
        force.y -= Math.cos(angleToCenter) * CENTER_PULL
        for (const id of node.connections) {
          const subNode = lastIndex.nodes.find(subNode => subNode.id === id)
          if (subNode === undefined) throw new Error(`Invalid connection id: ${id}`)
          const type = getType(subNode)
          const physics = type.getPhysics(ctx, subNode)
          const distance = getDistance(node, subNode) - minDistance
          const difference = physics.targetDistance - distance
          if (difference < -physics.pullForce || difference > physics.pushForce) {
            const angle = Math.atan2(node.x - subNode.x, node.y - subNode.y)
            if (difference < -physics.pullForce) {
              force.x -= Math.sin(angle) * physics.pullForce * (-difference / physics.targetDistance)
              force.y -= Math.cos(angle) * physics.pullForce * (-difference / physics.targetDistance)
            } else if (difference > physics.pushForce) {
              force.x += Math.sin(angle) * physics.pushForce * (difference / physics.targetDistance)
              force.y += Math.cos(angle) * physics.pushForce * (difference / physics.targetDistance)
            }
          }
        }
        for (const subNode of lastIndex.nodes) {
          if (subNode === node) continue
          const type = getType(subNode)
          const physics = type.getPhysics(ctx, subNode)
          const distance = getDistance(node, subNode) - minDistance
          if (distance < physics.minDistance) {
            const angle = Math.atan2(node.x - subNode.x, node.y - subNode.y)
            force.x += Math.sin(angle) * physics.pushForce
            force.y += Math.cos(angle) * physics.pushForce
          }
        }
        changes.push(force)
      }

      for (const node of lastIndex.nodes) {
        const change = changes.shift()
        if (change === undefined) throw new Error('Uh oh')
        if (heldNodes.has(node.id)) {
          node.movement = undefined
          continue
        }
        if (node.movement === undefined) node.movement = change
        else {
          node.movement.x += change.x
          node.movement.y += change.y
        }
        if (Math.abs(node.movement.x) + Math.abs(node.movement.y) > MIN_MOVE) {
          node.x += node.movement.x
          node.y += node.movement.y
        }
        node.movement.x *= 1 - FRICTION
        node.movement.y *= 1 - FRICTION
      }

      for (const node of lastIndex.nodes)
        for (const id of node.connections) {
          const subNode = lastIndex.nodes.find(subNode => subNode.id === id)
          if (subNode === undefined) throw new Error('Invalid connection id')
          ctx.strokeStyle = '#0f0'
          ctx.beginPath()
          ctx.moveTo((-x + node.x) * scale + canvas.width / 2, (-y + node.y) * scale + canvas.height / 2)
          ctx.lineTo((-x + subNode.x) * scale + canvas.width / 2, (-y + subNode.y) * scale + canvas.height / 2)
          ctx.stroke()
        }

      for (const node of lastIndex.nodes) {
        ctx.save()
        ctx.translate((-x + node.x) * scale + canvas.width / 2, (-y + node.y) * scale + canvas.height / 2)
        ctx.scale(scale, scale)
        getType(node).renderPreview(ctx, node)
        ctx.restore()
      }

      saveGraphIndex(lastIndex)

      for (const node of lastIndex.nodes)
        for (const id of node.connections) {
          if (id === node.id) throw new Error(`Node ${id} links to itself`)
          const subNode = lastIndex.nodes.find(subNode => subNode.id === id)
          if (subNode === undefined) throw new Error(`Invalid connection id: ${id}`)
          if (!subNode.connections.includes(node.id)) throw new Error(`Asymmetric link: ${node.id} -> ${id}`)
        }
    }

    newButton.addEventListener('click', async () => {
      const index = await getGraphIndex()
      let id
      if (index.unusedNodeIds.length) id = index.unusedNodeIds.shift() ?? 0
      else {
        id = index.nextNodeId
        index.nextNodeId++
      }
      if (Math.random() < 0.25) {
        /** @type {import('../types.d.js').Graph_node<import('../types.d.js').Node_data_topic>} */
        const entry = {
          id,
          type: 'topic',
          connections: [],
          data: {
            name: 'Topic',
            color: '#030',
            selectedColor: '#363',
            borderColor: '#0f0',
            textColor: '#fff'
          },
          x: (Math.random() * 2 - 1) * 100,
          y: (Math.random() * 2 - 1) * 100,
          selected: false
        }
        index.nodes.push(entry)
      } else {
        /** @type {import('../types.d.js').Graph_node<import('../types.d.js').Node_data_plaintext>} */
        const entry = {
          id,
          type: 'plaintext',
          connections: [],
          data: {
            text: ['Hello World!'],
            name: 'Hi',
            color: '#030',
            selectedColor: '#363',
            borderColor: '#0f0',
            textColor: '#fff'
          },
          x: (Math.random() * 2 - 1) * 100,
          y: (Math.random() * 2 - 1) * 100,
          selected: false
        }
        index.nodes.push(entry)
      }
      saveGraphIndex(index)
    })

    deleteButton.addEventListener('click', () => {
      for (const id of selectedNodes.values()) {
        const node = getNode(id)
        selectedNodes.delete(id)
        lastIndex.unusedNodeIds.push(id)
        lastIndex.nodes.splice(lastIndex.nodes.indexOf(node), 1)
        for (const subNode of lastIndex.nodes)
          if (subNode.connections.includes(id)) subNode.connections.splice(subNode.connections.indexOf(id), 1)
      }
      saveGraphIndex(lastIndex)
    })

    connectButton.addEventListener('click', () => {
      for (const id of selectedNodes.values()) {
        const node = getNode(id)
        for (const subId of selectedNodes.values()) {
          const subNode = getNode(subId)
          if (node === subNode) continue
          if (!node.connections.includes(subId)) node.connections.push(subId)
          if (!subNode.connections.includes(id)) subNode.connections.push(id)
        }
      }
      saveGraphIndex(lastIndex)
    })

    disconnectButton.addEventListener('click', () => {
      for (const id of selectedNodes.values()) {
        const node = getNode(id)
        for (const subId of selectedNodes.values()) {
          const subNode = getNode(subId)
          if (node === subNode) continue
          if (node.connections.includes(subId)) node.connections.splice(node.connections.indexOf(subId), 1)
          if (subNode.connections.includes(id)) subNode.connections.splice(subNode.connections.indexOf(id), 1)
        }
      }
      saveGraphIndex(lastIndex)
    })

    let lastMouseX = 0
    let lastMouseY = 0
    let isMouseDown = false
    /** @type {Set<number>} */
    const heldNodes = new Set()
    /** @type {Set<number>} */
    const selectedNodes = new Set()

    canvas.addEventListener('mousemove', event => {
      const rect = canvas.getBoundingClientRect()
      const newX = (event.x - rect.left - canvas.width / 2) / scale
      const newY = (event.y - rect.top - canvas.height / 2) / scale
      if (isMouseDown)
        if (heldNodes.size) {
          for (const id of heldNodes.values()) {
            const node = getNode(id)
            node.x -= lastMouseX - newX
            node.y -= lastMouseY - newY
          }
        } else {
          x += lastMouseX - newX
          y += lastMouseY - newY
        }
      lastMouseX = newX
      lastMouseY = newY
    })

    canvas.addEventListener('mousedown', event => {
      isMouseDown = true
      for (const node of lastIndex.nodes)
        if (getType(node).containsPoint(ctx, node, lastMouseX + x, lastMouseY + y)) {
          if (selectedNodes.has(node.id)) {
            node.selected = false
            selectedNodes.delete(node.id)
          } else {
            node.selected = true
            selectedNodes.add(node.id)
          }
          heldNodes.add(node.id)
        }
    })

    canvas.addEventListener('mouseup', event => {
      isMouseDown = false
      heldNodes.clear()
    })

    canvas.addEventListener('wheel', event => {
      scale *= event.deltaY < 0 ? 1.1 : 0.9
    })

    document.addEventListener('keypress', () => console.log(JSON.parse(JSON.stringify(lastIndex))))

    let lastWidth = 0
    let lastHeight = 0
    const intervalId = setInterval(() => {
      if (!document.contains(canvas)) {
        clearInterval(intervalId)
        return
      }
      const canvasBounds = canvas.getBoundingClientRect()
      if (canvasBounds.width !== lastWidth || canvasBounds.height !== lastHeight) {
        lastWidth = canvasBounds.width
        lastHeight = canvasBounds.height
        resize()
      }
      update()
    }, 1000 / 30)
    const resize = () => {
      const canvasBounds = canvas.getBoundingClientRect()
      canvas.width = canvasBounds.width
      canvas.height = canvasBounds.height
    }
    resize()
  }
}
