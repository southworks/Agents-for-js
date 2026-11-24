// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { ActivityHandler, AttachmentDownloader, CloudAdapter, createOutboundHostValidator, MessageFactory, MsalConnectionManager, TurnContext } from '@microsoft/agents-hosting'
import { Activity, ActivityTypes, Attachment, EndOfConversationCodes } from '@microsoft/agents-activity'
import path from 'node:path'
import { readFileSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'

export class MultiFeatureHandler extends ActivityHandler {
  private readonly downloader = new AttachmentDownloader(undefined, createOutboundHostValidator({ enabled: true }))
  private readonly downloadAdapter = new CloudAdapter()

  constructor () {
    super()
    // Compat downloads are anonymous. Never forward the bot token to an attachment URL.
    this.downloadAdapter.connectionManager = new MsalConnectionManager(new Map([['anonymous', {}]]))

    this.onMessage(async (context, next) => {
      const attachments = context.activity.attachments?.filter(attachment => !attachment.contentType.startsWith('text/html')) ?? []
      if (attachments.length > 0) {
        await this.saveAttachments(context, attachments)
      } else if (context.activity.text?.trim()) {
        switch (context.activity.text.trim().toLowerCase()) {
          case 'end':
          case 'stop':
            await context.sendActivity(Activity.fromObject({
              type: ActivityTypes.EndOfConversation,
              code: EndOfConversationCodes.CompletedSuccessfully
            }))
            break
          case 'wait':
            await context.sendActivities([
              Activity.fromObject({ type: ActivityTypes.Typing }),
              Activity.fromObject({ type: 'delay', value: 3000 }),
              Activity.fromObject({ type: ActivityTypes.Message, text: 'Finished typing' })
            ])
            break
          case '1':
          case '2':
            // Since no attachment was received, send an attachment to the user.
            await this.handleOutgoingAttachment(context)
            break
          default:
            await context.sendActivity(MessageFactory.text('Choose an attachment action or upload a file.'))
        }
      } else {
        await context.sendActivity('Choose an attachment action or upload a supported file.')
      }

      await next()
    })

    this.onReactionsAdded(async (context) => {
      await Promise.all((context.activity.reactionsAdded ?? []).map(async reaction => {
        if (context.activity.replyToId !== undefined) {
          const newReaction = `You reacted with '${reaction.type}' to the following message: '${context.activity.replyToId}'`
          await context.sendActivity(newReaction)
        }
      }))
    })

    this.onReactionsRemoved(async (context) => {
      await Promise.all((context.activity.reactionsRemoved ?? []).map(async reaction => {
        if (context.activity.replyToId !== undefined) {
          const newReaction = `You removed the reaction '${reaction.type}' from the message: '${context.activity.replyToId}'`
          await context.sendActivity(newReaction)
        }
      }))
    })

    this.onInstallationUpdateAdd(async (context, next) => {
      const installationText = 'Hi I\'m the multi feature demo agent. This message is being sent because I was installed'
      if (context.activity.conversation?.conversationType !== undefined && context.activity.conversation.conversationType !== 'personal') {
        if (context.activity.conversation.conversationType === 'channel') {
          const channelName: string = (context.activity.channelData as { team: { name: string } }).team.name
          await context.sendActivity(MessageFactory.text(`${installationText} and configured in the ${channelName} channel`))
        } else {
          if (context.activity.conversation.conversationType === 'groupChat') {
            const groupChatName: string = context.activity.conversation.name ?? 'group chat'
            await context.sendActivity(MessageFactory.text(`${installationText} and configured in this group ${groupChatName}`))
          }
        }
      } else {
        await context.sendActivity(MessageFactory.text(`${installationText} here.`))
      }
      await next()
    })

    this.onInstallationUpdateRemove(async (context, next) => {
      if ((context.activity.conversation != null) && context.activity.conversation.conversationType !== 'personal') {
        return
      } else {
        await context.sendActivity(MessageFactory.text('You uninstalled the multi feature demo agent.'))
      }
      await next()
    })

    this.onEndOfConversation(async (context, next) => {
      // This will be called if the root agent is ending the conversation.  Sending additional messages should be
      // avoided as the conversation may have been deleted.
      // Perform cleanup of resources if needed.

      // By calling next() you ensure that the next Handler is run.
      await next()
    })

    this.onTyping(async (context, next) => {
      const typingMessageText = 'You are typing a message'
      await context.sendActivity(MessageFactory.text(typingMessageText))

      await next()
    })

    this.onMessageUpdate(async (context, next) => {
      const updatedMessageText = 'You updated the message'
      await context.sendActivity(MessageFactory.text(updatedMessageText))
      await next()
    })

    this.onConversationUpdate(async (context, next) => {
      const convMessageText = 'The conversation has been updated'
      await context.sendActivity(MessageFactory.text(convMessageText))
      await next()
    })

    this.onMessageDelete(async (context, next) => {
      const deletedMessageText = 'You deleted the message'
      await context.sendActivity(MessageFactory.text(deletedMessageText))
      await next()
    })
  }

  private async saveAttachments (context: TurnContext, attachments: Attachment[]): Promise<void> {
    const directory = path.join(import.meta.dirname, '../.attachments')
    await mkdir(directory, { recursive: true })
    for (const attachment of attachments) {
      const name = attachment.name && path.basename(attachment.name)
      if (!name || !attachment.contentUrl) {
        await context.sendActivity('This attachment is missing a file name or download URL. Upload the file again.')
        continue
      }

      try {
        const activity = Activity.fromObject({ serviceUrl: attachment.contentUrl, attachments: [attachment], type: 'message' })
        const downloadContext = new TurnContext(this.downloadAdapter, activity, { aud: 'compat-attachments' })
        const [file] = await this.downloader.downloadFiles(downloadContext)
        if (!file) {
          await context.sendActivity(`Could not download "${name}". Check file access and the outbound URL policy.`)
          continue
        }
        const filename = `${randomUUID()}-${name}`
        await writeFile(path.join(directory, filename), file.content, { flag: 'wx' })
        await context.sendActivity(`Saved the attachment as "${filename}" in samples/.attachments/.`)
      } catch {
        await context.sendActivity(`Could not save "${name}". Check file access and the sample directory permissions, then retry.`)
      }
    }
  }

  async handleOutgoingAttachment (turnContext: TurnContext): Promise<void> {
    const reply: Activity = new Activity(ActivityTypes.Message)

    if (turnContext.activity.text === undefined) {
      return
    }

    // Look at the user input, and figure out what type of attachment to send.
    // If the input matches one of the available choices, populate reply with
    // the available attachments.
    // If the choice does not match with a valid choice, inform the user of
    // possible options.
    const firstChar = turnContext.activity.text[0]
    if (firstChar === '1') {
      reply.text = 'This is an inline attachment.'
      reply.attachments = [this.getInlineAttachment()]
    } else if (firstChar === '2') {
      reply.attachments = [this.getInternetAttachment()]
      reply.text = 'This is an internet attachment.'
    } else {
      // The user did not enter input that this agent was built to handle.
      reply.text = 'Choose an attachment action or upload a file.'
    }
    await turnContext.sendActivity(reply)
  }

  getInlineAttachment (): Attachment {
    const imageData = readFileSync(path.join(import.meta.dirname, './../_resources/multi-agents.jpg'))
    const base64Image = Buffer.from(imageData).toString('base64')

    return {
      name: 'multi-agents.jpg',
      contentType: 'image/jpeg',
      contentUrl: `data:image/jpeg;base64,${base64Image}`
    }
  }

  getInternetAttachment (): Attachment {
    // NOTE: The contentUrl must be HTTPS.
    return {
      name: 'architecture-resize.png',
      contentType: 'image/png',
      contentUrl: 'https://docs.microsoft.com/en-us/bot-framework/media/how-it-works/architecture-resize.png'
    }
  }
}
