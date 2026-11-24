// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { scenarioHeader } from '../_coordinator/navigation.js'
import type { Mode } from '../agent.js'
import { AgentApplication, CardFactory, MemoryStorage, MessageFactory, type CloudAdapter, type TurnContext } from '@microsoft/agents-hosting'
import { TeamsAgentExtension } from '@microsoft/agents-hosting-extensions-msteams'
import type { TaskModuleResponse } from '@microsoft/teams.api'
import { interactionData, record, TeamsInteractions } from './interaction.js'

function message (value: string): TaskModuleResponse {
  return { task: { type: 'message', value } }
}

const expired = 'This form has expired or belongs to another session. Open a new form from the scenario card.'

function formDialog (title: string, field: string, label: string, task: string, token: string, nextLabel = 'Submit', back = false): TaskModuleResponse {
  return {
    task: {
      type: 'continue',
      value: {
        title,
        height: 'small',
        width: 'small',
        card: {
          contentType: 'application/vnd.microsoft.card.adaptive',
          content: {
            type: 'AdaptiveCard',
            version: '1.4',
            body: [{ type: 'Input.Text', id: field, label, isRequired: true, maxLength: 80 }],
            actions: [
              { type: 'Action.Submit', title: nextLabel, data: { task, sampleOwner: 'teams-tasks', token } },
              ...(back ? [{ type: 'Action.Submit', title: 'Back to step 1', associatedInputs: 'none', data: { task: 'sample-multi-back', sampleOwner: 'teams-tasks', token } }] : [])
            ]
          }
        }
      }
    }
  }
}

function validInput (value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= 80
}

export function ownsTeamsTask (context: TurnContext): boolean {
  return context.activity.channelId === 'msteams' &&
    ['task/fetch', 'task/submit'].includes(context.activity.name ?? '') &&
    interactionData(context).sampleOwner === 'teams-tasks'
}

export function createTeamsTaskAgent (adapter: CloudAdapter, mode: Mode) {
  const interactions = new TeamsInteractions()
  const secondStep = new TeamsInteractions()
  const app = new AgentApplication({ adapter, storage: new MemoryStorage() })
  const teams = new TeamsAgentExtension(app)
  app.registerExtension(teams, extension => {
    extension.taskModules
      .onFetch(/^(sample-form|sample-multi-form)$/, async context => {
        const { task, token } = interactionData(context)
        if (!interactions.accepts(context) || typeof token !== 'string') {
          return message(expired)
        }
        secondStep.clear(context)
        return task === 'sample-form'
          ? formDialog('Sample form', 'name', 'Your name', 'sample-form', token)
          : formDialog('Step 1 of 2', 'name', 'Sample name', 'sample-multi-form', token, 'Next')
      })
      .onSubmit('sample-form', async (context, _state, request) => {
        if (!interactions.accepts(context)) {
          return message(expired)
        }
        if (!validInput(record(request.data).name)) {
          return message('Enter a name of 1–80 characters. Open the form to retry.')
        }
        interactions.clear(context)
        secondStep.clear(context)
        return message('Form submitted successfully.')
      })
      .onSubmit('sample-multi-form', async (context, _state, request) => {
        if (!interactions.accepts(context)) {
          return message(expired)
        }
        if (!validInput(record(request.data).name)) {
          return message('Enter a sample name of 1–80 characters. Open the form to retry.')
        }
        const token = secondStep.issue(context)
        if (!token) {
          return message(expired)
        }
        return formDialog('Step 2 of 2', 'email', 'Sample email address', 'sample-multi-finish', token, 'Submit', true)
      })
      .onSubmit('sample-multi-back', async context => {
        if (!secondStep.accepts(context)) {
          return message(expired)
        }
        secondStep.clear(context)
        const token = interactions.issue(context)
        return token ? formDialog('Step 1 of 2', 'name', 'Sample name', 'sample-multi-form', token, 'Next') : message(expired)
      })
      .onSubmit('sample-multi-finish', async (context, _state, request) => {
        if (!secondStep.accepts(context)) {
          return message(expired)
        }
        const { email } = record(request.data)
        if (typeof email !== 'string' || email.length > 80 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
          return message('Enter a sample email address of up to 80 characters. Open the form to retry.')
        }
        interactions.clear(context)
        secondStep.clear(context)
        return message('Both form steps submitted successfully.')
      })
  })

  async function showForm (context: TurnContext): Promise<void> {
    secondStep.clear(context)
    const token = interactions.issue(context)
    if (!token) {
      await context.sendActivity('A user and conversation are required to open this form.')
      return
    }
    await context.sendActivity(MessageFactory.attachment(CardFactory.adaptiveCard({
      type: 'AdaptiveCard',
      version: '1.4',
      body: [
        scenarioHeader(mode, 'teams-tasks', 'Teams task modules'),
        { type: 'TextBlock', text: 'Try a simple or multi-step form in Teams.', wrap: true },
        {
          type: 'ActionSet',
          actions: [
            { type: 'Action.Submit', title: 'Open form', data: { msteams: { type: 'task/fetch' }, task: 'sample-form', sampleOwner: 'teams-tasks', token } },
            { type: 'Action.Submit', title: 'Multi-step form', data: { msteams: { type: 'task/fetch' }, task: 'sample-multi-form', sampleOwner: 'teams-tasks', token } }
          ]
        }
      ]
    })))
  }
  app.onActivity('message', showForm)

  return {
    showIntroduction: showForm,
    async onExit (context: TurnContext): Promise<void> {
      interactions.clear(context)
      secondStep.clear(context)
    },
    async run (context: TurnContext): Promise<void> {
      if (context.activity.channelId !== 'msteams') {
        await context.sendActivity('Open this sample in Microsoft Teams to test the form.')
        return
      }
      await app.run(context)
    }
  }
}
