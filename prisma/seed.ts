import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { randomUUID } from 'node:crypto'
import { DEMO_SETUPS, DEMO_USER } from '../lib/demo-data'

const prisma = new PrismaClient()
const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME } = process.env

const s3 =
  R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET_NAME
    ? new S3Client({
        region: 'auto',
        endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
      })
    : null

async function main() {
  if (!s3) console.warn('R2 env vars missing: seeding metadata only, downloads will fail.')

  const user = await prisma.user.upsert({
    where: { email: DEMO_USER.email },
    update: {},
    create: {
      email: DEMO_USER.email,
      name: DEMO_USER.name,
      passwordHash: await bcrypt.hash(DEMO_USER.password, 12),
    },
  })

  if ((await prisma.setup.count({ where: { userId: user.id } })) > 0) {
    console.log('Demo setups already exist, skipping.')
    return
  }

  for (const { content, ...setup } of DEMO_SETUPS) {
    const body = Buffer.from(content, 'utf8')
    const fileKey = `${user.id}/${randomUUID()}/${setup.fileName}`
    if (s3) {
      await s3.send(
        new PutObjectCommand({ Bucket: R2_BUCKET_NAME, Key: fileKey, Body: body, ContentType: setup.mimeType }),
      )
    }
    await prisma.setup.create({ data: { ...setup, tags: [...setup.tags], userId: user.id, fileKey, fileSize: body.byteLength } })
  }
  console.log(`Seeded ${DEMO_SETUPS.length} setups for ${DEMO_USER.email}`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
