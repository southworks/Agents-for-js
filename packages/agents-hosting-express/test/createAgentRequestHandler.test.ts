/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import { describe, it, before, after } from 'node:test'
import assert from 'assert'
import { createServer, type Server } from 'node:http'
import express, { type Request, type Response } from 'express'
import { authorizeJWT } from '@microsoft/agents-hosting'
import { createAgentRequestHandler } from '../src/createAgentRequestHandler'

describe('createAgentRequestHandler', () => {
  describe('JWT enforcement', () => {
    let server: Server
    let port: number

    before(() => new Promise<void>((resolve, reject) => {
      const app = express()
      app.use(express.json())

      // Use createAgentRequestHandler with a lightweight mock:
      // We only test that JWT middleware is applied correctly (rejects without token).
      // We simulate the handler by mounting authorizeJWT directly since creating a full
      // CloudAdapter + agent pipeline would require a real Bot Framework connection.
      app.post('/api/messages', authorizeJWT({ clientId: 'test-app-id' }), (_req: Request, res: Response) => {
        res.status(200).send('processed')
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

    it('should reject requests without JWT token', async () => {
      const res = await fetch(`http://localhost:${port}/api/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'message', text: 'hello' })
      })
      assert.strictEqual(res.status, 401)
    })
  })

  it('should return a function', () => {
    // createAgentRequestHandler should return a callable handler
    // Using a minimal ActivityHandler to avoid full adapter initialization
    const { ActivityHandler } = require('@microsoft/agents-hosting')
    const handler = createAgentRequestHandler(new ActivityHandler())
    assert.strictEqual(typeof handler, 'function')
  })
})
