// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import citationFixture from '../_resources/activityWithCitations.json'
import { getSessionKey } from '../_shared/sessionKey.js'
import { AgentApplication, MemoryStorage, type CloudAdapter, type TurnContext } from '@microsoft/agents-hosting'
import { Activity, addAIToActivity } from '@microsoft/agents-activity'

const chunkDelayMs = 400
const chunkCount = 5
const citations = [
  { title: 'Agents SDK', content: 'Microsoft 365 Agents SDK documentation', filepath: '', url: 'https://learn.microsoft.com/microsoft-365/agents-sdk/' },
  { title: 'Adaptive Cards', content: 'Adaptive Cards documentation', filepath: '', url: 'https://adaptivecards.io/' }
]

function pauseBetweenChunks (): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, chunkDelayMs))
}

export function createStreamingAgent (adapter: CloudAdapter) {
  const busy = new Set<string>()
  const app = new AgentApplication({ adapter, storage: new MemoryStorage() })

  app.onActivity('message', async context => {
    const shouldFail = context.activity.text?.trim() === 'stream-error'
    const response = context.streamingResponse
    response.setDelayInMs(200)
    response.setFeedbackLoop(true)
    response.setSensitivityLabel({ type: 'https://schema.org/Message', '@type': 'CreativeWork', name: 'Internal' })
    // This demonstrates the label; all content is deterministic, without a model.
    response.setGeneratedByAILabel(true)
    await response.queueInformativeUpdate('Preparing sample response…')

    try {
      for (let index = 1; index <= chunkCount; index++) {
        await pauseBetweenChunks()
        if (shouldFail && index === 3) {
          throw new Error('Intentional sample stream failure')
        }

        await response.queueTextChunk(`part [${index}] `)
      }

      await response.queueTextChunk('Stream complete. See [doc1] and [doc2].')
      response.setCitations(citations)
    } catch {
      await response.queueTextChunk('\n\nStream failed. Partial output is incomplete. Select Start stream to retry.')
    } finally {
      await response.endStream()
    }
  })

  return {
    async canExit (context: TurnContext): Promise<boolean> {
      const key = getSessionKey(context)
      return !key || !busy.has(key)
    },
    async run (context: TurnContext): Promise<void> {
      if (context.activity.type !== 'message') {
        return
      }

      const key = getSessionKey(context)
      if (!key) {
        return
      }
      if (busy.has(key)) {
        await context.sendActivity('A response is still streaming. Wait for it to finish.')
        return
      }

      const command = context.activity.text?.trim()
      if (command === 'webchat-citations') {
        const reply = Activity.fromObject(citationFixture)
        reply.text = 'Sample proxy documentation [1] [2] [3].\n\n' +
          '[1]: https://support.microsoft.com/en-us/windows/use-a-proxy-server-in-windows-03096c53-0554-4ffe-b6ab-8b1deee8dae1 "Use a proxy server in Windows"\n' +
          '[2]: https://learn.microsoft.com/en-us/troubleshoot/windows-server/networking/configure-proxy-server-settings "Configure proxy server settings"\n' +
          '[3]: cite:1 "Introduction Configuring proxy settings is a fundamental aspect..."'
        reply.textFormat = 'markdown'
        await context.sendActivity(reply)
        return
      }

      if (command === 'cited-reply') {
        const reply = Activity.fromObject({ type: 'message', text: 'See the Agents SDK [1] and Adaptive Cards [2] documentation.' })
        addAIToActivity(reply, citations.map((citation, index) => ({
          '@type': 'Claim',
          position: index + 1,
          appearance: {
            '@type': 'DigitalDocument',
            name: citation.title,
            abstract: citation.content,
            url: citation.url
          }
        })))
        await context.sendActivity(reply)
        return
      }

      if (command !== 'stream' && command !== 'stream-error') {
        await context.sendActivity('Select Start stream, Test failure, or Send cited reply.')
        return
      }
      busy.add(key)

      try {
        await app.run(context)
      } catch {
        await context.sendActivity('The stream could not finish. Check channel streaming support and retry Start stream. Use samples/SCENARIOS.md for guidance.')
      } finally {
        busy.delete(key)
      }
    }
  }
}
