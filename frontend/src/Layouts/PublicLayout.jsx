import { NavLink, Outlet } from 'react-router-dom';
import {
  Package, User, Phone, Headphones, FileText, Calculator,
  Search, Download, MapPin, Globe, CheckCircle, Play, Users,
  Box
} from 'lucide-react';

const navItems = [
  { label: 'Trang chủ', to: '/' },
  { label: 'Dịch vụ', to: '/dich-vu' },
  { label: 'Bảng giá', to: '/bang-gia' },
  { label: 'Tin tức', to: '/tin-tuc' },
  { label: 'Tuyển dụng', to: '/tuyen-dung' },
];

export default function PublicLayout() {
  return (
    <div className="min-h-screen bg-[#F2F4F7] font-sans text-slate-800 flex flex-col overflow-x-hidden relative">
      <div className="fixed right-0 top-1/2 -translate-y-1/2 z-50 flex flex-col gap-1 hidden xl:flex">
        <div className="bg-slate-800 text-white p-3 hover:bg-blue-600 cursor-pointer transition-colors flex flex-col items-center justify-center w-16 h-16 rounded-l-lg shadow-lg group relative">
          <FileText size={20} className="mb-1" />
          <span className="text-[9px] font-bold text-center leading-tight">Tạo đơn<br />nhanh</span>
        </div>
        <div className="bg-slate-800 text-white p-3 hover:bg-blue-600 cursor-pointer transition-colors flex flex-col items-center justify-center w-16 h-16 rounded-l-lg shadow-lg">
          <Calculator size={20} className="mb-1" />
          <span className="text-[9px] font-bold text-center leading-tight">Ước tính<br />cước phí</span>
        </div>
        <div className="bg-slate-800 text-white p-3 hover:bg-blue-600 cursor-pointer transition-colors flex flex-col items-center justify-center w-16 h-16 rounded-l-lg shadow-lg">
          <Search size={20} className="mb-1" />
          <span className="text-[9px] font-bold text-center leading-tight">Theo dõi<br />vận đơn</span>
        </div>
        <div className="bg-slate-800 text-white p-3 hover:bg-blue-600 cursor-pointer transition-colors flex flex-col items-center justify-center w-16 h-16 rounded-l-lg shadow-lg">
          <Download size={20} className="mb-1" />
          <span className="text-[9px] font-bold text-center leading-tight">Tải App<br />Logistics</span>
        </div>
      </div>

      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
        <div className="bg-slate-800 text-white py-1.5 px-4 md:px-12 flex justify-between items-center text-xs font-medium">
          <div className="hidden md:flex items-center gap-4">
            <span className="flex items-center gap-1"><Phone size={12} /> Hotline: 1900 8095</span>
            <span className="flex items-center gap-1"><Headphones size={12} /> Hỗ trợ trực tuyến</span>
          </div>
          <div className="flex items-center gap-4 ml-auto">
            <span className="cursor-pointer hover:text-blue-300">Khách hàng cá nhân</span>
            <span className="cursor-pointer hover:text-blue-300">Khách hàng doanh nghiệp</span>
          </div>
        </div>

        <div className="py-3 px-4 md:px-12 flex justify-between items-center bg-white">
          <NavLink to="/" className="flex items-center gap-3 cursor-pointer">
            <div className="bg-blue-600 p-2 rounded-lg text-white">
              <Package size={28} />
            </div>
            <div className="flex flex-col">
              <h1 className="text-xl md:text-2xl font-black tracking-tighter text-blue-600 leading-none">SmartLogistics</h1>
              <p className="text-[9px] md:text-[10px] font-bold text-slate-500 tracking-[0.1em] mt-0.5">VẬN CHUYỂN THÔNG MINH</p>
            </div>
          </NavLink>

          <nav className="hidden lg:flex items-center gap-8 font-bold text-[14px] text-slate-700">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  isActive
                    ? 'text-blue-600 border-b-2 border-blue-600 pb-1'
                    : 'hover:text-blue-600 transition-colors'
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <NavLink
            to="/dang-nhap"
            className="text-xs md:text-sm font-bold text-slate-700 border-2 border-slate-200 bg-slate-50 hover:border-blue-600 hover:text-blue-600 transition-all px-5 py-2 rounded-full flex items-center gap-2"
          >
            <User size={16} /> ĐĂNG KÝ / ĐĂNG NHẬP
          </NavLink>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="bg-[#1A1A1A] text-slate-300 py-12 mt-auto text-sm">
        <div className="max-w-6xl mx-auto px-4 grid grid-cols-1 md:grid-cols-12 gap-8">
          <div className="md:col-span-4">
            <h4 className="text-white font-black text-lg mb-4 uppercase">Tổng công ty cổ phần Smart Logistics</h4>
            <p className="leading-relaxed mb-4 text-slate-400">Smart Logistics là doanh nghiệp Logistics Công nghệ cung cấp giải pháp chuỗi cung ứng toàn trình từ DỊCH VỤ GIAO NHẬN - VẬN TẢI - KHO VẬN ĐẾN THƯƠNG MẠI...</p>
            <p className="mb-4 text-slate-400"><CheckCircle size={14} className="inline mr-1 text-blue-500" /> Giấy chứng nhận Đăng ký Kinh doanh số: 0123456789</p>
            <h5 className="text-white font-bold mt-6 mb-2 uppercase text-xs">Thông tin liên hệ</h5>
            <p className="text-slate-400 mb-1"><MapPin size={14} className="inline mr-1" /> Tòa nhà Smart, Số 1 Nguyễn Văn Bảo, Gò Vấp, HCM</p>
            <p className="text-slate-400 mb-1"><Globe size={14} className="inline mr-1 text-blue-500" /> cskh@smartlogistics.vn</p>
            <p className="text-blue-500 font-black text-2xl mt-2 flex items-center gap-2"><Phone size={24} /> 1900 8095</p>
          </div>

          <div className="md:col-span-2">
            <h4 className="text-white font-bold mb-4 uppercase text-xs">Về SmartLogistics</h4>
            <ul className="space-y-3 text-slate-400">
              <li><NavLink to="/" className="hover:text-blue-400">Giới thiệu</NavLink></li>
              <li><NavLink to="/tin-tuc" className="hover:text-blue-400">Tin tức</NavLink></li>
              <li><NavLink to="/tim-buu-cuc" className="hover:text-blue-400">Mạng lưới bưu cục</NavLink></li>
              <li><NavLink to="/tuyen-dung" className="hover:text-blue-400">Tuyển dụng</NavLink></li>
              <li><NavLink to="/uoc-tinh-cuoc" className="hover:text-blue-400">Kết nối API</NavLink></li>
            </ul>
          </div>

          <div className="md:col-span-2">
            <h4 className="text-white font-bold mb-4 uppercase text-xs">Hỗ trợ khách hàng</h4>
            <ul className="space-y-3 text-slate-400">
              <li><NavLink to="/dich-vu" className="hover:text-blue-400">Hướng dẫn gửi hàng</NavLink></li>
              <li><NavLink to="/bang-gia" className="hover:text-blue-400">Câu hỏi thường gặp</NavLink></li>
              <li><NavLink to="/" className="hover:text-blue-400">Chính sách bảo mật</NavLink></li>
              <li><NavLink to="/" className="hover:text-blue-400">Quy định khiếu nại</NavLink></li>
            </ul>
          </div>

          <div className="md:col-span-4">
            <h4 className="text-white font-bold mb-4 uppercase text-xs">Hợp tác khách hàng doanh nghiệp, kết nối API</h4>
            <p className="text-blue-400 font-bold mb-1"><Phone size={14} className="inline mr-1" /> 0862235888</p>
            <p className="text-slate-400 mb-4">b2b@smartlogistics.vn</p>

            <h4 className="text-white font-bold mb-2 uppercase text-xs">Hợp tác Khách hàng Cá nhân, Shop Online</h4>
            <p className="text-blue-400 font-bold mb-1"><Phone size={14} className="inline mr-1" /> 0983663311</p>
            <p className="text-slate-400 mb-6">kinhdoanh@smartlogistics.vn</p>

            <div className="flex gap-4">
              <div className="bg-white p-1 rounded-md"><img src="https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=SmartLogistics" alt="QR" className="w-16 h-16" /></div>
              <div className="bg-white p-1 rounded-md"><img src="https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=AppStore" alt="QR" className="w-16 h-16" /></div>
            </div>
          </div>
        </div>
        <div className="max-w-6xl mx-auto px-4 mt-8 pt-6 border-t border-slate-800 text-center text-xs text-slate-600">
          © 2026 SmartLogistics. Mọi thông tin chỉ mang tính chất minh họa học thuật.
        </div>
      </footer>
    </div>
  );
}
