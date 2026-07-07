'use server'

import prisma from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { SignJWT } from 'jose'
import { cookies } from 'next/headers'
import { createHash, randomBytes } from 'crypto'
import nodemailer from 'nodemailer'
import { ActionResponse } from '@/interfaces'
import { fail, ok } from '@/lib/action-response'
import { getJwtSecret } from '@/lib/auth-config'
import { getCurrentSessionUser, publicUserSelect, requireUser } from '@/lib/auth-utils'
import { requireServerEnv } from '@/lib/env'
import { requiredEmail, requiredString } from '@/lib/validation'
import { slidingWindowRateLimiter } from '@/lib/rate-limiter'
import { syncUserSportExperiences, withUserDisplay } from '@/lib/normalized-data'

const PASSWORD_MIN_LENGTH = 12
const PASSWORD_RESET_RESPONSE = 'If an account exists with this email, a reset link has been sent.'

export async function createAccount({ email, password, name, phone, rollNumber, sportsExperience, qrCodePath }: {
    email: string;
    password: string;
    name: string;
    phone: string;
    rollNumber: string;
    sportsExperience?: string[];
    qrCodePath?: string | null;
}): Promise<ActionResponse> {
    try {
        const normalizedEmail = requiredEmail(email)
        validatePassword(password)

        const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } })
        if (existingUser) throw new Error('User with this email already exists.')

        const hashedPassword = await bcrypt.hash(password, 10)
        const user = await prisma.$transaction(async (tx: any) => {
            const createdUser = await tx.user.create({
                data: {
                    email: normalizedEmail,
                    password: hashedPassword,
                    name: requiredString(name, 'Name'),
                    phone: requiredString(phone, 'Phone', 30),
                    rollNumber: requiredString(rollNumber, 'Roll number', 50),
                    qrCodePath,
                },
            })
            await syncUserSportExperiences(tx, createdUser.id, sportsExperience || [])
            const userWithExperience = await tx.user.findUnique({ where: { id: createdUser.id }, select: publicUserSelect })
            return withUserDisplay(userWithExperience)
        })
        return ok(user)
    }
    catch (error: any) {
        console.error('Registration error:', error)
        return fail(error, 'Failed to register')
    }
}

export async function login({ email, password }: { email: string; password: string }): Promise<ActionResponse> {
    try {
        const normalizedEmail = requiredEmail(email)
        const rateLimit = await slidingWindowRateLimiter({
            identifier: `login:${normalizedEmail}`,
            limit: 10,
            windowsMs: 15 * 60 * 1000,
        })
        if (!rateLimit.success) throw new Error('Too many login attempts. Please try again later.')

        const user = await prisma.user.findUnique({
            where: { email: normalizedEmail },
            select: { ...publicUserSelect, password: true },
        })
        if (!user) throw new Error('Invalid email or password.')

        const isValid = await bcrypt.compare(password, user.password)
        if (!isValid) throw new Error('Invalid email or password.')

        await createSession(user)
        const { password: _password, ...publicUser } = user
        return ok(publicUser)
    }
    catch (error: any) {
        console.error('Login error:', error)
        return fail(error, 'Failed to login')
    }
}

export async function updateUser(userId: string, data: {
    name?: string;
    phone?: string;
    rollNumber?: string;
    sportsExperience?: string[];
}): Promise<ActionResponse> {
    try {
        const actor = await getCurrentSessionUser()
        if (!actor || (actor.id !== userId && actor.role !== 'Admin')) throw new Error('Unauthorized.')

        const user = await prisma.$transaction(async (tx: any) => {
            const updatedUser = await tx.user.update({
                where: { id: userId },
                data: {
                    name: data.name !== undefined ? requiredString(data.name, 'Name') : undefined,
                    phone: data.phone !== undefined ? requiredString(data.phone, 'Phone', 30) : undefined,
                    rollNumber: data.rollNumber !== undefined ? requiredString(data.rollNumber, 'Roll number', 50) : undefined,
                },
            });
            await syncUserSportExperiences(tx, userId, data.sportsExperience)
            const userWithExperience = await tx.user.findUnique({ where: { id: updatedUser.id }, select: publicUserSelect })
            return withUserDisplay(userWithExperience)
        });
        return ok(user);
    }
    catch (error: any) {
        console.error("Update user error:", error);
        return fail(error, 'Failed to update user');
    }
}

export async function logout(): Promise<ActionResponse> {
    const cookieStore = await cookies()
    cookieStore.delete('session')
    return ok(null)
}

export async function getCurrentUser(): Promise<ActionResponse> {
    try {
        const user = await getCurrentSessionUser()
        if (!user) return fail(new Error('No session'))
        return ok(user)
    }
    catch (error: any) {
        return fail(error, 'Failed to get current user')
    }
}

export async function getUsers(): Promise<ActionResponse<{ documents: any[], total: number }>> {
    try {
        await requireUser()
        const users = await prisma.user.findMany({ select: publicUserSelect });
        const documents = users.map(withUserDisplay)
        return ok({ documents, total: documents.length });
    }
    catch (error: any) {
        console.error("Get users error:", error);
        return fail(error, 'Failed to get users');
    }
}

export async function requestPasswordReset(email: string): Promise<ActionResponse> {
    try {
        const normalizedEmail = requiredEmail(email)
        const rateLimit = await slidingWindowRateLimiter({
            identifier: `password-reset:${normalizedEmail}`,
            limit: 3,
            windowsMs: 60 * 60 * 1000,
        })
        if (!rateLimit.success) return ok(PASSWORD_RESET_RESPONSE)

        const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
        if (!user) return ok(PASSWORD_RESET_RESPONSE);

        const token = randomBytes(32).toString('hex');
        const expiry = new Date(Date.now() + 3600000);

        await prisma.user.update({
            where: { id: user.id },
            data: {
                resetToken: hashResetToken(token),
                resetTokenExpiry: expiry,
            },
        });

        const appUrl = requireServerEnv('NEXT_PUBLIC_APP_URL')
        const resetLink = `${appUrl.replace(/\/$/, '')}/reset-password?token=${token}`;

        await sendResetEmail(normalizedEmail, resetLink);

        return ok(PASSWORD_RESET_RESPONSE);
    } catch (error: any) {
        console.error("Request password reset error:", error);
        return ok(PASSWORD_RESET_RESPONSE);
    }
}

export async function resetPassword(token: string, newPassword: string): Promise<ActionResponse> {
    try {
        if (!token || token.length < 32) return fail(new Error('Invalid or expired reset token.'))
        validatePassword(newPassword)

        const user = await prisma.user.findFirst({
            where: {
                resetToken: hashResetToken(token),
                resetTokenExpiry: { gt: new Date() },
            },
        });

        if (!user) return fail(new Error('Invalid or expired reset token.'));

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await prisma.user.update({
            where: { id: user.id },
            data: {
                password: hashedPassword,
                resetToken: null,
                resetTokenExpiry: null,
            },
        });

        return ok('Password updated successfully.');
    } catch (error: any) {
        console.error("Reset password error:", error);
        return fail(error, 'Failed to reset password');
    }
}

async function sendResetEmail(email: string, link: string) {
    const smtpPort = Number(process.env.SMTP_PORT)
    if (!Number.isInteger(smtpPort) || smtpPort <= 0) throw new Error('SMTP_PORT must be configured.')

    const transporter = nodemailer.createTransport({
        host: requireServerEnv('SMTP_HOST'),
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
            user: requireServerEnv('SMTP_USER'),
            pass: requireServerEnv('SMTP_PASS'),
        },
    });

    await transporter.sendMail({
        from: requireServerEnv('SMTP_FROM'),
        to: email,
        subject: "Password Reset Request",
        html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
        <h2 style="color: #3b82f6;">Password Reset</h2>
        <p>Hello,</p>
        <p>You requested a password reset for your SportsBook account. This link will expire in 1 hour.</p>
        <div style="text-align: center; margin: 30px 0;">
        <a href="${link}" style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">Reset Password</a>
        </div>
        <p>If you didn't request this, you can safely ignore this email.</p>
        <p>Best regards,<br>The SportsBook Team</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="font-size: 12px; color: #666;">If the button doesn't work, copy and paste this link: <br> ${link}</p>
        </div>
        `,
    });
}

async function createSession(user: any) {
    const token = await new SignJWT({ userId: user.id, email: user.email, role: user.role })
        .setProtectedHeader({ alg: 'HS256' })
        .setExpirationTime('7d').sign(getJwtSecret())
    const cookieStore = await cookies()
    cookieStore.set('session', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 60 * 60 * 24 * 7,
        path: '/',
    })
}

function hashResetToken(token: string) {
    return createHash('sha256').update(token).digest('hex')
}

function validatePassword(password: string) {
    if (!password || password.length < PASSWORD_MIN_LENGTH) {
        throw new Error(`Password must be at least ${PASSWORD_MIN_LENGTH} characters.`)
    }
}
