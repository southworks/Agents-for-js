/* eslint-disable */

import { writeFile } from 'fs/promises'
import { resolve } from 'path'
import json from '../package.json' with { type: 'json' }

json.type = 'module'

const dist = resolve(process.cwd(), 'dist', 'esm')
await writeFile(resolve(dist, 'package.json'), JSON.stringify(json, null, 2), { encoding: 'utf-8' })
