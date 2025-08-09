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
 * @prop {(fileName: string) => Promise<any>} getFile
 * @prop {(fileName: string, data: any) => Promise<void>} saveFile
 * @prop {(fileName: string) => Promise<void>} deleteFile
 * @prop {() => Promise<Index>} getIndex
 * @prop {(index: Index) => Promise<void>} saveIndex
 * @prop {(fileName: string) => Promise<boolean>} doesFileExist
 * @prop {((filePaths: string[], encrypt?: false) => Promise<Json<Exported_files>>) | ((filePaths: string[], encrypt: true) => Promise<Json<Encrypted<Exported_files>>>)} exportFiles
 * @prop {((files: Json<Exported_files>, encrypted?: false) => Promise<string[]>) | ((files: Json<Encrypted<Exported_files>>, encrypted: true) => Promise<string[]>)} importFiles
 * @prop {(...args: string[]) => string} joinPaths
 * @prop {(data: string) => Promise<string>} quickHash
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
