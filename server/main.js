const Security = require('./security.js')
const fs = require('node:fs')
const crypto = require('node:crypto')
const path = require('node:path')

/**
 * @typedef {Object} Request_new_connection
 * @prop {'new_connection'} command
 * @prop {JsonWebKey} public_key
 * @typedef {Object} Request_encrypted
 * @prop {'encrypted'} command
 * @prop {number} id
 * @prop {string} iv
 * @prop {string} tag
 * @prop {string} ciphertext
 * @typedef {Object} Request_echo
 * @prop {'echo'} command
 * @prop {any} data
 * @typedef {Object} Request_get_seed
 * @prop {'get_seed'} command
 * @prop {JsonWebKey} public_key
 * @prop {string} username
 * @typedef {Object} Request_prove_seed
 * @prop {'prove_seed'} command
 * @prop {string} hashed_seed
 * @typedef {Object} Request_get_file
 * @prop {'get_file'} command
 * @prop {string} file_name
 * @typedef {Object} Request_save_file
 * @prop {'save_file'} command
 * @prop {string} file_name
 * @prop {string} data
 * @typedef {Object} Request_delete_file
 * @prop {'delete_file'} command
 * @prop {string} file_name
 * @typedef {Request_new_connection | Request_encrypted | Request_echo | Request_get_seed | Request_prove_seed | Request_get_file | Request_save_file | Request_delete_file} Request
 */

/**
 * @typedef {Object} ServerConfig
 * @prop {number} port
 */

const config = /** @type {ServerConfig} */ (JSON.parse(fs.readFileSync('./config.json', 'utf8')))

/**
 * @typedef {Object} User
 * @prop {string} username
 * @prop {string} seed
 * @prop {string} [hashedSeed]
 * @prop {number} lastOnline
 */

if (!fs.existsSync('data')) fs.mkdirSync('data')
if (!fs.existsSync(path.join('data', 'users.json'))) fs.writeFileSync(path.join('data', 'users.json'), '{}')
const users = /** @type {Object<string, User>} */ (JSON.parse(fs.readFileSync(path.join('data', 'users.json'), 'utf8')))

const saveUsers = () => fs.writeFileSync(path.join('data', 'users.json'), JSON.stringify(users, undefined, 2))

/**
 * @typedef {{id: number, keys: { encode: CryptoKey, decode: CryptoKey }, username?: string, lastMessage: number, verified: boolean}} Connection
 */

/** @type {Connection[]} */
const connections = []

/**
 * @param {globalThis.Request} req
 * @returns {Promise<Response>}
 */
const handleRawMessage = async req => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204 })

  try {
    return new Response(JSON.stringify(await handleUnencryptedMessage(/** @type {Request} */ (await req.json()))))
  } catch (err) {
    console.error(err)
    return new Response('Unknown error')
  }
}

/**
 * @param {Request} request
 * @returns {Promise<any>}
 */
const handleUnencryptedMessage = async request => {
  if (request.command === 'echo') return request.data

  if (request.command === 'new_connection') {
    const clientKey = await crypto.subtle.importKey(
      'jwk',
      request.public_key,
      { name: 'ECDH', namedCurve: 'P-256' },
      false,
      []
    )
    const sharedKeys = await Security.computeSharedKeys(clientKey)

    /** @type {number} */
    let id
    do id = Math.floor(Math.random() * 10 ** 5)
    while (id < 0 || connections.some(connection => connection.id === id))
    connections.push({
      id,
      keys: sharedKeys,
      lastMessage: Date.now(),
      verified: false
    })
    return { public_key: await crypto.subtle.exportKey('jwk', (await Security.getKeyPair()).publicKey), id }
  }

  if (request.command === 'encrypted') {
    const connection = connections.find(connection => connection.id === request.id)
    if (connection === undefined) throw new Error('Uh oh')
    connection.lastMessage = Date.now()
    const ivIn = Buffer.from(request.iv, 'base64')
    const tagIn = Buffer.from(request.tag, 'base64')
    const ciphertextIn = Buffer.from(request.ciphertext, 'base64')

    const decrypted = /** @type {Request} */ (
      JSON.parse(
        new TextDecoder().decode(
          await crypto.subtle.decrypt(
            {
              name: 'AES-GCM',
              iv: ivIn,
              additionalData: new Uint8Array(),
              tagLength: 128
            },
            connection.keys.decode,
            new Uint8Array([...ciphertextIn, ...tagIn])
          )
        )
      )
    )

    const response = await handleUnverifiedRequest(decrypted, connection)

    const ivOut = crypto.getRandomValues(new Uint8Array(12))
    const dataOut = new TextEncoder().encode(JSON.stringify(response))

    const encrypted = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: ivOut,
        tagLength: 128
      },
      connection.keys.encode,
      dataOut
    )

    const ciphertextOut = encrypted.slice(0, encrypted.byteLength - 16)
    const tagOut = encrypted.slice(encrypted.byteLength - 16)

    return {
      command: 'encrypted',
      iv: ivOut.toBase64(),
      ciphertext: Buffer.from(ciphertextOut).toBase64(),
      tag: Buffer.from(tagOut).toBase64()
    }
  }
  return 'Uh oh'
}

/**
 * @param {Request} request
 * @param {Connection} connection
 * @returns {Promise<any>}
 */
const handleUnverifiedRequest = async (request, connection) => {
  if (request.command === 'echo') return request.data
  if (request.command === 'get_seed') {
    if (users[request.username] === undefined) {
      users[request.username] = {
        username: request.username,
        seed: crypto.randomBytes(64).toBase64(),
        lastOnline: Date.now()
      }
    }
    saveUsers()
    connection.username = request.username
    return users[request.username].seed
  }
  if (request.command === 'prove_seed') {
    if (connection.username !== undefined && users[connection.username] !== undefined) {
      const user = users[connection.username]
      if (user.hashedSeed === undefined) {
        user.hashedSeed = request.hashed_seed
        saveUsers()
        connection.verified = true
        return { status: 'success' }
      }
      if (user.hashedSeed === request.hashed_seed) {
        connection.verified = true
        return { status: 'success' }
      }
    }
  }
  // @ts-expect-error
  if (connection.verified) return await handleVerifiedRequest(request, connection, users[connection.username])
}

/**
 *
 * @param {Request} request
 * @param {Connection} connection
 * @param {User} user
 * @returns {Promise<any>}
 */
const handleVerifiedRequest = async (request, connection, user) => {
  user.lastOnline = Date.now()
  if (request.command === 'get_file') {
    if (fs.existsSync(path.join('data', user.username, `${request.file_name}.enc`)))
      return {
        status: 'success',
        file: fs.readFileSync(path.join('data', user.username, `${request.file_name}.enc`), 'utf8')
      }
    return { status: 'no_file' }
  }
  if (request.command === 'save_file') {
    if (!fs.existsSync(path.join('data', user.username))) fs.mkdirSync(path.join('data', user.username))
    fs.writeFileSync(path.join('data', user.username, `${request.file_name}.enc`), request.data, 'utf8')
    return { status: 'success' }
  }
  if (request.command === 'delete_file') {
    if (fs.existsSync(path.join('data', user.username, `${request.file_name}.enc`)))
      fs.rmSync(path.join('data', user.username, `${request.file_name}.enc`))
    return { status: 'success' }
  }
}

const server = Bun.serve({
  port: config.port,
  async fetch(req) {
    const response = await handleRawMessage(req)
    response.headers.set('Access-Control-Allow-Origin', '*')
    return response
  }
})

console.log(`Listening on ${server.url}`)
