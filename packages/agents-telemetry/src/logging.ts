// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { OTelLogs } from './types'

const loggerLevels = [
  'info',
  'warn',
  'error',
  'debug',
] as const

type LoggerLevel = typeof loggerLevels[number]

export function loggerFactory (otelLogs: OTelLogs) {
  const severityNumber = {
    debug: otelLogs.SeverityNumber.DEBUG,
    info: otelLogs.SeverityNumber.INFO,
    warn: otelLogs.SeverityNumber.WARN,
    error: otelLogs.SeverityNumber.ERROR,
  } as const

  return function createLogger (namespace: string, level?: LoggerLevel) {
    const _logger = otelLogs.logs.getLogger(namespace ?? 'agents:telemetry')
    const debug = loggerLevels[3]

    return function logger (message: string, ...args: unknown[]) {
      console.log(namespace, level, message, ...args)
      const attributes = {
        'log.namespace': namespace,
        'log.level': level ?? debug,
      }

      _logger.emit({
        severityNumber: level ? severityNumber[level] : otelLogs.SeverityNumber.DEBUG,
        severityText: level ? level.toUpperCase() : debug.toUpperCase(),
        body: formatMessage(message, args),
        attributes,
      })
    }
  }
}

function formatMessage (message: string, args: unknown[]): string {
  if (args.length === 0) {
    return message
  }

  const serialized = args.map((value) => serializeLogValue(value)).join(' ')
  return `${message} ${serialized}`
}

function serializeLogValue (value: unknown): string {
  if (value instanceof Error) {
    return `${value.name}: ${value.message}`
  }

  if (typeof value === 'string') {
    return value
  }

  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value)
  }

  if (value === null || value === undefined) {
    return String(value)
  }

  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}
