const crypto = require('node:crypto')

/** @type {CryptoKeyPair | undefined} */
let keyPair = undefined
export const getKeyPair = async () => {
  if (keyPair === undefined)
    keyPair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])
  return keyPair
}

/**
 * @param {CryptoKey} publicKey
 * @returns {Promise<{encode: CryptoKey, decode: CryptoKey}>}
 */
export const computeSharedKeys = async publicKey => {
  const secret = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: publicKey },
    (await getKeyPair()).privateKey,
    256
  )

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

  return {
    decode: await importKey(derivedKeyBytes.slice(0, 32), ['decrypt']),
    encode: await importKey(derivedKeyBytes.slice(32, 64), ['encrypt'])
  }
}

/**
 * @param {Uint8Array} keyBytes
 * @param {KeyUsage[]} usages
 * @returns {Promise<CryptoKey>}
 */
const importKey = (keyBytes, usages) => crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, true, usages)
