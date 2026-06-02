import Link from 'next/link'
import { Features } from '@/components/blocks/features-10'
import { MessageCircle, ArrowRight } from 'lucide-react'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <header className="border-b border-gray-100 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-green-600 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-sm">SC</div>
            <span className="font-bold text-gray-900">Service Center OS</span>
          </div>
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 text-sm font-medium bg-gray-900 text-white px-4 py-2 rounded-xl hover:bg-gray-700 transition-colors"
          >
            Open Dashboard <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="pt-20 pb-16 px-6 text-center">
        <div className="inline-flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 text-xs font-medium px-3 py-1.5 rounded-full mb-6">
          <MessageCircle className="size-3.5" />
          100% WhatsApp — No app needed
        </div>
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 leading-tight max-w-3xl mx-auto">
          Your service center,<br />
          <span className="text-green-600">running on WhatsApp</span>
        </h1>
        <p className="mt-6 text-lg text-gray-500 max-w-xl mx-auto">
          Customers book via WhatsApp. Staff manage from a dashboard. Auto-reminders reduce no-shows. No training required.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 bg-green-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-green-700 transition-colors shadow-sm"
          >
            Open Dashboard <ArrowRight className="size-4" />
          </Link>
          <Link
            href="/admin"
            className="flex items-center gap-2 border border-gray-200 text-gray-700 px-6 py-3 rounded-xl font-semibold hover:bg-gray-50 transition-colors"
          >
            Admin Panel
          </Link>
        </div>
      </section>

      {/* Stats strip */}
      <section className="border-y border-gray-100 bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-6 grid grid-cols-3 gap-6 text-center">
          {[
            { value: '90%+', label: 'Bookings via WhatsApp' },
            { value: '0', label: 'Double bookings' },
            { value: '30%↓', label: 'No-show reduction' },
          ].map((s) => (
            <div key={s.label}>
              <p className="text-3xl font-bold text-gray-900">{s.value}</p>
              <p className="text-sm text-gray-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <Features />

      {/* Footer */}
      <footer className="border-t border-gray-100 py-8 text-center text-sm text-gray-400">
        Service Center OS — WhatsApp-Powered Digital Receptionist
      </footer>
    </div>
  )
}
