import { strict as assert } from 'node:assert'
import http from 'node:http'
import { describe, it } from 'node:test'
import { HttpClient, HttpError } from '../../src'

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

  it('does not include an undefined code in serialized HttpError output', () => {
    const error = new HttpError(
      'Request failed with status 415',
      {
        data: { error: 'unsupported media type' },
        status: 415,
        statusText: 'Unsupported Media Type',
        headers: new Headers(),
        config: {
          method: 'post',
          url: '/activities'
        }
      },
      {
        method: 'post',
        url: '/activities'
      }
    )

    assert.deepStrictEqual(error.toJSON(), {
      message: 'Request failed with status 415',
      status: 415,
      config: {
        url: '/activities',
        method: 'post',
        data: undefined,
      },
      response: {
        status: 415,
        statusText: 'Unsupported Media Type',
        data: { error: 'unsupported media type' },
      }
    })
  })
})
