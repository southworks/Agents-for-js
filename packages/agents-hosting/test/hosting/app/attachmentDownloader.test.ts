// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { strict as assert } from 'node:assert'
import { afterEach, describe, it } from 'node:test'
import sinon from 'sinon'
import {
  AttachmentDownloader,
  M365AttachmentDownloader,
  OutboundHostValidator
} from '../../../src'

describe('attachment downloader outbound host validation', () => {
  afterEach(() => sinon.restore())

  it('skips a disallowed generic attachment without issuing a request', async () => {
    const fetchStub = sinon.stub(globalThis, 'fetch')
    const downloader = new AttachmentDownloader(
      'inputFiles',
      new OutboundHostValidator({ enabled: true })
    )

    const result = await (downloader as any).downloadFile({
      contentType: 'application/octet-stream',
      contentUrl: 'https://evil.example.com/file'
    }, 'secret-token')

    assert.equal(result, undefined)
    sinon.assert.notCalled(fetchStub)
  })

  it('downloads an attachment from an allowed host using native fetch redirect handling', async () => {
    const fetchStub = sinon.stub(globalThis, 'fetch').resolves(new Response('contents', {
      status: 200,
      headers: { 'content-type': 'application/octet-stream' }
    }))
    const downloader = new AttachmentDownloader(
      'inputFiles',
      new OutboundHostValidator({ enabled: true, hosts: ['files.contoso.com'] })
    )

    const result = await (downloader as any).downloadFile({
      contentType: 'application/octet-stream',
      contentUrl: 'https://files.contoso.com/file'
    }, 'secret-token')

    assert.equal(result.content.toString(), 'contents')
    assert.equal(fetchStub.firstCall.args[1]?.redirect, undefined)
  })

  it('validates the actual M365 downloadUrl instead of contentUrl', async () => {
    const fetchStub = sinon.stub(globalThis, 'fetch')
    const downloader = new M365AttachmentDownloader(
      'inputFiles',
      new OutboundHostValidator({ enabled: true })
    )

    const result = await (downloader as any).downloadFile({
      contentType: 'application/octet-stream',
      contentUrl: 'https://graph.microsoft.com/attachment',
      content: { downloadUrl: 'https://evil.example.com/token-target' }
    })

    assert.equal(result, undefined)
    sinon.assert.notCalled(fetchStub)
  })

  it('preserves existing download behavior when validation is disabled', async () => {
    const fetchStub = sinon.stub(globalThis, 'fetch').resolves(new Response('contents', {
      status: 200,
      headers: { 'content-type': 'application/octet-stream' }
    }))
    const downloader = new M365AttachmentDownloader(
      'inputFiles',
      new OutboundHostValidator({ enabled: false })
    )

    const result = await (downloader as any).downloadFile({
      contentType: 'application/octet-stream',
      contentUrl: 'https://evil.example.com/attachment',
      content: { downloadUrl: 'https://evil.example.com/file' }
    })

    assert.equal(result.content.toString(), 'contents')
    sinon.assert.calledOnce(fetchStub)
    assert.equal(fetchStub.firstCall.args[1]?.redirect, undefined)
  })
})
