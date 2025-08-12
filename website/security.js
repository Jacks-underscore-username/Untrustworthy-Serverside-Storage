/**
 * @import * as Types from "./types.d.js"
 */

const ERRORS = {
  MISSING_FILE: 'Missing file "$P"',
  MISSING_FOLDER: 'Missing folder "$P"',
  FOLDER_IS_FILE: 'File exists where a folder should at "$P"',
  FILE_IS_FOLDER: 'Folder exists where a file should at "$P"'
}

/**
 * 0 - none
 * 1 - real file changes
 * 2 - vfs operations
 * 3 - all messaging
 * 4 - encrypted data + everything else
 */
const LOGGING_LEVEL = 0

/** Assumes no files will change on the server unless told to by this client */
const ASSUME_SINGLE_CLIENT = false

/**
 * @param {string} error
 * @param  {...string} parts
 * @returns {string}
 */
const fillError = (error, ...parts) =>
  error.split('$P').reduce((prev, part, index) => (index ? `${prev}${parts.shift()}${part}` : part), '')

/**
 * @returns {Promise<CryptoKeyPair>}
 */
const makeKeyPair = () => crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])

/**
 * @param {URL} address
 * @param {string} username
 * @param {string} password
 * @param {string} [service]
 * @returns {Promise<Types.VFS>}
 */
export const connectToServer = async (address, username, password, service = '') => {
  if (address.origin === 'null') address = new URL(`http://${address.toString()}`)
  if (LOGGING_LEVEL >= 1) console.log(`Connecting to server at ${address.toString()}`)

  const keyPair = await makeKeyPair()
  if (LOGGING_LEVEL >= 1) console.log('Generated keypair')
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
  if (LOGGING_LEVEL >= 1) console.log('Received raw server public key')

  const serverPublicKey = await crypto.subtle.importKey(
    'jwk',
    serverPublicKeyJwk,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  )
  if (LOGGING_LEVEL >= 1) console.log('Imported server public key')

  const secret = await crypto.subtle.deriveBits({ name: 'ECDH', public: serverPublicKey }, keyPair.privateKey, 256)
  if (LOGGING_LEVEL >= 1) console.log('Derived shared secret')

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
  if (LOGGING_LEVEL >= 1) console.log('Derived shared key seeds')

  const sharedKeys = {
    encode: await importKey(derivedKeyBytes.slice(0, 32), ['encrypt']),
    decode: await importKey(derivedKeyBytes.slice(32, 64), ['decrypt'])
  }
  if (LOGGING_LEVEL >= 1) console.log('Derived shared keypair')

  /**
   * @param {any} message
   * @returns {Promise<any>}
   */
  const messageServer = async message => {
    if (LOGGING_LEVEL >= 4) console.log(`Messaging server: ${JSON.stringify(message)}`)
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
    if (LOGGING_LEVEL >= 4) console.log(`Got message back from server: ${JSON.stringify(decrypted)}`)
    return decrypted
  }
  /** @type {string} */
  const seed = await messageServer({ command: 'get_seed', username })
  if (LOGGING_LEVEL >= 1) console.log(`Got seed from server: ${seed}`)

  const token = [seed, service, username, password].join('')
  if (LOGGING_LEVEL >= 1) console.log(`Generated secret token from server seed: ${token}`)

  await messageServer({
    command: 'prove_seed',
    hashedSeed: arrayBufferToBase64(
      new Uint8Array(
        await crypto.subtle.digest('SHA-512', new TextEncoder().encode([seed, service, password, username].join('')))
      )
    )
  })
  if (LOGGING_LEVEL >= 1) console.log('Authenticated with server')

  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(
      arrayBufferToBase64(new Uint8Array(await crypto.subtle.digest('SHA-512', new TextEncoder().encode(token))))
    ),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  )
  if (LOGGING_LEVEL >= 1) console.log('Derived secret key material')

  /**
   * @template T
   * @param {T} data
   * @returns {Promise<Types.Json<Types.Encrypted<T>>>}
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
    const result =
      /** @type {Types.Json<Types.Encrypted<T>>} */
      (
        JSON.stringify({
          seed,
          iv: arrayBufferToBase64(iv),
          salt: arrayBufferToBase64(salt),
          encryptedData: arrayBufferToBase64(encryptedData)
        })
      )
    if (LOGGING_LEVEL >= 4) console.log(`Encrypted data: ${JSON.stringify(data)} -> ${result}`)
    return result
  }

  /**
   * @template T
   * @param {Types.Json<Types.Encrypted<T>>} encryptedData
   * @returns {Promise<T>}
   */
  const decryptData = async encryptedData => {
    const parsed = JSON.parse(encryptedData)
    const localKeyMaterial =
      parsed.seed === undefined
        ? keyMaterial
        : await window.crypto.subtle.importKey(
            'raw',
            new TextEncoder().encode(
              arrayBufferToBase64(
                new Uint8Array(
                  await crypto.subtle.digest(
                    'SHA-512',
                    new TextEncoder().encode([parsed.seed, service, username, password].join(''))
                  )
                )
              )
            ),
            'PBKDF2',
            false,
            ['deriveBits', 'deriveKey']
          )
    const { iv, salt, encryptedData: realEncryptedData } = parsed
    const key = await window.crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: base64ToArrayBuffer(salt),
        iterations: 100000,
        hash: 'SHA-256'
      },
      localKeyMaterial,
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
    if (LOGGING_LEVEL >= 4) console.log(`Decrypted data: ${encryptedData} -> ${JSON.stringify(data)}`)
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
    const hashedPath = await hashFilePath(filePath)
    if (LOGGING_LEVEL >= 1) console.log(`Getting file from server: ${filePath} -> ${hashedPath}`)
    const response = await messageServer({
      command: 'get_file',
      file_name: hashedPath
    })
    if (response.status === 'success') return JSON.parse(await decryptData(response.file))
    throw new Error(fillError(ERRORS.MISSING_FILE, filePath))
  }

  /**
   * @param {string} filePath
   * @param {any} data
   * @returns {Promise<void>}
   */
  const baseSaveFile = async (filePath, data) => {
    const hashedPath = await hashFilePath(filePath)
    if (LOGGING_LEVEL >= 1) console.log(`Saving file to server: ${filePath} -> ${hashedPath}`)
    await messageServer({
      command: 'save_file',
      file_name: hashedPath,
      data: await encryptData(JSON.stringify(data))
    })
  }

  /**
   * @param {string} filePath
   * @returns {Promise<void>}
   */
  const baseDeleteFile = async filePath => {
    const hashedPath = await hashFilePath(filePath)
    if (LOGGING_LEVEL >= 1) console.log(`Deleting file: ${filePath} -> ${hashedPath}`)
    await messageServer({
      command: 'delete_file',
      file_name: hashedPath
    })
  }

  /** @type {string} */
  let lastIndexHash = ''

  /** @type {Types.Index | undefined} */
  let lastIndex = undefined

  /** @type {Types.EarlyReturnFunc<Types.VFS["getIndex"]>} */
  const getIndex = () => ({
    earlyReturn: false,
    next: async () => {
      if (ASSUME_SINGLE_CLIENT && lastIndex !== undefined) {
        if (LOGGING_LEVEL >= 3) console.log('Got cached VFS index')
        return lastIndex
      }
      if (LOGGING_LEVEL >= 3) console.log('Getting VFS index')
      /** @type {Types.Index} */
      let index = {
        type: 'folder',
        contents: {}
      }
      try {
        index = await baseGetFile('index.json')
      } catch (err) {
        await normalizeEarlyReturnFunc(saveIndex(index))
      }
      return index
    }
  })

  /** @type {Types.EarlyReturnFunc<Types.VFS["saveIndex"]>} */
  const saveIndex = index => ({
    earlyReturn: false,
    next: async () => {
      if (ASSUME_SINGLE_CLIENT) lastIndex = index
      const hash = await quickHash(JSON.stringify(index))
      if (hash === lastIndexHash) {
        if (LOGGING_LEVEL >= 4) console.log('Skipped saving VFS index')
        return
      }
      lastIndexHash = await quickHash(JSON.stringify(index))
      if (LOGGING_LEVEL >= 3) console.log('Saving VFS index')
      await baseSaveFile('index.json', index)
    }
  })

  /**
   * @param {Types.Index} index
   * @param {string} fileHash
   * @param {string} [folderPath]
   * @param {string[]} [excludePaths]
   * @returns {{ folder: Types.Index, file: Types.Index_file, filePath: string } | undefined}
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
   * @param {Types.Index} index
   * @param {string} folderPath
   * @param {boolean} [makeFolders]
   * @param {boolean} [softFail]
   * @returns {Types.Index | undefined}
   */
  const getIndexFolder = (index, folderPath, makeFolders = false, softFail = false) => {
    if (!folderPath.length) return index
    const splitPath = folderPath.split('/')
    let parentFolder = index
    for (let part = splitPath.shift() ?? ''; part.length; part = splitPath.shift() ?? '') {
      if (parentFolder.contents[part] === undefined)
        if (makeFolders) parentFolder.contents[part] = { type: 'folder', contents: {} }
        else if (softFail) return
        else throw new Error(fillError(ERRORS.MISSING_FOLDER, folderPath))
      const nextEntry = parentFolder.contents[part]
      if (nextEntry.type === 'folder') parentFolder = nextEntry
      else throw new Error(fillError(ERRORS.FOLDER_IS_FILE, folderPath))
    }
    return parentFolder
  }

  /**
   * @template {(...args: any) => any} T
   * @typedef {{ func: T, args: Parameters<T>, resolveFuncs: ((value: ReturnType<T>) => void)[], funcName: string }} Queue_entry
   * @type {Queue_entry<(...args: any) => any>[]}
   */
  const queue = []
  let isQueueRunning = false

  /**
   * @template {(...args: any) => Promise<any>} T
   * @param {Types.EarlyReturnFunc<T>} func
   * @returns {(...args:Parameters<T>) => Promise<Awaited<ReturnType<T>>>}
   */
  const wrapInQueue =
    func =>
    (...args) => {
      const earlyResult = func(...args)
      if (earlyResult.earlyReturn) return earlyResult.value
      const promise = new Promise(resolveFunc => {
        const entry = { func: earlyResult.next, args, resolveFuncs: [resolveFunc], funcName: func.name }
        const addToQueue = optimizeQueue(entry)
        if (addToQueue) {
          queue.push(entry)
          if (!isQueueRunning) tickQueue()
        }
      })
      return promise
    }

  /** @type {Object<string, string>} */
  const cachedFiles = {}

  const updatingCachedFiles = new Set()

  /**
   * @template {(...args: any) => any} T
   * @param {ReturnType<Types.EarlyReturnFunc<T>>} funcReturn
   * @returns {ReturnType<T>}
   */
  const normalizeEarlyReturnFunc = funcReturn => {
    if (funcReturn.earlyReturn) return funcReturn.value
    return funcReturn.next()
  }

  /** @type {Types.EarlyReturnFunc<Types.VFS["saveFile"]>} */
  const saveFile = (filePath, data, cache = false) => ({
    earlyReturn: false,
    next: async () => {
      if (cache) {
        cachedFiles[filePath] = data
        updatingCachedFiles.delete(filePath)
      }

      const index = await normalizeEarlyReturnFunc(getIndex())
      const splitPath = filePath.split('/')

      const fileHash = await quickHash(JSON.stringify(data))
      const findResult = findFileByHash(index, fileHash)

      const parentFolderPath = splitPath.splice(0, splitPath.length - 1).join('/')

      const parentFolder = getIndexFolder(index, parentFolderPath, true)
      if (parentFolder === undefined) throw new Error(fillError(ERRORS.MISSING_FOLDER, parentFolderPath))
      if (parentFolder.type !== 'folder') throw new Error(fillError(ERRORS.FOLDER_IS_FILE, parentFolderPath))

      let oldHash = undefined

      const oldEntry = parentFolder.contents[splitPath[0]]
      if (oldEntry !== undefined) {
        if (oldEntry.type === 'folder')
          throw new Error(fillError(ERRORS.FILE_IS_FOLDER, joinPaths(parentFolderPath, splitPath[0])))
        oldHash = oldEntry.hash
      }

      if (findResult === undefined && oldHash !== fileHash) {
        if (LOGGING_LEVEL >= 1) console.log(`Saving file to server: ${fileHash}`)
        await baseSaveFile(fileHash, data)
      }
      parentFolder.contents[splitPath[0]] = {
        type: 'file',
        hash: fileHash
      }
      if (LOGGING_LEVEL >= 2) console.log(`Saved file to VFS: ${filePath}`)

      await normalizeEarlyReturnFunc(saveIndex(index))

      if (oldHash !== undefined && oldHash !== fileHash) {
        if (LOGGING_LEVEL >= 1) console.log(`Deleting old version of file: ${filePath} ${oldHash}`)
        await baseDeleteFile(oldHash)
      }
    }
  })

  /** @type {Types.EarlyReturnFunc<Types.VFS["getFile"]>} */
  const getFile = (filePath, skipCache = false) => {
    if (LOGGING_LEVEL >= 1) console.log(`Getting file with VFS: ${filePath}`)

    if (!skipCache && cachedFiles[filePath] !== undefined) {
      updatingCachedFiles.add(filePath)
      wrappedGetFile(filePath, true).then(result => {
        if (updatingCachedFiles.has(filePath)) cachedFiles[filePath] = result
        updatingCachedFiles.delete(filePath)
      })
      return { earlyReturn: true, value: Promise.resolve(cachedFiles[filePath]) }
    }
    return {
      earlyReturn: false,
      next: async () => {
        const index = await normalizeEarlyReturnFunc(getIndex())
        const splitPath = filePath.split('/')
        const parentFolderPath = splitPath.splice(0, splitPath.length - 1).join('/')
        const parentFolder = getIndexFolder(index, parentFolderPath)
        if (parentFolder === undefined) throw new Error(fillError(ERRORS.MISSING_FOLDER, parentFolderPath))
        if (parentFolder.type !== 'folder') throw new Error(fillError(ERRORS.FOLDER_IS_FILE, parentFolderPath))
        const entry = parentFolder.contents[splitPath[0]]
        if (entry === undefined) throw new Error(fillError(ERRORS.MISSING_FILE, filePath))
        if (entry.type === 'folder') throw new Error(fillError(ERRORS.FILE_IS_FOLDER, filePath))
        if (entry.type === 'file') return await baseGetFile(entry.hash)
      }
    }
  }

  const wrappedGetFile = wrapInQueue(getFile)

  /** @type {Types.EarlyReturnFunc<Types.VFS["deleteFile"]>} */
  const deleteFile = filePath => ({
    earlyReturn: false,
    next: async () => {
      const index = await normalizeEarlyReturnFunc(getIndex())
      const splitPath = filePath.split('/')
      const parentFolderPath = splitPath.splice(0, splitPath.length - 1).join('/')
      const parentFolder = getIndexFolder(index, parentFolderPath)
      if (parentFolder === undefined) throw new Error(fillError(ERRORS.MISSING_FOLDER, parentFolderPath))
      if (parentFolder.type !== 'folder') throw new Error(fillError(ERRORS.FOLDER_IS_FILE, parentFolderPath))
      const entry = parentFolder.contents[splitPath[0]]
      if (entry === undefined) throw new Error(fillError(ERRORS.MISSING_FILE, filePath))
      if (entry.type === 'folder') throw new Error(fillError(ERRORS.FILE_IS_FOLDER, filePath))
      delete parentFolder.contents[splitPath[0]]
      const findResult = findFileByHash(index, entry.hash)
      if (findResult === undefined) {
        if (LOGGING_LEVEL >= 1) console.log(`Deleting file from server: ${entry.hash}`)
        await baseDeleteFile(entry.hash)
      }
      for (let subPath = filePath.split('/').slice(0, filePath.split('/').length - 1); subPath.length; subPath.pop()) {
        const subParentFolder = getIndexFolder(index, subPath.join('/'))
        if (subParentFolder === undefined) throw new Error(fillError(ERRORS.MISSING_FOLDER, subPath.join('/')))
        if (Object.keys(subParentFolder.contents).length) break
        const subSubParentFolder = getIndexFolder(index, subPath.slice(0, subPath.length - 1).join('/'))
        if (subSubParentFolder === undefined)
          throw new Error(fillError(ERRORS.MISSING_FOLDER, subPath.slice(0, subPath.length - 1).join('/')))
        if (LOGGING_LEVEL >= 2) console.log(`Deleting empty folder from VFS: ${subPath.join('/')}`)
        delete subSubParentFolder.contents[subPath[subPath.length - 1]]
      }
      await normalizeEarlyReturnFunc(saveIndex(index))
    }
  })

  /** @type {Types.EarlyReturnFunc<Types.VFS["doesFileExist"]>} */
  const doesFileExist = filePath => ({
    earlyReturn: false,
    next: async () => {
      const index = await normalizeEarlyReturnFunc(getIndex())
      const splitPath = filePath.split('/')
      const parentFolder = getIndexFolder(index, splitPath.splice(0, splitPath.length - 1).join('/'), undefined, true)
      let result = undefined
      if (parentFolder === undefined || parentFolder.type !== 'folder') result = false
      if (result === undefined && parentFolder !== undefined) {
        const entry = parentFolder.contents[splitPath[0]]
        if (entry === undefined) return false
        result = true
      }
      if (result === undefined) throw new Error('Uh oh')
      if (LOGGING_LEVEL >= 2)
        console.log(`Checked for file at ${filePath} (it ${result ? 'exists' : 'does not exists'})`)
      return result
    }
  })

  /** @type {Types.EarlyReturnFunc<Types.VFS["exportFiles"]>} */
  const exportFiles = (filePaths, extraFiles = {}) => ({
    earlyReturn: false,
    next: async () => {
      /** @type {Object<string, string>} */
      const pathToHashMap = {}
      /** @type {Object<string, string>} */
      const hashToFileMap = {}
      for (const path of filePaths) {
        const file = await normalizeEarlyReturnFunc(getFile(path))
        const hash = await quickHash(file)
        pathToHashMap[path] = hash
        hashToFileMap[hash] = file
      }
      for (const [path, file] of Object.entries(extraFiles)) {
        const hash = await quickHash(file)
        pathToHashMap[path] = hash
        hashToFileMap[hash] = file
      }
      /** @type {Types.Exported_files} */
      const result = {
        pathToHashMap,
        hashToFileMap
      }
      return /** @type {Types.Json<Types.Exported_files>} */ (JSON.stringify(result))
    }
  })

  /** @type {Types.EarlyReturnFunc<Types.VFS["exportEncryptedFiles"]>} */
  const exportEncryptedFiles = (filePaths, extraFiles = {}) => ({
    earlyReturn: false,
    next: async () => {
      /** @type {Object<string, string>} */
      const pathToHashMap = {}
      /** @type {Object<string, string>} */
      const hashToFileMap = {}
      for (const path of filePaths) {
        const file = await normalizeEarlyReturnFunc(getFile(path))
        const hash = await quickHash(file)
        pathToHashMap[path] = hash
        hashToFileMap[hash] = file
      }
      for (const [path, file] of Object.entries(extraFiles)) {
        const hash = await quickHash(file)
        pathToHashMap[path] = hash
        hashToFileMap[hash] = file
      }
      /** @type {Types.Exported_files} */
      const result = {
        pathToHashMap,
        hashToFileMap
      }
      return encryptData(result)
    }
  })

  /** @type {Types.EarlyReturnFunc<Types.VFS["importFiles"]>} */
  const importFiles = files => ({
    earlyReturn: false,
    next: async () => {
      /** @type {Types.Exported_files} */
      const exported = JSON.parse(files)
      for (const [filePath, hash] of Object.entries(exported.pathToHashMap))
        await normalizeEarlyReturnFunc(saveFile(filePath, exported.hashToFileMap[hash]))
      return Object.keys(exported.pathToHashMap)
    }
  })

  /** @type {Types.EarlyReturnFunc<Types.VFS["importEncryptedFiles"]>} */
  const importEncryptedFiles = files => ({
    earlyReturn: false,
    next: async () => {
      /** @type {Types.Exported_files} */
      const exported = await decryptData(files)
      for (const [filePath, hash] of Object.entries(exported.pathToHashMap))
        await normalizeEarlyReturnFunc(saveFile(filePath, exported.hashToFileMap[hash]))
      return Object.keys(exported.pathToHashMap)
    }
  })

  /**
   * @param {Queue_entry<(...args: any) => any>} newEntry
   * @returns {boolean}
   */
  const optimizeQueue = newEntry => {
    if (newEntry.funcName === 'saveFile')
      for (const entry of queue) {
        if (entry.funcName === 'saveFile' && entry.args[0] === newEntry.args[0]) {
          for (const func of entry.resolveFuncs) func(undefined)
          queue.splice(queue.indexOf(entry), 1)
          return true
        }
      }
    if (newEntry.funcName === 'getFile')
      for (const entry of queue.toReversed()) {
        if (entry.funcName === 'saveFile' && entry.args[0] === newEntry.args[0]) {
          for (const func of entry.resolveFuncs) func(newEntry.args[1])
          queue.splice(queue.indexOf(newEntry), 1)
          return true
        }
        if (entry.funcName === 'deleteFile' && entry.args[0] === newEntry.args[0])
          throw new Error('Queue entry will try to read a file that does not exist')
        if (entry.funcName === 'getFile' && entry.args[0] === newEntry.args[0]) {
          entry.resolveFuncs.push(...newEntry.resolveFuncs)
          return false
        }
      }
    if (newEntry.funcName === 'deleteFile')
      for (const entry of queue) {
        if (entry.funcName === 'saveFile' && entry.args[0] === newEntry.args[0]) {
          for (const func of entry.resolveFuncs) func(undefined)
          queue.splice(queue.indexOf(entry), 1)
          return true
        }
      }
    if (newEntry.funcName === 'doesFileExist')
      for (const entry of queue.toReversed()) {
        if (entry.funcName === 'saveFile' && entry.args[0] === newEntry.args[0]) {
          for (const func of entry.resolveFuncs) func(true)
          queue.splice(queue.indexOf(newEntry), 1)
          return true
        }
        if (entry.funcName === 'deleteFile' && entry.args[0] === newEntry.args[0]) {
          for (const func of entry.resolveFuncs) func(false)
          queue.splice(queue.indexOf(newEntry), 1)
          return true
        }
      }
    return true
  }

  const tickQueue = async () => {
    isQueueRunning = true
    const entry = queue.shift()
    if (entry === undefined) throw new Error('Uh oh')
    const result = await entry.func(...entry.args)
    for (const func of entry.resolveFuncs) func(result)
    if (queue.length) tickQueue()
    else isQueueRunning = false
  }

  return {
    getFile: wrapInQueue(getFile),
    saveFile: wrapInQueue(saveFile),
    deleteFile: wrapInQueue(deleteFile),
    getIndex: wrapInQueue(getIndex),
    saveIndex: wrapInQueue(saveIndex),
    doesFileExist: wrapInQueue(doesFileExist),
    exportFiles: wrapInQueue(exportFiles),
    exportEncryptedFiles: wrapInQueue(exportEncryptedFiles),
    importFiles: wrapInQueue(importFiles),
    importEncryptedFiles: wrapInQueue(importEncryptedFiles),
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
