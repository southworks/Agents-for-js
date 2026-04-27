/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

// import {
//   CopilotStudioClient,
//   CopilotStudioWebChat,
// } from '@microsoft/agents-copilotstudio-client'

// import { acquireToken } from './acquireToken.js'
// import { SampleConnectionSettings } from './settings.js'

window.localStorage.debug = 'copilot-studio:*,agents:telemetry:*,test:*'
// window.localStorage.setItem('DEBUG', 'copilot-studio:*,agents:telemetry:*')

import { ConnectionSettings, getCopilotStudioConnectionUrl } from '@microsoft/agents-copilotstudio-client'

getCopilotStudioConnectionUrl()

// try {
//   const settings = new SampleConnectionSettings()

//   if (!settings.appClientId) {
//     throw new Error('appClientId is required in settings.js')
//   }
//   if (!settings.tenantId) {
//     throw new Error('tenantId is required in settings.js')
//   }
//   if (!settings.authority) {
//     settings.authority = 'https://login.microsoftonline.com'
//   }
//   const token = await acquireToken(settings)
//   const client = new CopilotStudioClient(settings, token)

//   window.WebChat.renderWebChat(
//     {
//       directLine: CopilotStudioWebChat.createConnection(client, {
//         showTyping: true,
//       }),
//     },
//     document.getElementById('webchat')
//   )

//   document.querySelector('#webchat > *').focus()
// } catch (err) {
//   console.error('Failed to initialize:', err)
// }
