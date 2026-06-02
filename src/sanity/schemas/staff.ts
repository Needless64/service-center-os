import { defineField, defineType } from 'sanity'

export const staffSchema = defineType({
  name: 'staff',
  title: 'Staff',
  type: 'document',
  fields: [
    defineField({ name: 'name', title: 'Name', type: 'string', validation: (r) => r.required() }),
    defineField({
      name: 'role',
      title: 'Role',
      type: 'string',
      options: {
        list: [
          { title: 'Service Advisor', value: 'advisor' },
          { title: 'Technician', value: 'technician' },
          { title: 'Manager', value: 'manager' },
          { title: 'Receptionist', value: 'receptionist' },
        ],
      },
      validation: (r) => r.required(),
    }),
    defineField({ name: 'contactDetails', title: 'Phone / Contact', type: 'string' }),
    defineField({
      name: 'branch',
      title: 'Branch',
      type: 'reference',
      to: [{ type: 'branch' }],
    }),
    defineField({ name: 'isActive', title: 'Active', type: 'boolean', initialValue: true }),
  ],
  preview: {
    select: { title: 'name', subtitle: 'role' },
  },
})
