import { google } from 'googleapis'
import { getAllBookingsForSheets } from '../sanity/queries'
import { format } from 'date-fns'

function getAuth() {
  return new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })
}

const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_SPREADSHEET_ID!

// ─── Sync all bookings to "Bookings" sheet ───────────────────────────────────

export async function syncBookingsToSheets() {
  const auth = getAuth()
  const sheets = google.sheets({ version: 'v4', auth })

  const bookings = await getAllBookingsForSheets()

  const headers = [
    'Booking ID', 'Customer Name', 'Phone', 'Vehicle Number', 'Vehicle Model',
    'Service Type', 'Date', 'Time', 'Status', 'Estimated Cost', 'Final Cost', 'Created At',
  ]

  const rows = bookings.map((b) => {
    const customer = b.customer as unknown as { name?: string; phoneNumber?: string }
    return [
      b.bookingId,
      customer?.name ?? '',
      customer?.phoneNumber ?? '',
      b.vehicleNumber,
      b.vehicleModel ?? '',
      b.serviceType,
      b.scheduledDate,
      b.scheduledTime,
      b.status,
      b.estimatedCost ?? '',
      b.finalCost ?? '',
      b.createdAt ? format(new Date(b.createdAt), 'yyyy-MM-dd HH:mm') : '',
    ]
  })

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Bookings!A1',
    valueInputOption: 'RAW',
    requestBody: { values: [headers, ...rows] },
  })

  return rows.length
}

// ─── Sync today's schedule ───────────────────────────────────────────────────

export async function syncDailySchedule(dateStr: string) {
  const auth = getAuth()
  const sheets = google.sheets({ version: 'v4', auth })

  const { getBookingsByDate } = await import('../sanity/queries')
  const bookings = await getBookingsByDate(dateStr)

  const headers = ['Time', 'Booking ID', 'Customer', 'Phone', 'Vehicle', 'Service Type', 'Status', 'Notes']
  const rows = bookings.map((b) => {
    const customer = b.customer as unknown as { name?: string; phoneNumber?: string }
    return [
      b.scheduledTime,
      b.bookingId,
      customer?.name ?? '',
      customer?.phoneNumber ?? '',
      b.vehicleNumber,
      b.serviceType,
      b.status,
      b.notes ?? '',
    ]
  })

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Daily Schedule!A1',
    valueInputOption: 'RAW',
    requestBody: { values: [headers, ...rows] },
  })

  return rows.length
}

// ─── Sync analytics summary ──────────────────────────────────────────────────

export async function syncAnalytics(startDate: string, endDate: string) {
  const auth = getAuth()
  const sheets = google.sheets({ version: 'v4', auth })

  const { getAnalytics } = await import('../sanity/queries')
  const analytics = await getAnalytics(startDate, endDate)

  const rows = [
    ['Metric', 'Value', 'Period'],
    ['Total Bookings', analytics.totalBookings, `${startDate} → ${endDate}`],
    ['Completed', analytics.completed, ''],
    ['Cancelled', analytics.cancelled, ''],
    ['No Shows', analytics.noShow, ''],
    ['New Customers', analytics.newCustomers, ''],
    ['Completion Rate', analytics.totalBookings > 0 ? `${Math.round((analytics.completed / analytics.totalBookings) * 100)}%` : '0%', ''],
    ['Cancellation Rate', analytics.totalBookings > 0 ? `${Math.round((analytics.cancelled / analytics.totalBookings) * 100)}%` : '0%', ''],
  ]

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Analytics!A1',
    valueInputOption: 'RAW',
    requestBody: { values: rows },
  })
}
