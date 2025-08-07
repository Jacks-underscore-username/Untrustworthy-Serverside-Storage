const fs = require('node:fs')

/**
 * @typedef {{ serverPort: number, clientPort: number } & ({ useCert: false | undefined } | { useCert: true, certPath: string, keyPath: string })} ServerConfig
 */

const config = /** @type {ServerConfig} */ (JSON.parse(fs.readFileSync('./config.json', 'utf8')))

/** @type {Bun.ServerWebSocket<any> | undefined} */
let serverSocket = undefined
/** @type {((value: any) => void) | undefined} */
let messagePromise = undefined
const socketServer = Bun.serve({
  port: config.serverPort,
  async fetch(req, server) {
    const url = new URL(req.url)
    if (url.pathname === '/ws') {
      const success = server.upgrade(req, {})
      if (success) {
        console.log(`WebSocket at port ${config.serverPort} upgraded successfully`)
        return undefined
      }
      return new Response(`WebSocket upgrade failed at port ${config.serverPort}`, { status: 500 })
    }
    return new Response()
  },
  websocket: {
    message: (ws, message) => {
      if (messagePromise !== undefined) {
        messagePromise(new Response(message))
        messagePromise = undefined
      }
    },
    open: ws => {
      console.log(`Socket connected at port ${config.serverPort}`)
      serverSocket = ws
    }
  }
})
const clientServer = Bun.serve({
  port: config.clientPort,
  async fetch(req) {
    if (serverSocket === undefined || serverSocket.readyState !== 1)
      return console.error(`Queried before websocket was connected at port ${config.clientPort}`)
    const response = await new Promise(async resolve => {
      messagePromise = resolve
      if (req.method === 'OPTIONS') return resolve(new Response(null, { status: 204 }))
      const message = await req.text()
      serverSocket?.send(message)
    })
    response.headers.set('Access-Control-Allow-Origin', '*')
    return response
  },
  ...(config.useCert
    ? { tls: { cert: fs.readFileSync(config.certPath, 'utf-8'), key: fs.readFileSync(config.keyPath, 'utf8') } }
    : {})
})

console.log(`Socket listening on ${socketServer.url}`)
console.log(`Server relay on ${clientServer.url}`)
