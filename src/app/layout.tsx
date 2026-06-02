import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Service Center OS',
  description: 'WhatsApp-Powered Digital Service Receptionist & Service Center Operating System',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900 antialiased">{children}</body>
    </html>
  )
}
