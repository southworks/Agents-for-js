import { getActiveSpanSync } from './otel'
import { traceAdapterProcess } from './decorators'

type HeaderPropagation = ((headers: Record<string, string>) => void) | undefined

export class CloudAdapter {
  @traceAdapterProcess
  public async process (
    request: unknown,
    res: unknown,
    logic: (...args: unknown[]) => Promise<unknown>,
    headerPropagation?: HeaderPropagation
  ): Promise<unknown> {
    const span = getActiveSpanSync()
    span?.setAttribute('agents.adapter.hasHeaderPropagation', Boolean(headerPropagation))

    const result = await logic(request, res)

    span?.setAttribute('http.status_code', 200)
    return result
  }
}
