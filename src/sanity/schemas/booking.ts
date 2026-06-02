import { defineField, defineType } from 'sanity'

export const SERVICE_TYPES = [
  { title: 'Free Service', value: 'free_service' },
  { title: 'General Paid Service', value: 'paid_service' },
  { title: 'Repair / Diagnosis', value: 'repair_diagnosis' },
  { title: 'Emergency', value: 'emergency' },
  { title: 'Other', value: 'other' },
]

export const BOOKING_STATUSES = [
  { title: 'Booked', value: 'booked' },
  { title: 'Received', value: 'received' },
  { title: 'Completed', value: 'completed' },
  { title: 'Cancelled', value: 'cancelled' },
  { title: 'No Show', value: 'no_show' },
]

export const bookingSchema = defineType({
  name: 'booking',
  title: 'Booking',
  type: 'document',
  fields: [
    defineField({ name: 'bookingId', title: 'Booking ID', type: 'string', readOnly: true }),
    defineField({
      name: 'customer',
      title: 'Customer',
      type: 'reference',
      to: [{ type: 'customer' }],
      validation: (r) => r.required(),
    }),
    defineField({ name: 'vehicleNumber', title: 'Vehicle Number', type: 'string', validation: (r) => r.required() }),
    defineField({ name: 'vehicleModel', title: 'Vehicle Model', type: 'string' }),
    defineField({ name: 'manufacturer', title: 'Manufacturer', type: 'string' }),
    defineField({
      name: 'serviceType',
      title: 'Service Type',
      type: 'string',
      options: { list: SERVICE_TYPES },
      validation: (r) => r.required(),
    }),
    defineField({ name: 'scheduledDate', title: 'Scheduled Date', type: 'date', validation: (r) => r.required() }),
    defineField({ name: 'scheduledTime', title: 'Scheduled Time', type: 'string', validation: (r) => r.required() }),
    defineField({
      name: 'status',
      title: 'Status',
      type: 'string',
      options: { list: BOOKING_STATUSES },
      initialValue: 'booked',
      validation: (r) => r.required(),
    }),
    defineField({ name: 'notes', title: 'Customer Notes', type: 'text' }),
    defineField({
      name: 'assignedAdvisor',
      title: 'Assigned Advisor',
      type: 'reference',
      to: [{ type: 'staff' }],
    }),
    defineField({ name: 'inspectionNotes', title: 'Inspection Notes', type: 'text' }),
    defineField({ name: 'estimatedCost', title: 'Estimated Cost (₹)', type: 'number' }),
    defineField({ name: 'finalCost', title: 'Final Cost (₹)', type: 'number' }),
    defineField({ name: 'estimatedCompletionTime', title: 'Estimated Completion', type: 'datetime' }),
    defineField({ name: 'completedAt', title: 'Completed At', type: 'datetime' }),
    defineField({ name: 'reminderSent24h', title: '24h Reminder Sent', type: 'boolean', initialValue: false }),
    defineField({ name: 'reminderSent3h', title: '3h Reminder Sent', type: 'boolean', initialValue: false }),
    defineField({ name: 'reminderSent30m', title: '30m Reminder Sent', type: 'boolean', initialValue: false }),
    defineField({ name: 'createdAt', title: 'Created At', type: 'datetime', readOnly: true }),
    defineField({ name: 'updatedAt', title: 'Updated At', type: 'datetime' }),
  ],
  preview: {
    select: {
      title: 'bookingId',
      subtitle: 'vehicleNumber',
      status: 'status',
    },
    prepare({ title, subtitle, status }) {
      return { title: `${title} — ${subtitle}`, subtitle: status }
    },
  },
  orderings: [
    {
      title: 'Scheduled Date (newest)',
      name: 'scheduledDateDesc',
      by: [{ field: 'scheduledDate', direction: 'desc' }],
    },
  ],
})
