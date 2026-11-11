import { apiFetch as fetch, API_URL } from '../../utils/apiFetch.js';
import { useState } from 'react';
import { Check, X, Sparkles, ShieldCheck, Zap, Headphones, ArrowRight, Building } from 'lucide-react';

const plans = [
  {
    name: 'Gói Tiêu Chuẩn',
    price: '29.000đ',
    badge: 'Phổ thông',
    description: 'Tối ưu cho đơn hàng cá nhân, kiện hàng vừa & nhỏ trong nội thành.',
    features: [
      'Định vị trạng thái GPS thời gian thực',
      'Giao hàng tiêu chuẩn 24h nội thành',
      'Miễn phí thu hộ COD dưới 3.000.000đ',
      'Chụp ảnh minh chứng giao hàng (POD)',
      'Hỗ trợ khách hàng qua tổng đài 24/7'
    ],
    featured: false,
    cta: 'Đăng Ký Gói Này'
  },
  {
    name: 'Gói Nâng Cao',
    price: '69.000đ',
    badge: 'Khuyên Dùng · Bán Chạy',
    description: 'Lựa chọn số 1 cho các Shop Online và đơn vị kinh doanh TMĐT.',
    features: [
      'Giao hỏa tốc 4h nội quận Gò Vấp & lân cận',
      'Thuật toán AI tự động tối ưu tuyến đường',
      'Đối soát COD tự động 3 lần / tuần',
      'Hỗ trợ đổi địa chỉ giao linh hoạt',
      'Tích hợp Chat trực tiếp với bưu tá',
      'Bảo hiểm hàng hóa 100% giá trị khai báo'
    ],
    featured: true,
    cta: 'Chọn Gói Nâng Cao'
  },
  {
    name: 'Gói Doanh Nghiệp',
    price: 'Liên hệ',
    badge: 'Doanh nghiệp / B2B',
    description: 'Dành cho chuỗi bán lẻ, nhà máy và sàn TMĐT quy mô lớn.',
    features: [
      'Kết nối trực tiếp API ERP & Webhook tự động',
      'Đội xe tải và nhân viên kho dành riêng',
      'Kho bãi phân loại chuyên biệt tại Gò Vấp',
      'Đối soát công nợ linh hoạt theo chu kỳ',
      'Quản lý tài khoản VIP & SLA cam kết 99.9%'
    ],
    featured: false,
    cta: 'Tư Vấn Doanh Nghiệp'
  },
];

export default function BangGia() {
  const [goiDangChon, setGoiDangChon] = useState(null);
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', message: '' });
  const [dangGui, setDangGui] = useState(false);
  const [thongBao, setThongBao] = useState('');
  const [guiThanhCong, setGuiThanhCong] = useState(false);

  const guiYeuCau = async (event) => {
    event.preventDefault();
    setDangGui(true);
    setThongBao('');
    try {
      const response = await fetch(`${API_URL}/api/public/service-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, plan_name: goiDangChon.name })
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Không gửi được yêu cầu.');
      setGuiThanhCong(true);
    } catch (error) {
      setThongBao(error.message || 'Không thể kết nối máy chủ. Vui lòng thử lại.');
    } finally {
      setDangGui(false);
    }
  };

  const dongForm = () => {
    setGoiDangChon(null);
    setThongBao('');
    setGuiThanhCong(false);
    setForm({ full_name: '', email: '', phone: '', message: '' });
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      
      {/* Header */}
      <div className="mb-14 text-center max-w-3xl mx-auto space-y-3">
        <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-black uppercase tracking-wider border border-blue-200">
          <Sparkles size={14} className="text-amber-500" />
          Bảng Giá Dịch Vụ Niêm Yết
        </div>
        <h1 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight">
          Chọn Gói Phù Hợp Với Nhu Cầu Của Bạn
        </h1>
        <p className="text-slate-500 text-sm sm:text-base font-medium">
          Mức cước minh bạch, không phí ẩn. Hỗ trợ đầy đủ định vị GPS tài xế, chụp ảnh ký nhận và đối soát thu hộ COD tức thì.
        </p>
      </div>

      {/* Pricing Cards Grid */}
      <div className="grid gap-8 lg:grid-cols-3 items-stretch">
        {plans.map((plan) => (
          <div
            key={plan.name}
            className={`rounded-3xl p-8 flex flex-col justify-between transition-all duration-300 relative ${
              plan.featured
                ? 'bg-gradient-to-b from-blue-600 to-indigo-700 text-white shadow-xl shadow-blue-500/25 ring-2 ring-blue-500 scale-105 z-10'
                : 'bg-white border border-slate-200/90 text-slate-800 shadow-soft-sm hover:shadow-soft-lg hover:-translate-y-1'
            }`}
          >
            {plan.featured && (
              <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-amber-400 to-orange-400 text-slate-900 font-black text-[11px] uppercase tracking-wider shadow-md">
                {plan.badge}
              </span>
            )}

            <div>
              <div className="flex items-center justify-between gap-2">
                <span className={`text-xs font-black uppercase tracking-widest ${plan.featured ? 'text-blue-200' : 'text-blue-600'}`}>
                  {plan.name}
                </span>
                {!plan.featured && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                    {plan.badge}
                  </span>
                )}
              </div>

              <div className="mt-5 flex items-baseline gap-2">
                <span className="text-4xl font-black tracking-tight">{plan.price}</span>
                {plan.price !== 'Liên hệ' && <span className={`text-xs font-medium ${plan.featured ? 'text-blue-200' : 'text-slate-400'}`}>/ đơn chuẩn</span>}
              </div>

              <p className={`mt-3 text-xs leading-relaxed font-medium ${plan.featured ? 'text-blue-100' : 'text-slate-500'}`}>
                {plan.description}
              </p>

              <div className={`my-6 border-t ${plan.featured ? 'border-white/20' : 'border-slate-100'}`} />

              <ul className="space-y-3.5 text-xs font-semibold">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <span className={`h-5 w-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                      plan.featured ? 'bg-white/20 text-white' : 'bg-blue-50 text-blue-600'
                    }`}>
                      <Check size={12} strokeWidth={3} />
                    </span>
                    <span className={plan.featured ? 'text-blue-50' : 'text-slate-700'}>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-8 pt-4">
              <button
                type="button"
                onClick={() => { setGoiDangChon(plan); setGuiThanhCong(false); }}
                className={`w-full py-3.5 rounded-2xl font-black text-xs sm:text-sm tracking-wide transition-all shadow-md ${
                  plan.featured
                    ? 'bg-white text-blue-700 hover:bg-slate-100 shadow-blue-900/20 active:scale-98'
                    : 'bg-slate-900 text-white hover:bg-blue-600 active:scale-98'
                }`}
              >
                {plan.cta}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* MODAL YÊU CẦU TƯ VẤN */}
      {goiDangChon && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <section
            role="dialog"
            aria-modal="true"
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-6 sm:p-8 shadow-2xl border border-slate-100"
          >
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <span className="text-[11px] font-black uppercase tracking-wider text-blue-600">
                  Tư Vấn Dịch Vụ
                </span>
                <h2 className="mt-1 text-2xl font-black text-slate-900 tracking-tight">
                  {goiDangChon.name}
                </h2>
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
                  <Check size={24} />
                </div>
                <h3 className="font-black text-emerald-900 text-lg">Đã Tiếp Nhận Yêu Cầu!</h3>
                <p className="text-xs text-emerald-700 leading-relaxed font-medium">
                  Chuyên viên hỗ trợ của Smart Logistics sẽ liên hệ qua số điện thoại của bạn trong vòng 15 phút.
                </p>
                <button
                  type="button"
                  onClick={dongForm}
                  className="mt-4 px-6 py-2.5 rounded-xl bg-emerald-600 text-white font-black text-xs hover:bg-emerald-700 transition-all"
                >
                  Xong
                </button>
              </div>
            ) : (
              <form onSubmit={guiYeuCau} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Họ và tên</label>
                  <input
                    required
                    maxLength={255}
                    value={form.full_name}
                    onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-medium text-slate-800 outline-none focus:bg-white focus:border-blue-500"
                    placeholder="Nguyễn Văn A"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Địa chỉ Email</label>
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

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Số điện thoại liên hệ</label>
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
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Nhu cầu hoặc quy mô kiện hàng</label>
                  <textarea
                    rows={3}
                    maxLength={2000}
                    value={form.message}
                    onChange={(e) => setForm({ ...form, message: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-medium text-slate-800 outline-none focus:bg-white focus:border-blue-500"
                    placeholder="Khoảng 50 đơn/ngày, chủ yếu giao tại Gò Vấp..."
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
                  {dangGui ? 'Đang gửi...' : 'Gửi Yêu Cầu Tư Vấn Ngay'}
                </button>
              </form>
            )}
          </section>
        </div>
      )}

    </div>
  );
}
