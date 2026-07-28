# teams.api drift-test package

This directory was generated from the installed @microsoft/teams.api@2.0.13 package.

- Package: `@microsoft/teams.api`
- Version: `2.0.14-test`
- Tarball: `microsoft-teams.api-2.0.14-test.tgz`

Controlled declaration changes:

- **blocking:** removes `ChannelData.meeting`, which the extension reads.
- **required:** changes `MessagingExtensionAction.botActivityPreview` from `Activity[]` to `string`.
- **review:** adds `@deprecated` to the consumed `ChannelInfo` type.
- **no-action:** adds unconsumed `TestOnlyDiagnostics`.
- **feature-review:** adds `TeamClient.getChannelMembers`, mapped to the extension's channels capability.
- **internal implementation opportunity:** adds `Client.createDiagnosticsScope`, mapped to the extension's internal Teams API client capability.

Publish only to your local test registry, for example:

`npm publish ./microsoft-teams.api-2.0.14-test.tgz --tag test --registry http://localhost:4873`

Do not publish this fixture to npm or a shared registry.
