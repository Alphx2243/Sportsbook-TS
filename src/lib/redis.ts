import { Redis } from '@upstash/redis/cloudflare'
import { requireServerEnv } from './env'

const redis = new Redis({
    url: requireServerEnv('UPSTASH_REDIS_REST_URL'),
    token: requireServerEnv('UPSTASH_REDIS_REST_TOKEN')
})
export default redis;
