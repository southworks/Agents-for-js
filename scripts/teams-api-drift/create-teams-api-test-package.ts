import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { basename, join, resolve } from 'node:path'

const dependency = '@microsoft/teams.api'
const fixtureVersion = '2.0.14-test'
const sourcePackage = 'node_modules/@microsoft/teams.api'
const defaultOutput = 'artifacts/teams-api-test-package'

interface Settings {
  output: string
  help: boolean
}

const help = `Usage:
  npm run create:teams-api-test-package [--] [--output <directory>]

Creates a publishable ${dependency}@${fixtureVersion} fixture from the installed
${dependency}@2.0.13 package. The fixture deliberately contains four isolated
API changes for drift-workflow testing:

  blocking  ChannelData.meeting is removed (a consumed property)
  required  MessagingExtensionAction.botActivityPreview changes to string
  review    ChannelInfo is marked @deprecated
  no-action TestOnlyDiagnostics is added but is not consumed by the extension
  feature-review TeamClient.getChannelMembers is added for the channels capability
  internal-opportunity Client.createDiagnosticsScope is added for internal client use

The output contains a .tgz suitable for npm publish and a README with the
publish command. It never overwrites an existing output directory.
`

function parseSettings (args: string[]): Settings {
  const settings: Settings = { output: defaultOutput, help: false }
  for (let index = 0; index < args.length; index++) {
    const argument = args[index]
    if (argument === '--help' || argument === '-h') return { ...settings, help: true }
    if (argument === '--output' || argument === '-o') {
      const value = args[++index]
      if (!value) throw new Error(`${argument} requires a directory path.`)
      settings.output = value
      continue
    }
    throw new Error(`Unknown option: ${argument}`)
  }
  return settings
}

function replaceOnce (filePath: string, expected: string, replacement: string): void {
  const text = readFileSync(filePath, 'utf8')
  const occurrences = text.split(expected).length - 1
  if (occurrences !== 1) throw new Error(`Expected one matching declaration in ${filePath}; found ${occurrences}.`)
  writeFileSync(filePath, text.replace(expected, replacement))
}

function npmCommand (): string {
  return process.platform === 'win32' ? 'npm.cmd' : 'npm'
}

function packPackage (packageDirectory: string, outputDirectory: string): string {
  const command = process.platform === 'win32' ? process.env.ComSpec ?? 'cmd.exe' : npmCommand()
  const args = process.platform === 'win32'
    ? ['/d', '/s', '/c', npmCommand(), 'pack', '--cache', join(outputDirectory, '.npm-cache'), '--pack-destination', outputDirectory]
    : ['pack', '--cache', join(outputDirectory, '.npm-cache'), '--pack-destination', outputDirectory]
  const result = execFileSync(command, args, { cwd: packageDirectory, encoding: 'utf8' }).trim()
  const tarballName = result.split(/\r?\n/).at(-1)
  if (!tarballName) throw new Error('npm pack did not report a tarball name.')
  return join(outputDirectory, tarballName)
}

function main (): void {
  const settings = parseSettings(process.argv.slice(2))
  if (settings.help) {
    console.log(help)
    return
  }

  const sourceDirectory = resolve(sourcePackage)
  const outputDirectory = resolve(settings.output)
  const packageDirectory = join(outputDirectory, 'package')
  if (!existsSync(sourceDirectory)) throw new Error(`Installed baseline package not found: ${sourceDirectory}`)
  if (existsSync(outputDirectory)) throw new Error(`Refusing to overwrite existing output directory: ${outputDirectory}`)

  mkdirSync(outputDirectory, { recursive: true })
  cpSync(sourceDirectory, packageDirectory, { recursive: true })

  const packageJsonPath = join(packageDirectory, 'package.json')
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as { name: string, version: string, description?: string }
  if (packageJson.name !== dependency || packageJson.version !== '2.0.13') {
    throw new Error(`Expected installed ${dependency}@2.0.13, found ${packageJson.name}@${packageJson.version}.`)
  }
  packageJson.version = fixtureVersion
  packageJson.description = 'Local drift-test fixture. Do not publish to a shared registry.'
  writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, undefined, 2)}\n`)

  replaceOnce(
    join(packageDirectory, 'dist/models/channel-data/index.d.ts'),
    ['    /**', '     * @member {MeetingInfo} [meeting] Information about the tenant in which the', '     * message was sent.', '     */', '    meeting?: MeetingInfo;', ''].join('\n'),
    ''
  )
  replaceOnce(
    join(packageDirectory, 'dist/activity-DzKP6phL.d.ts'),
    '    botActivityPreview?: Activity[];',
    '    botActivityPreview?: string;'
  )
  replaceOnce(
    join(packageDirectory, 'dist/models/channel-data/channel-info.d.ts'),
    ' * A channel info object which decribes the channel.\n *\n */',
    ' * A channel info object which decribes the channel.\n *\n * @deprecated Drift-test fixture: review the replacement channel model before upgrading.\n */'
  )
  replaceOnce(
    join(packageDirectory, 'dist/clients/team.d.ts'),
    '    getConversations(id: string): Promise<ChannelInfo[]>;',
    ['    getConversations(id: string): Promise<ChannelInfo[]>;', '    /**', '     * Lists the members of a Teams channel.', '     * Added by the drift-test fixture to exercise feature review.', '     */', '    getChannelMembers(teamId: string, channelId: string): Promise<ChannelInfo[]>;'].join('\n')
  )
  replaceOnce(
    join(packageDirectory, 'dist/clients/index.d.ts'),
    '    constructor(serviceUrl: string, options?: Client$1 | ClientOptions, apiClientSettings?: Partial<ApiClientSettings>, cloud?: CloudEnvironment);',
    ['    constructor(serviceUrl: string, options?: Client$1 | ClientOptions, apiClientSettings?: Partial<ApiClientSettings>, cloud?: CloudEnvironment);', '    /** Creates a local request diagnostics scope. Added by the drift-test fixture. */', '    createDiagnosticsScope(name: string): { name: string; };'].join('\n')
  )
  replaceOnce(
    join(packageDirectory, 'dist/clients/team.js'),
    'exports.TeamClient = TeamClient;',
    ['TeamClient.prototype.getChannelMembers = async function (teamId, channelId) {', '  const res = await this.http.get(this.serviceUrl + \'/v3/teams/\' + teamId + \'/channels/\' + channelId + \'/members\');', '  return res.data.members;', '};', '', 'exports.TeamClient = TeamClient;'].join('\n')
  )
  replaceOnce(
    join(packageDirectory, 'dist/clients/team.mjs'),
    'export { TeamClient };',
    ['TeamClient.prototype.getChannelMembers = async function (teamId, channelId) {', '  const res = await this.http.get(this.serviceUrl + \'/v3/teams/\' + teamId + \'/channels/\' + channelId + \'/members\');', '  return res.data.members;', '};', '', 'export { TeamClient };'].join('\n')
  )
  replaceOnce(
    join(packageDirectory, 'dist/clients/index.js'),
    'exports.Client = Client;',
    ['Client.prototype.createDiagnosticsScope = function (name) {', '  return { name };', '};', '', 'exports.Client = Client;'].join('\n')
  )
  replaceOnce(
    join(packageDirectory, 'dist/clients/index.mjs'),
    'export { Client };',
    ['Client.prototype.createDiagnosticsScope = function (name) {', '  return { name };', '};', '', 'export { Client };'].join('\n')
  )
  writeFileSync(join(packageDirectory, 'dist/test-only-diagnostics.d.ts'), ['/**', ' * Added solely to verify that unrelated upstream additions are classified as no-action.', ' */', 'declare class TestOnlyDiagnostics {', '    readonly marker: string;', '}', '', 'export { TestOnlyDiagnostics };', ''].join('\n'))
  writeFileSync(join(packageDirectory, 'dist/test-only-diagnostics.js'), ['class TestOnlyDiagnostics {', '  marker = \'teams-api-drift-test-fixture\'', '}', '', 'export { TestOnlyDiagnostics }', ''].join('\n'))
  writeFileSync(join(packageDirectory, 'dist/index.d.ts'), `${readFileSync(join(packageDirectory, 'dist/index.d.ts'), 'utf8')}\nexport { TestOnlyDiagnostics } from './test-only-diagnostics.js';\n`)
  writeFileSync(join(packageDirectory, 'dist/index.js'), `${readFileSync(join(packageDirectory, 'dist/index.js'), 'utf8')}\nexport { TestOnlyDiagnostics } from './test-only-diagnostics.js';\n`)

  const tarballPath = packPackage(packageDirectory, outputDirectory)
  rmSync(packageDirectory, { recursive: true, force: true })
  rmSync(join(outputDirectory, '.npm-cache'), { recursive: true, force: true })
  const registryPlaceholder = 'http://localhost:4873'
  writeFileSync(join(outputDirectory, 'README.md'), `# teams.api drift-test package\n\nThis directory was generated from the installed ${dependency}@2.0.13 package.\n\n- Package: \`${dependency}\`\n- Version: \`${fixtureVersion}\`\n- Tarball: \`${basename(tarballPath)}\`\n\nControlled declaration changes:\n\n- **blocking:** removes \`ChannelData.meeting\`, which the extension reads.\n- **required:** changes \`MessagingExtensionAction.botActivityPreview\` from \`Activity[]\` to \`string\`.\n- **review:** adds \`@deprecated\` to the consumed \`ChannelInfo\` type.\n- **no-action:** adds unconsumed \`TestOnlyDiagnostics\`.\n- **feature-review:** adds \`TeamClient.getChannelMembers\`, mapped to the extension's channels capability.\n- **internal implementation opportunity:** adds \`Client.createDiagnosticsScope\`, mapped to the extension's internal Teams API client capability.\n\nPublish only to your local test registry, for example:\n\n\`npm publish ./${basename(tarballPath)} --tag test --registry ${registryPlaceholder}\`\n\nDo not publish this fixture to npm or a shared registry.\n`)
  console.log(`Created ${dependency}@${fixtureVersion}: ${tarballPath}`)
}

main()
