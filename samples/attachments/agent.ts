// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Activity } from '@microsoft/agents-activity'
import { AgentApplication, AttachmentDownloader, CardFactory, CloudAdapter, MessageFactory, MemoryStorage, MsalConnectionManager, TurnContext } from '@microsoft/agents-hosting'

const sampleUrl = 'https://raw.githubusercontent.com/microsoft/AdaptiveCards/main/assets/adaptive-card-50.png'

function sampleResult (outcome: string, guidance?: string, preview?: string) {
  const body: object[] = [
    {
      type: 'TextBlock',
      text: 'Generic attachments · Sample test',
      size: 'Small',
      isSubtle: true,
      wrap: true
    },
    { type: 'TextBlock', text: outcome, weight: 'Bolder', wrap: true }
  ]

  if (guidance) {
    body.push({ type: 'TextBlock', text: guidance, wrap: true })
  }

  if (preview) {
    body.push({
      type: 'Image',
      url: preview,
      altText: 'Downloaded Adaptive Cards sample image',
      size: 'Medium',
      horizontalAlignment: 'Left'
    })
  }

  const card = CardFactory.adaptiveCard({ type: 'AdaptiveCard', version: '1.3', body })
  return MessageFactory.attachment(card)
}

export function createAttachmentAgent (adapter: CloudAdapter) {
  // The public fixture must not receive the channel's bearer token. This adapter
  // is used only as download context; all chat replies use the inbound context.
  const publicAdapter = new CloudAdapter()
  publicAdapter.connectionManager = new MsalConnectionManager(new Map([['serviceConnection', {}]]))
  const sampleDownloader = new AttachmentDownloader()
  const agent = new AgentApplication({
    adapter,
    storage: new MemoryStorage(),
    fileDownloaders: [new AttachmentDownloader('storedFiles')]
  })

  agent.onActivity('message', async (context, state) => {
    const files = (state.getValue('storedFiles') as unknown[] | undefined) ?? []
    await context.sendActivity(`Downloaded ${files.length} file(s). Files are held only for this turn.`)
  })

  async function testSampleAttachment (context: TurnContext): Promise<void> {
    try {
      const activity = Activity.fromObject({
        ...context.activity,
        value: undefined,
        serviceUrl: sampleUrl,
        attachments: [{ name: 'adaptive-card-50.png', contentType: 'image/png', contentUrl: sampleUrl }]
      })
      const downloadContext = new TurnContext(publicAdapter, activity, { aud: 'public-attachment-sample' })
      const files = await sampleDownloader.downloadFiles(downloadContext)
      const downloadedImage = files[0]

      if (files.length !== 1 || downloadedImage.content.length === 0) {
        await context.sendActivity(sampleResult(
          'Download failed',
          'The sample file was not downloaded. Check network access and the outbound URL policy, then retry.'
        ))
        return
      }

      const preview = `data:image/png;base64,${downloadedImage.content.toString('base64')}`
      await context.sendActivity(sampleResult('Downloaded 1 file', undefined, preview))
    } catch {
      await context.sendActivity(sampleResult('Download failed', 'Check access to the public sample URL and the outbound URL policy, then retry. Use samples/SCENARIOS.md for details.'))
    }
  }

  return {
    async run (context: TurnContext): Promise<void> {
      const isSampleRequest = context.activity.type === 'message' &&
        context.activity.text?.trim() === 'test-sample-attachment'

      if (isSampleRequest) {
        await testSampleAttachment(context)
        return
      }

      try {
        await agent.run(context)
      } catch {
        await context.sendActivity('Attachment download failed. Check that the attachment is available and the channel credentials and outbound URL policy allow it. Use samples/SCENARIOS.md for guidance.')
      }
    }
  }
}
