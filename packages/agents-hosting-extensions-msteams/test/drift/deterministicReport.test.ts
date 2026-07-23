import assert from 'node:assert'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { renderDeterministicReport, type FindingsResult } from '../../../../scripts/render-teams-api-drift-report'

const fixturePath = 'packages/agents-hosting-extensions-msteams/test/drift/fixtures/findings.json'
const snapshotPath = 'packages/agents-hosting-extensions-msteams/test/drift/snapshots/deterministic-report.md'

describe('deterministic Teams API drift report', () => {
  it('renders the findings snapshot with every required report section', () => {
    const findings = JSON.parse(readFileSync(fixturePath, 'utf8')) as FindingsResult
    const report = renderDeterministicReport(findings, {
      findingsPath: 'artifacts/teams-api-drift/findings.json',
      outputPath: 'artifacts/teams-api-drift/deterministic-report.md',
      artifactPaths: ['artifacts/teams-api-drift/raw-api-diff.json'],
      checks: { ...findings.checks, boundaryTests: 'passed' }
    })

    assert.strictEqual(report, readFileSync(snapshotPath, 'utf8'))
  })
})
