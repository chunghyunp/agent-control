import fs from 'fs'
import path from 'path'

const soulsDir = path.join(process.cwd(), 'src', 'souls')

function load(filename: string): string {
  return fs.readFileSync(path.join(soulsDir, filename), 'utf-8')
}

// Loaded once at server startup — never re-read per request
export const SOULS: Record<string, string> = {
  supervisor: load('supervisor-system.md'),
  designer:   load('designer-system.md'),
  frontend:   load('frontend-system.md'),
  backend:    load('backend-system.md'),
  web3:       load('web3-system.md'),
  reviewer:   load('reviewer-system.md'),
}
