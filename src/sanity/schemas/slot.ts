import { defineField, defineType } from 'sanity'

export const slotSchema = defineType({
  name: 'slot',
  title: 'Slot',
  type: 'document',
  fields: [
    defineField({ name: 'date', title: 'Date', type: 'date', validation: (r) => r.required() }),
    defineField({ name: 'time', title: 'Time (HH:MM)', type: 'string', validation: (r) => r.required() }),
    defineField({ name: 'capacity', title: 'Max Vehicles', type: 'number', initialValue: 10, validation: (r) => r.required().min(1) }),
    defineField({ name: 'currentBookings', title: 'Current Bookings', type: 'number', initialValue: 0, readOnly: true }),
    defineField({ name: 'isBlocked', title: 'Blocked', type: 'boolean', initialValue: false }),
    defineField({
      name: 'branch',
      title: 'Branch',
      type: 'reference',
      to: [{ type: 'branch' }],
    }),
  ],
  preview: {
    select: { title: 'date', subtitle: 'time' },
    prepare({ title, subtitle }) {
      return { title: `${title} @ ${subtitle}` }
    },
  },
})
