import { getDefaultBranch } from '@/lib/sanity/queries'
import { BranchSettingsForm } from '@/components/admin/BranchSettingsForm'

export const dynamic = 'force-dynamic'

export default async function AdminSettingsPage() {
  const branch = await getDefaultBranch()
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Branch Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Configure your service center&apos;s working schedule and capacity.</p>
      </div>
      <BranchSettingsForm branch={branch} />
    </div>
  )
}
