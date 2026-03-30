import { Octokit } from '@octokit/rest'

export interface FileChange {
  path: string
  content: string
}

export interface PushResult {
  commitSha: string
  commitUrl: string
  filesCount: number
}

export interface CommitResult {
  commitSha: string
  commitUrl: string
  fileUrl: string
}

/**
 * Create a new branch from an existing base branch.
 * Returns the SHA of the branch tip.
 */
export async function createBranch(
  token: string,
  owner: string,
  repo: string,
  baseBranch: string,
  newBranch: string,
): Promise<{ sha: string }> {
  const octokit = new Octokit({ auth: token })

  // Check if branch already exists
  try {
    const { data: ref } = await octokit.git.getRef({ owner, repo, ref: `heads/${newBranch}` })
    return { sha: ref.object.sha }
  } catch {
    // Branch doesn't exist — create it
  }

  // Get base branch SHA
  const { data: baseRef } = await octokit.git.getRef({ owner, repo, ref: `heads/${baseBranch}` })
  const baseSha = baseRef.object.sha

  await octokit.git.createRef({
    owner,
    repo,
    ref: `refs/heads/${newBranch}`,
    sha: baseSha,
  })

  return { sha: baseSha }
}

/**
 * Commit a single file to a branch using the GitHub Contents API.
 * Creates or updates the file. Returns commit info and file URL.
 */
export async function commitFile(
  token: string,
  owner: string,
  repo: string,
  branch: string,
  filePath: string,
  content: string,
  message: string,
  authorName = 'HYPAI Agent',
  authorEmail = 'agent@hypaikorea.com',
): Promise<CommitResult> {
  const octokit = new Octokit({ auth: token })

  // Check if file already exists (need SHA for update)
  let existingSha: string | undefined
  try {
    const { data } = await octokit.repos.getContent({
      owner,
      repo,
      path: filePath,
      ref: branch,
    })
    if (!Array.isArray(data) && data.type === 'file') {
      existingSha = data.sha
    }
  } catch {
    // File doesn't exist yet — that's fine
  }

  const { data } = await octokit.repos.createOrUpdateFileContents({
    owner,
    repo,
    path: filePath,
    message,
    content: Buffer.from(content).toString('base64'),
    branch,
    ...(existingSha ? { sha: existingSha } : {}),
    committer: { name: authorName, email: authorEmail },
    author: { name: authorName, email: authorEmail },
  })

  return {
    commitSha: data.commit.sha?.slice(0, 7) ?? '',
    commitUrl: data.commit.html_url ?? `https://github.com/${owner}/${repo}/commit/${data.commit.sha}`,
    fileUrl: `https://github.com/${owner}/${repo}/blob/${branch}/${filePath}`,
  }
}

/**
 * Fetch file content from a GitHub repo.
 */
export async function fetchFileContent(
  token: string,
  owner: string,
  repo: string,
  branch: string,
  filePath: string,
): Promise<{ content: string; sha: string }> {
  const octokit = new Octokit({ auth: token })
  const { data } = await octokit.repos.getContent({
    owner,
    repo,
    path: filePath,
    ref: branch,
  })
  if (Array.isArray(data) || data.type !== 'file') {
    throw new Error('Not a file')
  }
  const content = Buffer.from(data.content, 'base64').toString('utf-8')
  return { content, sha: data.sha }
}

/**
 * Generate a branch name slug from a task ID and title.
 */
export function makeBranchName(taskId: string, title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
  return `agent/task-${taskId}-${slug}`
}

/**
 * Parse agent outputs for FILE delimiter blocks:
 *
 *   --- FILE: path/to/file.ext ---
 *   ```lang
 *   code here
 *   ```
 *   --- END FILE ---
 *
 * Falls back to the old **bold** + code-fence format for backward compat.
 */
export function parseFilesFromOutput(output: string): FileChange[] {
  const files: FileChange[] = []
  const seen = new Set<string>()

  // Primary: --- FILE: path --- ... ``` ... ``` ... --- END FILE ---
  const primary =
    /^---\s*FILE:\s*(\S+)\s*---[ \t]*\r?\n```[^\n]*\r?\n([\s\S]*?)```[ \t]*\r?\n---\s*END FILE\s*---/gm
  let m: RegExpExecArray | null
  while ((m = primary.exec(output)) !== null) {
    const path = m[1].trim()
    if (!seen.has(path)) {
      seen.add(path)
      files.push({ path, content: m[2] })
    }
  }

  if (files.length > 0) return files

  // Fallback: **path.ext**\n```lang\ncontent\n```
  const fallback = /\*\*([^\s*]+\.[a-z]{1,6})\*\*\s*```[^\n]*\n([\s\S]*?)```/gi
  while ((m = fallback.exec(output)) !== null) {
    const path = m[1].trim()
    if (!seen.has(path)) {
      seen.add(path)
      files.push({ path, content: m[2] })
    }
  }

  return files
}

/**
 * Returns true if the branch does not exist yet (empty repo or new branch).
 */
export async function isRepoEmpty(
  token: string,
  owner: string,
  repo: string,
  branch: string,
): Promise<boolean> {
  const octokit = new Octokit({ auth: token })
  try {
    await octokit.git.getRef({ owner, repo, ref: `heads/${branch}` })
    return false
  } catch (e: unknown) {
    const status = (e as { status?: number })?.status
    if (status === 404 || status === 409) return true
    throw e
  }
}

/**
 * Generate a minimal Next.js 14 + Tailwind + Prisma + Railway scaffold.
 * These files are pushed on the first commit to an empty repo.
 */
export function getScaffoldingFiles(projectName = 'app'): FileChange[] {
  const slug = projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-')

  return [
    {
      path: 'package.json',
      content: JSON.stringify(
        {
          name: slug,
          version: '0.1.0',
          private: true,
          scripts: {
            dev: 'next dev',
            build: 'next build',
            start: 'node .next/standalone/server.js',
            lint: 'next lint',
            'db:push': 'prisma db push --accept-data-loss',
            'db:generate': 'prisma generate',
          },
          dependencies: {
            next: '14.2.23',
            react: '^18',
            'react-dom': '^18',
            '@prisma/client': '^5.21.0',
            prisma: '^5.21.0',
          },
          devDependencies: {
            '@types/node': '^20',
            '@types/react': '^18',
            '@types/react-dom': '^18',
            typescript: '^5',
            tailwindcss: '^3.4.0',
            postcss: '^8',
            autoprefixer: '^10',
            eslint: '^8',
            'eslint-config-next': '14.2.23',
          },
        },
        null,
        2,
      ),
    },
    {
      path: 'tsconfig.json',
      content: JSON.stringify(
        {
          compilerOptions: {
            target: 'ES2017',
            lib: ['dom', 'dom.iterable', 'esnext'],
            allowJs: true,
            skipLibCheck: true,
            strict: true,
            noEmit: true,
            esModuleInterop: true,
            module: 'esnext',
            moduleResolution: 'bundler',
            resolveJsonModule: true,
            isolatedModules: true,
            jsx: 'preserve',
            incremental: true,
            plugins: [{ name: 'next' }],
            paths: { '@/*': ['./src/*'] },
          },
          include: ['next-env.d.ts', '**/*.ts', '**/*.tsx', '.next/types/**/*.ts'],
          exclude: ['node_modules'],
        },
        null,
        2,
      ),
    },
    {
      path: 'next.config.js',
      content: `/** @type {import('next').NextConfig} */\nconst nextConfig = {\n  output: 'standalone',\n}\nmodule.exports = nextConfig\n`,
    },
    {
      path: 'tailwind.config.ts',
      content: `import type { Config } from 'tailwindcss'\n\nconst config: Config = {\n  content: [\n    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',\n    './src/components/**/*.{js,ts,jsx,tsx,mdx}',\n    './src/app/**/*.{js,ts,jsx,tsx,mdx}',\n  ],\n  theme: { extend: {} },\n  plugins: [],\n}\nexport default config\n`,
    },
    {
      path: 'postcss.config.js',
      content: `module.exports = {\n  plugins: {\n    tailwindcss: {},\n    autoprefixer: {},\n  },\n}\n`,
    },
    {
      path: 'prisma/schema.prisma',
      content: `generator client {\n  provider = "prisma-client-js"\n}\n\ndatasource db {\n  provider = "postgresql"\n  url      = env("DATABASE_URL")\n}\n`,
    },
    {
      path: '.env.example',
      content: `# Copy to .env and fill in values\nDATABASE_URL=postgresql://user:password@host:5432/dbname\n`,
    },
    {
      path: '.gitignore',
      content: `.env\n.env.local\n.env*.local\n.next/\nnode_modules/\n*.log\n.DS_Store\nprisma/dev.db\ndist/\nbuild/\n`,
    },
    {
      path: 'railway.json',
      content: JSON.stringify(
        {
          $schema: 'https://railway.com/railway.schema.json',
          build: { builder: 'NIXPACKS' },
          deploy: {
            startCommand:
              'npx prisma db push --accept-data-loss; node .next/standalone/server.js',
            healthcheckPath: '/api/health',
            restartPolicyType: 'ON_FAILURE',
            restartPolicyMaxRetries: 3,
          },
        },
        null,
        2,
      ),
    },
    {
      path: 'README.md',
      content: `# ${projectName}\n\nGenerated by Agent Control multi-agent system.\n\n## Development\n\n\`\`\`bash\nnpm install\nnpm run db:push\nnpm run dev\n\`\`\`\n\n## Deployment\n\nDeploy to Railway. Set \`DATABASE_URL\` environment variable.\n`,
    },
  ]
}

/**
 * Push files to GitHub, handling empty repos (no existing branch).
 * - Empty repo: creates root tree with no base_tree, then createRef instead of updateRef.
 * - Existing repo: builds on top of latest commit tree.
 */
export async function pushFiles(
  token: string,
  owner: string,
  repo: string,
  branch: string,
  files: FileChange[],
  message: string,
): Promise<PushResult> {
  const octokit = new Octokit({ auth: token })

  // Try to get the current branch tip
  let latestSha: string | null = null
  let baseTreeSha: string | null = null

  try {
    const { data: ref } = await octokit.git.getRef({ owner, repo, ref: `heads/${branch}` })
    latestSha = ref.object.sha
    const { data: commit } = await octokit.git.getCommit({ owner, repo, commit_sha: latestSha })
    baseTreeSha = commit.tree.sha
  } catch (e: unknown) {
    const status = (e as { status?: number })?.status
    // 404 = branch/repo empty; 409 = repo exists but has no commits
    if (status !== 404 && status !== 409) throw e
  }

  // Create a blob for each file
  const blobs = await Promise.all(
    files.map(async (f) => {
      const { data: blob } = await octokit.git.createBlob({
        owner,
        repo,
        content: Buffer.from(f.content).toString('base64'),
        encoding: 'base64',
      })
      return { path: f.path, sha: blob.sha }
    }),
  )

  // Create tree (omit base_tree for initial commit to get a clean root)
  const { data: newTree } = await octokit.git.createTree({
    owner,
    repo,
    ...(baseTreeSha ? { base_tree: baseTreeSha } : {}),
    tree: blobs.map((b) => ({
      path: b.path,
      mode: '100644' as const,
      type: 'blob' as const,
      sha: b.sha,
    })),
  })

  // Create commit
  const { data: newCommit } = await octokit.git.createCommit({
    owner,
    repo,
    message,
    tree: newTree.sha,
    parents: latestSha ? [latestSha] : [],
  })

  // Update existing branch ref or create new one
  if (latestSha) {
    await octokit.git.updateRef({ owner, repo, ref: `heads/${branch}`, sha: newCommit.sha })
  } else {
    await octokit.git.createRef({ owner, repo, ref: `refs/heads/${branch}`, sha: newCommit.sha })
  }

  return {
    commitSha: newCommit.sha.slice(0, 7),
    commitUrl: `https://github.com/${owner}/${repo}/commit/${newCommit.sha}`,
    filesCount: files.length,
  }
}
