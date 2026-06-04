import { sanityClient } from '@/lib/sanity/client'
import { CustomersPanel } from '@/components/admin/CustomersPanel'

export const dynamic = 'force-dynamic'

export default async function CustomersPage() {
  const customers = await sanityClient.fetch(
    `*[_type == "customer"] | order(totalVisits desc, name asc) {
      _id, customerId, name, phoneNumber, totalVisits, lastVisitDate,
      vehicles[]{ vehicleNumber, vehicleModel }
    }`
  )
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
        <p className="text-sm text-gray-500 mt-1">{customers.length} customers registered.</p>
      </div>
      <CustomersPanel customers={customers} />
    </div>
  )
}
