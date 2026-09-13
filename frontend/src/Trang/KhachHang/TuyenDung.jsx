const jobs = [
  {
    title: 'Chuyên viên vận hành tuyến',
    type: 'Toàn thời gian',
    location: 'TP. Hồ Chí Minh',
  },
  {
    title: 'Tài xế giao hàng nội thành',
    type: 'Theo ca',
    location: 'Đà Nẵng',
  },
  {
    title: 'Quản lý kho vận',
    type: 'Toàn thời gian',
    location: 'Hà Nội',
  },
];

export default function TuyenDung() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-16">
      <div className="mb-10 text-center">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-blue-600">Tuyển dụng</p>
        <h1 className="mt-3 text-4xl font-black text-slate-800">Tham gia đội ngũ Smart Logistics</h1>
      </div>

      <div className="space-y-5">
        {jobs.map((job) => (
          <div key={job.title} className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-xl font-bold text-slate-800">{job.title}</h3>
              <p className="mt-1 text-sm text-slate-500">{job.location}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-600">{job.type}</span>
              <button className="rounded-full bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-700">
                Ứng tuyển
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
