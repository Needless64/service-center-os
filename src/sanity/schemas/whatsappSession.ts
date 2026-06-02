import { defineField, defineType } from 'sanity'

export const whatsappSessionSchema = defineType({
  name: 'whatsappSession',
  title: 'WhatsApp Session',
  type: 'document',
  fields: [
    defineField({ name: 'phone', title: 'Phone', type: 'string' }),
    defineField({ name: 'data', title: 'Session Data', type: 'object', fields: [] }),
    defineField({ name: 'lastActivity', title: 'Last Activity', type: 'number' }),
  ],
})
