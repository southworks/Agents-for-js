// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { OTelLogs } from './types'

type LoggerLevel = 'info' | 'warn' | 'error' | 'debug'

const DEFAULT_LEVEL: LoggerLevel = 'debug'

export function loggerFactory (otelLogs: OTelLogs) {
  const severityNumber = {
    debug: otelLogs.SeverityNumber.DEBUG,
    info: otelLogs.SeverityNumber.INFO,
    warn: otelLogs.SeverityNumber.WARN,
    error: otelLogs.SeverityNumber.ERROR,
  } as const

  return function createLogger (namespace: string, level?: LoggerLevel) {
    const _logger = otelLogs.logs.getLogger(namespace)

    return function logger (message: string, ...args: unknown[]) {
      const attributes = {
        'log.namespace': namespace,
        'log.level': level ?? DEFAULT_LEVEL,
      }

      _logger.emit({
        severityNumber: severityNumber[level ?? DEFAULT_LEVEL],
        severityText: (level ?? DEFAULT_LEVEL).toUpperCase(),
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
