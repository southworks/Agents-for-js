import { strict as assert } from 'node:assert'
import http from 'node:http'
import { describe, it } from 'node:test'
import { HttpClient } from '../../src'

describe('HttpClient', () => {
  it('merges content-type headers without sending duplicates', async () => {
    let requestHeaders: http.IncomingHttpHeaders | undefined
    let requestBody = ''

    const server = http.createServer((req, res) => {
      requestHeaders = req.headers
      req.setEncoding('utf8')
      req.on('data', (chunk) => {
        requestBody += chunk
      })
      req.on('end', () => {
        res.writeHead(200, { 'content-type': 'application/json' })
        res.end('{"ok":true}')
      })
    })

    await new Promise<void>((resolve) => {
      server.listen(0, resolve)
    })

    const port = (server.address() as http.AddressInfo).port
    const client = new HttpClient({
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer test-token'
      }
    })

    try {
      await client.post(`http://127.0.0.1:${port}/activities`, { text: 'hello' }, {
        headers: {
          'Content-Type': 'application/json'
        }
      })
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error)
            return
          }
          resolve()
        })
      })
    }

    assert.strictEqual(requestHeaders?.['content-type'], 'application/json')
    assert.strictEqual(requestBody, '{"text":"hello"}')
  })
})
