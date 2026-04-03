export default function ContactPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-6">Contact Us</h1>

      <p className="text-slate-300 mb-6">
        Have questions, feedback, or need support? Reach out to us below.
      </p>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
        <div>
          <p className="text-sm text-slate-400">Email</p>
          <p className="text-white">support@itsreadyroster.com</p>
        </div>

        <div>
          <p className="text-sm text-slate-400">Phone</p>
          <p className="text-white">(781) 722-0338</p>
        </div>

        <div>
          <p className="text-sm text-slate-400">Business Hours</p>
          <p className="text-white">Monday – Friday, 9am – 5pm</p>
        </div>
      </div>
    </div>
  );
}