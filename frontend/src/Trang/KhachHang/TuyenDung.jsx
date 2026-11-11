import { apiFetch as fetch, API_URL } from '../../utils/apiFetch.js';
import { useState } from 'react';
import { X, Briefcase, MapPin, Clock, CheckCircle2, ArrowRight, Sparkles } from 'lucide-react';

const jobs = [
  {
    title: 'Chuyên Viên Điều Phối Vận Tải (Dispatcher)',
    type: 'Toàn thời gian',
    location: 'Tổng kho Gò Vấp, TP.HCM',
    salary: '12.000.000đ - 18.000.000đ',
    description: 'Chịu trách nhiệm phân bổ đơn hàng tự động, theo dõi SLA tài xế và xử lý sự cố phát sinh trên lộ trình.'
  },
  {
    title: 'Tài Xế Giao Hàng Nội Thành (Shipper Bưu Tá)',
    type: 'Theo ca / Linh hoạt',
    location: 'Quận Gò Vấp & Lân Cận',
    salary: '15.000.000đ - 25.000.000đ',
    description: 'Lấy và giao hàng trong khu vực phân công, thu tiền COD và đồng bộ trạng thái qua ứng dụng di động.'
  },
  {
    title: 'Thủ Kho Vận Hành & Phân Loại Hàng Hóa',
    type: 'Toàn thời gian',
    location: 'Kho Trung Tâm Gò Vấp',
    salary: '10.000.000đ - 14.000.000đ',
    description: 'Bắn mã vạch kiểm kê, quản lý vị trí bin kệ, đóng bao kiện và xuất nhập hàng liên bưu cục.'
  },
  {
    title: 'Chuyên Viên Chăm Sóc Khách Hàng (CSKH)',
    type: 'Xoay ca',
    location: 'Văn phòng Gò Vấp, TP.HCM',
    salary: '9.000.000đ - 13.000.000đ',
    description: 'Trực tổng đài 1900 8095, hỗ trợ qua widget chat trực tuyến và giải quyết khiếu nại của Shop.'
  }
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
      const response = await fetch(`${API_URL}/api/public/job-applications`, {
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
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      
      {/* Header */}
      <div className="mb-12 text-center max-w-2xl mx-auto space-y-3">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-black uppercase tracking-wider border border-blue-200">
          <Briefcase size={14} className="text-blue-600" />
          Cơ Hội Nghề Nghiệp
        </span>
        <h1 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight">
          Gia Nhập Đội Ngũ Smart Logistics
        </h1>
        <p className="text-slate-500 text-xs sm:text-sm font-medium">
          Môi trường năng động, công nghệ tự động hóa hiện đại và chế độ đãi ngộ cạnh tranh hàng đầu thị trường.
        </p>
      </div>

      {/* Job list */}
      <div className="space-y-4">
        {jobs.map((job) => (
          <div
            key={job.title}
            className="rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-8 shadow-soft-sm hover:shadow-soft-md hover:border-blue-300 transition-all flex flex-col md:flex-row md:items-center justify-between gap-6"
          >
            <div className="space-y-2 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-blue-50 text-blue-700 border border-blue-200 px-3 py-0.5 text-[11px] font-bold">
                  {job.type}
                </span>
                <span className="rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-0.5 text-[11px] font-black">
                  {job.salary}
                </span>
              </div>
              <h3 className="text-lg sm:text-xl font-black text-slate-900">{job.title}</h3>
              <p className="text-xs text-slate-500 font-medium leading-relaxed max-w-2xl">
                {job.description}
              </p>
              <div className="flex items-center gap-4 text-xs font-bold text-slate-400 pt-1">
                <span className="flex items-center gap-1.5"><MapPin size={14} className="text-blue-600" /> {job.location}</span>
              </div>
            </div>

            <div className="shrink-0">
              <button
                type="button"
                onClick={() => { setViTriDangUngTuyen(job); setGuiThanhCong(false); }}
                className="w-full md:w-auto px-6 py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-black text-xs sm:text-sm shadow-md shadow-blue-500/20 transition-all flex items-center justify-center gap-2"
              >
                <span>Nộp Hồ Sơ</span>
                <ArrowRight size={15} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Application Dialog Modal */}
      {viTriDangUngTuyen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <section
            role="dialog"
            aria-modal="true"
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-6 sm:p-8 shadow-2xl border border-slate-100"
          >
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <span className="text-[11px] font-black uppercase tracking-wider text-blue-600">
                  Nộp Hồ Sơ Ứng Tuyển
                </span>
                <h2 className="mt-1 text-xl font-black text-slate-900 tracking-tight">
                  {viTriDangUngTuyen.title}
                </h2>
                <p className="text-xs font-semibold text-slate-400 mt-1">
                  {viTriDangUngTuyen.location} • {viTriDangUngTuyen.type}
                </p>
              </div>
              <button
                type="button"
                aria-label="Đóng"
                onClick={dongForm}
                className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {guiThanhCong ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center space-y-3">
                <div className="h-12 w-12 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center font-bold">
                  <CheckCircle2 size={24} />
                </div>
                <h3 className="font-black text-emerald-900 text-lg">Đã Nhận Hồ Sơ!</h3>
                <p className="text-xs text-emerald-700 leading-relaxed font-medium">
                  Bộ phận Tuyển dụng Smart Logistics sẽ liên hệ với bạn qua số điện thoại để trao đổi lịch phỏng vấn.
                </p>
                <button
                  type="button"
                  onClick={dongForm}
                  className="mt-4 px-6 py-2.5 rounded-xl bg-emerald-600 text-white font-black text-xs hover:bg-emerald-700 transition-all"
                >
                  Đóng
                </button>
              </div>
            ) : (
              <form onSubmit={guiHoSo} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Họ và tên ứng viên</label>
                  <input
                    required
                    maxLength={255}
                    value={form.full_name}
                    onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-medium text-slate-800 outline-none focus:bg-white focus:border-blue-500"
                    placeholder="Nguyễn Văn A"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Số điện thoại</label>
                    <input
                      required
                      type="tel"
                      maxLength={50}
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-medium text-slate-800 outline-none focus:bg-white focus:border-blue-500"
                      placeholder="0901234567"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Email</label>
                    <input
                      required
                      type="email"
                      maxLength={255}
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-medium text-slate-800 outline-none focus:bg-white focus:border-blue-500"
                      placeholder="email@example.com"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Kinh nghiệm liên quan</label>
                  <input
                    maxLength={255}
                    value={form.experience}
                    onChange={(e) => setForm({ ...form, experience: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-medium text-slate-800 outline-none focus:bg-white focus:border-blue-500"
                    placeholder="VD: 1 năm giao hàng cho sàn TMĐT..."
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Lời nhắn / Giới thiệu bản thân</label>
                  <textarea
                    rows={3}
                    maxLength={2000}
                    value={form.message}
                    onChange={(e) => setForm({ ...form, message: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-medium text-slate-800 outline-none focus:bg-white focus:border-blue-500"
                    placeholder="Mong muốn làm việc ca sáng, có bằng lái xe máy..."
                  />
                </div>

                {thongBao && (
                  <p className="text-xs font-bold text-rose-600 bg-rose-50 p-3 rounded-xl border border-rose-200">
                    {thongBao}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={dangGui}
                  className="w-full rounded-xl bg-blue-600 py-3.5 text-xs sm:text-sm font-black text-white hover:bg-blue-700 shadow-md shadow-blue-500/25 transition-all disabled:opacity-60"
                >
                  {dangGui ? 'Đang gửi hồ sơ...' : 'Gửi Hồ Sơ Ứng Tuyển'}
                </button>
              </form>
            )}
          </section>
        </div>
      )}

    </div>
  );
}
