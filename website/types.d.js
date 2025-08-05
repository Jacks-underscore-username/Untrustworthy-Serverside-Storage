/**
 * Virtual File System
 * @typedef {Object} VFS
 * @prop {(fileName: string) => Promise<any>} getFile
 * @prop {(fileName: string, data: any) => Promise<void>} saveFile
 * @prop {(fileName: string) => Promise<void>} deleteFile
 * @prop {() => Promise<Index>} getIndex
 * @prop {(index: Index) => Promise<void>} saveIndex
 * @prop {(fileName: string) => Promise<boolean>} doesFileExist
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
