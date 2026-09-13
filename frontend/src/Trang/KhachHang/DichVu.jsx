import { CheckCircle, Truck, PackageCheck, MapPinned, ShieldCheck, ArrowRight } from 'lucide-react';

const dichVu = [
  {
    title: 'Giao hàng tận nơi',
    description: 'Dịch vụ giao hàng nhanh, đúng hẹn với theo dõi trạng thái theo thời gian thực.',
    icon: Truck,
  },
  {
    title: 'Lấy hàng tận shop',
    description: 'Hệ thống tối ưu tuyến đường, tài xế đến nhận hàng nhanh chóng và an toàn.',
    icon: PackageCheck,
  },
  {
    title: 'Bảo mật hàng hóa',
    description: 'Quản lý xác thực đơn hàng và giao nhận theo chuẩn bảo mật cao cho hàng hóa quan trọng.',
    icon: ShieldCheck,
  },
  {
    title: 'Phân tuyến thông minh',
    description: 'AI gợi ý tuyến vận chuyển hiệu quả, giảm thời gian, chi phí và tối ưu tài nguyên.',
    icon: MapPinned,
  },
];

export default function DichVu() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-16">
      <div className="mb-10 text-center">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-blue-600">Dịch vụ</p>
        <h1 className="mt-3 text-4xl font-black text-slate-800">Giải pháp logistics hiện đại cho mọi nhu cầu</h1>
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {dichVu.map(({ title, description, icon: Icon }) => (
          <div key={title} className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
            <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <Icon size={28} />
            </div>
            <h3 className="mb-3 text-xl font-bold text-slate-800">{title}</h3>
            <p className="text-sm leading-6 text-slate-600">{description}</p>
            <div className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-blue-600">
              Chi tiết <ArrowRight size={16} />
            </div>
          </div>
        ))}
      </div>

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
