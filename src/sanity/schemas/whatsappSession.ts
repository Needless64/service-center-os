import { defineField, defineType } from "sanity";

export const whatsappSessionSchema = defineType({
  name: "whatsappSession",
  title: "WhatsApp Session",
  type: "document",
  fields: [
    defineField({
      name: "phone",
      title: "Phone Number",
      type: "string",
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "status",
      title: "Status",
      type: "string",
      options: {
        list: [
          { title: "Connected", value: "connected" },
          { title: "Disconnected", value: "disconnected" },
          { title: "Connecting", value: "connecting" },
          { title: "Error", value: "error" },
        ],
      },
      initialValue: "disconnected",
    }),
    defineField({
      name: "data",
      title: "Session Data",
      type: "object",
      fields: [
        defineField({
          name: "clientId",
          title: "Client ID",
          type: "string",
        }),
        defineField({
          name: "serverToken",
          title: "Server Token",
          type: "string",
        }),
        defineField({
          name: "clientToken",
          title: "Client Token",
          type: "string",
        }),
        defineField({
          name: "encKey",
          title: "Encryption Key",
          type: "string",
        }),
        defineField({
          name: "macKey",
          title: "MAC Key",
          type: "string",
        }),
        defineField({
          name: "qr",
          title: "QR Code",
          type: "string",
          description: "Base64 encoded QR code for authentication",
        }),
        defineField({
          name: "pairingCode",
          title: "Pairing Code",
          type: "string",
        }),
      ],
    }),
    defineField({
      name: "lastActivity",
      title: "Last Activity",
      type: "datetime",
      description: "Timestamp of the last activity in this session",
    }),
    defineField({
      name: "createdAt",
      title: "Created At",
      type: "datetime",
      initialValue: () => new Date().toISOString(),
    }),
    defineField({
      name: "updatedAt",
      title: "Updated At",
      type: "datetime",
      initialValue: () => new Date().toISOString(),
    }),
  ],
  preview: {
    select: {
      title: "phone",
      subtitle: "status",
    },
  },
});
