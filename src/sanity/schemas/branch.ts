import { defineField, defineType } from 'sanity'

export const branchSchema = defineType({
  name: 'branch',
  title: 'Branch',
  type: 'document',
  fields: [
    defineField({ name: 'name', title: 'Branch Name', type: 'string', validation: (r) => r.required() }),
    defineField({ name: 'location', title: 'Location / Address', type: 'text' }),
    defineField({
      name: 'workingDays',
      title: 'Working Days',
      type: 'array',
      of: [{ type: 'string' }],
      options: {
        list: [
          'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
        ],
      },
      initialValue: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    }),
    defineField({
      name: 'workingHours',
      title: 'Working Hours',
      type: 'object',
      fields: [
        defineField({ name: 'start', title: 'Start (HH:MM)', type: 'string', initialValue: '09:00' }),
        defineField({ name: 'end', title: 'End (HH:MM)', type: 'string', initialValue: '18:00' }),
      ],
    }),
    defineField({ name: 'slotDurationMinutes', title: 'Slot Duration (minutes)', type: 'number', initialValue: 60 }),
    defineField({ name: 'capacityPerSlot', title: 'Vehicles Per Slot', type: 'number', initialValue: 5 }),
    defineField({
      name: 'holidays',
      title: 'Holidays / Closures',
      type: 'array',
      of: [{ type: 'date' }],
    }),
    defineField({ name: 'whatsappGreeting', title: 'WhatsApp Greeting', type: 'text', initialValue: 'Welcome to our Service Center! How can we help you today?' }),
    defineField({ name: 'isActive', title: 'Active', type: 'boolean', initialValue: true }),
  ],
  preview: {
    select: { title: 'name', subtitle: 'location' },
  },
})
