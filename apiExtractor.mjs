import fs from 'fs'
import path from 'path'

import { Extractor, ExtractorConfig } from '@microsoft/api-extractor'
import { Colorize } from "@rushstack/terminal";

import tsconfigReferences from './tsconfig.build.json' with { type: 'json' }

const folders = {
  root: import.meta.dirname,
  reports: path.join(import.meta.dirname, 'api-reports'),
  packages: 'packages/'
}

fs.mkdirSync(path.join(folders.reports, 'etc'), { recursive: true })
fs.mkdirSync(path.join(folders.reports, 'temp'), { recursive: true })

const settings = loadSettings()

const packages = settings.package ? [settings.package] : tsconfigReferences.references
  .filter(ref => ref.path.startsWith(folders.packages))
  .map(ref => ref.path)

console.time('Total Duration')

console.log(`==============================
   ${Colorize.magenta('API Compatibility Report')}


==============================`)

const { _console, restore } = stubConsole()

const packagesWithFailures = []
for (const projectFolder of packages) {
  _console.log(`\n┌─ [${Colorize.blue(projectFolder)}] analyzing compatibility...`)
  const packageJsonFullPath = path.resolve(folders.root, projectFolder, 'package.json')

  const extractorConfig = ExtractorConfig.prepare({
    packageJsonFullPath,
    configObject: {
      projectFolder,
      mainEntryPointFilePath: 'dist/src/index.d.ts',
      compiler: {
        tsconfigFilePath: 'tsconfig.json'
      },
      apiReport: {
        enabled: true,
        reportFolder: path.join(folders.reports, 'etc'),
        reportTempFolder: path.join(folders.reports, 'temp'),
      },
      docModel: {
        enabled: false
      },
      dtsRollup: {
        enabled: false
      },
      tsdocMetadata: {
        enabled: false
      },
    }
  })

  console.log(`\r`)

  const extractorResult = Extractor.invoke(extractorConfig, {
    localBuild: settings.local,
    showVerboseMessages: settings.verbose,
    showDiagnostics: settings.diagnostics,
  })

  console.log(`\r`)

  if (extractorResult.succeeded) {
    _console.log(`└─ ${Colorize.green('passed')}`)
    continue
  }

  _console.log(`└─ ${Colorize.red(`${extractorResult.errorCount} error(s)`)} ── ${Colorize.yellow(`${extractorResult.warningCount} warning(s)`)}`)

  packagesWithFailures.push(projectFolder)
}

restore()

if (packagesWithFailures.length === 0) {
  console.log(`\n${Colorize.green(`${packages.length} package(s) passed the compatibility analysis!`)}\n`)
  console.timeEnd('Total Duration')
  console.log('\r')
  process.exit(0)
} else {
  console.log(`\n${Colorize.red(`${packagesWithFailures.length} package(s) failed the compatibility analysis!`)}\n`)
  console.timeEnd('Total Duration')
  console.log('\r')
  console.info()
  process.exit(1)
}

function stubConsole() {
  const _console = { ...console }
  console.log = (...args) => _console.log('│ ', ...args)
  console.warn = (...args) => _console.warn('│ ', ...args)
  console.error = (...args) => _console.error('│ ', ...args)
  return {
    _console,
    restore: () => {
      console.log = _console.log.bind(console)
      console.warn = _console.warn.bind(console)
      console.error = _console.error.bind(console)
    },
  }
}

function loadSettings() {
  let [, , packageName, ...args] = process.argv

  packageName = packageName?.trim() ?? ''
  args ??= []

  if (packageName.startsWith('--')) {
    args.push(packageName)
    packageName = ''
  } else if (packageName) {
    packageName.startsWith(folders.packages) ? packageName : `${folders.packages}${packageName}`
  }

  return {
    package: packageName,
    verbose: args.includes('--verbose'),
    local: args.includes('--local'),
    diagnostics: args.includes('--diagnostics'),
  }
}