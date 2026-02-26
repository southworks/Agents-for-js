const LIBRARY_NAME = 'Agents SDK'

let otelApi: typeof import('@opentelemetry/api') | undefined
const resolveAttempted = false

// async function loadOtelApi (): Promise<typeof import('@opentelemetry/api') | undefined> {
//   if (resolveAttempted) return otelApi
//   resolveAttempted = true
;(async () => {
  try {
    otelApi = await import('@opentelemetry/api')
  } catch {
    console.warn(
      `[${LIBRARY_NAME}] @opentelemetry/api is not installed. ` +
      'Telemetry is disabled. To enable instrumentation, install it:\n\n' +
      '  npm install @opentelemetry/api\n'
    )
  }

  // return otelApi
})()

export function getOtelApi () {
  return otelApi
}
