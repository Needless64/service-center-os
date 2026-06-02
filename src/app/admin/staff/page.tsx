import { sanityClient } from '@/lib/sanity/client'
import { StaffPanel } from '@/components/admin/StaffPanel'

export const dynamic = 'force-dynamic'

export default async function StaffPage() {
  const staff = await sanityClient.fetch(
    `*[_type == "staff"] | order(name asc) { _id, name, role, contactDetails, isActive }`
  )
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Staff</h1>
        <p className="text-sm text-gray-500 mt-1">Manage your service center team.</p>
      </div>
      <StaffPanel staff={staff} />
    </div>
  )
}
