'use server'

import prisma from '@/lib/prisma'
import { ActionResponse } from '@/interfaces'
import { fail, ok } from '@/lib/action-response'
import { requiredString } from '@/lib/validation'

export async function getSports(): Promise<ActionResponse<{ documents: any[], total: number }>> {
    try {
        const sports = await prisma.sport.findMany({
            orderBy: { name: 'asc' },
            include: { equipments: true }
        })
        return ok({ documents: sports, total: sports.length })
    }
    catch (error: any) {
        console.error('Get sports error:', error);
        return fail(error, 'Failed to get sports')
    }
}

export async function getSport(id: string): Promise<ActionResponse> {
    try {
        const sport = await prisma.sport.findUnique({
            where: { id },
            include: { equipments: true },
        })
        if (!sport) return fail(new Error('Sport not found'))
        return ok(sport)
    }
    catch (error: any) {
        console.error('Get sport error:', error);
        return fail(error, 'Failed to get sport')
    }
}

export async function getSportAnalytics(sportName: string): Promise<ActionResponse> {
    try {
        const safeSportName = requiredString(sportName, 'Sport name')
        const today = new Date();
        const dates = Array.from({ length: 7 }, (_: unknown, i: number) => {
            const d = new Date(today);
            d.setDate(today.getDate() - (6 - i));
            return d.toISOString().split('T')[0];
        });

        const bookings = await prisma.booking.findMany({
            where: {
                sportName: safeSportName,
                date: { in: dates }
            }
        });

        const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        const weeklyAttendance = dates.map((date: string) => {
            const dateObj = new Date(date);
            const dayName = days[dateObj.getDay()];
            const dayBookings = bookings.filter((b: any) => b.date === date);
            const totalPlayers = dayBookings.reduce((sum: number, b: any) => sum + (b.numberOfPlayers || 0), 0);
            return { day: dayName, Students: totalPlayers };
        });

        const timeSlots = ["06-08", "08-10", "10-12", "12-14", "14-16", "16-18", "18-20", "20-22"];
        const peakHours = timeSlots.map((slot: string) => {
            const [startHour, endHour] = slot.split('-').map(Number);
            const slotBookings = bookings.filter((b: any) => {
                const hour = parseInt(b.startTime.split(':')[0]);
                return hour >= startHour && hour < endHour;
            });
            const totalUsersInSlot = slotBookings.reduce((sum: number, b: any) => sum + (b.numberOfPlayers || 0), 0);
            return { time: slot, Users: Math.round(totalUsersInSlot / 7) };
        });

        return ok({ weeklyAttendance, peakHours });
    }
    catch (error: any) {
        console.error('Get sport analytics error:', error);
        return fail(error, 'Failed to get analytics');
    }
}

