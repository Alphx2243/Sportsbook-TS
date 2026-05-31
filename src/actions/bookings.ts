'use server'

import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { ActionResponse, CreateBookingInput, UpdateBookingInput } from '@/interfaces'
import { fail, ok } from '@/lib/action-response'
import { bookingUserSelect, ensureSelfOrAdmin, requireUser } from '@/lib/auth-utils'
import { requireServerEnv } from '@/lib/env'
import { bookingStatus, equipmentIssues, positiveInt, requiredString } from '@/lib/validation'

async function notifySocketUpdate(sportName: string, type: string = 'availability_changed') {
    const url = `${process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3005'}/notify-update`;
    const secret = requireServerEnv('SOCKET_INTERNAL_SECRET');
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-socket-secret': secret },
            body: JSON.stringify({ sportName, type }),
        });
        if (!response.ok) {
            console.error(`[SOCKET] Server returned ${response.status}: ${response.statusText}`);
        }
    } catch (error) {
        console.error('[SOCKET] Failed to notify server:', error);
    }
}

export async function createBooking(data: CreateBookingInput): Promise<ActionResponse> {
    try {
        await ensureSelfOrAdmin(data.userId)
        const result = await prisma.$transaction(async (tx: any) => {
            await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${data.userId} FOR UPDATE`;

            const existingBooking = await tx.booking.findFirst({
                where: {
                    userId: data.userId,
                    status: { in: ['pending', 'active', 'returned'] }
                }
            })

            if (existingBooking) {
                const msg = existingBooking.status === 'active'
                    ? 'You already have an active booking.'
                    : 'Your previous session return is pending admin approval.';
                throw new Error(`${msg} Please return items and wait for admin approval first.`)
            }

            return await tx.booking.create({
                data: normalizeBookingCreateData(data),
            })
        })
        revalidatePath('/')
        await notifySocketUpdate(data.sportName, 'availability_changed');
        return ok(result)
    }
    catch (error: any) {
        console.error('Create booking error:', error)
        return fail(error, 'Failed to create booking')
    }
}

export async function updateBooking(id: string, data: UpdateBookingInput): Promise<ActionResponse> {
    try {
        const existing = await assertBookingAccess(id)
        const booking = await prisma.booking.update({
            where: { id },
            data: {
                userId: data.userId !== undefined ? requiredString(data.userId, 'User ID') : undefined,
                sportName: data.sportName !== undefined ? requiredString(data.sportName, 'Sport name') : undefined,
                numberOfPlayers: data.numberOfPlayers ? positiveInt(data.numberOfPlayers, 'Number of players') : undefined,
                startTime: data.startTime !== undefined ? requiredString(data.startTime, 'Start time', 20) : undefined,
                endTime: data.endTime !== undefined ? requiredString(data.endTime, 'End time', 20) : undefined,
                scanned: data.scanned,
                qrDetail: data.qrdetail,
                status: data.status !== undefined ? bookingStatus(data.status) : undefined,
                endDate: data.enddate,
                courtNo: data.CourtNo,
            },
        })
        revalidatePath('/')
        await notifySocketUpdate(data.sportName || existing.sportName, 'availability_changed');
        return ok(booking)
    }
    catch (error: any) {
        console.error('Update booking error:', error)
        return fail(error, 'Failed to update booking')
    }
}

export async function deleteBooking(id: string): Promise<ActionResponse> {
    try {
        const booking = await assertBookingAccess(id)
        await prisma.booking.delete({ where: { id } })
        revalidatePath('/')
        await notifySocketUpdate(booking.sportName, 'availability_changed');
        return ok(null)
    }
    catch (error: any) {
        console.error('Delete booking error:', error)
        return fail(error, 'Failed to delete booking')
    }
}

export async function getBooking(id: string): Promise<ActionResponse> {
    try {
        const booking = await assertBookingAccess(id)
        return ok(booking)
    }
    catch (error: any) {
        console.error('Get booking error:', error)
        return fail(error, 'Failed to get booking')
    }
}

export async function getBookings(filters: { userId?: string; status?: string; date?: string; timeRange?: string } = {}): Promise<ActionResponse<{ documents: any[], total: number }>> {
    try {
        const actor = await requireUser()
        if (filters.userId) {
            await ensureSelfOrAdmin(filters.userId)
        } else if (actor.role !== 'Admin') {
            filters.userId = actor.id
        }

        const where: any = {}
        if (filters.userId) where.userId = filters.userId
        if (filters.status) where.status = bookingStatus(filters.status)
        if (filters.date) where.date = requiredString(filters.date, 'Date', 20)
        if (filters.timeRange) {
            where.startTime = { lte: filters.timeRange }
            where.endTime = { gt: filters.timeRange }
        }
        const bookings = await prisma.booking.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            include: { user: { select: bookingUserSelect } }
        })
        return ok({ documents: bookings, total: bookings.length })
    }
    catch (error: any) {
        console.error('Get bookings error:', error)
        return fail(error, 'Failed to get bookings')
    }
}

export async function extendBooking(bookingId: string, extensionMinutes: number): Promise<ActionResponse> {
    try {
        await assertBookingAccess(bookingId)
        const safeExtensionMinutes = positiveInt(extensionMinutes, 'Extension minutes')
        const updatedBooking = await prisma.$transaction(async (tx: any) => {
            const [booking]: any = await tx.$queryRaw`SELECT * FROM "Booking" WHERE "id" = ${bookingId} FOR UPDATE`;
            if (!booking) throw new Error('Booking not found');

            const originalStartDate = new Date(`${booking.date}T${booking.startTime}`);
            const currentEndDate = new Date(`${booking.endDate || booking.date}T${booking.endTime}`);
            const newEndDate = new Date(currentEndDate.getTime() + safeExtensionMinutes * 60000);
            const totalDurationMs = newEndDate.getTime() - originalStartDate.getTime();
            const totalDurationMinutes = totalDurationMs / (1000 * 60);

            if (totalDurationMinutes > 240) {
                throw new Error('Total booking duration cannot exceed 4 hours');
            }

            const newEndTime = newEndDate.toTimeString().split(' ')[0];
            const newEndDateStr = newEndDate.toISOString().split('T')[0];

            return await tx.booking.update({
                where: { id: bookingId },
                data: { endTime: newEndTime, endDate: newEndDateStr }
            });
        });
        revalidatePath('/')
        return ok(updatedBooking)
    }
    catch (error: any) {
        console.error('Extend booking error:', error)
        return fail(error, 'Failed to extend booking')
    }
}

export async function expireBooking(bookingId: string): Promise<ActionResponse> {
    try {
        await assertBookingAccess(bookingId)
        await prisma.$transaction(async (tx: any) => {
            const [booking]: any = await tx.$queryRaw`SELECT * FROM "Booking" WHERE "id" = ${bookingId} FOR UPDATE`;
            if (!booking || (booking.status !== 'active' && booking.status !== 'returned')) {
                throw new Error('Booking not found or already inactive');
            }

            const [sportRow]: any = await tx.$queryRaw`SELECT * FROM "Sport" WHERE "name" = ${booking.sportName} FOR UPDATE`;
            if (!sportRow) throw new Error('Associated Sport not found');

            await tx.booking.update({ where: { id: bookingId }, data: { status: 'expired' } });

            const bookingEquipments = await tx.bookingEquipment.findMany({ where: { bookingId } });
            for (const be of bookingEquipments) {
                await tx.equipment.update({
                    where: { id: be.equipmentId },
                    data: { inUse: { decrement: be.count } }
                });
            }
        });
        revalidatePath('/')
        revalidatePath('/dashboard')
        revalidatePath('/book-court')

        const [bookingForSport]: any = await prisma.$queryRaw`SELECT "sportName" FROM "Booking" WHERE "id" = ${bookingId}`;
        if (bookingForSport) {
            await notifySocketUpdate(bookingForSport.sportName, 'availability_changed');
        }

        return ok(null)
    }
    catch (error: any) {
        console.error('Expire booking error:', error)
        return fail(error, 'Failed to expire booking')
    }
}

export async function requestReturn(bookingId: string): Promise<ActionResponse> {
    try {
        await assertBookingAccess(bookingId)
        await prisma.$transaction(async (tx: any) => {
            const [booking]: any = await tx.$queryRaw`SELECT * FROM "Booking" WHERE "id" = ${bookingId} FOR UPDATE`;
            if (!booking || booking.status !== 'active') {
                throw new Error('Booking not found or not active');
            }

            const [sport]: any = await tx.$queryRaw`SELECT * FROM "Sport" WHERE "name" = ${booking.sportName} FOR UPDATE`;
            if (!sport) {
                throw new Error('Associated Sport not found');
            }

            const courtNo = booking.courtNo;
            let newCourtData = sport.courtData || [];
            newCourtData = newCourtData.map((item: any, i: number) => {
                const targetIndex = parseInt(courtNo) - 1;
                if (i === targetIndex) {
                    const name = item.split(':')[0];
                    return `${name}:0`;
                }
                return item;
            });

            await tx.sport.update({
                where: { id: sport.id },
                data: {
                    courtsInUse: Math.max(0, (sport.courtsInUse || 0) - 1),
                    numPlayers: Math.max(0, (sport.numPlayers || 0) - (booking.numberOfPlayers || 0)),
                    courtData: newCourtData
                }
            });

            await tx.booking.update({
                where: { id: bookingId },
                data: { status: 'returned' }
            });
        });

        revalidatePath('/')
        revalidatePath('/dashboard')
        revalidatePath('/book-court')

        const [bookingForSport]: any = await prisma.$queryRaw`SELECT "sportName" FROM "Booking" WHERE "id" = ${bookingId}`;
        if (bookingForSport) {
            await notifySocketUpdate(bookingForSport.sportName, 'availability_changed');
        }

        return ok(null)
    }
    catch (error: any) {
        console.error('Request return error:', error)
        return fail(error, 'Failed to request return')
    }
}

export async function secureBooking(data: CreateBookingInput): Promise<ActionResponse> {
    try {
        await ensureSelfOrAdmin(data.userId)
        const issues = equipmentIssues(data.equipmentsIssued)
        const result = await prisma.$transaction(async (tx: any) => {
            await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${data.userId} FOR UPDATE`;

            const existingBooking = await tx.booking.findFirst({
                where: { userId: data.userId, status: { in: ['pending', 'active', 'returned'] } }
            })
            if (existingBooking) {
                const msg = existingBooking.status === 'active'
                    ? 'You already have an active booking.'
                    : 'Your previous session return is pending admin approval.';
                throw new Error(`${msg} Please return items and wait for admin approval first.`)
            }

            const [sport]: any = await tx.$queryRaw`SELECT * FROM "Sport" WHERE "name" = ${data.sportName} FOR UPDATE`;
            if (!sport) throw new Error('Sport not found.')

            const isCapacityBased = sport.maxCapacity && sport.maxCapacity > 0
            const alreadyBookedPlayers = sport.numPlayers || 0
            const numPlayers = positiveInt(data.numberOfPlayers, 'Number of players')
            const courtNo = data.CourtNo
            if (isCapacityBased) {
                if (alreadyBookedPlayers + numPlayers > (sport.maxCapacity || 0)) {
                    throw new Error('Facility is full!')
                }
            }
            else {
                const cData = sport.courtData || []
                const courtIndex = Number(courtNo) - 1
                if (courtIndex < 0 || courtIndex >= (sport.numberOfCourts || 0)) {
                    throw new Error('Court is not available!')
                }
                if (cData[courtIndex] && cData[courtIndex].split(':')[1] === '1') {
                    throw new Error('Court already booked!')
                }

                const currentCData = Array.from({ length: sport.numberOfCourts || 0 }, (_, i) => cData[i] || `Court${i + 1}:0`)
                const newCourtData = currentCData.map((item: any, i: number) => {
                    const name = item.split(':')[0]
                    if (i === courtIndex) return `${name}:1`
                    return item
                })

                await tx.sport.update({
                    where: { id: sport.id },
                    data: {
                        courtsInUse: { increment: 1 }, courtData: newCourtData, numPlayers: { increment: numPlayers }
                    }
                })
            }
            if (isCapacityBased) {
                await tx.sport.update({
                    where: { id: sport.id }, data: { numPlayers: { increment: numPlayers } }
                })
            }

            const booking = await tx.booking.create({
                data: normalizeBookingCreateData({ ...data, numberOfPlayers: numPlayers }),
            });

            for (const issued of issues) {
                const equipment = await tx.equipment.findFirst({ where: { name: issued.name, sportId: sport.id } });
                if (!equipment) throw new Error(`Equipment '${issued.name}' not found for this sport.`);
                if (equipment.inUse + issued.count > equipment.total) throw new Error(`Not enough '${issued.name}' available.`);
                await tx.equipment.update({ where: { id: equipment.id }, data: { inUse: { increment: issued.count } } });
                await tx.bookingEquipment.create({ data: { bookingId: booking.id, equipmentId: equipment.id, count: issued.count } });
            }

            const qrObj = JSON.parse(data.qrdetail || '{}');
            qrObj.bookingId = booking.id;
            return await tx.booking.update({ where: { id: booking.id }, data: { qrDetail: JSON.stringify(qrObj) } });
        })
        revalidatePath('/')
        await notifySocketUpdate(data.sportName, 'availability_changed');
        return ok(result)
    }
    catch (error: any) {
        console.error('Secure booking error:', error)
        return fail(error, 'Failed to create booking')
    }
}

async function assertBookingAccess(bookingId: string) {
    const booking = await prisma.booking.findUnique({ where: { id: bookingId } })
    if (!booking) throw new Error('Booking not found')
    await ensureSelfOrAdmin(booking.userId)
    return booking
}

function normalizeBookingCreateData(data: CreateBookingInput) {
    return {
        userId: requiredString(data.userId, 'User ID'),
        sportName: requiredString(data.sportName, 'Sport name'),
        numberOfPlayers: positiveInt(data.numberOfPlayers, 'Number of players'),
        startTime: requiredString(data.startTime, 'Start time', 20),
        endTime: requiredString(data.endTime, 'End time', 20),
        date: requiredString(data.date, 'Date', 20),
        qrDetail: data.qrdetail,
        status: bookingStatus(data.status),
        endDate: data.enddate,
        courtNo: data.CourtNo,
    }
}

