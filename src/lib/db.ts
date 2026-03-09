import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }
export const prisma = globalForPrisma.prisma || new PrismaClient()
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export async function initDb() {
  await prisma.$connect()
  console.log('[DB] Connected')
}

export async function createTask(id: string, title: string) {
  return prisma.task.create({ data: { id, title } })
}

export async function updateTaskStatus(id: string, status: string, result?: string) {
  return prisma.task.update({ where: { id }, data: { status, result } })
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
  return prisma.task.findMany({ orderBy: { createdAt: 'desc' }, take: 20 })
}

export async function getLogs(taskId: string) {
  return prisma.log.findMany({ where: { taskId }, orderBy: { createdAt: 'asc' } })
}

export async function getCosts(taskId: string) {
  return prisma.agentCost.findMany({ where: { taskId } })
}
