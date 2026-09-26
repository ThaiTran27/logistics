import { useState } from 'react';
import { Check, X } from 'lucide-react';

const plans = [
  {
    name: 'Gói Tiêu Chuẩn',
    price: '29.000đ',
    description: 'Phù hợp với hàng hóa nhỏ, giao hàng nội thành nhanh.',
    features: ['Theo dõi trạng thái 24/7', 'Giao hàng trong 24h', 'Hỗ trợ khách hàng cơ bản'],
    featured: false,
  },
  {
    name: 'Gói Nâng Cao',
    price: '69.000đ',
    description: 'Lựa chọn phổ biến cho shop và đơn hàng thường xuyên.',
    features: ['Ai tối ưu tuyến đường', 'Kiểm soát COD rõ ràng', 'Ưu tiên xử lý đơn hàng'],
    featured: true,
  },
  {
    name: 'Gói Doanh Nghiệp',
    price: 'Tùy chỉnh',
    description: 'Dành cho doanh nghiệp cần giải pháp logistics chuyên sâu.',
    features: ['API tích hợp', 'Quản lý kho và xuất nhập', 'Đội ngũ tư vấn riêng'],
    featured: false,
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
      const response = await fetch('http://localhost:5000/api/public/service-requests', {
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
    <div className="max-w-6xl mx-auto px-4 py-16">
      <div className="mb-12 text-center">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-blue-600">Bảng giá</p>
        <h1 className="mt-3 text-4xl font-black text-slate-800">Chọn gói phù hợp với quy mô vận chuyển</h1>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {plans.map((plan) => (
          <div
            key={plan.name}
            className={`rounded-3xl border p-8 shadow-sm ${
              plan.featured
                ? 'border-blue-600 bg-blue-600 text-white shadow-xl'
                : 'border-slate-200 bg-white text-slate-800'
            }`}
          >
            <p className={`text-sm font-bold uppercase tracking-[0.2em] ${plan.featured ? 'text-blue-100' : 'text-blue-600'}`}>
              {plan.name}
            </p>
            <div className="mt-6 flex items-end gap-2">
              <span className="text-4xl font-black">{plan.price}</span>
            </div>
            <p className={`mt-4 text-sm ${plan.featured ? 'text-blue-100' : 'text-slate-600'}`}>{plan.description}</p>

            <ul className="mt-6 space-y-4">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-start gap-3">
                  <span className={`mt-0.5 flex h-5 w-5 items-center justify-center rounded-full ${plan.featured ? 'bg-white/20 text-white' : 'bg-blue-50 text-blue-600'}`}>
                    <Check size={12} />
                  </span>
                  <span className={plan.featured ? 'text-blue-50' : 'text-slate-700'}>{feature}</span>
                </li>
              ))}
            </ul>

            <button type="button" onClick={() => { setGoiDangChon(plan); setGuiThanhCong(false); }} className={`mt-8 w-full rounded-full px-4 py-3 font-bold transition ${plan.featured ? 'bg-white text-blue-600 hover:bg-slate-100' : 'bg-slate-900 text-white hover:bg-slate-700'}`}>
              Chọn gói này
            </button>
          </div>
        ))}
      </div>

      {goiDangChon && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <section role="dialog" aria-modal="true" aria-labelledby="plan-request-title" className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-600">Yêu cầu tư vấn</p>
                <h2 id="plan-request-title" className="mt-2 text-2xl font-black text-slate-800">{goiDangChon.name}</h2>
              </div>
              <button type="button" aria-label="Đóng" onClick={dongForm} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={20} /></button>
            </div>

            {guiThanhCong ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-800">
                <p className="font-bold">Đã nhận yêu cầu tư vấn.</p>
                <p className="mt-1 text-sm">Smart Logistics sẽ liên hệ theo thông tin bạn cung cấp.</p>
                <button type="button" onClick={dongForm} className="mt-4 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-bold text-white">Đóng</button>
              </div>
            ) : (
              <form onSubmit={guiYeuCau} className="space-y-4">
                <label className="block text-sm font-bold text-slate-700">Họ và tên<input required maxLength="255" value={form.full_name} onChange={(event) => setForm({ ...form, full_name: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 p-3 font-normal" autoComplete="name" /></label>
                <label className="block text-sm font-bold text-slate-700">Email<input required type="email" maxLength="255" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 p-3 font-normal" autoComplete="email" /></label>
                <label className="block text-sm font-bold text-slate-700">Số điện thoại<input required type="tel" maxLength="50" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 p-3 font-normal" autoComplete="tel" /></label>
                <label className="block text-sm font-bold text-slate-700">Ghi chú<textarea rows="3" maxLength="2000" value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 p-3 font-normal" placeholder="Quy mô đơn hàng, nhu cầu vận chuyển..." /></label>
                {thongBao && <p role="alert" className="text-sm font-medium text-red-600">{thongBao}</p>}
                <button type="submit" disabled={dangGui} className="w-full rounded-lg bg-blue-600 px-4 py-3 font-bold text-white hover:bg-blue-700 disabled:opacity-60">{dangGui ? 'Đang gửi...' : 'Gửi yêu cầu tư vấn'}</button>
              </form>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
