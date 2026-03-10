import { Octokit } from '@octokit/rest'

export interface FileChange {
  path: string
  content: string
}

export interface PushResult {
  commitSha: string
  commitUrl: string
}

export async function pushFiles(
  token: string,
  owner: string,
  repo: string,
  branch: string,
  files: FileChange[],
  message: string,
): Promise<PushResult> {
  const octokit = new Octokit({ auth: token })

  // 1. Get latest commit SHA for the branch
  const { data: ref } = await octokit.git.getRef({ owner, repo, ref: `heads/${branch}` })
  const latestSha = ref.object.sha

  // 2. Get its tree SHA
  const { data: commit } = await octokit.git.getCommit({ owner, repo, commit_sha: latestSha })
  const baseTreeSha = commit.tree.sha

  // 3. Create a blob for each file
  const blobs = await Promise.all(
    files.map(async (f) => {
      const { data: blob } = await octokit.git.createBlob({
        owner, repo,
        content: Buffer.from(f.content).toString('base64'),
        encoding: 'base64',
      })
      return { path: f.path, sha: blob.sha }
    })
  )

  // 4. Create new tree on top of the existing one
  const { data: newTree } = await octokit.git.createTree({
    owner, repo,
    base_tree: baseTreeSha,
    tree: blobs.map(b => ({ path: b.path, mode: '100644', type: 'blob', sha: b.sha })),
  })

  // 5. Create commit
  const { data: newCommit } = await octokit.git.createCommit({
    owner, repo,
    message,
    tree: newTree.sha,
    parents: [latestSha],
  })

  // 6. Update branch ref
  await octokit.git.updateRef({ owner, repo, ref: `heads/${branch}`, sha: newCommit.sha })

  return {
    commitSha: newCommit.sha.slice(0, 7),
    commitUrl: `https://github.com/${owner}/${repo}/commit/${newCommit.sha}`,
  }
}

/** Parse agent output for file blocks. Detects patterns like:
 *  **src/foo.ts**             ← bold filename
 *  ```ts                      ← code fence
 *  // code here
 *  ```
 */
export function parseFilesFromOutput(output: string): FileChange[] {
  const files: FileChange[] = []
  const pattern = /\*\*([^\s*]+\.[a-z]+)\*\*\s*```[^\n]*\n([\s\S]*?)```/gi
  let match: RegExpExecArray | null
  while ((match = pattern.exec(output)) !== null) {
    files.push({ path: match[1], content: match[2] })
  }
  return files
}
