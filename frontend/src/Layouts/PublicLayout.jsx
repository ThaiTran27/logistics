import { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Package, User, Phone, Headphones, FileText, Calculator,
  Search, Download, MapPin, Globe, CheckCircle, Menu, X,
  ArrowRight, ShieldCheck, ChevronUp, Sparkles, MessageSquare
} from 'lucide-react';
import FloatingChatWidget from './FloatingChatWidget';
import { getWorkspacePath, normalizeRole } from '../utils/workspaceRoutes.js';

const navItems = [
  { label: 'Trang chủ', to: '/' },
  { label: 'Dịch vụ', to: '/dich-vu' },
  { label: 'Bảng giá', to: '/bang-gia' },
  { label: 'Ước tính cước', to: '/uoc-tinh-cuoc' },
  { label: 'Bưu cục', to: '/tim-buu-cuc' },
  { label: 'Tin tức', to: '/tin-tuc' },
  { label: 'Tuyển dụng', to: '/tuyen-dung' },
];

export default function PublicLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const rawRole = localStorage.getItem('role') || localStorage.getItem('user_role');
  const role = normalizeRole(rawRole);
  const userName = localStorage.getItem('full_name') || 'Người dùng';
  const dashboardLink = role ? getWorkspacePath(role) : '/dang-nhap';

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 300);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const logout = () => {
    localStorage.clear();
    window.location.href = '/';
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleQuickCreateOrder = () => {
    if (role === 'shop') {
      navigate('/cua-hang');
    } else {
      navigate('/dang-nhap', { state: { registration: false, redirect: '/cua-hang' } });
    }
  };

  const handleQuickTracking = () => {
    if (location.pathname === '/') {
      const trackerEl = document.getElementById('tracking-search-box');
      if (trackerEl) {
        trackerEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        trackerEl.focus();
        return;
      }
    }
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 flex flex-col overflow-x-hidden relative selection:bg-blue-600 selection:text-white">
      
      {/* FLOATING ACTION TOOLBAR (DESKTOP) */}
      <aside aria-label="Công cụ nhanh" className="fixed right-3 top-1/2 -translate-y-1/2 z-40 hidden xl:flex flex-col gap-2 p-1.5 bg-white/90 backdrop-blur-md border border-slate-200/90 rounded-2xl shadow-soft-xl">
        <button
          type="button"
          onClick={handleQuickCreateOrder}
          className="group relative flex flex-col items-center justify-center w-14 h-14 rounded-xl text-slate-700 hover:text-white hover:bg-blue-600 transition-all shadow-sm"
          title="Tạo đơn nhanh cho Shop"
        >
          <FileText size={20} className="transition-transform group-hover:scale-110" />
          <span className="text-[10px] font-bold text-center leading-tight mt-0.5">Tạo đơn</span>
          <span className="pointer-events-none absolute right-full mr-3 whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
            Tạo đơn nhanh
          </span>
        </button>

        <NavLink
          to="/uoc-tinh-cuoc"
          className="group relative flex flex-col items-center justify-center w-14 h-14 rounded-xl text-slate-700 hover:text-white hover:bg-indigo-600 transition-all shadow-sm"
          title="Ước tính cước phí vận chuyển"
        >
          <Calculator size={20} className="transition-transform group-hover:scale-110" />
          <span className="text-[10px] font-bold text-center leading-tight mt-0.5">Tính cước</span>
          <span className="pointer-events-none absolute right-full mr-3 whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
            Ước tính cước phí
          </span>
        </NavLink>

        <button
          type="button"
          onClick={handleQuickTracking}
          className="group relative flex flex-col items-center justify-center w-14 h-14 rounded-xl text-slate-700 hover:text-white hover:bg-cyan-600 transition-all shadow-sm"
          title="Tra cứu vận đơn"
        >
          <Search size={20} className="transition-transform group-hover:scale-110" />
          <span className="text-[10px] font-bold text-center leading-tight mt-0.5">Tra cứu</span>
          <span className="pointer-events-none absolute right-full mr-3 whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
            Tra cứu vận đơn
          </span>
        </button>

        <NavLink
          to="/tim-buu-cuc"
          className="group relative flex flex-col items-center justify-center w-14 h-14 rounded-xl text-slate-700 hover:text-white hover:bg-emerald-600 transition-all shadow-sm"
          title="Tìm kiếm bưu cục gần bạn"
        >
          <MapPin size={20} className="transition-transform group-hover:scale-110" />
          <span className="text-[10px] font-bold text-center leading-tight mt-0.5">Bưu cục</span>
          <span className="pointer-events-none absolute right-full mr-3 whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
            Tìm bưu cục gần nhất
          </span>
        </NavLink>
      </aside>

      {/* HEADER SECTION */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200/80 transition-all shadow-soft-sm">
        {/* Top utility notification bar */}
        <div className="bg-slate-900 text-slate-300 py-1.5 px-4 sm:px-8 lg:px-12 flex justify-between items-center text-xs font-medium">
          <div className="flex items-center gap-6">
            <a href="tel:19008095" className="flex items-center gap-1.5 hover:text-white transition-colors">
              <Phone size={13} className="text-blue-400" />
              <span>Hotline 24/7: <strong className="text-white font-bold">1900 8095</strong></span>
            </a>
            <span className="hidden md:flex items-center gap-1.5 text-slate-400">
              <Headphones size={13} className="text-cyan-400" />
              Hỗ trợ kỹ thuật & đối soát
            </span>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <span className="hidden sm:inline-block px-2 py-0.5 rounded-full bg-blue-900/60 text-blue-300 font-semibold border border-blue-800">
              TP. Hồ Chí Minh & Toàn quốc
            </span>
            <NavLink to="/dich-vu" className="hover:text-blue-300 transition-colors">Khách hàng DN</NavLink>
            <span className="text-slate-600">•</span>
            <NavLink to="/bang-gia" className="hover:text-blue-300 transition-colors">Chính sách phí</NavLink>
          </div>
        </div>

        {/* Main Navigation Bar */}
        <div className="py-3 px-4 sm:px-8 lg:px-12 flex justify-between items-center max-w-7xl mx-auto w-full">
          {/* Logo */}
          <NavLink to="/" className="flex items-center gap-3 group">
            <div className="h-11 w-11 rounded-2xl bg-gradient-to-tr from-blue-700 via-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-blue-500/25 group-hover:shadow-blue-500/40 group-hover:scale-105 transition-all">
              <Package size={24} className="transition-transform group-hover:rotate-6" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 leading-none">Smart<span className="text-blue-600">Logistics</span></span>
                <span className="hidden sm:inline-block text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200">ERP</span>
              </div>
              <p className="text-[10px] font-bold text-slate-400 tracking-wider uppercase mt-1">Hệ thống Vận hành Thông minh</p>
            </div>
          </NavLink>

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center gap-1 xl:gap-2 font-bold text-[13px] text-slate-600">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  isActive
                    ? 'px-3.5 py-2 rounded-xl text-blue-700 bg-blue-50/80 font-black transition-all shadow-soft-sm'
                    : 'px-3.5 py-2 rounded-xl hover:text-slate-900 hover:bg-slate-100/80 transition-all'
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          {/* User action controls */}
          <div className="flex items-center gap-3">
            {role ? (
              <div className="flex items-center gap-2">
                <NavLink
                  to={dashboardLink}
                  className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-md shadow-blue-500/20 active:scale-95 transition-all px-4 py-2.5 rounded-xl"
                  title="Vào khu vực làm việc"
                >
                  <User size={15} />
                  <span className="hidden sm:inline">Bàn làm việc:</span>
                  <span className="font-black max-w-[120px] truncate">{userName}</span>
                </NavLink>
                <button
                  type="button"
                  onClick={logout}
                  className="text-xs font-bold text-slate-600 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 transition-all px-3 py-2.5 rounded-xl"
                  title="Đăng xuất tài khoản"
                >
                  Đăng xuất
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <NavLink
                  to="/dang-nhap"
                  state={{ registration: true }}
                  className="hidden md:inline-flex text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100/80 border border-blue-200 px-4 py-2.5 rounded-xl transition-all"
                >
                  Đăng ký Shop
                </NavLink>
                <NavLink
                  to="/dang-nhap"
                  className="text-xs sm:text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-500/25 active:scale-95 transition-all px-4 py-2.5 rounded-xl flex items-center gap-2"
                >
                  <User size={16} /> Đăng nhập
                </NavLink>
              </div>
            )}

            {/* Mobile Menu Toggle Button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-xl text-slate-700 hover:bg-slate-100 border border-slate-200 transition-colors"
              aria-label="Mở danh mục menu"
            >
              {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-slate-200 bg-white/95 backdrop-blur-md px-4 py-4 space-y-2 shadow-lg animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="grid grid-cols-2 gap-2 pb-3 mb-2 border-b border-slate-100">
              <button
                type="button"
                onClick={() => { setMobileMenuOpen(false); handleQuickCreateOrder(); }}
                className="flex items-center gap-2 p-2.5 rounded-xl bg-blue-50 text-blue-700 font-bold text-xs"
              >
                <FileText size={16} /> Tạo đơn nhanh
              </button>
              <button
                type="button"
                onClick={() => { setMobileMenuOpen(false); handleQuickTracking(); }}
                className="flex items-center gap-2 p-2.5 rounded-xl bg-cyan-50 text-cyan-700 font-bold text-xs"
              >
                <Search size={16} /> Tra cứu đơn
              </button>
            </div>

            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) =>
                  isActive
                    ? 'flex items-center justify-between px-4 py-3 rounded-xl bg-blue-50 text-blue-700 font-black text-sm'
                    : 'flex items-center justify-between px-4 py-3 rounded-xl hover:bg-slate-50 text-slate-700 font-bold text-sm'
                }
              >
                <span>{item.label}</span>
                <ArrowRight size={14} className="text-slate-400" />
              </NavLink>
            ))}

            {!role && (
              <div className="pt-2">
                <NavLink
                  to="/dang-nhap"
                  state={{ registration: true }}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-center w-full py-3 rounded-xl border border-blue-200 bg-blue-50 text-blue-700 font-black text-sm"
                >
                  Đăng ký mở tài khoản Shop
                </NavLink>
              </div>
            )}
          </div>
        )}
      </header>

      {/* MAIN VIEWPORT */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* SCROLL TO TOP FLOATING BUTTON */}
      {showScrollTop && (
        <button
          type="button"
          onClick={scrollToTop}
          className="fixed bottom-24 right-5 z-40 p-3 rounded-full bg-slate-900/80 text-white hover:bg-blue-600 backdrop-blur-md shadow-soft-lg transition-all active:scale-95"
          aria-label="Cuộn lên đầu trang"
        >
          <ChevronUp size={20} />
        </button>
      )}

      {/* MODERN ENTERPRISE FOOTER */}
      <footer className="bg-slate-950 text-slate-300 py-16 mt-auto text-sm border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-10">
          
          {/* Brand info */}
          <div className="lg:col-span-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-blue-600 flex items-center justify-center text-white font-black">
                <Package size={22} />
              </div>
              <h4 className="text-white font-black text-xl tracking-tight">Smart Logistics Vietnam</h4>
            </div>
            
            <p className="leading-relaxed text-slate-400 max-w-md">
              Hệ thống vận tải và giao nhận thông minh thế hệ mới. Tối ưu hóa đa chặng, định vị thời gian thực, quản lý kho bãi tự động và đối soát COD minh bạch cho doanh nghiệp.
            </p>

            <div className="space-y-2 pt-2 text-xs text-slate-400">
              <p className="flex items-center gap-2">
                <ShieldCheck size={16} className="text-emerald-400 shrink-0" />
                <span>Giấy phép Bưu chính & Vận tải số <strong>28/GP-BTTTT</strong> cấp bởi Bộ TTTT</span>
              </p>
              <p className="flex items-center gap-2">
                <MapPin size={16} className="text-blue-400 shrink-0" />
                <span>Tổng kho & Trung tâm điều hành: Số 1 Nguyễn Văn Bảo, Phường 4, Q. Gò Vấp, TP.HCM</span>
              </p>
              <p className="flex items-center gap-2">
                <Globe size={16} className="text-cyan-400 shrink-0" />
                <span>Email hỗ trợ: <strong className="text-slate-300">cskh@smartlogistics.vn</strong></span>
              </p>
            </div>

            <div className="pt-2">
              <a
                href="tel:19008095"
                className="inline-flex items-center gap-3 px-5 py-3 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-black text-base shadow-lg shadow-blue-600/25 hover:from-blue-500 hover:to-indigo-500 transition-all"
              >
                <Phone size={20} />
                <span>Hotline: 1900 8095</span>
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div className="lg:col-span-2 space-y-3">
            <h5 className="text-white font-black uppercase text-xs tracking-wider border-b border-slate-800 pb-2">
              Về Chúng Tôi
            </h5>
            <ul className="space-y-2.5 text-slate-400 text-xs font-medium">
              <li><NavLink to="/" className="hover:text-white transition-colors">Giới thiệu dịch vụ</NavLink></li>
              <li><NavLink to="/dich-vu" className="hover:text-white transition-colors">Các gói vận chuyển</NavLink></li>
              <li><NavLink to="/bang-gia" className="hover:text-white transition-colors">Bảng giá niêm yết</NavLink></li>
              <li><NavLink to="/tim-buu-cuc" className="hover:text-white transition-colors">Mạng lưới bưu cục</NavLink></li>
              <li><NavLink to="/tin-tuc" className="hover:text-white transition-colors">Tin tức & Sự kiện</NavLink></li>
              <li><NavLink to="/tuyen-dung" className="hover:text-white transition-colors">Cơ hội nghề nghiệp</NavLink></li>
            </ul>
          </div>

          {/* Customer support */}
          <div className="lg:col-span-2 space-y-3">
            <h5 className="text-white font-black uppercase text-xs tracking-wider border-b border-slate-800 pb-2">
              Khách Hàng & Đối Tác
            </h5>
            <ul className="space-y-2.5 text-slate-400 text-xs font-medium">
              <li><NavLink to="/uoc-tinh-cuoc" className="hover:text-white transition-colors">Công cụ tính cước</NavLink></li>
              <li><NavLink to="/dang-nhap" state={{ registration: true }} className="hover:text-white transition-colors">Đăng ký Shop mới</NavLink></li>
              <li><NavLink to="/" className="hover:text-white transition-colors">Quy định gửi hàng</NavLink></li>
              <li><NavLink to="/" className="hover:text-white transition-colors">Chính sách bảo mật</NavLink></li>
              <li><NavLink to="/" className="hover:text-white transition-colors">Quy trình xử lý khiếu nại</NavLink></li>
              <li><NavLink to="/dang-nhap" className="hover:text-white transition-colors">Cổng API Doanh Nghiệp</NavLink></li>
            </ul>
          </div>

          {/* Contact & App */}
          <div className="lg:col-span-3 space-y-4">
            <h5 className="text-white font-black uppercase text-xs tracking-wider border-b border-slate-800 pb-2">
              Kênh Tiếp Nhận B2B
            </h5>
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
              <p className="text-xs font-bold text-slate-300">Khách hàng Doanh Nghiệp / Sàn TMĐT:</p>
              <p className="text-sm font-black text-blue-400 flex items-center gap-1.5">
                <Phone size={14} /> 0862.235.888
              </p>
              <p className="text-xs text-slate-400">b2b@smartlogistics.vn</p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
              <p className="text-xs font-bold text-slate-300">Hỗ trợ Tài Xế & Bưu Cục:</p>
              <p className="text-sm font-black text-emerald-400 flex items-center gap-1.5">
                <Phone size={14} /> 0983.663.311
              </p>
              <p className="text-xs text-slate-400">driver-support@smartlogistics.vn</p>
            </div>
          </div>
        </div>

        {/* Bottom copyright line */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-12 pt-6 border-t border-slate-800/80 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-slate-500">
          <p>© 2026 Smart Logistics Corporation. Nền tảng Logistics số hóa toàn trình.</p>
          <div className="flex items-center gap-4">
            <span>Tiêu chuẩn ISO 9001:2015</span>
            <span>•</span>
            <span>Bảo mật dữ liệu TLS 1.3</span>
          </div>
        </div>
      </footer>

      {/* Floating CSKH & Driver Chat Widget */}
      <FloatingChatWidget />
    </div>
  );
}
