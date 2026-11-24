// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { AgentApplication, CardFactory, M365AttachmentDownloader, MemoryStorage, MessageFactory, type CloudAdapter, type InputFile, type TurnContext } from '@microsoft/agents-hosting'

export function createTeamsAttachmentAgent (adapter: CloudAdapter) {
  const app = new AgentApplication({
    adapter,
    storage: new MemoryStorage(),
    fileDownloaders: [new M365AttachmentDownloader('storedFiles')]
  })

  app.onActivity('message', async (context, state) => {
    const files = (state.getValue('storedFiles') as InputFile[] | undefined) ?? []
    const candidates = context.activity.attachments?.filter(attachment =>
      attachment.contentType && !attachment.contentType.startsWith('text/html')
    ) ?? []
    let guidance = 'Files are held only for this turn.'
    if (candidates.length === 0) {
      guidance = 'Attach a file in this Teams personal chat to test the download.'
    } else if (files.length < candidates.length) {
      guidance = 'Some attachments could not be downloaded. Check file access, channel credentials, and outbound URL policy, then retry.'
    }

    await context.sendActivity(MessageFactory.attachment(CardFactory.adaptiveCard({
      type: 'AdaptiveCard',
      version: '1.3',
      body: [
        { type: 'TextBlock', text: 'Teams attachments', isSubtle: true, size: 'Small' },
        { type: 'TextBlock', text: `Downloaded ${files.length} file(s)`, weight: 'Bolder', wrap: true },
        { type: 'TextBlock', text: guidance, wrap: true }
      ]
    })))
  })

  return {
    async run (context: TurnContext): Promise<void> {
      if (context.activity.type !== 'message') {
        return
      }
      if (context.activity.channelId !== 'msteams' || context.activity.conversation?.conversationType !== 'personal') {
        await context.sendActivity('Use Teams attachments in a Teams personal chat. Playground and group/channel uploads do not validate this sample.')
        return
      }

      try {
        await app.run(context)
      } catch {
        await context.sendActivity('The Teams attachment download could not run. Check channel credentials and file access, then retry. Use samples/SCENARIOS.md for setup.')
      }
    }
  }
}
