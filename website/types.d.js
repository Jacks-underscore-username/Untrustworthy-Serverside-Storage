/**
 * @template T
 * @typedef {string & {_: T}} Json<T>
 */

/**
 * @template T
 * @typedef {Object} Encrypted<T>
 * @prop {string} seed
 * @prop {string} salt
 * @prop {string} iv
 * @prop {string} data
 */

/**
 * Virtual File System
 * @typedef {Object} VFS
 * @prop {() => Promise<Index>} getIndex
 * @prop {(index: Index) => Promise<void>} saveIndex
 * @prop {(fileName: string, skipCache?: boolean) => Promise<any>} getFile
 * @prop {(fileName: string, data: any, cache?: boolean) => Promise<void>} saveFile
 * @prop {(fileName: string) => Promise<void>} deleteFile
 * @prop {(fileName: string) => Promise<boolean>} doesFileExist
 * @prop {(filePaths: string[]) => Promise<Json<Exported_files>>} exportFiles
 * @prop {(files: Json<Exported_files>) => Promise<string[]>} importFiles
 * @prop {(filePaths: string[]) => Promise<Json<Encrypted<Exported_files>>>} exportEncryptedFiles
 * @prop {(files: Json<Encrypted<Exported_files>>) => Promise<string[]>} importEncryptedFiles
 * @prop {(...args: string[]) => string} joinPaths
 * @prop {(data: string) => Promise<string>} quickHash
 */

/**
 * @template {(...args: any) => any} T
 * @typedef {(...args: Parameters<T>) => ({ earlyReturn: false, next: () => ReturnType<T> } | { earlyReturn: true, value: ReturnType<T> })} EarlyReturnFunc<T>
 */

/**
 * The VFS structure
 * @typedef {Object} Index_file
 * @prop {'file'} type
 * @prop {string} hash
 * @typedef {Object} Index
 * @prop {'folder'} type
 * @prop {{[key: string]: (Index_file | Index)}} contents
 */

/**
 * @typedef {Object} Exported_files
 * @prop {Object<string, string>} pathToHashMap
 * @prop {Object<string, string>} hashToFileMap
 */
