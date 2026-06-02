export default function PrivacyPage() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-16">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Privacy Policy</h1>
      <p className="text-gray-500 text-sm mb-6">Last updated: June 2026</p>
      <div className="space-y-6 text-gray-700">
        <section>
          <h2 className="text-xl font-semibold mb-2">Data We Collect</h2>
          <p>We collect your name, phone number, and vehicle information when you book a service appointment via WhatsApp. This data is used solely to manage your service bookings.</p>
        </section>
        <section>
          <h2 className="text-xl font-semibold mb-2">How We Use It</h2>
          <p>Your data is used to schedule appointments, send reminders, and maintain your service history with our service center.</p>
        </section>
        <section>
          <h2 className="text-xl font-semibold mb-2">WhatsApp Messaging</h2>
          <p>By messaging our WhatsApp number, you consent to receive booking confirmations and service reminders via WhatsApp.</p>
        </section>
        <section>
          <h2 className="text-xl font-semibold mb-2">Data Retention</h2>
          <p>We retain your booking history for up to 2 years. You may request deletion at any time by contacting us.</p>
        </section>
        <section>
          <h2 className="text-xl font-semibold mb-2">Contact</h2>
          <p>For privacy concerns, contact us via WhatsApp or visit our service center.</p>
        </section>
      </div>
    </div>
  )
}
