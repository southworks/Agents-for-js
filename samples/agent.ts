// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { existsSync, readFileSync } from 'node:fs'
import { parseEnv, styleText } from 'node:util'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { cancel, intro, isCancel, log, outro, select } from '@clack/prompts'
import { copilotSettings, type Mode } from './_shared/config.js'
import { inspectEnvironment, isIncompatibleOAuthKey } from './_shared/environment.mjs'

export type { Mode } from './_shared/config.js'

const modeOptions: Array<{ value: Mode, label: string, hint: string }> = [
  { value: 'latest', label: 'Latest', hint: 'Current interfaces and configuration' },
  { value: 'legacy', label: 'Legacy', hint: 'Current interfaces with legacy configuration' },
  { value: 'compat', label: 'Compat', hint: 'Older programming interfaces' }
]

const usage = 'Usage: tsx samples/agent.ts [--mode latest|legacy|compat] [--reload] | --help'

function readModeArgument (args: string[]): Mode | undefined {
  if (args.length === 0) {
    return undefined
  }
  const option = modeOptions.find(option => option.value === args[1])
  if (args.length === 2 && args[0] === '--mode' && option) {
    return option.value
  }

  throw new Error(usage)
}

const modeSettingPrefixes = [
  'connections__', 'connectionsmap__', 'cloudadapteroptions__', 'outboundhostvalidator__',
  'agentapplication__', 'microsoftapp', 'auth_', 'sso_', 'obo_auto_', 'obo_manual_',
  'mcs_', 'blob_', 'cosmos_', 'samples_'
]

const modeSettingNames = new Set([
  'clientId', 'clientSecret', 'tenantId', 'authType', 'appType', 'federatedClientId', 'federatedTokenFile',
  'FICClientId', 'WIDAssertionFile', 'certPemFile', 'certKeyFile', 'authority', 'issuer', 'scope',
  'SIDECAR_URL', 'TOKEN_SERVICE_ENDPOINT', ...copilotSettings
].map(key => key.toLowerCase()))

function isModeSetting (key: string): boolean {
  const normalized = key.toLowerCase()
  return modeSettingNames.has(normalized) || modeSettingPrefixes.some(prefix => normalized.startsWith(prefix))
}

function checkInheritedSettings (fileSettings: NodeJS.ProcessEnv): void {
  const conflicts: string[] = []

  for (const key of Object.keys(process.env)) {
    const inheritedValue = process.env[key]
    if (!isModeSetting(key) || !inheritedValue?.trim()) {
      continue
    }

    // SDK setting names are case-insensitive, including on non-Windows hosts.
    const matchingKey = Object.keys(fileSettings).find(fileKey => fileKey.toLowerCase() === key.toLowerCase())
    if (matchingKey === undefined || fileSettings[matchingKey] !== inheritedValue) {
      conflicts.push(key)
    }
  }

  if (conflicts.length > 0) {
    throw new Error(`Remove conflicting inherited sample settings before starting: ${conflicts.join(', ')}`)
  }
}

function loadEnvironment (mode: Mode): string {
  const path = fileURLToPath(new URL(`${mode}.env`, import.meta.url))
  let source: string
  try {
    source = readFileSync(path, 'utf8').replace(/^\uFEFF/, '')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(`Missing ${path}. Copy samples/${mode}.env.TEMPLATE to samples/${mode}.env, then try again.`)
    }
    throw new Error(`Cannot read ${path}. Check the file permissions, then try again.`, { cause: error })
  }

  const { issues } = inspectEnvironment(source)
  if (issues.length) {
    const { line, message } = issues[0]
    throw new Error(`${path} at line ${line}. ${message}`)
  }
  const values = parseEnv(source)
  const incompatible = Object.keys(values).filter(key => values[key]?.trim() && isIncompatibleOAuthKey(mode, key))
  if (incompatible.length) {
    throw new Error(`OAuth settings incompatible with ${mode}: ${incompatible.join(', ')}. Use the mode template and restart.`)
  }
  checkInheritedSettings(values)

  // Copilot Studio's client reads these keys by their exact spelling.
  for (const key of copilotSettings) {
    const sourceKey = Object.keys(values).find(candidate => candidate.toLowerCase() === key.toLowerCase())
    if (sourceKey) {
      values[key] = values[sourceKey]
    }
  }
  Object.assign(process.env, values)
  return path
}

async function chooseMode (): Promise<Mode | undefined> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error(`Choose a mode with --mode when running without a terminal. ${usage}`)
  }

  const options = modeOptions.map(option => {
    const environmentFile = new URL(`${option.value}.env`, import.meta.url)
    let label = option.label

    if (!existsSync(environmentFile)) {
      const warning = styleText('yellow', `missing ${option.value}.env`)
      label = `${label} · ${warning}`
    }

    return { value: option.value, label, hint: option.hint }
  })

  const selectedMode = await select<Mode>({
    message: 'Which mode would you like to use?',
    options,
    initialValue: options.find(option => option.value === process.env.AGENTS_RELOAD_MODE)?.value
  })

  if (isCancel(selectedMode)) {
    cancel('Startup cancelled.')
    return undefined
  }

  return selectedMode
}

async function main () {
  const args = process.argv.slice(2)
  if (args.length === 1 && args[0] === '--help') {
    console.log(usage)
    return
  }

  if (args.includes('--reload')) {
    const startupArgs = args.filter(argument => argument !== '--reload')
    if (args.length - startupArgs.length !== 1) {
      throw new Error(usage)
    }
    readModeArgument(startupArgs)
    const { runWithReload } = await import('./_coordinator/reload.js')
    await runWithReload(fileURLToPath(import.meta.url), startupArgs)
    return
  }

  let mode = readModeArgument(args)
  intro('Development samples')

  if (!mode) {
    mode = await chooseMode()
  }

  // Cancellation ends startup before any configuration is loaded.
  if (!mode) {
    return
  }

  const environmentPath = loadEnvironment(mode)
  log.info(`Mode: ${mode}\nEnvironment: ${environmentPath}`)
  const { initializeTelemetry } = await import('./telemetry/setup.js')
  initializeTelemetry()
  // Import SDK consumers only after the selected environment is loaded.
  const { startServer } = await import('@microsoft/agents-hosting-express')
  const { SamplesCoordinator } = await import('./_coordinator/coordinator.js')
  const { registerProactiveTriggerRoutes } = await import('./proactive/httpTrigger.js')
  startServer(new SamplesCoordinator(mode), {
    beforeListen: mode === 'latest' ? registerProactiveTriggerRoutes : undefined
  })
  outro('Connect chat to /api/messages. Send a message to see the scenarios.')
  process.send?.({ type: 'samples-ready', mode })
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    log.error(error.message)
    cancel('Startup stopped.')
    process.exitCode = 1
  })
}
