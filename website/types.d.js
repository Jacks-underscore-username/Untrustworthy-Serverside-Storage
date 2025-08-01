/**
 * Virtual File System
 * @typedef {Object} VFS
 * @prop {(fileName: string) => Promise<any>} getFile
 * @prop {(fileName: string, data: any) => Promise<void>} saveFile
 * @prop {(fileName: string) => Promise<void>} deleteFile
 * @prop {() => Promise<Index>} getIndex
 * @prop {(fileName: string) => Promise<boolean>} doesFileExist
 * @prop {(...args: string[]) => string} joinPaths
 */

/**
 * For markup element styling
 * @typedef {Object} CssStyleObj
 * @prop {boolean} [code]
 * @prop {string} [color]
 * @prop {boolean} [italic]
 * @prop {string} [align]
 * @prop {boolean} [bold]
 * @prop {string} [size]
 * @prop {boolean} [showMarkup]
 * @prop {boolean} [strike]
 * @prop {boolean} [underline]
 */

/**
 * For dynamic highlighting in the monaco editor
 * @typedef {Object} MonacoHighlight
 * @prop {number} start
 * @prop {number} length
 * @prop {number} line
 * @prop {MonacoHighlightType} type
 */

/**
 * For dynamic highlighting in the monaco editor
 * @typedef {Object} MonacoHighlightType
 * @prop {boolean} italic
 * @prop {boolean} bold
 * @prop {boolean} underline
 * @prop {string} color
 */

/**
 * The api passed to each page in the SPA
 * @typedef {Object} PageApi
 * @prop {(name: string) => void} goto
 * @prop {import('./security.js')} rawUss
 * @prop {VFS} vfs
 * @prop {(vfs: VFS) => void} setVfs
 * @prop {Page[]} allPages
 * @prop {import('./shared.js')} shared
 * @prop {import('./markup.js')['default']} markup
 * @prop {Node_type<any>[]} nodeTypes
 * @prop {Object<string, boolean>} TEST_FLAGS
 */

/**
 * What each page of the SPA exports
 * @typedef {Object} Page
 * @prop {string} name
 * @prop {(api: PageApi) => void} load
 * @prop {() => void} [stop]
 * @prop {string} [icon]
 */

/**
 * A file node in the VFS index
 * @typedef {Object} Index_file
 * @prop {'file'} type
 * @prop {string} hash
 * @typedef {Object} Index
 * @prop {'folder'} type
 * @prop {{[key: string]: (Index_file | Index)}} contents
 */

/**
 * @template T
 * @typedef {Object} Graph_node<T>
 * @prop {number} id
 * @prop {string} type
 * @prop {T} data
 * @prop {number[]} connections
 * @prop {number} x
 * @prop {number} y
 * @prop {boolean} selected
 * @prop {{x: number, y: number}} [movement]
 */

/**
 * @typedef {Object} Graph_index
 * @prop {Graph_node<any>[]} nodes
 * @prop {number} nextNodeId
 * @prop {number[]} unusedNodeIds
 */

/**
 * @typedef {Object} Node_physics
 * @prop {number} pullForce
 * @prop {number} pushForce
 * @prop {number} targetDistance
 * @prop {number} minDistance
 */

/**
 * @template T
 * @typedef {Object} Node_type<T>
 * @prop {string} name
 * @prop {(ctx: CanvasRenderingContext2D, node: Graph_node<T>) => void} renderPreview
 * @prop {(ctx: CanvasRenderingContext2D, node: Graph_node<T>) => Node_physics} getPhysics
 * @prop {(node: Graph_node<T>) => void} render
 * @prop {(ctx: CanvasRenderingContext2D, node: Graph_node<T>, x: number, y: number) => boolean} containsPoint
 */

/**
 * @typedef {Object} Node_data_plaintext
 * @prop {string} name
 * @prop {string[]} text
 * @prop {string} textColor
 * @prop {string} color
 * @prop {string} selectedColor
 * @prop {string} borderColor
 */

/**
 * @typedef {Object} Node_data_topic
 * @prop {string} name
 * @prop {string} textColor
 * @prop {string} color
 * @prop {string} selectedColor
 * @prop {string} borderColor
 */
