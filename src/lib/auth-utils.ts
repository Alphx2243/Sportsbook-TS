import prisma from '@/lib/prisma'
import { verifySessionToken } from '@/lib/auth-config'
import { cookies } from 'next/headers'
import { withUserDisplay } from '@/lib/normalized-data'

export const publicUserSelect = {
  id: true,
  email: true,
  name: true,
  phone: true,
  rollNumber: true,
  sportExperiences: { include: { sport: true } },
  qrCodePath: true,
  role: true,
  createdAt: true,
  updatedAt: true,
} as const

export const bookingUserSelect = {
  id: true,
  email: true,
  name: true,
  phone: true,
  rollNumber: true,
  qrCodePath: true,
  role: true,
} as const

export async function getCurrentSessionUser() {
  const cookieStore = await cookies()
  const session = cookieStore.get('session')
  if (!session) return null

  const payload = await verifySessionToken(session.value)
  if (!payload.userId) return null

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: publicUserSelect,
  })
  return user ? withUserDisplay(user) : null
}

export async function requireUser() {
  const user = await getCurrentSessionUser()
  if (!user) throw new Error('Unauthorized.')
  return user
}

export async function ensureAdmin() {
  const user = await requireUser()
  if (user.role !== 'Admin') throw new Error('Unauthorized: Administrative access required.')
  return user
}

export async function ensureSelfOrAdmin(userId: string) {
  const user = await requireUser()
  if (user.id !== userId && user.role !== 'Admin') throw new Error('Unauthorized.')
  return user
}

