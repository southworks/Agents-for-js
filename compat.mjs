import fs from 'fs'
import path from 'path'

import { Extractor, ExtractorConfig } from '@microsoft/api-extractor'
import { Colorize } from '@rushstack/terminal'

const folders = {
  root: import.meta.dirname,
  reports: path.join(import.meta.dirname, 'api-reports'),
  packages: 'packages/'
}

const tsconfigReferences = JSON.parse(fs.readFileSync(path.join(folders.root, 'tsconfig.build.json'), 'utf-8'))

fs.mkdirSync(path.join(folders.reports, 'etc'), { recursive: true })
fs.mkdirSync(path.join(folders.reports, 'temp'), { recursive: true })

const helpMessage = `
${Colorize.cyan('Usage:')}
  npm run compat ${Colorize.blue('[package]')} ${Colorize.dim('[--local] [--verbose] [--diagnostics]')}

${Colorize.cyan('Options:')}
  ${Colorize.blue('[package]')}          ${Colorize.dim('Name of the package to analyze (e.g. agents-hosting). If omitted, all packages are analyzed.')}
  -l, --local        ${Colorize.dim('Copy temporary API report files to the final report folder (api-reports/etc).')}
  -v, --verbose      ${Colorize.dim('Show verbose output from API Extractor.')}
  -d, --diagnostics  ${Colorize.dim('Show diagnostics output from API Extractor.')}
  -h, --help         ${Colorize.dim('Show this help message.')}

${Colorize.cyan('Examples:')}
  npm run compat
  npm run compat agents-hosting
  npm run compat agents-hosting ${Colorize.dim('-- --local --verbose --diagnostics')}
`

console.log(`${Colorize.magenta('API Compatibility Report')}

${Colorize.cyan('Tips:')}
  ${Colorize.dim('- use --local to syncronize reports from temp to etc.')}
  ${Colorize.dim('- run "npm run compat --help" for more information.')}`)

const settings = loadSettings()

if (settings.help) {
  console.log(helpMessage)
  process.exit(0)
}

const packages = settings.package
  ? [settings.package]
  : tsconfigReferences.references
    .filter(ref => ref.path.startsWith(folders.packages))
    .map(ref => ref.path)

console.time('Total Duration')

const packagesWithFailures = []
const { _console, restore } = stubConsole()

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

  console.log('\r')

  let updated = false
  const extractorResult = Extractor.invoke(extractorConfig, {
    localBuild: settings.local,
    showVerboseMessages: settings.verbose,
    showDiagnostics: settings.diagnostics,
    messageCallback (message) {
      if (message.logLevel === 'warning' && message.text.includes('Updating ')) {
        updated = true
      }
    }
  })

  console.log('\r')

  if (updated) {
    _console.log(`└─ ${Colorize.green('updated')}`)
    continue
  }

  if (extractorResult.succeeded) {
    _console.log(`└─ ${Colorize.green('passed')}`)
    continue
  }

  _console.log(`└─ ${Colorize.red(`${extractorResult.errorCount} error(s)`)} ── ${Colorize.yellow(`${extractorResult.warningCount} warning(s)`)}`)

  packagesWithFailures.push(projectFolder)
}

restore()

// console.log('\n', separator, '\r')

if (packagesWithFailures.length === 0) {
  console.log(`\n${Colorize.green(`${packages.length} package(s) passed the compatibility analysis!`)}\n`)
} else {
  console.log(`\n${Colorize.red(`${packagesWithFailures.length} package(s) failed the compatibility analysis!`)}\n`)
}

console.timeEnd('Total Duration')

if (packagesWithFailures.length === 0) {
  process.exit(0)
} else {
  process.exit(1)
}

function stubConsole () {
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

function loadSettings () {
  let [, , packageName, ...args] = process.argv

  packageName = packageName?.trim() ?? ''
  args ??= []

  if (packageName.startsWith('--')) {
    args.push(packageName)
    packageName = ''
  } else if (packageName) {
    packageName = packageName.startsWith(folders.packages) ? packageName : `${folders.packages}${packageName}`
  }

  return {
    package: packageName,
    verbose: args.includes('--verbose') || args.includes('-v'),
    local: args.includes('--local') || args.includes('-l'),
    diagnostics: args.includes('--diagnostics') || args.includes('-d'),
    help: args.includes('--help') || args.includes('-h'),
  }
}
