import { AuthConfiguration, authorizeJWT, CloudAdapter, loadAuthConfigFromEnv, Request } from '@microsoft/agents-hosting'
import express, { Response } from 'express'
import path from 'path'

const authConfig: AuthConfiguration = loadAuthConfigFromEnv()
const adapter = new CloudAdapter(authConfig)

const server = express()
server.use(express.json())
server.use(authorizeJWT(authConfig))

async function loadModule () {
  const moduleName = process.env.agentName || 'teamsApp'
  let module
  switch (moduleName) {
    case 'teamsApp':
      module = (await import('./teamsApp')).app
      return module
    case 'teamsMultiFeatureBot':
      module = (await import('./teamsMultiFeatureBot')).app
      return module
    default:
      throw new Error(`Agent with name ${moduleName} is not recognized.`)
  }
}

server.use(express.static(path.join(__dirname, '..', 'public')))

server.post('/api/messages', async (req: Request, res: Response) => {
  await adapter.process(req, res, async (context) => {
    const app = await loadModule()
    await app.run(context)
  })
})

server.get('/YouTube', (_req, res) => {
  const filePath = path.join(__dirname, '../pages/youtube.html')
  res.sendFile(filePath)
})

server.get('/CustomForm', (_req, res) => {
  const filePath = path.join(__dirname, '../pages/customForm.html')
  res.sendFile(filePath)
})

server.post('/CustomForm', (_req) => {
  console.log('Data is being sent to the teams handler when this endpoint is called by teams')
})

const port = process.env.PORT || 3978
server.listen(port, () => {
  console.log(`\nServer listening to port ${port} for appId ${authConfig.clientId} debug ${process.env.DEBUG}`)
})
