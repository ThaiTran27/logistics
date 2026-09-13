import { Check } from 'lucide-react';

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

            <button className={`mt-8 w-full rounded-full px-4 py-3 font-bold transition ${plan.featured ? 'bg-white text-blue-600 hover:bg-slate-100' : 'bg-slate-900 text-white hover:bg-slate-700'}`}>
              Chọn gói này
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
