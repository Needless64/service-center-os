import { defineField, defineType } from 'sanity'

export const serviceRecordSchema = defineType({
  name: 'serviceRecord',
  title: 'Service Record',
  type: 'document',
  fields: [
    defineField({
      name: 'booking',
      title: 'Booking',
      type: 'reference',
      to: [{ type: 'booking' }],
      validation: (r) => r.required(),
    }),
    defineField({ name: 'inspectionNotes', title: 'Inspection Notes', type: 'text' }),
    defineField({ name: 'workDone', title: 'Work Done', type: 'text' }),
    defineField({ name: 'partsReplaced', title: 'Parts Replaced', type: 'text' }),
    defineField({ name: 'costEstimate', title: 'Cost Estimate (₹)', type: 'number' }),
    defineField({ name: 'finalCost', title: 'Final Cost (₹)', type: 'number' }),
    defineField({ name: 'completionDate', title: 'Completion Date', type: 'datetime' }),
    defineField({ name: 'technicianNotes', title: 'Technician Notes', type: 'text' }),
  ],
  preview: {
    select: { title: 'booking.bookingId' },
    prepare({ title }) {
      return { title: `Service Record — ${title}` }
    },
  },
})
