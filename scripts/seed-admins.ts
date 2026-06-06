/**
 * One-off script to seed the two admin accounts.
 *
 * Run locally with:
 *   SEED_ADMIN_PASSWORD='Bajaj@2015' npx tsx --env-file=.env.local scripts/seed-admins.ts
 *
 * The password is read from the SEED_ADMIN_PASSWORD env var on the
 * caller's shell, never from a source file. The plaintext password
 * leaves no trace in git history.
 *
 * Hashes the password with bcrypt (cost 12) and upserts each admin
 * doc in Sanity. Re-runnable: re-running updates the passwordHash on
 * the existing docs.
 */
import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { createClient } from '@sanity/client'

const ADMINS: { email: string; name: string }[] = [
  { email: 'sharmaautobaroda@gmail.com', name: 'Sharma Auto Baroda' },
  { email: 'lingamaditya3669@gmail.com', name: 'Lingam Aditya' },
]

async function main() {
  const password = process.env.SEED_ADMIN_PASSWORD
  if (!password) {
    console.error('SEED_ADMIN_PASSWORD env var is required. Refusing to seed with no password.')
    process.exit(1)
  }
  if (password.length < 8) {
    console.error('SEED_ADMIN_PASSWORD is too short (min 8 chars).')
    process.exit(1)
  }

  const sanity = createClient({
    projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
    dataset: process.env.NEXT_PUBLIC_SANITY_DATASET!,
    apiVersion: '2024-01-01',
    useCdn: false,
    token: process.env.SANITY_API_TOKEN!,
  })

  const passwordHash = await bcrypt.hash(password, 12)

  for (const admin of ADMINS) {
    const email = admin.email.trim().toLowerCase()
    const existing = await sanity.fetch<{ _id: string } | null>(
      '*[_type == "adminUser" && email == $email][0]{ _id }',
      { email }
    )

    if (existing) {
      await sanity
        .patch(existing._id)
        .set({ name: admin.name, passwordHash })
        .commit()
      console.log(`updated: ${email} (_id=${existing._id})`)
    } else {
      const created = await sanity.create({
        _type: 'adminUser',
        email,
        name: admin.name,
        passwordHash,
        createdAt: new Date().toISOString(),
      })
      console.log(`created: ${email} (_id=${created._id})`)
    }
  }

  console.log('DONE. Plaintext password discarded from this process.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
