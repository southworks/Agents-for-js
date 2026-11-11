import { startServer } from '@microsoft/agents-hosting-express'
import { AgentApplication, MemoryStorage, TurnContext, TurnState } from '@microsoft/agents-hosting'

const echo = new AgentApplication<TurnState>({ storage: new MemoryStorage() })
// Keep the default handler so emitStackTrace controls outbound diagnostics.
echo.onMessage('/error', async () => {
  // Invalid JSON produces a real exception and stack for manual testing.
  JSON.parse('Intentional echo sample error')
})

echo.onConversationUpdate('membersAdded', async (context: TurnContext) => {
  await context.sendActivity('Welcome to Echo. Send a message to echo it, or /error to test default error handling.')
})
echo.onActivity('message', async (context: TurnContext, state: TurnState) => {
  let counter: number = state.getValue('conversation.counter') || 0
  await context.sendActivity(`[${counter++}]You said: ${context.activity.text}`)
  state.setValue('conversation.counter', counter)
})

startServer(echo)
