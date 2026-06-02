import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { Calendar, MessageCircle, LayoutDashboard, LucideIcon, Bell } from 'lucide-react'
import { ReactNode } from 'react'

export function Features() {
  return (
    <section className="bg-zinc-50 py-16 md:py-32">
      <div className="mx-auto max-w-2xl px-6 lg:max-w-5xl">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl">
            Everything your service center needs
          </h2>
          <p className="mt-4 text-lg text-gray-500">
            Customers book on WhatsApp. Staff manage from a simple dashboard. No apps. No training.
          </p>
        </div>

        <div className="mx-auto grid gap-4 lg:grid-cols-2">
          {/* WhatsApp Booking */}
          <FeatureCard>
            <CardHeader className="pb-3">
              <CardHeading
                icon={MessageCircle}
                title="WhatsApp Booking"
                description="Customers book appointments in minutes — right from WhatsApp."
              />
            </CardHeader>
            <div className="relative mb-6 border-t border-dashed px-6 pt-6">
              <div className="rounded-xl bg-white border border-gray-100 shadow-sm p-4 space-y-3">
                <ChatBubble from="customer" text="My bike needs servicing" />
                <ChatBubble from="bot" text="Welcome! Select your service type 👇" />
                <div className="flex gap-2 flex-wrap">
                  {['Free Service', 'Paid Service', 'Repair'].map((s) => (
                    <span key={s} className="text-xs bg-green-50 border border-green-200 text-green-700 px-3 py-1.5 rounded-full font-medium">{s}</span>
                  ))}
                </div>
                <ChatBubble from="bot" text="✅ Booking confirmed! BK-20240602 — Tomorrow 10:00 AM" />
              </div>
            </div>
          </FeatureCard>

          {/* Smart reminders */}
          <FeatureCard>
            <CardHeader className="pb-3">
              <CardHeading
                icon={Bell}
                title="Automatic Reminders"
                description="No-show rate drops dramatically with 24h, 3h and 30-min reminders."
              />
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  { time: '24 hours before', msg: 'Reminder: Your service is tomorrow at 10 AM 📅', color: 'bg-blue-50 border-blue-100' },
                  { time: '3 hours before', msg: 'Your appointment is in 3 hours! See you soon 🔧', color: 'bg-yellow-50 border-yellow-100' },
                  { time: '30 minutes before', msg: '🚨 Your slot is in 30 minutes — please head over!', color: 'bg-orange-50 border-orange-100' },
                ].map((r) => (
                  <div key={r.time} className={`rounded-xl border ${r.color} p-3`}>
                    <p className="text-xs font-semibold text-gray-400 mb-1">{r.time}</p>
                    <p className="text-sm text-gray-700">{r.msg}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </FeatureCard>

          {/* Live dashboard */}
          <FeatureCard className="p-0 lg:col-span-2 overflow-hidden">
            <div className="p-8 pb-0">
              <CardHeading
                icon={LayoutDashboard}
                title="Live Workshop Dashboard"
                description="See every vehicle's status in real time. Tap one button to move it forward."
              />
            </div>
            <div className="px-8 py-6">
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: 'Booked', count: 4, color: 'bg-blue-50 border-blue-200 text-blue-700', vehicles: ['TS09AB1234', 'AP28CD5678'] },
                  { label: 'In Workshop', count: 2, color: 'bg-indigo-50 border-indigo-200 text-indigo-700', vehicles: ['TS01EF9012'] },
                  { label: 'Completed', count: 3, color: 'bg-green-50 border-green-200 text-green-700', vehicles: ['MH12GH3456', 'KA03IJ7890'] },
                ].map((col) => (
                  <div key={col.label}>
                    <div className={`rounded-lg border px-3 py-2 flex items-center justify-between mb-3 ${col.color}`}>
                      <span className="text-xs font-bold">{col.label}</span>
                      <span className="text-xs font-bold bg-white rounded-full w-5 h-5 flex items-center justify-center">{col.count}</span>
                    </div>
                    <div className="space-y-2">
                      {col.vehicles.map((v) => (
                        <div key={v} className="bg-white rounded-lg border border-gray-100 shadow-sm px-3 py-2">
                          <p className="text-xs font-bold text-gray-800 font-mono">{v}</p>
                          <p className="text-xs text-gray-400">General Service</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </FeatureCard>
        </div>
      </div>
    </section>
  )
}

// ─── Sub-components ──────────────────────────────────────────────────────────

interface FeatureCardProps { children: ReactNode; className?: string }
const FeatureCard = ({ children, className }: FeatureCardProps) => (
  <Card className={cn('group relative rounded-2xl shadow-sm border-gray-100', className)}>
    <CardDecorator />
    {children}
  </Card>
)

const CardDecorator = () => (
  <>
    <span className="border-green-500 absolute -left-px -top-px block size-2 border-l-2 border-t-2 rounded-tl-sm" />
    <span className="border-green-500 absolute -right-px -top-px block size-2 border-r-2 border-t-2 rounded-tr-sm" />
    <span className="border-green-500 absolute -bottom-px -left-px block size-2 border-b-2 border-l-2 rounded-bl-sm" />
    <span className="border-green-500 absolute -bottom-px -right-px block size-2 border-b-2 border-r-2 rounded-br-sm" />
  </>
)

interface CardHeadingProps { icon: LucideIcon; title: string; description: string }
const CardHeading = ({ icon: Icon, title, description }: CardHeadingProps) => (
  <div className="p-2">
    <span className="text-green-600 flex items-center gap-2 text-sm font-medium">
      <Icon className="size-4" />
      {title}
    </span>
    <p className="mt-3 text-xl font-semibold text-gray-900">{description}</p>
  </div>
)

const ChatBubble = ({ from, text }: { from: 'customer' | 'bot'; text: string }) => (
  <div className={cn('flex', from === 'customer' ? 'justify-end' : 'justify-start')}>
    <div className={cn('max-w-[80%] rounded-2xl px-3 py-2 text-xs', from === 'customer' ? 'bg-green-500 text-white rounded-br-sm' : 'bg-gray-100 text-gray-700 rounded-bl-sm')}>
      {text}
    </div>
  </div>
)
