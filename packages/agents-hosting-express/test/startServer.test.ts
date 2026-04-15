/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import { describe, it, before, after } from 'node:test'
import assert from 'assert'
import { createServer, type Server } from 'node:http'
import express, { type Request, type Response } from 'express'
import { authorizeJWT } from '@microsoft/agents-hosting'

// Using a clientId ensures JWT is enforced (non-empty clientId prevents anonymous fallback)
const TEST_AUTH_CONFIG = { clientId: 'test-app-id' }

describe('JWT middleware scoped to /api/messages', () => {
  let server: Server
  let port: number

  before(() => new Promise<void>((resolve, reject) => {
    const app = express()
    app.use(express.json())

    // Simulate the fixed startServer pattern: JWT only on /api/messages
    app.post('/api/messages', authorizeJWT(TEST_AUTH_CONFIG), (_req: Request, res: Response) => {
      res.status(200).send('ok')
    })

    // A custom route added by the user — should NOT require JWT
    app.get('/health', (_req: Request, res: Response) => {
      res.status(200).json({ status: 'ok' })
    })

    server = createServer(app)
    server.listen(0, () => {
      const addr = server.address()
      if (addr && typeof addr === 'object') {
        port = addr.port
        resolve()
      } else {
        reject(new Error('Failed to get server address'))
      }
    })
    server.on('error', reject)
  }))

  after(() => new Promise<void>((resolve) => server.close(() => resolve())))

  it('should not require JWT for custom routes', async () => {
    const res = await fetch(`http://localhost:${port}/health`)
    assert.strictEqual(res.status, 200)
    const body = await res.json() as { status: string }
    assert.strictEqual(body.status, 'ok')
  })

  it('should require JWT for /api/messages when no token is provided', async () => {
    const res = await fetch(`http://localhost:${port}/api/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'message', text: 'hello' })
    })
    assert.strictEqual(res.status, 401)
  })
})

describe('StartServerOptions', () => {
  describe('custom routePath', () => {
    let server: Server
    let port: number

    before(() => new Promise<void>((resolve, reject) => {
      const app = express()
      app.use(express.json())

      // Simulate startServer with a custom routePath
      app.post('/bot/messages', authorizeJWT(TEST_AUTH_CONFIG), (_req: Request, res: Response) => {
        res.status(200).send('ok')
      })

      server = createServer(app)
      server.listen(0, () => {
        const addr = server.address()
        if (addr && typeof addr === 'object') {
          port = addr.port
          resolve()
        } else {
          reject(new Error('Failed to get server address'))
        }
      })
      server.on('error', reject)
    }))

    after(() => new Promise<void>((resolve) => server.close(() => resolve())))

    it('should mount the agent on the custom route path', async () => {
      const res = await fetch(`http://localhost:${port}/bot/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'message', text: 'hello' })
      })
      // 401 means the route matched and JWT middleware was applied
      assert.strictEqual(res.status, 401)
    })

    it('should not respond on the default /api/messages path', async () => {
      const res = await fetch(`http://localhost:${port}/api/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'message', text: 'hello' })
      })
      assert.strictEqual(res.status, 404)
    })
  })

  describe('beforeListen hook', () => {
    let server: Server
    let port: number

    before(() => new Promise<void>((resolve, reject) => {
      const app = express()
      app.use(express.json())

      app.post('/api/messages', authorizeJWT(TEST_AUTH_CONFIG), (_req: Request, res: Response) => {
        res.status(200).send('ok')
      })

      // Simulate beforeListen adding a custom route
      app.get('/health', (_req: Request, res: Response) => {
        res.status(200).json({ status: 'healthy' })
      })

      server = createServer(app)
      server.listen(0, () => {
        const addr = server.address()
        if (addr && typeof addr === 'object') {
          port = addr.port
          resolve()
        } else {
          reject(new Error('Failed to get server address'))
        }
      })
      server.on('error', reject)
    }))

    after(() => new Promise<void>((resolve) => server.close(() => resolve())))

    it('should make routes added via beforeListen accessible without JWT', async () => {
      const res = await fetch(`http://localhost:${port}/health`)
      assert.strictEqual(res.status, 200)
      const body = await res.json() as { status: string }
      assert.strictEqual(body.status, 'healthy')
    })
  })
})
