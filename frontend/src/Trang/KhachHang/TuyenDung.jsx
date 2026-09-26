import { useState } from 'react';
import { X } from 'lucide-react';

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
  const [viTriDangUngTuyen, setViTriDangUngTuyen] = useState(null);
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', experience: '', message: '' });
  const [dangGui, setDangGui] = useState(false);
  const [thongBao, setThongBao] = useState('');
  const [guiThanhCong, setGuiThanhCong] = useState(false);

  const guiHoSo = async (event) => {
    event.preventDefault();
    setDangGui(true);
    setThongBao('');
    try {
      const response = await fetch('http://localhost:5000/api/public/job-applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, job_title: viTriDangUngTuyen.title })
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Không gửi được hồ sơ.');
      setGuiThanhCong(true);
    } catch (error) {
      setThongBao(error.message || 'Không thể kết nối máy chủ. Vui lòng thử lại.');
    } finally {
      setDangGui(false);
    }
  };

  const dongForm = () => {
    setViTriDangUngTuyen(null);
    setThongBao('');
    setGuiThanhCong(false);
    setForm({ full_name: '', email: '', phone: '', experience: '', message: '' });
  };

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
              <button type="button" onClick={() => { setViTriDangUngTuyen(job); setGuiThanhCong(false); }} className="rounded-full bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-700">
                Ứng tuyển
              </button>
            </div>
          </div>
        ))}
      </div>

      {viTriDangUngTuyen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <section role="dialog" aria-modal="true" aria-labelledby="application-title" className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-600">Ứng tuyển</p>
                <h2 id="application-title" className="mt-2 text-2xl font-black text-slate-800">{viTriDangUngTuyen.title}</h2>
                <p className="mt-1 text-sm text-slate-500">{viTriDangUngTuyen.location} · {viTriDangUngTuyen.type}</p>
              </div>
              <button type="button" aria-label="Đóng" onClick={dongForm} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={20} /></button>
            </div>

            {guiThanhCong ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-800">
                <p className="font-bold">Đã nhận hồ sơ ứng tuyển.</p>
                <p className="mt-1 text-sm">Bộ phận Nhân sự sẽ xem xét và liên hệ với bạn.</p>
                <button type="button" onClick={dongForm} className="mt-4 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-bold text-white">Đóng</button>
              </div>
            ) : (
              <form onSubmit={guiHoSo} className="space-y-4">
                <label className="block text-sm font-bold text-slate-700">Họ và tên<input required maxLength="255" value={form.full_name} onChange={(event) => setForm({ ...form, full_name: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 p-3 font-normal" autoComplete="name" /></label>
                <label className="block text-sm font-bold text-slate-700">Email<input required type="email" maxLength="255" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 p-3 font-normal" autoComplete="email" /></label>
                <label className="block text-sm font-bold text-slate-700">Số điện thoại<input required type="tel" maxLength="50" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 p-3 font-normal" autoComplete="tel" /></label>
                <label className="block text-sm font-bold text-slate-700">Kinh nghiệm<textarea rows="3" maxLength="2000" value={form.experience} onChange={(event) => setForm({ ...form, experience: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 p-3 font-normal" placeholder="Mô tả kinh nghiệm phù hợp với vị trí..." /></label>
                <label className="block text-sm font-bold text-slate-700">Lời nhắn<textarea rows="2" maxLength="2000" value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 p-3 font-normal" /></label>
                {thongBao && <p role="alert" className="text-sm font-medium text-red-600">{thongBao}</p>}
                <button type="submit" disabled={dangGui} className="w-full rounded-lg bg-slate-900 px-4 py-3 font-bold text-white hover:bg-slate-700 disabled:opacity-60">{dangGui ? 'Đang gửi...' : 'Gửi hồ sơ'}</button>
              </form>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
