const fs = require('node:fs')

/**
 * @typedef {{ ports: string[] } & ({ useCert: false | undefined } | { useCert: true, certPath: string, keyPath: string })} ServerConfig
 */

const config = /** @type {ServerConfig} */ (JSON.parse(fs.readFileSync('./config.json', 'utf8')))

for (const port of config.ports) {
  /** @type {Bun.ServerWebSocket<any> | undefined} */
  let serverSocket = undefined
  /** @type {((value: any) => void) | undefined} */
  let messagePromise = undefined
  const server = Bun.serve({
    port,
    async fetch(req, server) {
      const url = new URL(req.url)
      if (url.pathname === '/ws') {
        const success = server.upgrade(req, {})
        if (success) {
          console.log(`WebSocket at port ${port} upgraded successfully`)
          return undefined
        }
        return new Response(`WebSocket upgrade failed at port ${port}`, { status: 500 })
      }
      if (serverSocket === undefined || serverSocket.readyState !== 1)
        return console.error(`Queried before websocket was connected at port ${port}`)
      const response = await new Promise(async resolve => {
        messagePromise = resolve
        if (req.method === 'OPTIONS') return resolve(new Response(null, { status: 204 }))
        const message = await req.text()
        serverSocket?.send(message)
      })
      response.headers.set('Access-Control-Allow-Origin', '*')
      return response
    },
    websocket: {
      message: (ws, message) => {
        if (messagePromise !== undefined) {
          messagePromise(new Response(message))
          messagePromise = undefined
        }
      },
      open: ws => {
        console.log(`Socket connected at port ${port}`)
        serverSocket = ws
      }
    },
    ...(config.useCert
      ? { tls: { cert: fs.readFileSync(config.certPath, 'utf-8'), key: fs.readFileSync(config.keyPath, 'utf8') } }
      : {})
  })
  console.log(`Listening on ${server.url}`)
}
