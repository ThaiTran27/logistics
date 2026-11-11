import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckCircle, Truck, PackageCheck, MapPinned, ShieldCheck,
  ArrowRight, X, Sparkles, Clock, Calculator, ShieldAlert, Award
} from 'lucide-react';

const dichVu = [
  {
    title: 'Giao Hàng Chặng Cuối (Last-Mile)',
    badge: 'Phổ biến nhất',
    description: 'Dịch vụ phát hàng tận tay người nhận với độ chính xác cao và theo dõi vị trí bưu tá theo thời gian thực.',
    details: [
      'Định vị GPS vị trí tài xế giao hàng trực tiếp trên bản đồ',
      'Ảnh chụp chữ ký và gói hàng minh chứng giao thành công (POD)',
      'Hỗ trợ khách hẹn lại giờ giao hoặc chuyển bưu cục phát',
      'Thông báo trạng thái qua SMS / Zalo khi bắt đầu đi phát'
    ],
    icon: Truck,
    color: 'from-blue-600 to-cyan-500'
  },
  {
    title: 'Lấy Hàng Tận Shop (First-Mile)',
    badge: 'Miễn phí lấy hàng',
    description: 'Tài xế đến tận kho của Shop nhận hàng đúng giờ theo phân công tự động của hệ thống điều hành.',
    details: [
      'Đặt lịch hẹn lấy hàng linh hoạt từ 07:00 đến 21:00',
      'Bắn mã vạch kiểm đếm từng kiện ngay tại thời điểm nhận',
      'Hỗ trợ Shop in mã vận đơn và bọc chống sốc tiêu chuẩn',
      'Đồng bộ tức thì lên hệ thống quản lý đơn của Shop'
    ],
    icon: PackageCheck,
    color: 'from-emerald-600 to-teal-500'
  },
  {
    title: 'Trung Chuyển & Kho Vận Gò Vấp',
    badge: 'Tự động hóa',
    description: 'Kho trung tâm phân loại tự động tại Gò Vấp với quy trình kiểm soát vị trí bin kệ và niêm phong bao kiện.',
    details: [
      'Kiểm đếm tự động qua cổng quét mã vạch tốc độ cao',
      'Quản lý vị trí lưu kho theo mã Bin/Kệ chính xác 100%',
      'Kiểm kê định kỳ chống thất lạc và hư hỏng hàng hóa',
      'Đội ngũ bảo vệ và camera giám sát 24/7'
    ],
    icon: ShieldCheck,
    color: 'from-purple-600 to-indigo-500'
  },
  {
    title: 'Điều Phối & Tối Ưu Tuyến Đường',
    badge: 'Trí tuệ nhân tạo',
    description: 'Thuật toán gom đơn thông minh giúp tài xế giảm quãng đường di chuyển và rút ngắn 40% thời gian giao.',
    details: [
      'Tự động sắp xếp thứ tự giao hợp lý nhất theo bản đồ',
      'Cảnh báo quá hạn SLA giao nhận để ưu tiên xử lý',
      'Hỗ trợ phân bổ lại đơn khi có sự cố kẹt xe hoặc thời tiết',
      'Báo cáo hiệu suất kinh doanh trực quan cho giám đốc'
    ],
    icon: MapPinned,
    color: 'from-amber-500 to-orange-500'
  },
];

export default function DichVu() {
  const [dichVuDangXem, setDichVuDangXem] = useState(null);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      
      {/* Header */}
      <div className="mb-14 text-center max-w-2xl mx-auto space-y-3">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-black uppercase tracking-wider border border-blue-200">
          <Sparkles size={14} className="text-blue-600" />
          Hệ Thống Dịch Vụ Toàn Trình
        </span>
        <h1 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight">
          Giải Pháp Vận Tải Toàn Trình Cho Mọi Nhu Cầu
        </h1>
        <p className="text-slate-500 text-xs sm:text-sm font-medium">
          Từ lúc tài xế nhận hàng tại shop, trung chuyển qua kho tổng Gò Vấp đến khi giao tận tay người nhận an toàn.
        </p>
      </div>

      {/* Services Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {dichVu.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.title}
              className="group rounded-3xl border border-slate-200/90 bg-white p-7 shadow-soft-sm hover:shadow-soft-lg hover:-translate-y-1 transition-all flex flex-col justify-between"
            >
              <div>
                <div className={`h-14 w-14 rounded-2xl bg-gradient-to-tr ${item.color} text-white flex items-center justify-center shadow-md mb-6 transition-transform group-hover:scale-105`}>
                  <Icon size={26} />
                </div>
                <span className="text-[10px] font-black uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                  {item.badge}
                </span>
                <h3 className="text-lg font-black text-slate-900 mt-2 mb-2 group-hover:text-blue-600 transition-colors">
                  {item.title}
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed font-medium">
                  {item.description}
                </p>
              </div>

              <div className="pt-6 border-t border-slate-100 mt-6">
                <button
                  type="button"
                  onClick={() => setDichVuDangXem(item)}
                  className="w-full inline-flex items-center justify-between text-xs font-black text-blue-600 group-hover:text-blue-800"
                >
                  <span>Xem Quy Trình Chi Tiết</span>
                  <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Detail Dialog Modal */}
      {dichVuDangXem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
          onMouseDown={(event) => { if (event.target === event.currentTarget) setDichVuDangXem(null); }}
        >
          <section
            role="dialog"
            aria-modal="true"
            className="w-full max-w-lg rounded-3xl bg-white p-6 sm:p-8 shadow-2xl border border-slate-100"
          >
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <span className="text-[11px] font-black uppercase tracking-wider text-blue-600">
                  Chi Tiết Giải Pháp
                </span>
                <h2 className="mt-1 text-2xl font-black text-slate-900 tracking-tight">
                  {dichVuDangXem.title}
                </h2>
              </div>
              <button
                type="button"
                aria-label="Đóng"
                onClick={() => setDichVuDangXem(null)}
                className="rounded-full p-2 text-slate-400 hover:bg-slate-100 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <p className="text-xs sm:text-sm leading-relaxed text-slate-600 font-medium">
              {dichVuDangXem.description}
            </p>

            <div className="mt-6 space-y-3">
              <p className="text-xs font-black uppercase tracking-wider text-slate-800">
                Tiêu chuẩn cam kết vận hành:
              </p>
              {dichVuDangXem.details.map((detail) => (
                <div key={detail} className="flex items-start gap-3 text-xs text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <CheckCircle size={16} className="shrink-0 text-emerald-600 mt-0.5" />
                  <span className="font-medium leading-relaxed">{detail}</span>
                </div>
              ))}
            </div>

            <div className="mt-8 flex gap-3">
              <Link
                to="/bang-gia"
                onClick={() => setDichVuDangXem(null)}
                className="flex-1 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs text-center shadow-md shadow-blue-500/20 transition-all"
              >
                Xem Bảng Giá Cước
              </Link>
              <Link
                to="/uoc-tinh-cuoc"
                onClick={() => setDichVuDangXem(null)}
                className="px-5 py-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs text-center transition-all"
              >
                Tính Cước Nhanh
              </Link>
            </div>
          </section>
        </div>
      )}

      {/* WHY CHOOSE US BANNER */}
      <div className="mt-16 rounded-3xl bg-slate-900 p-8 sm:p-12 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="grid gap-8 lg:grid-cols-2 items-center relative z-10">
          <div className="space-y-4">
            <span className="text-xs font-bold uppercase tracking-widest text-cyan-400">
              Tại Sao Chọn Smart Logistics?
            </span>
            <h2 className="text-2xl sm:text-4xl font-black tracking-tight leading-tight">
              Hạ Tầng Công Nghệ Cao, <br />
              Vận Hành Chuẩn Xác Từng Giây.
            </h2>
            <p className="text-slate-400 text-xs sm:text-sm leading-relaxed max-w-md">
              Hệ thống được thiết kế theo mô hình State Machine khép kín, đảm bảo mọi kiện hàng đều có lịch sử kiểm toán đầy đủ từ đầu đến cuối.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { title: 'Tối Ưu Tuyến Đường Bằng AI', desc: 'Rút ngắn 35% thời gian giao nhận hàng ngày' },
              { title: 'Bảo Vệ Đơn Hàng 100%', desc: 'Ảnh chụp chữ ký POD và bảo hiểm giá trị khai báo' },
              { title: 'Đối Soát COD Linh Hoạt', desc: 'Minh bạch từng dòng tiền, không sợ thất thoát' },
              { title: 'Đội Ngũ Hỗ Trợ 24/7', desc: 'Tổng đài 1900 8095 và chat trực tiếp tài xế' },
            ].map((feature) => (
              <div key={feature.title} className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700/80 space-y-1">
                <div className="flex items-center gap-2 text-cyan-400 font-bold text-xs">
                  <CheckCircle size={15} />
                  <span>{feature.title}</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed font-medium">
                  {feature.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}
