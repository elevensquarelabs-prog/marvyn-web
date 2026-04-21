import { S3Client, PutObjectCommand, GetObjectCommand, PutObjectAclCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

export const wasabi = new S3Client({
  endpoint: `https://s3.${process.env.WASABI_REGION}.wasabisys.com`,
  region: process.env.WASABI_REGION || 'ap-southeast-1',
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.WASABI_ACCESS_KEY!,
    secretAccessKey: process.env.WASABI_SECRET_KEY!,
  },
})

const BUCKET = process.env.WASABI_BUCKET || 'marketing-agent-media'
const REGION = process.env.WASABI_REGION || 'ap-southeast-1'

export async function uploadToWasabi(
  key: string,
  body: Buffer,
  contentType: string
): Promise<string> {
  await wasabi.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
      ACL: 'public-read',
    })
  )
  return key
}

export async function getPresignedUrl(key: string, expiresIn = 3600): Promise<string> {
  return getSignedUrl(
    wasabi,
    new GetObjectCommand({ Bucket: BUCKET, Key: key }),
    { expiresIn }
  )
}

export function getPublicUrl(key: string): string {
  return `https://s3.${REGION}.wasabisys.com/${BUCKET}/${key}`
}

export async function ensurePublicRead(key: string): Promise<void> {
  await wasabi.send(new PutObjectAclCommand({ Bucket: BUCKET, Key: key, ACL: 'public-read' }))
}
