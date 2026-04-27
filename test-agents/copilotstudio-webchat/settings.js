/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */
// Flag to enable debug mode, which will store the debug information in localStorage.
// Copilot Studio Client uses the "debug" library for logging (https://github.com/debug-js/debug?tab=readme-ov-file#browser-support).
window.localStorage.debug = 'copilot-studio:*,agents:telemetry:*,test:*'
// window.localStorage.setItem('DEBUG', 'copilot-studio:*,agents:telemetry:*')

import { ConnectionSettings, getCopilotStudioConnectionUrl } from '@microsoft/agents-copilotstudio-client'

getCopilotStudioConnectionUrl()

export class SampleConnectionSettings extends ConnectionSettings {
  constructor () {
    super({
      environmentId: 'Default-367c5af9-6300-4248-99bc-72288021c775',
      // Schema Name of the Copilot Studio App (required if directConnectUrl is empty).
      schemaName: 'cre98_echoBot',
      // URL used to connect to the Copilot Studio service (use this OR environmentId + schemaName).
      directConnectUrl: '',
      // Cloud hosting the Power Platform Services. Default value is "Prod". Set to "Other" when using customPowerPlatformCloud.
      cloud: '',
      // Power Platform API endpoint to use if Cloud is configured as "Other".
      customPowerPlatformCloud: '',
      // Type of Copilot Studio Agent (Published or Prebuilt). Default value is "Published".
      copilotAgentType: '',
      // Flag to use the "x-ms-d2e-experimental" header URL on subsequent calls to the Copilot Studio service.
      useExperimentalEndpoint: false
    })
    this.appClientId = 'eeb240dc-529c-49c1-9b6d-1a4f9de26a4e'
    // Tenant ID of the App Registration used to log in; must match the Copilot's tenant.
    this.tenantId = '367c5af9-6300-4248-99bc-72288021c775'
    // Authority endpoint for the Azure AD login. Default is 'https://login.microsoftonline.com'.
    this.authority = ''
  }
}
