import neostandard from 'neostandard'
import terminalTestCastRule from './eslint-rules/no-terminal-test-cast.js'

export default [
  ...neostandard({ ts: true, ignores: ['node_modules', '**/dist/**'] }),
  {
    files: ['packages/**/test/**/*.{ts,cts,mts}', 'test-agents/**/test/**/*.{ts,cts,mts}'],
    plugins: {
      local: {
        rules: {
          'no-terminal-test-cast': terminalTestCastRule
        }
      }
    },
    rules: {
      'local/no-terminal-test-cast': 'error'
    }
  },
  {
    files: ['packages/agents-telemetry/src/**/*.{ts,cts,mts}'],
    languageOptions: {
      parser: neostandard.plugins['typescript-eslint'].parser,
    },
    plugins: {
      n: neostandard.plugins.n,
    },
    rules: {
      'n/file-extension-in-import': ['error', 'always'],
    },
  }
]
