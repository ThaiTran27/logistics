import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle, Truck, PackageCheck, MapPinned, ShieldCheck, ArrowRight, X } from 'lucide-react';

const dichVu = [
  {
    title: 'Giao hàng tận nơi',
    description: 'Dịch vụ giao hàng nhanh, đúng hẹn với theo dõi trạng thái theo thời gian thực.',
    details: ['Theo dõi trạng thái và vị trí tài xế', 'Có ảnh xác nhận khi giao hàng', 'Thông báo khi giao thành công hoặc phát sinh sự cố'],
    icon: Truck,
  },
  {
    title: 'Lấy hàng tận shop',
    description: 'Hệ thống tối ưu tuyến đường, tài xế đến nhận hàng nhanh chóng và an toàn.',
    details: ['Đặt lịch lấy hàng tại địa chỉ shop', 'Theo dõi tài xế trên lộ trình lấy hàng', 'Quét mã khi hàng được tiếp nhận'],
    icon: PackageCheck,
  },
  {
    title: 'Bảo mật hàng hóa',
    description: 'Quản lý xác thực đơn hàng và giao nhận theo chuẩn bảo mật cao cho hàng hóa quan trọng.',
    details: ['Lưu lịch sử xử lý theo từng đơn', 'Yêu cầu ảnh minh chứng giao nhận', 'Ghi nhận lý do khi giao hàng thất bại'],
    icon: ShieldCheck,
  },
  {
    title: 'Phân tuyến thông minh',
    description: 'AI gợi ý tuyến vận chuyển hiệu quả, giảm thời gian, chi phí và tối ưu tài nguyên.',
    details: ['Điều phối theo điểm lấy và điểm giao', 'Đồng bộ lộ trình với tài xế', 'Theo dõi tiến độ vận chuyển tập trung'],
    icon: MapPinned,
  },
];

export default function DichVu() {
  const [dichVuDangXem, setDichVuDangXem] = useState(null);

  return (
    <div className="max-w-6xl mx-auto px-4 py-16">
      <div className="mb-10 text-center">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-blue-600">Dịch vụ</p>
        <h1 className="mt-3 text-4xl font-black text-slate-800">Giải pháp logistics hiện đại cho mọi nhu cầu</h1>
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {dichVu.map(({ title, description, details, icon: Icon }) => (
          <div key={title} className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
            <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <Icon size={28} />
            </div>
            <h3 className="mb-3 text-xl font-bold text-slate-800">{title}</h3>
            <p className="text-sm leading-6 text-slate-600">{description}</p>
            <button type="button" onClick={() => setDichVuDangXem({ title, description, details })} className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-blue-600 hover:text-blue-800">
              Chi tiết <ArrowRight size={16} />
            </button>
          </div>
        ))}
      </div>

      {dichVuDangXem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setDichVuDangXem(null); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="service-detail-title" className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-600">Chi tiết dịch vụ</p>
                <h2 id="service-detail-title" className="mt-2 text-2xl font-black text-slate-800">{dichVuDangXem.title}</h2>
              </div>
              <button type="button" aria-label="Đóng" onClick={() => setDichVuDangXem(null)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={20} /></button>
            </div>
            <p className="text-sm leading-6 text-slate-600">{dichVuDangXem.description}</p>
            <ul className="mt-5 space-y-3">
              {dichVuDangXem.details.map((detail) => (
                <li key={detail} className="flex items-start gap-3 text-sm text-slate-700">
                  <CheckCircle size={18} className="mt-0.5 shrink-0 text-emerald-600" />{detail}
                </li>
              ))}
            </ul>
            <Link to="/bang-gia" onClick={() => setDichVuDangXem(null)} className="mt-6 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-sm font-bold text-white hover:bg-blue-700">Xem gói dịch vụ <ArrowRight size={16} /></Link>
          </section>
        </div>
      )}

      <div className="mt-16 rounded-3xl bg-slate-900 p-8 text-white shadow-xl">
        <div className="grid gap-8 lg:grid-cols-2 items-center">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-blue-300">Tại sao chọn chúng tôi</p>
            <h2 className="mt-3 text-3xl font-black">Vận hành khoa học, giao hàng an tâm</h2>
          </div>
          <div className="space-y-4">
            {[
              'Theo dõi đơn hàng theo thời gian thực',
              'Tối ưu tuyến đường với AI vận chuyển',
              'Tài xế, kho và trung tâm điều phối đồng bộ',
              'Hỗ trợ khách hàng 24/7 và xác thực rõ ràng',
            ].map((item) => (
              <div key={item} className="flex items-center gap-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-500/20 text-blue-300">
                  <CheckCircle size={16} />
                </div>
                <span className="text-slate-200">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
