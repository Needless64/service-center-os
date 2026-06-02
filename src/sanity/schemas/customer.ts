import { defineField, defineType } from 'sanity'

export const customerSchema = defineType({
  name: 'customer',
  title: 'Customer',
  type: 'document',
  fields: [
    defineField({ name: 'customerId', title: 'Customer ID', type: 'string', readOnly: true }),
    defineField({ name: 'name', title: 'Name', type: 'string', validation: (r) => r.required() }),
    defineField({ name: 'phoneNumber', title: 'WhatsApp Number', type: 'string', validation: (r) => r.required() }),
    defineField({
      name: 'vehicles',
      title: 'Vehicles',
      type: 'array',
      of: [
        {
          type: 'object',
          fields: [
            defineField({ name: 'vehicleNumber', title: 'Vehicle Number', type: 'string' }),
            defineField({ name: 'vehicleModel', title: 'Model', type: 'string' }),
            defineField({ name: 'manufacturer', title: 'Manufacturer', type: 'string' }),
          ],
        },
      ],
    }),
    defineField({ name: 'totalVisits', title: 'Total Visits', type: 'number', initialValue: 0 }),
    defineField({ name: 'lastVisitDate', title: 'Last Visit Date', type: 'date' }),
    defineField({ name: 'createdAt', title: 'Created At', type: 'datetime', readOnly: true }),
  ],
  preview: {
    select: { title: 'name', subtitle: 'phoneNumber' },
  },
})
