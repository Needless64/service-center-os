import { defineConfig } from 'sanity'
import { structureTool } from 'sanity/structure'
import { schemaTypes } from './src/sanity/schemaTypes'

export default defineConfig({
  name: 'service-now',
  title: 'Service Center OS',
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET ?? 'production',
  plugins: [
    structureTool({ title: 'Service Center Admin',
      structure: (S) =>
        S.list()
          .title('Service Center OS')
          .items([
            S.listItem().title('Branches').schemaType('branch').child(S.documentTypeList('branch')),
            S.listItem().title('Staff').schemaType('staff').child(S.documentTypeList('staff')),
            S.divider(),
            S.listItem().title('Customers').schemaType('customer').child(S.documentTypeList('customer')),
            S.listItem().title('Bookings').schemaType('booking').child(
              S.documentTypeList('booking').defaultOrdering([{ field: 'scheduledDate', direction: 'desc' }])
            ),
            S.listItem().title('Slot Management').schemaType('slot').child(S.documentTypeList('slot')),
            S.listItem().title('Service Records').schemaType('serviceRecord').child(S.documentTypeList('serviceRecord')),
          ]),
    }),
  ],
  schema: { types: schemaTypes },
})
