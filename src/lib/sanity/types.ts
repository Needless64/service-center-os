import { SanityDocument } from '@sanity/client'

export interface SanityCustomer extends SanityDocument {
  _type: 'customer'
  customerId: string
  name: string
  phoneNumber?: string | null
  vehicles: {
    _key: string
    vehicleNumber: string
    vehicleModel: string
    manufacturer: string
  }[]
  totalVisits: number
  lastVisitDate?: string
  createdAt?: string
}

export interface SanityBooking extends SanityDocument {
  _type: 'booking'
  bookingId: string
  customer: { _ref: string; name?: string; phoneNumber?: string }
  vehicleNumber: string
  vehicleModel?: string
  manufacturer?: string
  serviceType: string
  scheduledDate: string
  scheduledTime: string
  status: string
  notes?: string
  inspectionNotes?: string
  estimatedCost?: number
  finalCost?: number
  reminderSent24h?: boolean
  reminderSent3h?: boolean
  reminderSent30m?: boolean
  confirmedAt?: string
  createdAt?: string
  updatedAt?: string
}

export interface SanitySlot extends SanityDocument {
  _type: 'slot'
  date: string
  time: string
  capacity: number
  currentBookings: number
  isBlocked: boolean
}

export interface SanityBranch extends SanityDocument {
  _type: 'branch'
  name: string
  workingDays: string[]
  workingHours: { start: string; end: string }
  slotDurationMinutes: number
  capacityPerSlot: number
  holidays: string[]
  whatsappGreeting?: string
}