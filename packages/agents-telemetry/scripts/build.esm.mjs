import { readFile, writeFile } from 'fs/promises'
import { resolve } from 'path'

const pkgContent = await readFile(resolve(process.cwd(), 'package.json'), { encoding: 'utf-8' })

// Match indentation from the "name": ... property line.
// Regex breakdown: /^(\s+)"name"\s*:/m
// ^                      start of a line (with the m flag)
// (\s+)                  capture one or more indentation whitespace characters
// "name"\s*:            match the "name" property and optional spaces before ':'
const indentation = pkgContent.match(/^(\s+)"name"\s*:/m)?.[1] ?? 2
const json = JSON.parse(pkgContent)
const dist = resolve(process.cwd(), 'dist', 'esm')
await writeFile(resolve(dist, 'package.json'), JSON.stringify(json, null, indentation), { encoding: 'utf-8' })
