// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { attempt } from './attempt'

type AttemptValue<TResult> =
  TResult extends Promise<infer U> ? U : TResult

export type TMethodShape = (...args: any[]) => any
export type TScopeShape = Record<string, any>

type This<TScope extends TScopeShape> = object & {
//   __store: WeakMap<Symbol, TScope>
//   __methodScope?: TScope
  share?(scope: TScope): any
}

export interface DecoratorContext<TMethod extends TMethodShape, TScope extends TScopeShape> {
  class: ClassDecoratorContext['name'],
  name: ClassMethodDecoratorContext['name'],
  args: Parameters<TMethod>
  scope: TScope
  result: AttemptValue<ReturnType<TMethod>>
  call(): ReturnType<TMethod>
}

export function createDecorator<TMethod extends TMethodShape, TScope extends TScopeShape> (fn: (decorator: DecoratorContext<TMethod, TScope>) => ReturnType<TMethod>) {
  function decorator (originalMethod: TMethod, context: ClassMethodDecoratorContext) {
    // this.__store = new WeakMap<Symbol, TScope>()
    if (context.kind !== 'method') {
      throw new Error('This decorator can only be applied to methods')
    }
    return function decoratorWrapperMethod (this: This<TScope>, ...args: Parameters<TMethod>) {
    //   const scope = {} as TScope
    //   const key = Symbol(`${this.constructor.name}.${context.name.toString()}`)
    //   this.__store.set(key, scope)
      // TODO: see if we can alter the this in decoratorWrapperMethod, maybe we can share data through that.
      //   console.log('Creating context for', this.constructor.name, this)
      //   store.set(this, {} as TScope)

      const thisContext = this
      thisContext.share = function share (scope: TScope) {
        // console.log('Sharing scope', this.constructor.name, context.name, scope)
        value.scope = Object.assign(value.scope, scope)
        return value
      }

      const value: DecoratorContext<TMethod, TScope> = {
        class: this.constructor.name,
        name: context.name,
        args,
        scope: {} as TScope,
        result: undefined as any,
        call: () => attempt({
          try: () => originalMethod.apply(thisContext, args),
          then: (result) => {
            // value.scope = this.__methodScope!
            value.result = result
          }
        })
      }

      return attempt({
        try: () => fn(value),
        finally: () => {
        //   console.log('Clearing context for', this.constructor.name, context.name)
        //   this.__methodScope = undefined
        }
      })
    }
  }

  decorator.share = function share (_this: This<TScope>, scope: TScope) {
    // console.log('Sharing scope', _this.constructor.name, this)
    // const store = this.__store.get(this)
    // if (!this.__decoratorContext) {
    //   throw new Error('No active context scope found. Ensure that "share" is called within a decorated method.')
    // }
    if (!_this.share) {
      throw new Error('No active context scope found. Ensure that "share" is called within a decorated method.')
    }

    return _this.share(scope)
    // Object.assign(_this.__methodScope, scope)
  }

  decorator.process = function process (fn: TMethod) {
    return decorator(fn, { kind: 'method', name: this.name } as ClassMethodDecoratorContext).apply(fn)
  }

  return decorator
}

const decorated = createDecorator(context => {
  context.call()
  return attempt({
    try: () => context.call(),
    then: () => {
      console.log('In decorator', context.class, context.name, context.args, context.scope, context.result)
    }
  })
})

function deferred<T> () {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void

  // eslint-disable-next-line promise/param-names
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })

  return { promise, resolve, reject }
}

const gateA = deferred<void>()
const gateB = deferred<void>()

class A {
  @decorated
  async methodA (value: string) {
    await gateA.promise
    return decorated.share(this, { from: 'methodA', value })
  }

  @decorated
  async methodB (value: string) {
    await gateB.promise
    return decorated.share(this, { from: 'methodB', value })
  }
}

(async () => {
  const a = new A()

  // 1. start methodA on instance a
  const promiseA = a.methodA('testA')

  // 2. start methodB on the same instance a
  const promiseB = a.methodB('testB')

  // At this point:
  // - methodA wrapper already installed shareA, then paused on gateA
  // - methodB wrapper already installed shareB, then paused on gateB
  // So a.share now points to shareB

  // 3. let methodB install its this.share after methodA
  // already done just by starting methodB second

  // 4. resume methodA and call decorated.share(this, ...)
  gateA.resolve()
  const updatedByA = await promiseA

  // Capture A's observed result before B resumes and mutates the same object again
  const snapshotAfterA = {
    name: updatedByA.name,
    scope: { ...updatedByA.scope }
  }

  console.log('After A resumes')
  console.log('updatedByA.name', snapshotAfterA.name)
  console.log('updatedByA.scope', snapshotAfterA.scope)

  // 5. now resume methodB
  gateB.resolve()
  const updatedByB = await promiseB

  console.log('After B resumes')
  console.log('updatedByB.name', updatedByB.name)
  console.log('updatedByB.scope', updatedByB.scope)

  // 6. inspect which value object got updated
  console.log('updatedByA === updatedByB', updatedByA === updatedByB)
  console.log('A returned methodB context', snapshotAfterA.name === 'methodB')
})()

// const a = new A()

// for (let index = 0; index < 10; index++) {
//   const a1 = a.methodA('testA')
//   const b1 = a.methodB('testB')
//   const b2 = a.methodB('testB')
//   const b3 = a.methodB('testB')

//   Promise.all([a1, b1, b2, b3]).then(([a, b1, b2, b3]) => {
//     console.log('Results', a.name, b1.name, b2.name, b3.name)
//     console.log('Results scope', a.scope, b1.scope, b2.scope, b3.scope)
//     console.log('b1 === a', b1 === a)
//     console.log('b1 === b2', b1 === b2)
//     console.log('b1 === b3', b1 === b3)
//     console.log('b2 === a', b2 === a)
//     console.log('b2 === b3', b2 === b3)
//     console.log('b3 === a', b3 === a)
//   })
// }
