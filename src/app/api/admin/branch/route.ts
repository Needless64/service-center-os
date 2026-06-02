import { NextRequest, NextResponse } from 'next/server'
import { sanityClient } from '@/lib/sanity/client'
import { getDefaultBranch } from '@/lib/sanity/queries'

export async function GET() {
  const branch = await getDefaultBranch()
  return NextResponse.json(branch ?? {})
}

export async function POST(req: NextRequest) {
  try {
    const { branchId, name, location, workingDays, workingHours, capacityPerSlot, slotDurationMinutes, whatsappGreeting } = await req.json()

    if (branchId) {
      await sanityClient.patch(branchId).set({
        name, location, workingDays, workingHours,
        capacityPerSlot, slotDurationMinutes, whatsappGreeting,
      }).commit()
    } else {
      await sanityClient.create({
        _type: 'branch', name, location, workingDays, workingHours,
        capacityPerSlot, slotDurationMinutes, whatsappGreeting, isActive: true,
      })
    }
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[admin/branch]', err)
    return NextResponse.json({ error: 'Save failed' }, { status: 500 })
  }
}
