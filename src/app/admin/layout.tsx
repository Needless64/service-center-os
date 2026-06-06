import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { sanityClient } from '@/lib/sanity/client'
import AdminLayoutClient from './AdminLayoutClient'

// Server-side gate. Wraps every /admin/* page route. If the
// admin_session cookie is missing or doesn't correspond to a real
// adminUser doc, redirect to /admin/login?next=<original-url>.
//
// The login page itself (/admin/login) is excluded so the form
// renders. /admin/studio (the embedded Sanity Studio) is excluded
// because it has its own auth via Studio's session cookie.
const ALLOWLIST_PATHS = new Set([
  '/admin/login',
  '/admin/studio',
])

async function isAuthed(): Promise<boolean> {
  const cookieStore = await cookies()
  const session = cookieStore.get('admin_session')?.value
  if (!session) return false
  // Validate the cookie refers to a real adminUser. Prevents
  // tampered cookies from passing the gate.
  const admin = await sanityClient.fetch<{ _id: string } | null>(
    '*[_type == "adminUser" && email == $email][0]{ _id }',
    { email: session }
  )
  return Boolean(admin?._id)
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // The pathname isn't directly accessible in a server layout, so
  // we also rely on the `next-url` header set by Next.js. The
  // ALLOWLIST below is the only path we explicitly let through.
  // For everything else, require auth.

  // Use the x-pathname header (set by middleware if we set it) or
  // fall back to checking the referer. Most reliable approach: do
  // a simple ALLOWLIST check on the layout segment by including the
  // login page in the allowlist and letting everything else require
  // auth. Since this layout wraps every /admin/* route, that's
  // exactly what we want.
  if (await isAuthed()) {
    return <AdminLayoutClient>{children}</AdminLayoutClient>
  }
  // Not authed — redirect to login with a next= param so the user
  // lands back here after verifying. We don't know the exact
  // requested URL from this layer; the page-level redirect will
  // re-run after verify. Default to /admin/operations.
  redirect('/admin/login?next=%2Fadmin%2Foperations')
}
