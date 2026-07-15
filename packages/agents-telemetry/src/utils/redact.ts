/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

const REDACTED_VALUE = '<redacted>'
const REDACTION_PEEK_LENGTH = 2

/**
 * Redacts a string value, optionally allowing a peek at the beginning of the string for context.
 * @param value The string value to redact.
 * @param peek Whether to allow a peek at the beginning of the string (default: false). If true and the string is long enough, the first few characters of the string will be included in the redacted output for context before `'<redacted>'`.
 * @returns The redacted string, or undefined if the input value was undefined.
 */
export function redactString (value: string | undefined, peek: boolean = false): string | undefined {
  if (value === undefined) {
    return undefined
  }

  return peek && value.length > REDACTION_PEEK_LENGTH + 6
    ? `${value.slice(0, REDACTION_PEEK_LENGTH)}${REDACTED_VALUE}`
    : REDACTED_VALUE
}

/**
 * Redacts sensitive information from a URL by removing path segments and query parameters.
 * @param value The URL string to redact.
 * @returns The redacted URL string, which includes only the origin and an indication of how many path segments were redacted, or just the origin if there are no path segments. Query parameters are not included in the output to avoid exposing sensitive information. If the input value is not a valid URL, the function returns a fully redacted placeholder.
 */
export function redactUrl (value: string | undefined): string | undefined {
  if (!value?.trim()) {
    return undefined
  }

  try {
    const url = new URL(value)
    const pathSegments = url.pathname.split('/').filter(Boolean)

    if (pathSegments.length === 0) {
      return url.origin
    }

    return `${url.origin}/${REDACTED_VALUE} (${pathSegments.length} segments)`
  } catch {
    return REDACTED_VALUE
  }
}

/**
 * Redacts sensitive information from an array of scopes.
 * @param scopes The array of scopes to redact.
 * @returns The redacted scopes string, which includes an indication of how many scopes were redacted. If the input value is undefined, it will be returned as undefined.
 */
export function redactScopes (scopes: string[] | undefined): string | undefined {
  if (scopes === undefined) {
    return undefined
  }

  const count = scopes.length
  return `${REDACTED_VALUE} (${count} ${count === 1 ? 'scope' : 'scopes'})`
}

/**
 * Creates a redacted copy of an object for diagnostic logging.
 * Conversation IDs, activity text, and URL-valued properties are redacted while all other values are preserved.
 * @param value The value to sanitize for diagnostics.
 * @returns A non-mutating, redacted copy of the value.
 */
export function redactDiagnosticObject (value: unknown): unknown {
  return redactValue(value, [])
}

function redactValue (value: unknown, path: string[]): unknown {
  if (typeof value === 'string') {
    const propertyName = path.at(-1)?.toLowerCase()
    const parentPropertyName = path.at(-2)?.toLowerCase()

    if (propertyName === 'conversationid' || (propertyName === 'id' && parentPropertyName === 'conversation') || propertyName === 'text' || propertyName === 'activitytext') {
      return redactString(value)
    }

    if (propertyName?.includes('url') || propertyName === 'uri' || propertyName === 'href') {
      return redactUrl(value)
    }

    return value
  }

  if (Array.isArray(value)) {
    return value.map(item => redactValue(item, path))
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, redactValue(item, [...path, key])]))
  }

  return value
}
