// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { randomBytes } from 'node:crypto'
import type { Express } from 'express'
import { readSetting } from '../_shared/config.js'

const triggerPath = '/samples/proactive'
const lifetimeMs = 2 * 60_000
const triggers = new Map<string, () => Promise<boolean>>()

export function createProactiveTrigger (send: () => Promise<boolean>, onRevoke: () => void) {
  const base = new URL(readSetting('SAMPLES_PROACTIVE_BASE_URL') || `http://localhost:${process.env.PORT || 3978}`)
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password) {
    throw new Error('Set SAMPLES_PROACTIVE_BASE_URL to an HTTP(S) address for the coordinator.')
  }

  const token = randomBytes(24).toString('hex')
  const revoke = () => {
    clearTimeout(expiry)
    if (triggers.delete(token)) {
      onRevoke()
    }
  }
  const expiry = setTimeout(revoke, lifetimeMs).unref()
  triggers.set(token, async () => {
    revoke()
    return send()
  })

  return { url: new URL(`${triggerPath}/${token}`, base.origin).href, revoke }
}

export function registerProactiveTriggerRoutes (server: Express): void {
  const path = `${triggerPath}/:token`

  server.get(path, (request, response) => {
    const nonce = randomBytes(16).toString('base64')
    response.set({
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
      'Content-Security-Policy': `default-src 'none'; script-src 'nonce-${nonce}'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'`
    })
    if (!triggers.has(request.params.token)) {
      response.status(410).type('text').send('This link has expired or was already used. Create a new link in chat.')
      return
    }

    response.type('html').send(`<!doctype html>
<html lang="en">
<meta charset="utf-8">
<title>Send a proactive message</title>
<form method="post"><button type="submit">Send proactive message</button></form>
<script nonce="${nonce}">document.forms[0].requestSubmit()</script>
</html>`)
  })

  server.post(path, async (request, response) => {
    response.set({ 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' }).type('text')
    const trigger = triggers.get(request.params.token)
    if (!trigger) {
      response.status(410).send('This link has expired or was already used. Create a new link in chat.')
      return
    }

    try {
      if (await trigger()) {
        response.send('Message sent. Return to chat to see it.')
        return
      }
      response.status(409).send('A proactive message is already pending. Return to chat and create a new link.')
    } catch {
      response.status(502).send('The message could not be delivered. Return to chat and try again.')
    }
  })
}
