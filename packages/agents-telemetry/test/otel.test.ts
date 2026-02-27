import { describe, it } from 'node:test'
import assert from 'assert'
import { withSpan, otelTrace } from '../src/otel.js'

describe('otel', () => {
  describe('withSpan', () => {
    it('runs function and returns result', async () => {
      const result = await withSpan('test.withSpan', async (span) => {
        span?.setAttribute('test.attribute', 'value')
        return 'ok'
      })

      assert.strictEqual(result, 'ok')
    })

    it('propagates errors from wrapped function', async () => {
      await assert.rejects(
        async () => withSpan('test.withSpan.error', async () => {
          throw new Error('boom')
        }),
        /boom/
      )
    })
  })

  describe('otelTrace', () => {
    it('can inject span into decorated method', async () => {
      let receivedExtraArg = false

      class DecoratedService {
        public async process (value: number, span?: unknown): Promise<number> {
          receivedExtraArg = arguments.length >= 2
          assert.ok(span === undefined || typeof span === 'object')
          return value + 1
        }
      }

      const process = DecoratedService.prototype.process
      const wrapped = otelTrace<DecoratedService, [number]>({
        name: 'test.decorator.process',
        injectSpan: true,
      })(
        process,
        { kind: 'method', name: 'process' } as ClassMethodDecoratorContext<DecoratedService, (value: number) => Promise<number>>
      )

      Object.defineProperty(DecoratedService.prototype, 'process', {
        value: wrapped,
        writable: true,
        configurable: true,
      })

      const service = new DecoratedService()
      const result = await service.process(41)

      assert.strictEqual(result, 42)
      assert.strictEqual(receivedExtraArg, true)
    })

    it('supports direct @otelTrace-style invocation without options', async () => {
      class DefaultNameService {
        public async run (): Promise<string> {
          return 'ok'
        }
      }

      const run = DefaultNameService.prototype.run
      const wrapped = otelTrace<DefaultNameService, [], Promise<string>>(
        run,
        { kind: 'method', name: 'run' } as ClassMethodDecoratorContext<DefaultNameService, () => Promise<string>>
      )

      Object.defineProperty(DefaultNameService.prototype, 'run', {
        value: wrapped,
        writable: true,
        configurable: true,
      })

      const service = new DefaultNameService()
      const result = await service.run()

      assert.strictEqual(result, 'ok')
    })
  })
})
