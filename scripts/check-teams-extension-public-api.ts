import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, extname, join, relative, resolve } from 'node:path'
import { Extractor, ExtractorConfig } from '@microsoft/api-extractor'

const packageRoot = 'packages/agents-hosting-extensions-msteams'
const packageName = '@microsoft/agents-hosting-extensions-msteams'
const defaultBaseline = 'compat/baseline/agents-hosting-extensions-msteams.api.md'
const defaultEntrypoint = join(packageRoot, 'dist/src/index.d.ts')

type ChangeKind = 'public-symbol-added' | 'public-symbol-removed' | 'public-symbol-changed'
type ReleaseDecision = 'patch' | 'minor' | 'major' | 'maintainer-review'

interface Settings {
  baseline: string
  entrypoint: string
  output?: string
  failOnChange: boolean
  verbose: boolean
  help: boolean
}

interface PublicSymbolChange {
  kind: ChangeKind
  symbol: string
  before?: string
  after?: string
  releaseDecision: ReleaseDecision
}

interface UpstreamTypeLeak {
  upstreamSymbol: string
  importKind: 'type-only' | 'runtime'
  publicExports: string[]
}

interface PublicApiReport {
  schemaVersion: 1
  package: string
  baseline: string
  entrypoint: string
  status: 'unchanged' | 'changed'
  releaseDecision: ReleaseDecision
  publicSymbolChanges: PublicSymbolChange[]
  upstreamTypeLeaks: UpstreamTypeLeak[]
}

const help = `Usage:
  npm run check:teams-extension-public-api -- [--baseline <file>] [--entrypoint <file>] [--output <file-or-directory>] [--fail-on-change] [--verbose]

Runs API Extractor against the checked-in public API baseline for ${packageName},
writes a machine-readable report, and identifies @microsoft/teams.api types that
are exposed through this package's public declarations.

Defaults:
  baseline:   ${defaultBaseline}
  entrypoint: ${defaultEntrypoint}

Examples:
  npm run build -- --verbose
  npm run check:teams-extension-public-api -- --output artifacts/teams-api-drift
  npm run detect:teams-api-drifts -- --public-api-report artifacts/teams-api-drift/public-api-report.json --output artifacts/teams-api-drift
`

function parseSettings (args: string[]): Settings {
  const settings: Settings = {
    baseline: defaultBaseline,
    entrypoint: defaultEntrypoint,
    failOnChange: false,
    verbose: false,
    help: false
  }

  for (let index = 0; index < args.length; index++) {
    const argument = args[index]
    if (argument === '--help' || argument === '-h') return { ...settings, help: true }
    if (argument === '--fail-on-change') {
      settings.failOnChange = true
      continue
    }
    if (argument === '--verbose' || argument === '-v') {
      settings.verbose = true
      continue
    }
    if (argument === '--baseline' || argument === '--entrypoint' || argument === '--output' || argument === '-o') {
      const value = args[++index]
      if (!value) throw new Error(`${argument} requires a file path.`)
      if (argument === '--baseline') settings.baseline = value
      else if (argument === '--entrypoint') settings.entrypoint = value
      else settings.output = value
      continue
    }
    throw new Error(`Unknown option: ${argument}`)
  }

  return settings
}

function requireFile (filePath: string, description: string): string {
  const fullPath = resolve(filePath)
  if (!existsSync(fullPath)) throw new Error(`${description} not found: ${fullPath}. Run npm run build first.`)
  return fullPath
}

function reportFileName (baselinePath: string): string {
  return basename(baselinePath).replace(/\.api\.md$/, '')
}

function generateCurrentReport (baselinePath: string, entrypointPath: string, verbose: boolean): string {
  const temporaryDirectory = mkdtempSync(join(tmpdir(), 'teams-extension-public-api-'))
  const generatedDirectory = join(temporaryDirectory, 'generated')
  const packageJsonPath = resolve(packageRoot, 'package.json')
  const apiReportName = reportFileName(baselinePath)

  try {
    const config = ExtractorConfig.prepare({
      packageJsonFullPath: packageJsonPath,
      configObjectFullPath: join(temporaryDirectory, 'api-extractor.json'),
      configObject: {
        projectFolder: resolve(packageRoot),
        mainEntryPointFilePath: entrypointPath,
        compiler: { tsconfigFilePath: 'tsconfig.json' },
        apiReport: {
          enabled: true,
          reportFileName: apiReportName,
          reportFolder: dirname(baselinePath),
          reportTempFolder: generatedDirectory
        },
        docModel: { enabled: false },
        dtsRollup: { enabled: false },
        tsdocMetadata: { enabled: false }
      }
    })
    const result = Extractor.invoke(config, { localBuild: false, showVerboseMessages: verbose })
    const generatedPath = join(generatedDirectory, `${apiReportName}.api.md`)
    if (!existsSync(generatedPath)) throw new Error(`API Extractor did not generate ${generatedPath}.`)
    if (!result.succeeded && !result.apiReportChanged) throw new Error(`API Extractor failed with ${result.errorCount} error(s).`)
    return readFileSync(generatedPath, 'utf8')
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true })
  }
}

function normalizeDeclaration (value: string): string {
  return value.replace(/\r\n/g, '\n').replace(/\s+/g, ' ').trim()
}

function publicSymbols (report: string): Map<string, string> {
  const symbols = new Map<string, string>()
  const blocks = report.split(/(?=\/\/ @public\r?\nexport )/g)
  for (const block of blocks) {
    if (!block.startsWith('// @public')) continue
    const match = /^\/\/ @public\r?\nexport\s+(?:declare\s+)?(?:abstract\s+)?(?:class|interface|type|const|function)\s+([A-Za-z_$][\w$]*)/m.exec(block)
    if (match) symbols.set(match[1], normalizeDeclaration(block))
  }
  return symbols
}

function publicSymbolChanges (baseline: string, current: string): PublicSymbolChange[] {
  const before = publicSymbols(baseline)
  const after = publicSymbols(current)
  const names = [...new Set([...before.keys(), ...after.keys()])].sort()
  const changes: PublicSymbolChange[] = []

  for (const symbol of names) {
    const beforeValue = before.get(symbol)
    const afterValue = after.get(symbol)
    if (beforeValue === undefined) changes.push({ kind: 'public-symbol-added', symbol, after: afterValue, releaseDecision: 'minor' })
    else if (afterValue === undefined) changes.push({ kind: 'public-symbol-removed', symbol, before: beforeValue, releaseDecision: 'major' })
    else if (beforeValue !== afterValue) changes.push({ kind: 'public-symbol-changed', symbol, before: beforeValue, after: afterValue, releaseDecision: 'maintainer-review' })
  }

  return changes
}

function publicExportName (block: string): string | undefined {
  return /^\/\/ @public\r?\nexport\s+(?:declare\s+)?(?:abstract\s+)?(?:class|interface|type|const|function)\s+([A-Za-z_$][\w$]*)/m.exec(block)?.[1]
}

function upstreamTypeLeaks (report: string): UpstreamTypeLeak[] {
  const imports = new Map<string, { upstreamSymbol: string, importKind: 'type-only' | 'runtime' }>()
  const importExpression = /^import\s+(type\s+)?\{([^}]+)\}\s+from\s+'@microsoft\/teams\.api';$/gm
  for (const match of report.matchAll(importExpression)) {
    const importKind = match[1] ? 'type-only' : 'runtime'
    for (const specifier of match[2].split(',')) {
      const [upstreamSymbol, localSymbol = upstreamSymbol] = specifier.trim().split(/\s+as\s+/)
      imports.set(localSymbol, { upstreamSymbol, importKind })
    }
  }

  const leaks = new Map<string, UpstreamTypeLeak>()
  const blocks = report.split(/(?=\/\/ @public\r?\nexport )/g)
  for (const block of blocks) {
    const exportName = publicExportName(block)
    if (!exportName) continue
    for (const [localSymbol, imported] of imports) {
      if (!new RegExp(`\\b${localSymbol}\\b`).test(block)) continue
      const existing = leaks.get(imported.upstreamSymbol) ?? {
        upstreamSymbol: imported.upstreamSymbol,
        importKind: imported.importKind,
        publicExports: []
      }
      existing.publicExports.push(exportName)
      leaks.set(imported.upstreamSymbol, existing)
    }
  }

  return [...leaks.values()]
    .map(leak => ({ ...leak, publicExports: [...new Set(leak.publicExports)].sort() }))
    .sort((left, right) => left.upstreamSymbol.localeCompare(right.upstreamSymbol))
}

function releaseDecision (changes: PublicSymbolChange[]): ReleaseDecision {
  if (changes.some(change => change.releaseDecision === 'major')) return 'major'
  if (changes.some(change => change.releaseDecision === 'maintainer-review')) return 'maintainer-review'
  if (changes.some(change => change.releaseDecision === 'minor')) return 'minor'
  return 'patch'
}

function writeOutput (report: PublicApiReport, output: string): void {
  const destination = resolve(output)
  const outputPath = extname(destination).toLowerCase() === '.json'
    ? destination
    : join(destination, 'public-api-report.json')
  mkdirSync(dirname(outputPath), { recursive: true })
  writeFileSync(outputPath, `${JSON.stringify(report, undefined, 2)}\n`)
  console.log(`Wrote public API report to ${relative(process.cwd(), outputPath) || basename(outputPath)}`)
}

function main (): void {
  const settings = parseSettings(process.argv.slice(2))
  if (settings.help) {
    console.log(help)
    return
  }

  const baselinePath = requireFile(settings.baseline, 'Public API baseline')
  const entrypointPath = requireFile(settings.entrypoint, 'Public declaration entrypoint')
  const baseline = readFileSync(baselinePath, 'utf8')
  const current = generateCurrentReport(baselinePath, entrypointPath, settings.verbose)
  const changes = publicSymbolChanges(baseline, current)
  const report: PublicApiReport = {
    schemaVersion: 1,
    package: packageName,
    baseline: relative(process.cwd(), baselinePath),
    entrypoint: relative(process.cwd(), entrypointPath),
    status: changes.length === 0 ? 'unchanged' : 'changed',
    releaseDecision: releaseDecision(changes),
    publicSymbolChanges: changes,
    upstreamTypeLeaks: upstreamTypeLeaks(current)
  }

  console.log(`Public API ${report.status}; ${report.upstreamTypeLeaks.length} ${dependencyName()} type(s) exposed; release decision: ${report.releaseDecision}.`)
  if (settings.output) writeOutput(report, settings.output)
  if (settings.failOnChange && report.status === 'changed') process.exitCode = 1
}

function dependencyName (): string {
  return '@microsoft/teams.api'
}

main()
