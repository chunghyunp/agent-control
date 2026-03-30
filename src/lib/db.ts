import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }
export const prisma = globalForPrisma.prisma || new PrismaClient()
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export async function initDb() {
  await prisma.$connect()
  console.log('[DB] Connected')
}

export async function createTask(
  id: string,
  title: string,
  opts?: { prompt?: string; repoTarget?: string; branch?: string }
) {
  return prisma.task.create({
    data: {
      id,
      title,
      prompt: opts?.prompt,
      repoTarget: opts?.repoTarget,
      branch: opts?.branch,
    },
  })
}

export async function updateTaskStatus(id: string, status: string, result?: string) {
  const data: Record<string, unknown> = { status, result }
  if (status === 'completed' || status === 'error') {
    data.completedAt = new Date()
  }
  return prisma.task.update({ where: { id }, data })
}

export async function updateTaskMeta(
  id: string,
  data: { totalCost?: number; agentCount?: number; branch?: string; repoTarget?: string }
) {
  return prisma.task.update({ where: { id }, data })
}

export async function updateTaskPipeline(id: string, pipeline: string) {
  return prisma.task.update({ where: { id }, data: { pipeline } })
}

export async function insertLog(taskId: string, agent: string, type: string, message: string) {
  return prisma.log.create({ data: { taskId, agent, type, message } })
}

export async function upsertCost(
  taskId: string,
  agent: string,
  inputTokens: number,
  outputTokens: number,
  costUsd: number
) {
  return prisma.agentCost.upsert({
    where: { taskId_agent: { taskId, agent } },
    update: { inputTokens, outputTokens, costUsd },
    create: { taskId, agent, inputTokens, outputTokens, costUsd },
  })
}

export async function getTasks() {
  return prisma.task.findMany({ orderBy: { createdAt: 'desc' }, take: 50 })
}

export async function getLogs(taskId: string) {
  return prisma.log.findMany({ where: { taskId }, orderBy: { createdAt: 'asc' } })
}

export async function getCosts(taskId: string) {
  return prisma.agentCost.findMany({ where: { taskId } })
}

export async function saveTaskFiles(taskId: string, files: Record<string, string>, agentName?: string) {
  const ops = Object.entries(files).map(([path, content]) =>
    prisma.taskFile.upsert({
      where: { taskId_path: { taskId, path } },
      update: { content, ...(agentName ? { agentName } : {}) },
      create: { taskId, path, content, agentName },
    })
  )
  return prisma.$transaction(ops)
}

export async function saveTaskFileWithGithub(
  taskId: string,
  path: string,
  content: string,
  githubUrl: string,
  agentName?: string
) {
  return prisma.taskFile.upsert({
    where: { taskId_path: { taskId, path } },
    update: { content, githubUrl, ...(agentName ? { agentName } : {}) },
    create: { taskId, path, content, githubUrl, agentName },
  })
}

export async function getTaskFiles(taskId: string) {
  return prisma.taskFile.findMany({ where: { taskId }, orderBy: { path: 'asc' } })
}

export async function getTaskWithDetails(taskId: string) {
  return prisma.task.findUnique({
    where: { id: taskId },
    include: { files: { orderBy: { path: 'asc' } }, logs: { orderBy: { createdAt: 'asc' } }, costs: true },
  })
}

export async function deleteTask(taskId: string) {
  return prisma.task.delete({ where: { id: taskId } })
}

export async function getAllFiles() {
  return prisma.taskFile.findMany({
    orderBy: { createdAt: 'desc' },
    include: { task: { select: { id: true, title: true, status: true, createdAt: true } } },
  })
}

export async function getFileById(id: number) {
  return prisma.taskFile.findUnique({ where: { id } })
}
