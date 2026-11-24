// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { fork, type ChildProcess } from 'node:child_process'

/** Restart the complete sample process without loading its environment here. */
export async function runWithReload (entryPoint: string, args: string[]): Promise<void> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error('--reload requires an interactive terminal. Omit the flag for normal execution.')
  }

  await new Promise<void>((resolve, reject) => {
    let child: ChildProcess
    let restarting = false
    let stopping = false
    let listening = false
    let lastMode: string | undefined
    const originalRawMode = process.stdin.isRaw

    function releaseKeyboard () {
      if (!listening) {
        return
      }

      process.stdin.off('data', onKey)
      process.stdin.setRawMode(originalRawMode)
      process.stdin.pause()
      listening = false
    }

    function cleanup () {
      releaseKeyboard()
      process.off('SIGINT', stop)
      process.off('SIGTERM', stop)
    }

    function stop () {
      if (stopping) {
        return
      }

      stopping = true
      releaseKeyboard()
      child.kill()
    }

    function onKey (input: Buffer) {
      const key = input.toString()
      if (key === '\u0003') {
        stop()
        return
      }

      if (key.toLowerCase() !== 'r' || restarting || stopping) {
        return
      }

      restarting = true
      releaseKeyboard()
      child.kill()
    }

    function start () {
      // The child owns terminal input during the mode picker. Only take over
      // after startup, so a single R never interferes with the prompt.
      child = fork(entryPoint, args, {
        stdio: ['inherit', 'inherit', 'inherit', 'ipc'],
        env: { ...process.env, AGENTS_RELOAD_MODE: lastMode }
      })
      child.once('error', error => {
        cleanup()
        reject(error)
      })
      child.on('message', message => {
        if (restarting || stopping || !message || typeof message !== 'object' ||
          !('type' in message) || message.type !== 'samples-ready' ||
          !('mode' in message) || typeof message.mode !== 'string') {
          return
        }

        lastMode = message.mode
        console.log('Press R to restart the samples. Press Ctrl+C to stop.')
        process.stdin.setRawMode(true)
        process.stdin.on('data', onKey)
        process.stdin.resume()
        listening = true
      })
      child.once('exit', code => {
        releaseKeyboard()
        if (restarting && !stopping) {
          restarting = false
          console.clear()
          start()
          return
        }

        cleanup()
        process.exitCode = stopping ? 0 : (code ?? 1)
        resolve()
      })
    }

    process.on('SIGINT', stop)
    process.on('SIGTERM', stop)
    start()
  })
}
