export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'disallow TypeScript casts in a test callback\'s final executable statement'
    },
    schema: [],
    messages: {
      terminalCast: 'Move this TypeScript cast into a typed local before the final test statement. The VS Code node:test extension can misparse a terminal cast and display later tests as children.'
    }
  },
  create (context) {
    const sourceCode = context.sourceCode
    const testFunctionNames = new Set(['it', 'test'])

    const isTestCall = (node) => {
      if (node.callee.type === 'Identifier') return testFunctionNames.has(node.callee.name)
      return node.callee.type === 'MemberExpression' &&
        !node.callee.computed &&
        node.callee.object.type === 'Identifier' &&
        testFunctionNames.has(node.callee.object.name) &&
        node.callee.property.type === 'Identifier' &&
        ['only', 'skip', 'todo'].includes(node.callee.property.name)
    }

    const containsCast = (node, root) => {
      if (node.type === 'TSAsExpression' || node.type === 'TSTypeAssertion') return true
      if (node !== root && (node.type === 'ArrowFunctionExpression' || node.type === 'FunctionExpression')) return false
      return (sourceCode.visitorKeys[node.type] ?? []).some((key) => {
        const value = node[key]
        return Array.isArray(value)
          ? value.some(child => containsCast(child, root))
          : value != null && containsCast(value, root)
      })
    }

    return {
      CallExpression (node) {
        if (!isTestCall(node)) return
        const callback = [...node.arguments].reverse().find((argument) =>
          argument.type === 'ArrowFunctionExpression' || argument.type === 'FunctionExpression'
        )
        if (callback?.body.type !== 'BlockStatement') return

        const terminalStatement = callback.body.body.at(-1)
        if (terminalStatement && containsCast(terminalStatement, terminalStatement)) {
          context.report({ node: terminalStatement, messageId: 'terminalCast' })
        }
      }
    }
  }
}
