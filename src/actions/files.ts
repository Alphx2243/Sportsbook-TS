'use server'

import cloudinary from '@/lib/cloudinary'
import { writeFile, unlink, mkdir } from 'fs/promises'
import { join } from 'path'
import { v4 as uuidv4 } from 'uuid'
import { ActionResponse } from '@/interfaces'
import { fail, ok } from '@/lib/action-response'
import { requireUser } from '@/lib/auth-utils'

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024
const ALLOWED_UPLOAD_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const EXTENSION_BY_MIME: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
}

export async function uploadFile(formData: FormData): Promise<ActionResponse> {
    let tempFilePath = null
    try {
        await requireUser()
        const file = formData.get('file') as File;
        if (!file || typeof file === 'string') {
            throw new Error('No file uploaded or invalid file format')
        }
        if (!ALLOWED_UPLOAD_TYPES.has(file.type)) {
            throw new Error('Only JPEG, PNG, and WebP images are allowed.')
        }
        if (file.size > MAX_UPLOAD_BYTES) {
            throw new Error('File size cannot exceed 5 MB.')
        }

        const bytes = await file.arrayBuffer()
        const buffer = Buffer.from(bytes)
        const uploadDir = join(process.cwd(), 'public', 'temp_uploads')
        await mkdir(uploadDir, { recursive: true })
        const fileName = `${uuidv4()}${EXTENSION_BY_MIME[file.type]}`
        tempFilePath = join(uploadDir, fileName)
        await writeFile(tempFilePath, buffer)
        
        const result = await cloudinary.uploader.upload(tempFilePath, { folder: 'sportsbook', })
        return ok({ id: result.public_id, name: file.name, url: result.secure_url })
    }
    catch (error: any) {
        console.error('Cloudinary upload error:', error)
        return fail(error, 'Failed to upload file')
    }
    finally {
        if (tempFilePath) {
            try { await unlink(tempFilePath) }
            catch (err) { console.error('Failed to delete temporary file:', err) }
        }
    }
}

export async function getFilePreview(path: string): Promise<ActionResponse<string>> {
    try {
        if (!path) {
            return ok('/sblogo.png')
        }
        const url = new URL(path, 'http://local.invalid')
        const cloudName = process.env.CLOUDINARY_CLOUD_NAME
        const allowedCloudinaryHost = cloudName ? `res.cloudinary.com` : ''
        const isAllowedCloudinaryUrl = url.protocol === 'https:' &&
            url.hostname === allowedCloudinaryHost &&
            url.pathname.startsWith(`/${cloudName}/`)

        if (isAllowedCloudinaryUrl) {
            return ok(path)
        }
        if (url.protocol === 'https:') throw new Error('External file preview URL is not allowed.')

        const localPath = path.replace(/^\/+/, '')
        if (localPath.includes('..') || localPath.includes('\\')) {
            throw new Error('Invalid file preview path.')
        }
        return ok(`/uploads/${localPath}`)
    } catch (error: any) {
        console.error('Error getting file preview:', error)
        return fail(error, 'Failed to get file preview')
    }
}
