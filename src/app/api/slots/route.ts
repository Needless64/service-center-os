import { NextRequest, NextResponse } from 'next/server'
import { getNextAvailableSlots } from '@/lib/whatsapp/slotHelper'
import { sanityClient } from '@/lib/sanity/client'
import { format } from 'date-fns'

// GET /api/slots — returns next available slots
export async function GET() {
  const slots = await getNextAvailableSlots(5)
  return NextResponse.json(slots)
}

// POST /api/slots — block/unblock a slot
// Body: { slotId, isBlocked }
export async function POST(req: NextRequest) {
  try {
    const { slotId, isBlocked } = await req.json()
    await sanityClient.patch(slotId).set({ isBlocked }).commit()
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[slots POST]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
