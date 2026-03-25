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
