import { NextRequest, NextResponse } from 'next/server'
import { sanityClient } from '@/lib/sanity/client'

export async function PATCH(req: NextRequest) {
  try {
    const { bookingDocId, status } = await req.json()
    if (!bookingDocId || !status) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }
    await sanityClient.patch(bookingDocId).set({ status, updatedAt: new Date().toISOString() }).commit()
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[admin/bookings PATCH]', err)
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }
}
