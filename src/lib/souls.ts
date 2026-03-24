import fs from 'fs'
import path from 'path'

const soulsDir = path.join(process.cwd(), 'src', 'souls')

function load(filename: string): string {
  return fs.readFileSync(path.join(soulsDir, filename), 'utf-8')
}

// Loaded once at server startup — never re-read per request
export const SOULS: Record<string, string> = {
  // Command
  orchestrator:        load('orchestrator-system.md'),
  architect:           load('architect-system.md'),
  // Design
  'ux-researcher':     load('ux-researcher-system.md'),
  'ui-designer':       load('ui-designer-system.md'),
  'brand-guardian':     load('brand-guardian-system.md'),
  // Engineering
  frontend:            load('frontend-system.md'),
  backend:             load('backend-system.md'),
  web3:                load('web3-system.md'),
  security:            load('security-system.md'),
  'tech-writer':       load('tech-writer-system.md'),
  // Testing
  'code-reviewer':     load('code-reviewer-system.md'),
  'blockchain-auditor': load('blockchain-auditor-system.md'),
}
