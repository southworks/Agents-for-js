// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

/**
 * Check dotenv declarations for both startup and Repository Doctor.
 * Node's parseEnv remains responsible for reading the values.
 * @param {string} source - Contents of a mode environment file or template.
 */
export function inspectEnvironment (source) {
  const names = new Set()
  const declarations = []
  const issues = []
  let openingQuote
  let openingLine = 0

  for (const [index, rawLine] of source.replace(/^\uFEFF/, '').split(/\r?\n/).entries()) {
    let text = rawLine.trim()
    const line = index + 1
    if (!openingQuote) {
      if (!text || text.startsWith('#')) {
        continue
      }

      const assignment = text.match(/^(?:export\s+)?([A-Za-z_]\w*)\s*=\s*(.*)$/)
      if (!assignment) {
        issues.push({ line, message: 'Invalid setting. Use NAME=value.' })
        continue
      }
      const [, name, value] = assignment
      const key = name.toLowerCase()
      declarations.push({ name, line })
      if (names.has(key)) {
        issues.push({ name, line, message: `Duplicate setting ${name}. Keep one declaration.` })
      }
      names.add(key)

      openingQuote = ['"', "'", '`'].find(mark => value.startsWith(mark))
      if (!openingQuote) {
        continue
      }
      openingLine = line
      text = value.slice(1)
    }

    const closingQuote = text.indexOf(openingQuote)
    if (closingQuote !== -1) {
      const suffix = text.slice(closingQuote + 1).trim()
      if (suffix && !suffix.startsWith('#')) {
        issues.push({ line, message: 'Unexpected text after a quoted value.' })
      }
      openingQuote = undefined
    }
  }

  if (openingQuote) {
    issues.push({ line: openingLine, message: 'Unclosed quoted value.' })
  }
  return { declarations, issues }
}

export function isIncompatibleOAuthKey (mode, key) {
  const modern = /^AgentApplication__UserAuthorization__Handlers__/i.test(key)
  const legacy = /^(auth|sso|obo_auto|obo_manual|mcs)_/i.test(key)
  return (mode !== 'latest' && modern) || (mode !== 'legacy' && legacy)
}
