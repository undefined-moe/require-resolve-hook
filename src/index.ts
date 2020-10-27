/**
 * Module to hook into the Node.js require and require.resolve function
 * @author imcuttle
 */
// import * as resolveFrom from 'resolve-from'
import * as ModuleType from 'module'

const Module = require('module')

export type StrictMatch = string | ((id: string) => boolean) | RegExp
export type Match = StrictMatch | StrictMatch[]
export type OnResolve = (id: string, parent: null | ModuleType, isMain: boolean, options: any) => string | false

const isMatch = (match: Match, id: string) => {
  if (Array.isArray(match)) {
    return match.some((mat) => isMatch(mat, id))
  }

  let shouldUseHook = false
  if (typeof match === 'function') {
    shouldUseHook = match(id)
  } else if (typeof match === 'string') {
    shouldUseHook = id === match
  } else if (match instanceof RegExp) {
    shouldUseHook = match.test(id)
  }
  return shouldUseHook
}

const requireResolveHook = (match: Match, onResolve: OnResolve) => {
  const argv = [match, onResolve]
  const hook = () => {
    const argvList = (Module.__require_resolve_hook__ = Module.__require_resolve_hook__ || [])
    argvList.push(argv)
  }
  hook()

  if (!Module.__require_resolve_hook_origin_resolveFilename__) {
    Module.__require_resolve_hook_origin_resolveFilename__ = Module._resolveFilename
    const _resolveFilename = Module._resolveFilename

    Module._resolveFilename = function (request, parent, isMain, options) {
      const argvList = (Module.__require_resolve_hook__ || []).slice()

      while (argvList.length) {
        const [match, onResolve] = argvList.shift()

        if (match) {
          if (isMatch(match, request)) {
            let result = onResolve(request, parent, isMain, options)
            if (result && typeof result === 'string') {
              return result
            }
          }
        }
      }

      return _resolveFilename.call(this, request, parent, isMain, options)
    }
  }

  const unhook = () => {
    const argvList = Module.__require_resolve_hook__ || []
    const index = argvList.indexOf(argv)
    if (index >= 0) {
      argvList.splice(index, 1)
    }

    if (!argvList.length) {
      Module._resolveFilename = Module.__require_resolve_hook_origin_resolveFilename__ || Module._resolveFilename
      delete Module.__require_resolve_hook_origin_resolveFilename__
      delete Module.__require_resolve_hook__
    }
  }

  return {
    bypass: (fn: () => any): ReturnType<typeof fn> => {
      unhook()
      const result = fn()
      hook()
      return result
    },
    unhook: () => unhook()
  }
}

export const bypass = (fn: () => any): ReturnType<typeof fn> => {
  const _resolveFilename = Module._resolveFilename
  Module._resolveFilename = Module.__require_resolve_hook_origin_resolveFilename__ || Module._resolveFilename
  const result = fn()
  Module._resolveFilename = _resolveFilename
  return result
}

export default requireResolveHook
