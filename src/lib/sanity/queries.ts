import { defineQuery } from 'groq'
import { readClient, sanityClient } from './client'

// ─── Types ─────────────────────────────────────────────────────────────────

export type SanityCustomer = {
  _id: string
  customerId: string
  name: string
  phoneNumber: string
  vehicles: { vehicleNumber: string; vehicleModel: string; manufacturer: string }[]
  totalVisits: number
  lastVisitDate?: string
  createdAt?: string
}

export type SanityBooking = {
  _id: string
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
  createdAt?: string
  updatedAt?: string
}

export type SanitySlot = {
  _id: string
  date: string
  time: string
  capacity: number
  currentBookings: number
  isBlocked: boolean
}

export type SanityBranch = {
  _id: string
  name: string
  workingDays: string[]
  workingHours: { start: string; end: string }
  slotDurationMinutes: number
  capacityPerSlot: number
  holidays: string[]
  whatsappGreeting?: string
}

// ─── Customer queries ────────────────────────────────────────────────────────

const customerByPhoneQuery = defineQuery(`*[_type == "customer" && phoneNumber == $phone][0]`)

export async function getCustomerByPhone(phone: string): Promise<SanityCustomer | null> {
  return sanityClient.fetch(customerByPhoneQuery, { phone })
}

// ─── Booking queries ─────────────────────────────────────────────────────────

const bookingByIdQuery = defineQuery(`*[_type == "booking" && bookingId == $bookingId][0]{
  ...,
  customer->{ _id, name, phoneNumber }
}`)

export async function getBookingById(bookingId: string): Promise<SanityBooking | null> {
  return readClient.fetch(bookingByIdQuery, { bookingId })
}

const bookingsByDateQuery = defineQuery(`*[_type == "booking" && scheduledDate == $date] | order(scheduledTime asc){
  ...,
  customer->{ _id, name, phoneNumber }
}`)

export async function getBookingsByDate(date: string): Promise<SanityBooking[]> {
  return sanityClient.fetch(bookingsByDateQuery, { date })
}

const activeBookingForCustomerQuery = defineQuery(`*[_type == "booking" && customer._ref == $customerId && status in ["booked","received"]] | order(scheduledDate desc)[0]`)

export async function getActiveBookingForCustomer(customerId: string): Promise<SanityBooking | null> {
  return sanityClient.fetch(activeBookingForCustomerQuery, { customerId })
}

const allActiveBookingsForCustomerQuery = defineQuery(`*[_type == "booking" && customer._ref == $customerId && status in ["booked","received"]] | order(scheduledDate asc)`)

export async function getAllActiveBookingsForCustomer(customerId: string): Promise<SanityBooking[]> {
  return sanityClient.fetch(allActiveBookingsForCustomerQuery, { customerId })
}

const upcomingBookingsForRemindersQuery = defineQuery(`*[_type == "booking" && status == "booked" && scheduledDate >= $today]{
  ...,
  customer->{ _id, name, phoneNumber }
}`)

export async function getUpcomingBookingsForReminders(today: string): Promise<SanityBooking[]> {
  return sanityClient.fetch(upcomingBookingsForRemindersQuery, { today })
}

const todayDashboardQuery = defineQuery(`{
  "bookings": *[_type == "booking" && scheduledDate == $today]{
    ...,
    customer->{ name, phoneNumber }
  },
  "slots": *[_type == "slot" && date == $today] | order(time asc)
}`)

export async function getTodayDashboard(today: string) {
  return sanityClient.fetch(todayDashboardQuery, { today })
}

// ─── Slot queries ────────────────────────────────────────────────────────────

const availableSlotsQuery = defineQuery(`*[_type == "slot" && date in $dates && isBlocked != true && currentBookings < capacity] | order(date asc, time asc)`)

export async function getAvailableSlots(dates: string[]): Promise<SanitySlot[]> {
  return sanityClient.fetch(availableSlotsQuery, { dates })
}

const slotQuery = defineQuery(`*[_type == "slot" && date == $date && time == $time][0]`)

export async function getSlot(date: string, time: string): Promise<SanitySlot | null> {
  return readClient.fetch(slotQuery, { date, time })
}

// ─── Branch queries ──────────────────────────────────────────────────────────

const defaultBranchQuery = defineQuery(`*[_type == "branch" && isActive == true][0]`)

export async function getDefaultBranch(): Promise<SanityBranch | null> {
  return sanityClient.fetch(defaultBranchQuery)
}

// ─── Analytics queries ───────────────────────────────────────────────────────

const analyticsQuery = defineQuery(`{
  "totalBookings": count(*[_type == "booking" && scheduledDate >= $startDate && scheduledDate <= $endDate]),
  "completed": count(*[_type == "booking" && scheduledDate >= $startDate && scheduledDate <= $endDate && status == "delivered"]),
  "cancelled": count(*[_type == "booking" && scheduledDate >= $startDate && scheduledDate <= $endDate && status == "cancelled"]),
  "noShow": count(*[_type == "booking" && scheduledDate >= $startDate && scheduledDate <= $endDate && status == "no_show"]),
  "newCustomers": count(*[_type == "customer" && createdAt >= $startDate + "T00:00:00Z"])
}`)

export async function getAnalytics(startDate: string, endDate: string) {
  return sanityClient.fetch(analyticsQuery, { startDate, endDate })
}

const allBookingsForSheetsQuery = defineQuery(`*[_type == "booking"] | order(scheduledDate desc){
  bookingId, vehicleNumber, vehicleModel, serviceType, scheduledDate, scheduledTime, status, estimatedCost, finalCost, createdAt,
  customer->{ name, phoneNumber }
}`)

export async function getAllBookingsForSheets(): Promise<SanityBooking[]> {
  return sanityClient.fetch(allBookingsForSheetsQuery)
}
