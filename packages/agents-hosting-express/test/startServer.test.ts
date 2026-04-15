/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import { describe, it, before, after } from 'node:test'
import assert from 'assert'
import { createServer, type Server } from 'node:http'
import express, { type Request, type Response } from 'express'
import { ActivityHandler, authorizeJWT, CloudAdapter } from '@microsoft/agents-hosting'
import { createAgentRequestHandler, createCloudAdapter, startServer, type StartServerOptions } from '../src/index.js'

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

describe('createCloudAdapter', () => {
  it('returns a CloudAdapter for an ActivityHandler', () => {
    const handler = new ActivityHandler()
    const adapter = createCloudAdapter(handler)
    assert.ok(adapter instanceof CloudAdapter)
  })
})

describe('createAgentRequestHandler', () => {
  let server: Server
  let port: number

  before(() => new Promise<void>((resolve, reject) => {
    const handler = new ActivityHandler()
    const app = express()
    app.use(express.json())

    app.get('/health', (_req: Request, res: Response) => {
      res.status(200).json({ status: 'ok' })
    })

    // Use createAgentRequestHandler — JWT should only apply to this route
    app.post('/api/messages', createAgentRequestHandler(handler, TEST_AUTH_CONFIG))

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

  it('does not apply JWT to unrelated routes', async () => {
    const res = await fetch(`http://localhost:${port}/health`)
    assert.strictEqual(res.status, 200)
  })

  it('returns 401 for /api/messages without a token', async () => {
    const res = await fetch(`http://localhost:${port}/api/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'message', text: 'hello' })
    })
    assert.strictEqual(res.status, 401)
  })
})

describe('startServer options object', () => {
  let server: ReturnType<typeof startServer>

  before(() => new Promise<void>((resolve, reject) => {
    const handler = new ActivityHandler()
    // Pick a random free port by listening on 0 first
    const probe = createServer()
    probe.listen(0, () => {
      const addr = probe.address()
      if (!addr || typeof addr !== 'object') {
        reject(new Error('Failed to get probe address'))
        return
      }
      const port = addr.port
      probe.close(() => {
        server = startServer(handler, {
          authConfig: TEST_AUTH_CONFIG,
          port,
          routePath: '/api/messages',
          beforeListen: (app) => {
            app.get('/health', (_req, res) => res.status(200).json({ status: 'ok' }))
          }
        })
        server.httpServer.once('listening', resolve)
        server.httpServer.once('error', reject)
      })
    })
    probe.on('error', reject)
  }))

  after(() => new Promise<void>((resolve) => server.httpServer.close(() => resolve())))

  it('serves the beforeListen route without JWT', async () => {
    const addr = server.httpServer.address()
    assert.ok(addr && typeof addr === 'object', 'server should be listening')
    const port = addr.port
    const res = await fetch(`http://localhost:${port}/health`)
    assert.strictEqual(res.status, 200)
    const body = await res.json() as { status: string }
    assert.strictEqual(body.status, 'ok')
  })

  it('requires JWT for the agent route', async () => {
    const addr = server.httpServer.address()
    assert.ok(addr && typeof addr === 'object')
    const port = addr.port
    const res = await fetch(`http://localhost:${port}/api/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'message', text: 'hello' })
    })
    assert.strictEqual(res.status, 401)
  })

  it('returns 404 for an unregistered route', async () => {
    const addr = server.httpServer.address()
    assert.ok(addr && typeof addr === 'object')
    const port = addr.port
    const res = await fetch(`http://localhost:${port}/nonexistent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'message', text: 'hello' })
    })
    assert.strictEqual(res.status, 404)
  })

  it('exposes StartServerOptions type (compile-time check)', () => {
    const opts: StartServerOptions = {
      authConfig: TEST_AUTH_CONFIG,
      port: 4000,
      routePath: '/custom',
      beforeListen: (_app) => {}
    }
    assert.ok(typeof opts.beforeListen === 'function')
  })
})

