import { defineField, defineType } from 'sanity'

// Admin user account for the dashboard. Passwords are stored as bcrypt
// hashes (never plaintext). OTP is short-lived (5 min) and cleared on
// use. No session table — the admin_session cookie holds the email
// directly, validated by middleware on every /api/admin/* call.
export const adminUserSchema = defineType({
  name: 'adminUser',
  title: 'Admin User',
  type: 'document',
  fields: [
    defineField({ name: 'email', type: 'string', validation: (r) => r.required() }),
    defineField({ name: 'name', type: 'string' }),
    defineField({ name: 'passwordHash', type: 'string', validation: (r) => r.required(), hidden: true }),
    defineField({ name: 'otpCode', type: 'string', hidden: true }),
    defineField({ name: 'otpExpiresAt', type: 'datetime', hidden: true }),
    defineField({ name: 'lastLoginAt', type: 'datetime' }),
    defineField({ name: 'createdAt', type: 'datetime', readOnly: true }),
  ],
  preview: {
    select: { title: 'email', subtitle: 'name', last: 'lastLoginAt' },
    prepare({ title, subtitle, last }) {
      return {
        title: title ?? '(no email)',
        subtitle: `${subtitle ?? ''}${last ? ` · last login ${new Date(last as string).toLocaleString()}` : ''}`,
      }
    },
  },
})
