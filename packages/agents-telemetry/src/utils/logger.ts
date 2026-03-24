// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { name as packageName } from '../../package.json'

// TODO: replace this with DEBUG library instead.
const debug = process.env.DEBUG
const isAgentsTelemetry = debug?.includes('agents:telemetry') || debug?.includes('agents:telemetry:*')
const isError = debug?.includes('agents:telemetry:error') || isAgentsTelemetry
const isDebug = debug?.includes('agents:telemetry:debug') || isAgentsTelemetry
const isInfo = debug?.includes('agents:telemetry:info') || isAgentsTelemetry
const isWarn = debug?.includes('agents:telemetry:warn') || isAgentsTelemetry

function withPrefix (log: (...args: unknown[]) => void) {
  return (...args: unknown[]) => log(`[${packageName}]`, ...args)
}

export const logger = {
  error: withPrefix((...args) => {
    if (isError) {
      console.error(...args)
    }
  }),
  warn: withPrefix((...args) => {
    if (isWarn) {
      console.warn(...args)
    }
  }),
  info: withPrefix((...args) => {
    if (isInfo) {
      console.info(...args)
    }
  }),
  debug: withPrefix((...args) => {
    if (isDebug) {
      console.debug(...args)
    }
  })
}
