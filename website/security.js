/**
 * @returns {Promise<CryptoKeyPair>}
 */
const makeKeyPair = () => crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])

/**
 * @param {URL} address
 * @param {string} username
 * @param {string} password
 * @param {string} [service]
 * @returns {Promise<{getFile:(fileName:string)=>Promise<any>,saveFile:(fileName:string,data:any)=>Promise<void>,deleteFile:(filePath:string)=>Promise<void>,getIndex:()=>Promise<Index>}>}
 */
export const connectToServer = async (address, username, password, service = '') => {
  const keyPair = await makeKeyPair()
  const clientPublicKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey)

  const { public_key: serverPublicKeyJwk, id } = await (
    await fetch(address, {
      method: 'POST',
      body: JSON.stringify({
        command: 'new_connection',
        public_key: clientPublicKeyJwk
      })
    })
  ).json()

  const serverPublicKey = await crypto.subtle.importKey(
    'jwk',
    serverPublicKeyJwk,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  )

  const secret = await crypto.subtle.deriveBits({ name: 'ECDH', public: serverPublicKey }, keyPair.privateKey, 256)

  const derivedKeyBytes = new Uint8Array(
    await crypto.subtle.deriveBits(
      {
        name: 'HKDF',
        salt: new TextEncoder().encode('salt'),
        info: new TextEncoder().encode('key-derivation-context'),
        hash: 'SHA-256'
      },
      await crypto.subtle.importKey('raw', secret, { name: 'HKDF' }, false, ['deriveBits']),
      512
    )
  )

  const sharedKeys = {
    encode: await importKey(derivedKeyBytes.slice(0, 32), ['encrypt']),
    decode: await importKey(derivedKeyBytes.slice(32, 64), ['decrypt'])
  }

  /**
   * @param {any} message
   * @returns {Promise<any>}
   */
  const messageServer = async message => {
    const ivOut = crypto.getRandomValues(new Uint8Array(12))
    const dataOut = new TextEncoder().encode(JSON.stringify(message))

    const encrypted = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: ivOut,
        tagLength: 128
      },
      sharedKeys.encode,
      dataOut
    )

    const ciphertextOut = encrypted.slice(0, encrypted.byteLength - 16)
    const tagOut = encrypted.slice(encrypted.byteLength - 16)

    /** @type {Object<string, string>} */
    const {
      iv: ivIn,
      ciphertext: ciphertextIn,
      tag: tagIn
    } = await (
      await fetch(address, {
        method: 'POST',
        body: JSON.stringify({
          command: 'encrypted',
          iv: arrayBufferToBase64(ivOut),
          ciphertext: arrayBufferToBase64(ciphertextOut),
          tag: arrayBufferToBase64(tagOut),
          id
        })
      })
    ).json()

    const decrypted = JSON.parse(
      new TextDecoder().decode(
        await crypto.subtle.decrypt(
          {
            name: 'AES-GCM',
            iv: base64ToArrayBuffer(ivIn),
            additionalData: new Uint8Array(),
            tagLength: 128
          },
          sharedKeys.decode,
          new Uint8Array(await new Blob([base64ToArrayBuffer(ciphertextIn), base64ToArrayBuffer(tagIn)]).arrayBuffer())
        )
      )
    )
    return decrypted
  }
  /** @type {string} */
  const seed = await messageServer({ command: 'get_seed', username })

  const token = [seed, service, address, username, password].join('')

  await messageServer({
    command: 'prove_seed',
    hashedSeed: arrayBufferToBase64(
      new Uint8Array(
        await crypto.subtle.digest(
          'SHA-512',
          new TextEncoder().encode([seed, service, address, password, username].join(''))
        )
      )
    )
  })

  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(
      arrayBufferToBase64(new Uint8Array(await crypto.subtle.digest('SHA-512', new TextEncoder().encode(token))))
    ),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  )

  /**
   * @param {any} data
   * @returns {Promise<string>}
   */
  const encryptData = async data => {
    const iv = window.crypto.getRandomValues(new Uint8Array(12))
    const salt = window.crypto.getRandomValues(new Uint8Array(12))
    const key = await window.crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    )
    const encryptedData = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      new TextEncoder().encode(JSON.stringify(data))
    )
    return JSON.stringify({
      iv: arrayBufferToBase64(iv),
      salt: arrayBufferToBase64(salt),
      encryptedData: arrayBufferToBase64(encryptedData)
    })
  }

  /**
   * @param {string} encryptedData
   * @returns {Promise<any>}
   */
  const decryptData = async encryptedData => {
    const { iv, salt, encryptedData: realEncryptedData } = JSON.parse(encryptedData)
    const key = await window.crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: base64ToArrayBuffer(salt),
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    )

    const data = JSON.parse(
      new TextDecoder().decode(
        await window.crypto.subtle.decrypt(
          { name: 'AES-GCM', iv: base64ToArrayBuffer(iv) },
          key,
          base64ToArrayBuffer(realEncryptedData)
        )
      )
    )
    return data
  }

  /**
   * @param {string} filePath
   * @returns {Promise<string>}
   */
  const hashFilePath = async filePath =>
    arrayBufferToFileName(
      new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${filePath}${token}`)))
    )

  /**
   * @param {string} filePath
   * @returns {Promise<any>}
   */
  const getFile = async filePath => {
    const response = await messageServer({
      command: 'get_file',
      file_name: await hashFilePath(filePath)
    })
    if (response.status === 'success') return JSON.parse(await decryptData(response.file))
    throw new Error('Missing file')
  }

  /**
   * @param {string} filePath
   * @param {any} data
   * @returns {Promise<void>}
   */
  const baseSaveFile = async (filePath, data) =>
    await messageServer({
      command: 'save_file',
      file_name: await hashFilePath(filePath),
      data: await encryptData(JSON.stringify(data))
    })

  /**
   * @typedef {{[key: string]: Index | string | undefined}} Index
   * @returns {Promise<Index>}
   */
  const getIndex = async () => {
    /** @type {Index} */
    let index = {}
    try {
      index = await getFile('index.json')
    } catch (err) {
      await baseSaveFile('index.json', index)
    }
    return index
  }

  /**
   * @param {string} filePath
   * @param {any} data
   * @returns {Promise<void>}
   */
  const saveFile = async (filePath, data) => {
    const index = await getIndex()
    const splitPath = filePath.split('/')
    let parentFolder = index
    for (let part = splitPath[0]; splitPath.length > 1; part = splitPath.shift() ?? '') {
      if (parentFolder[part] === undefined) parentFolder[part] = {}
      const nextFolder = parentFolder[part]
      if (nextFolder !== undefined && typeof nextFolder === 'object') parentFolder = nextFolder
      else throw new Error('Conflicting file / folder')
    }
    const fileHash = arrayBufferToBase64(await crypto.subtle.digest('SHA-1', new TextEncoder().encode(data)))
    if (parentFolder[splitPath[0]] !== fileHash) {
      parentFolder[splitPath[0]] = fileHash
      baseSaveFile('index.json', index)
      baseSaveFile(filePath, data)
    }
  }

  /**
   * @param {string} filePath
   * @returns {Promise<void>}
   */
  const deleteFile = async filePath => {
    const index = await getIndex()
    const splitPath = filePath.split('/')
    let parentFolder = index
    for (let part = splitPath[0]; splitPath.length > 1; part = splitPath.shift() ?? '')
      // @ts-expect-error
      parentFolder = parentFolder[part]
    delete parentFolder[splitPath[0]]
    await saveFile('index.json', index)
    await messageServer({
      command: 'delete_file',
      file_name: await hashFilePath(filePath)
    })
  }

  return { getFile, saveFile, deleteFile, getIndex }
}

/**
 * @param {string} base64
 * @returns {ArrayBuffer}
 */
const base64ToArrayBuffer = base64 => {
  const binaryString = atob(base64)
  const bytes = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i)
  return bytes.buffer
}

/**
 * @param {ArrayBuffer | Uint8Array} buffer
 * @returns {string}
 */
const arrayBufferToBase64 = buffer => btoa(String.fromCharCode(...new Uint8Array(buffer)))

/**
 * @param {ArrayBuffer | Uint8Array} buffer
 * @returns {string}
 */
const arrayBufferToFileName = buffer =>
  [...new Uint8Array(buffer)]
    .map(x => x.toString(32))
    .join('')
    .replaceAll(/\/\-\+/g, '_')

/**
 * @param {Uint8Array} keyBytes
 * @param {KeyUsage[]} usages
 * @returns {Promise<CryptoKey>}
 */
const importKey = (keyBytes, usages) => crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, true, usages)
