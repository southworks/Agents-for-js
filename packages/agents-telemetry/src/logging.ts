// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

export const loggerLevels = [
  'info',
  'warn',
  'error',
  'debug',
] as const

export type LoggerLevel = typeof loggerLevels[number]

type OTelLogRecord = {
  severityNumber: number
  severityText: string
  body: string
  attributes?: Record<string, string>
}

type OTelLogger = {
  emit: (record: OTelLogRecord) => void
}

export type OTelLogsModule = {
  logs: {
    getLogger: (name: string) => OTelLogger
  }
  SeverityNumber: {
    DEBUG: number
    INFO: number
    WARN: number
    ERROR: number
  }
}

export function createOtelLogging (otelLogs: OTelLogsModule) {
  const severityNumber = {
    debug: otelLogs.SeverityNumber.DEBUG,
    info: otelLogs.SeverityNumber.INFO,
    warn: otelLogs.SeverityNumber.WARN,
    error: otelLogs.SeverityNumber.ERROR,
  } as const

  function createOtelLogger (namespace: string): OTelLogger {
    const loggerNamespace = namespace ? `debug:${namespace}` : 'debug:agents'
    return otelLogs.logs.getLogger(loggerNamespace)
  }

  function emitOtelLoggerLog (logger: OTelLogger | undefined, namespace: string, level: LoggerLevel, message: string, args: unknown[]) {
    if (!logger) {
      return
    }

    const attributes = {
      'log.namespace': namespace,
      'log.level': level,
    }

    const record: OTelLogRecord = {
      severityNumber: severityNumber[level],
      severityText: level.toUpperCase(),
      body: formatMessage(message, args),
      attributes,
    }

    logger.emit(record)
  }

  return {
    createOtelLogger,
    emitOtelLoggerLog,
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
