import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join, relative, resolve } from 'node:path'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { Extractor, ExtractorConfig } from '@microsoft/api-extractor'
import { createTwoFilesPatch, diffLines } from 'diff'

const dependency = '@microsoft/teams.api'
const require = createRequire(import.meta.url)

interface Settings {
  candidate?: string
  output?: string
  help: boolean
}

interface ApiReport {
  version: string
  text: string
}

interface ComparisonResult {
  dependency: string
  apiExtractorVersion: string
  current: { version: string }
  candidate: { requested: string, version: string }
  changed: boolean
  addedLines: string[]
  removedLines: string[]
  diff: string
}

const help = `Usage:
  npm run compare:teams-api [--] [candidate-version] [--output <file>]

Compares the version of ${dependency} installed for agents-hosting-extensions-msteams
with a candidate release. When candidate-version is omitted, the latest stable npm
release is selected. Prerelease candidates must be supplied explicitly.

Examples:
  npm run compare:teams-api
  npm run compare:teams-api -- 2.0.14
  npm run compare:teams-api -- 2.0.14 --output artifacts/teams-api-comparison.json
`

function parseSettings (args: string[]): Settings {
  const positional: string[] = []
  let output: string | undefined

  for (let index = 0; index < args.length; index++) {
    const argument = args[index]
    if (argument === '--help' || argument === '-h') {
      return { help: true }
    }
    if (argument === '--output' || argument === '-o') {
      output = args[++index]
      if (!output) {
        throw new Error(`${argument} requires a file path.`)
      }
      continue
    }
    if (argument.startsWith('-')) {
      throw new Error(`Unknown option: ${argument}`)
    }
    positional.push(argument)
  }

  if (positional.length > 1) {
    throw new Error('Specify at most one candidate version.')
  }

  return { candidate: positional[0], output, help: false }
}

function npmCommand (): string {
  return process.platform === 'win32' ? 'npm.cmd' : 'npm'
}

function runNpm (args: string[], workingDirectory?: string): string {
  const useWindowsCommandShell = process.platform === 'win32'
  const command = useWindowsCommandShell ? process.env.ComSpec ?? 'cmd.exe' : npmCommand()
  const commandArgs = useWindowsCommandShell ? ['/d', '/s', '/c', npmCommand(), ...args] : args
  return execFileSync(command, commandArgs, {
    cwd: workingDirectory,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  })
}

function isStableVersion (version: string): boolean {
  return /^\d+\.\d+\.\d+$/.test(version)
}

function isVersion (version: string): boolean {
  return /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)
}

function compareVersions (left: string, right: string): number {
  const leftParts = left.split('.').map(Number)
  const rightParts = right.split('.').map(Number)
  for (let index = 0; index < 3; index++) {
    const difference = leftParts[index] - rightParts[index]
    if (difference !== 0) return difference
  }
  return 0
}

function getLatestStableVersion (): string {
  const result = JSON.parse(runNpm(['view', dependency, 'versions', '--json'])) as string[] | string
  const versions = (Array.isArray(result) ? result : [result]).filter(isStableVersion)
  if (versions.length === 0) {
    throw new Error(`No stable npm release was found for ${dependency}. Supply a candidate version explicitly.`)
  }
  return versions.sort(compareVersions).at(-1)!
}

function readPackageJson (packageRoot: string): { name: string, version: string, types?: string } {
  return JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8')) as { name: string, version: string, types?: string }
}

function resolveTypesEntryPoint (packageRoot: string, packageJson: { name: string, types?: string }): string {
  if (!packageJson.types) {
    throw new Error(`${packageJson.name} does not declare a public types entry point.`)
  }

  const entryPoint = resolve(packageRoot, packageJson.types)
  if (!entryPoint.startsWith(`${packageRoot}\\`) && !entryPoint.startsWith(`${packageRoot}/`)) {
    throw new Error(`${packageJson.name} types entry point resolves outside the package.`)
  }
  return entryPoint
}

function generateApiReport (packageRoot: string, workRoot: string): ApiReport {
  const packageJsonPath = join(packageRoot, 'package.json')
  const packageJson = readPackageJson(packageRoot)
  const reportDirectory = join(workRoot, packageJson.version)
  const reportTempDirectory = join(reportDirectory, 'temp')
  mkdirSync(reportDirectory, { recursive: true })
  // API Extractor treats a missing baseline as a warning, even for a disposable report.
  writeFileSync(join(reportDirectory, 'teams-api.api.md'), '')

  const config = ExtractorConfig.prepare({
    packageJsonFullPath: packageJsonPath,
    configObjectFullPath: join(reportDirectory, 'api-extractor.json'),
    configObject: {
      projectFolder: packageRoot,
      mainEntryPointFilePath: resolveTypesEntryPoint(packageRoot, packageJson),
      compiler: {
        overrideTsconfig: {
          compilerOptions: {
            module: 'NodeNext',
            moduleResolution: 'NodeNext',
            skipLibCheck: true
          }
        },
        skipLibCheck: true
      },
      apiReport: {
        enabled: true,
        reportFileName: 'teams-api',
        reportFolder: reportDirectory,
        reportTempFolder: reportTempDirectory
      },
      docModel: { enabled: false },
      dtsRollup: { enabled: false },
      tsdocMetadata: { enabled: false }
    }
  })

  const extractorResult = Extractor.invoke(config, {
    localBuild: true,
    messageCallback: () => {}
  })
  if (!extractorResult.succeeded) {
    throw new Error(`API Extractor failed for ${dependency}@${packageJson.version} with ${extractorResult.errorCount} error(s).`)
  }

  return {
    version: packageJson.version,
    text: readFileSync(join(reportDirectory, 'teams-api.api.md'), 'utf8')
  }
}

function installCandidate (version: string, workRoot: string): string {
  const installRoot = join(workRoot, 'candidate')
  mkdirSync(installRoot, { recursive: true })
  writeFileSync(join(installRoot, 'package.json'), '{ "private": true }\n')
  try {
    runNpm(['install', '--ignore-scripts', '--no-package-lock', '--no-save', `${dependency}@${version}`], installRoot)
  } catch (error) {
    const details = error instanceof Error && 'stderr' in error && error.stderr != null
      ? String(error.stderr).trim()
      : error instanceof Error ? error.message : String(error)
    throw new Error(`Unable to install ${dependency}@${version}. ${details}`)
  }
  return join(installRoot, 'node_modules', ...dependency.split('/'))
}

function createComparison (current: ApiReport, candidate: ApiReport, requestedCandidate: string): ComparisonResult {
  const changes = diffLines(current.text, candidate.text)
  const addedLines = changes.filter(change => change.added).flatMap(change => change.value.split('\n').filter(Boolean))
  const removedLines = changes.filter(change => change.removed).flatMap(change => change.value.split('\n').filter(Boolean))

  return {
    dependency,
    apiExtractorVersion: Extractor.version,
    current: { version: current.version },
    candidate: { requested: requestedCandidate, version: candidate.version },
    changed: current.text !== candidate.text,
    addedLines,
    removedLines,
    diff: createTwoFilesPatch(
      `${dependency}@${current.version}`,
      `${dependency}@${candidate.version}`,
      current.text,
      candidate.text,
      '',
      '',
      { context: 3 }
    )
  }
}

function writeResult (result: ComparisonResult, output: string): void {
  const destination = resolve(output)
  mkdirSync(dirname(destination), { recursive: true })
  writeFileSync(destination, `${JSON.stringify(result, undefined, 2)}\n`)
  console.log(`Wrote comparison result to ${relative(process.cwd(), destination) || basename(destination)}`)
}

function main (): void {
  const settings = parseSettings(process.argv.slice(2))
  if (settings.help) {
    console.log(help)
    return
  }

  const currentPackageJsonPath = require.resolve(`${dependency}/package.json`)
  const currentPackageRoot = dirname(currentPackageJsonPath)
  const currentVersion = readPackageJson(currentPackageRoot).version
  const requestedCandidate = settings.candidate ?? getLatestStableVersion()
  if (!isVersion(requestedCandidate)) {
    throw new Error(`Candidate must be a complete version, optionally with a prerelease suffix: ${requestedCandidate}`)
  }
  const workRoot = mkdtempSync(join(tmpdir(), 'teams-api-compare-'))

  try {
    console.log(`Comparing ${dependency}@${currentVersion} with ${dependency}@${requestedCandidate}...`)
    const current = generateApiReport(currentPackageRoot, workRoot)
    const candidatePackageRoot = requestedCandidate === currentVersion
      ? currentPackageRoot
      : installCandidate(requestedCandidate, workRoot)
    const candidate = generateApiReport(candidatePackageRoot, workRoot)
    const comparison = createComparison(current, candidate, requestedCandidate)

    console.log(comparison.changed ? 'Public API changed.' : 'No public API changes detected.')
    if (comparison.changed) {
      console.log(comparison.diff)
    }
    if (settings.output) {
      writeResult(comparison, settings.output)
    }
  } finally {
    rmSync(workRoot, { recursive: true, force: true })
  }
}

main()
