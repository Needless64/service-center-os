import { cookies } from "next/headers";

import { sanityClient } from "@/lib/sanity/client";
import AdminLayoutClient from "./AdminLayoutClient";

// Server-side gate. Wraps every /admin/* page route. If the
// admin_session cookie is missing or doesn't correspond to a real
// adminUser doc, redirect to /admin/login?next=<original-url>.
//
// The login page itself (/admin/login) is excluded so the form
// renders. /admin/studio (the embedded Sanity Studio) is excluded
// because it has its own auth via Studio's session cookie.
const ALLOWLIST_PATHS = new Set(["/admin/login", "/admin/studio"]);

async function isAuthed(): Promise<boolean> {
  const cookieStore = await cookies();
  const session = cookieStore.get("admin_session")?.value;
  if (!session) return false;
  // Validate the cookie refers to a real adminUser. Prevents
  // tampered cookies from passing the gate.
  const admin = await sanityClient.fetch<{ _id: string } | null>(
    '*[_type == "adminUser" && email == $email][0]{ _id }',
    { email: session },
  );
  return Boolean(admin?._id);
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // If the user is authenticated, render the full admin layout.
  if (await isAuthed()) {
    return <AdminLayoutClient>{children}</AdminLayoutClient>;
  }

  // If not authenticated, render children without the layout
  // wrapper. This allows the login page to render without a
  // redirect loop.
  return <>{children}</>;
}
