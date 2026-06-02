import { NextRequest, NextResponse } from 'next/server'
import { sanityClient } from '@/lib/sanity/client'

export async function GET() {
  const staff = await sanityClient.fetch(
    `*[_type == "staff"] | order(name asc) { _id, name, role, contactDetails, isActive }`
  )
  return NextResponse.json(staff)
}

export async function POST(req: NextRequest) {
  const { name, role, contactDetails } = await req.json()
  await sanityClient.create({ _type: 'staff', name, role, contactDetails, isActive: true })
  return NextResponse.json({ success: true })
}

export async function PATCH(req: NextRequest) {
  const { id, isActive } = await req.json()
  await sanityClient.patch(id).set({ isActive }).commit()
  return NextResponse.json({ success: true })
}
