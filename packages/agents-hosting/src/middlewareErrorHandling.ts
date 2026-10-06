const handledErrorCallbacks = new WeakMap<Function, () => void>()

export function registerHandledMiddlewareError (logic: Function, callback: () => void): void {
  handledErrorCallbacks.set(logic, callback)
}

export function notifyHandledMiddlewareError (logic: Function): void {
  const callback = handledErrorCallbacks.get(logic)
  if (callback) {
    handledErrorCallbacks.delete(logic)
    callback()
  }
}
