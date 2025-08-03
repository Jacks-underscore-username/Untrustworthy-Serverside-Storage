/**
 * @typedef {Object} VFS
 * @prop {(fileName: string) => Promise<any>} getFile
 * @prop {(fileName: string, data: any) => Promise<void>} saveFile
 * @prop {(fileName: string) => Promise<void>} deleteFile
 * @prop {() => Promise<Index>} getIndex
 * @prop {(index: Index) => Promise<void>} saveIndex
 * @prop {(fileName: string) => Promise<boolean>} doesFileExist
 * @prop {(...args: string[]) => string} joinPaths
 * @prop {(data: string) => Promise<string>} quickHash
 * @typedef {Object} Index_file
 * @prop {'file'} type
 * @prop {string} hash
 * @typedef {Object} Index
 * @prop {'folder'} type
 * @prop {{[key: string]: (Index_file | Index)}} contents
 */

const ERRORS = {
  MISSING_FILE: 'Missing file',
  MISSING_FOLDER: 'Missing folder',
  FOLDER_IS_FILE: 'File exists where a folder should',
  FILE_IS_FOLDER: 'Folder exists where a file should'
}

/**
 * @returns {Promise<CryptoKeyPair>}
 */
const makeKeyPair = () => crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])

/**
 * @param {URL} address
 * @param {string} username
 * @param {string} password
 * @param {string} [service]
 * @returns {Promise<VFS>}
 */
export const connectToServer = async (address, username, password, service = '') => {
  if (address.origin === 'null') address = new URL(`http://${address.toString()}`)

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

  const token = [seed, service, username, password].join('')

  await messageServer({
    command: 'prove_seed',
    hashedSeed: arrayBufferToBase64(
      new Uint8Array(
        await crypto.subtle.digest('SHA-512', new TextEncoder().encode([seed, service, password, username].join('')))
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
  const baseGetFile = async filePath => {
    const response = await messageServer({
      command: 'get_file',
      file_name: await hashFilePath(filePath)
    })
    if (response.status === 'success') return JSON.parse(await decryptData(response.file))
    throw new Error(ERRORS.MISSING_FILE)
  }

  /**
   * @param {string} filePath
   * @param {any} data
   * @returns {Promise<void>}
   */
  const baseSaveFile = async (filePath, data) => {
    await messageServer({
      command: 'save_file',
      file_name: await hashFilePath(filePath),
      data: await encryptData(JSON.stringify(data))
    })
  }

  /**
   * @param {string} filePath
   * @returns {Promise<void>}
   */
  const baseDeleteFile = async filePath => {
    await messageServer({
      command: 'delete_file',
      file_name: await hashFilePath(filePath)
    })
  }

  /** @type {string} */
  let lastIndexHash = ''

  /**
   * @returns {Promise<Index>}
   */
  const getIndex = async () => {
    /** @type {Index} */
    let index = {
      type: 'folder',
      contents: {}
    }
    try {
      index = await baseGetFile('index.json')
    } catch (err) {
      await saveIndex(index)
    }
    lastIndexHash = await quickHash(JSON.stringify(index))
    return index
  }

  /**
   * @param {Index} index
   * @returns {Promise<void>}
   */
  const saveIndex = async index => {
    const hash = await quickHash(JSON.stringify(index))
    if (hash === lastIndexHash) return
    await baseSaveFile('index.json', index)
  }

  /**
   * @param {Index} index
   * @param {string} fileHash
   * @param {string} [folderPath]
   * @param {string[]} [excludePaths]
   * @returns {{ folder: Index, file: Index_file, filePath: string } | undefined}
   */
  const findFileByHash = (index, fileHash, folderPath, excludePaths = []) => {
    for (const [name, entry] of Object.entries(index.contents)) {
      const entryPath = folderPath === undefined ? name : `${folderPath}/${name}`
      if (entry.type === 'folder') {
        const result = findFileByHash(entry, fileHash, entryPath)
        if (result !== undefined) return result
      }
      if (entry.type === 'file' && entry.hash === fileHash && !excludePaths.includes(entryPath))
        return { folder: index, file: entry, filePath: entryPath }
    }
    return
  }

  /**
   * @param {Index} index
   * @param {string} folderPath
   * @param {boolean} [makeFolders]
   * @param {boolean} [softFail]
   * @returns {Index | undefined}
   */
  const getIndexFolder = (index, folderPath, makeFolders = false, softFail = false) => {
    if (!folderPath.length) return index
    const splitPath = folderPath.split('/')
    let parentFolder = index
    for (let part = splitPath.shift() ?? ''; part.length; part = splitPath.shift() ?? '') {
      if (parentFolder.contents[part] === undefined)
        if (makeFolders) parentFolder.contents[part] = { type: 'folder', contents: {} }
        else if (softFail) return
        else throw new Error(ERRORS.MISSING_FOLDER)
      const nextEntry = parentFolder.contents[part]
      if (nextEntry.type === 'folder') parentFolder = nextEntry
      else throw new Error(ERRORS.FOLDER_IS_FILE)
    }
    return parentFolder
  }

  /**
   * @param {string} filePath
   * @param {any} data
   * @returns {Promise<void>}
   */
  const saveFile = async (filePath, data) => {
    const index = await getIndex()
    const splitPath = filePath.split('/')

    const fileHash = await quickHash(JSON.stringify(data))
    const findResult = findFileByHash(index, fileHash)

    const parentFolder = getIndexFolder(index, splitPath.splice(0, splitPath.length - 1).join('/'), true)
    if (parentFolder === undefined) throw new Error(ERRORS.MISSING_FOLDER)
    if (parentFolder.type !== 'folder') throw new Error(ERRORS.FOLDER_IS_FILE)

    let oldHash = undefined

    const oldEntry = parentFolder.contents[splitPath[0]]
    if (oldEntry !== undefined) {
      if (oldEntry.type === 'folder') throw new Error(ERRORS.FILE_IS_FOLDER)
      oldHash = oldEntry.hash
    }

    if (findResult === undefined && oldHash !== fileHash) await baseSaveFile(fileHash, data)
    parentFolder.contents[splitPath[0]] = {
      type: 'file',
      hash: fileHash
    }

    if (oldHash !== undefined && oldHash !== fileHash) await baseDeleteFile(oldHash)

    await saveIndex(index)
  }

  /**
   * @param {string} filePath
   * @returns {Promise<any>}
   */
  const getFile = async filePath => {
    const index = await getIndex()
    const splitPath = filePath.split('/')
    const parentFolder = getIndexFolder(index, splitPath.splice(0, splitPath.length - 1).join('/'))
    if (parentFolder === undefined || parentFolder.type !== 'folder') throw new Error(ERRORS.FOLDER_IS_FILE)
    const entry = parentFolder.contents[splitPath[0]]
    if (entry === undefined) throw new Error(ERRORS.MISSING_FILE)
    if (entry.type === 'folder') throw new Error(ERRORS.FILE_IS_FOLDER)
    if (entry.type === 'file') return await baseGetFile(entry.hash)
  }

  /**
   * @param {string} filePath
   * @returns {Promise<void>}
   */
  const deleteFile = async filePath => {
    const index = await getIndex()
    const splitPath = filePath.split('/')
    const parentFolder = getIndexFolder(index, splitPath.splice(0, splitPath.length - 1).join('/'))
    if (parentFolder === undefined || parentFolder.type !== 'folder') throw new Error(ERRORS.FOLDER_IS_FILE)
    const entry = parentFolder.contents[splitPath[0]]
    if (entry === undefined) throw new Error(ERRORS.MISSING_FILE)
    if (entry.type === 'folder') throw new Error(ERRORS.FILE_IS_FOLDER)
    delete parentFolder.contents[splitPath[0]]
    const findResult = findFileByHash(index, entry.hash)
    if (findResult === undefined) await baseDeleteFile(entry.hash)
    for (let subPath = filePath.split('/').slice(0, filePath.split('/').length - 1); subPath.length; subPath.pop()) {
      const subParentFolder = getIndexFolder(index, subPath.join('/'))
      if (subParentFolder === undefined) throw new Error(ERRORS.MISSING_FOLDER)
      if (Object.keys(subParentFolder.contents).length) break
      const subSubParentFolder = getIndexFolder(index, subPath.slice(0, subPath.length - 1).join('/'))
      if (subSubParentFolder === undefined) throw new Error(ERRORS.MISSING_FOLDER)
      delete subSubParentFolder.contents[subPath[subPath.length - 1]]
    }
    await saveIndex(index)
  }

  /**
   * @param {string} filePath
   * @returns {Promise<boolean>}
   */
  const doesFileExist = async filePath => {
    const index = await getIndex()
    const splitPath = filePath.split('/')
    const parentFolder = getIndexFolder(index, splitPath.splice(0, splitPath.length - 1).join('/'))
    if (parentFolder === undefined || parentFolder.type !== 'folder') return false
    const entry = parentFolder.contents[splitPath[0]]
    if (entry === undefined) return false
    return true
  }

  /** @type {{func: function, args: any[], resolve: any}[]} */
  const queue = []

  /**
   * @template T
   * @param {T extends function ? T : never} func
   * @returns {T extends function ? T : never}
   */
  const wrapInQueue =
    func =>
    // @ts-expect-error
    (...args) => {
      let resolve
      const promise = new Promise(subResolve => (resolve = subResolve))
      queue.push({ func, args, resolve })
      if (queue.length === 1) tickQueue()
      return promise
    }

  const tickQueue = async () => {
    const entry = queue[0]
    const result = await entry.func(...entry.args)
    entry.resolve(result)
    queue.shift()
    if (queue.length) tickQueue()
  }

  return {
    getFile: wrapInQueue(getFile),
    saveFile: wrapInQueue(saveFile),
    deleteFile: wrapInQueue(deleteFile),
    getIndex: wrapInQueue(getIndex),
    saveIndex: wrapInQueue(saveIndex),
    doesFileExist: wrapInQueue(doesFileExist),
    joinPaths,
    quickHash
  }
}

/**
 * @param  {...string} args
 * @returns {string}
 */
const joinPaths = (...args) => {
  let result = ''
  for (const arg of args)
    if (result.length) result += `/${arg}`
    else result = arg
  return result
}

/**
 * @param {string} data
 * @returns {Promise<string>}
 */
const quickHash = async data => arrayBufferToBase64(await crypto.subtle.digest('SHA-1', new TextEncoder().encode(data)))

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
