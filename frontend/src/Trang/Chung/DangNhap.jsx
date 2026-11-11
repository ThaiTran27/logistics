import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Mail, Lock, LogIn, ArrowLeft, Package, ShieldCheck, AlertCircle,
  User, Phone, MapPin, UserPlus, Eye, EyeOff, Sparkles, Check, CheckCircle2
} from 'lucide-react';
import { apiFetch as fetch, API_URL } from '../../utils/apiFetch.js';
import { getWorkspacePath, normalizeRole } from '../../utils/workspaceRoutes.js';

const DEMO_ACCOUNTS = [
  { role: 'Giám đốc', email: 'admin@smartlogistics.vn', label: 'Admin/Giám Đốc', color: 'from-amber-500 to-orange-500' },
  { role: 'Cửa hàng', email: 'shop@smartlogistics.vn', label: 'Shop Bán Hàng', color: 'from-blue-600 to-cyan-500' },
  { role: 'Tài xế', email: 'taixe3@smartlogistics.vn', label: 'Tài Xế Giao', color: 'from-emerald-500 to-teal-600' },
  { role: 'Điều hành', email: 'dieu_hanh@smartlogistics.vn', label: 'Điều Phối Viên', color: 'from-indigo-600 to-blue-500' },
  { role: 'Thủ kho', email: 'kho@smartlogistics.vn', label: 'Quản Lý Kho', color: 'from-purple-600 to-indigo-600' },
  { role: 'Kế toán', email: 'ketoan@smartlogistics.vn', label: 'Kế Toán COD', color: 'from-rose-500 to-pink-600' },
  { role: 'Nhân sự', email: 'hr@smartlogistics.vn', label: 'Nhân Sự HR', color: 'from-slate-700 to-slate-900' },
];

export default function DangNhap() {
  const location = useLocation();
  const [cheDoDangKy, setCheDoDangKy] = useState(() => location.state?.registration === true);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [shopAddress, setShopAddress] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loi, setLoi] = useState(() => {
    if (sessionStorage.getItem('auth_expired_notice') !== '1') return '';
    sessionStorage.removeItem('auth_expired_notice');
    return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
  });
  const [dangXuLy, setDangXuLy] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    if (location.state?.registration === true) return;
    const rawRole = localStorage.getItem('role') || localStorage.getItem('user_role');
    const role = normalizeRole(rawRole);
    if (!role) return;
    navigate(getWorkspacePath(role), { replace: true });
  }, [location.state, navigate]);

  const fillDemo = (demoEmail) => {
    setCheDoDangKy(false);
    setEmail(demoEmail);
    setPassword('123');
    setLoi('');
  };

  const xuLyDangNhap = async (e) => {
    e.preventDefault();
    setLoi('');
    setDangXuLy(true);

    try {
      const res = await fetch(`${API_URL}/api/${cheDoDangKy ? 'register' : 'login'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cheDoDangKy
          ? { full_name: fullName, phone, shop_address: shopAddress, email, password }
          : { email, password })
      });
      const data = await res.json();

      if (data.success) {
        const role = String(data.user.role || '').trim().toLowerCase();
        const normalizedRole = normalizeRole(role);

        localStorage.setItem('user_id', data.user.id);
        localStorage.setItem('access_token', data.token);
        localStorage.setItem('full_name', data.user.full_name);
        localStorage.setItem('role', normalizedRole);
        localStorage.setItem('user_role', normalizedRole);
        if (data.user.warehouse_id) localStorage.setItem('warehouse_id', data.user.warehouse_id);
        else localStorage.removeItem('warehouse_id');
        if (data.user.warehouse_type) localStorage.setItem('warehouse_type', data.user.warehouse_type);
        else localStorage.removeItem('warehouse_type');

        navigate(getWorkspacePath(normalizedRole));
      } else {
        setLoi(data.message || 'Email hoặc mật khẩu không chính xác!');
      }
    } catch {
      setLoi('Không thể kết nối đến máy chủ backend. Vui lòng kiểm tra dịch vụ!');
    } finally {
      setDangXuLy(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 sm:p-6 lg:p-8 font-sans text-slate-800 relative overflow-hidden">
      
      {/* Background Decorative Ambient Lights */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-sky-500/10 rounded-full blur-[140px] pointer-events-none" />

      <div className="max-w-5xl w-full bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row relative z-10 border border-slate-100">
        
        {/* NỬA TRÁI: FORM ĐĂNG NHẬP / ĐĂNG KÝ */}
        <div className="w-full md:w-7/12 p-8 sm:p-12 lg:p-14 flex flex-col justify-center bg-white">
          
          <div className="flex items-center justify-between mb-8">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="inline-flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-blue-600 transition-colors"
            >
              <ArrowLeft size={16} /> Quay lại trang chủ
            </button>

            <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
              Cổng ERP v2.4
            </span>
          </div>

          <div className="mb-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-blue-700 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-600/20">
                <Package size={26} />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                  {cheDoDangKy ? 'Đăng Ký Cửa Hàng' : 'Đăng Nhập'}
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 font-medium">
                  {cheDoDangKy
                    ? 'Bắt đầu gửi hàng và quản lý đơn thu hộ COD'
                    : 'Truy cập trung tâm làm việc Smart Logistics'}
                </p>
              </div>
            </div>

            {/* Quick mode switcher tabs */}
            <div className="flex p-1 bg-slate-100 rounded-xl mt-4">
              <button
                type="button"
                onClick={() => { setCheDoDangKy(false); setLoi(''); }}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                  !cheDoDangKy
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Đăng nhập
              </button>
              <button
                type="button"
                onClick={() => { setCheDoDangKy(true); setLoi(''); }}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                  cheDoDangKy
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Đăng ký Shop mới
              </button>
            </div>
          </div>

          {/* Quick Demo Selector Chips (Only when logging in) */}
          {!cheDoDangKy && (
            <div className="mb-6 p-3 rounded-2xl bg-blue-50/70 border border-blue-100">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-blue-800 mb-2">
                <Sparkles size={13} className="text-amber-500" />
                <span>Tài khoản thử nghiệm nhanh (bấm chọn):</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {DEMO_ACCOUNTS.map((item) => (
                  <button
                    key={item.email}
                    type="button"
                    onClick={() => fillDemo(item.email)}
                    className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border transition-all ${
                      email === item.email
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-blue-400 hover:text-blue-700'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <form onSubmit={xuLyDangNhap} className="space-y-4">
            {cheDoDangKy && (
              <>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    TÊN CỬA HÀNG / NGƯỜI ĐẠI DIỆN
                  </label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                      type="text"
                      required
                      maxLength={255}
                      autoComplete="name"
                      placeholder="VD: Shop Thời Trang Gò Vấp"
                      className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all font-medium text-slate-800 text-sm placeholder:text-slate-400"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    SỐ ĐIỆN THOẠI
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                      type="tel"
                      required
                      autoComplete="tel"
                      placeholder="0901234567"
                      className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all font-medium text-slate-800 text-sm placeholder:text-slate-400"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    ĐỊA CHỈ SHOP LẤY HÀNG
                  </label>
                  <div className="relative">
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                      type="text"
                      maxLength={1000}
                      autoComplete="street-address"
                      placeholder="Số nhà, tên đường, Phường, Quận Gò Vấp"
                      className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all font-medium text-slate-800 text-sm placeholder:text-slate-400"
                      value={shopAddress}
                      onChange={(e) => setShopAddress(e.target.value)}
                    />
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                ĐỊA CHỈ EMAIL
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="email"
                  required
                  placeholder="name@smartlogistics.vn"
                  autoComplete="email"
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all font-medium text-slate-800 text-sm placeholder:text-slate-400"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  MẬT KHẨU
                </label>
                {!cheDoDangKy && (
                  <span className="text-[11px] text-slate-400 font-medium">Mật khẩu mẫu: <strong>123</strong></span>
                )}
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={cheDoDangKy ? 6 : undefined}
                  maxLength={128}
                  autoComplete={cheDoDangKy ? 'new-password' : 'current-password'}
                  placeholder="••••••••"
                  className="w-full pl-11 pr-11 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all font-medium text-slate-800 text-sm placeholder:text-slate-400"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1"
                  aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {loi && (
              <div className="p-3.5 bg-rose-50 text-rose-700 rounded-xl font-bold text-xs flex items-start gap-2.5 border border-rose-200 animate-in fade-in">
                <AlertCircle size={18} className="shrink-0 mt-0.5 text-rose-600" />
                <p className="flex-1 leading-relaxed">{loi}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={dangXuLy}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 active:scale-[0.99] text-white font-black py-3.5 rounded-xl shadow-lg shadow-blue-600/25 transition-all flex items-center justify-center gap-2 mt-5 disabled:opacity-70 disabled:cursor-not-allowed text-sm"
            >
              {dangXuLy ? (
                <>
                  <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>{cheDoDangKy ? 'Đang tạo tài khoản...' : 'Đang xác thực...'}</span>
                </>
              ) : cheDoDangKy ? (
                <>
                  <UserPlus size={18} />
                  <span>Đăng Ký Tài Khoản Shop</span>
                </>
              ) : (
                <>
                  <LogIn size={18} />
                  <span>Truy Cập Hệ Thống</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* NỬA PHẢI: BANNER THƯƠNG HIỆU */}
        <div className="w-full md:w-5/12 bg-gradient-to-br from-blue-700 via-indigo-800 to-slate-900 p-8 sm:p-12 text-white flex flex-col justify-between relative overflow-hidden">
          
          {/* Subtle geometric circles */}
          <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full bg-white/5 blur-2xl" />
          <div className="absolute -bottom-16 -left-16 w-56 h-56 rounded-full bg-cyan-400/10 blur-2xl" />

          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-xs font-bold text-cyan-200 mb-6">
              <ShieldCheck size={16} />
              Hệ thống bảo mật TLS 1.3 & JWT
            </div>

            <h2 className="text-2xl sm:text-3xl font-black leading-tight tracking-tight mb-4">
              Quản trị vận tải & <br />
              <span className="text-cyan-300">đối soát dòng tiền</span> chuẩn xác.
            </h2>

            <p className="text-blue-100/80 text-xs sm:text-sm leading-relaxed mb-6 font-medium">
              Đồng bộ trạng thái đơn hàng theo thời gian thực từ lúc shop tạo đơn, điều phối tài xế lấy hàng, lưu kho đến khi giao tận tay người nhận.
            </p>
          </div>

          <div className="relative z-10 pt-6 border-t border-white/10 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-blue-100">
              <CheckCircle2 size={16} className="text-emerald-400" />
              <span>Đối soát COD tức thì, minh bạch</span>
            </div>
            <div className="flex items-center gap-2 text-xs font-bold text-blue-100">
              <CheckCircle2 size={16} className="text-emerald-400" />
              <span>Định vị GPS tài xế theo thời gian thực</span>
            </div>
            <div className="flex items-center gap-2 text-xs font-bold text-blue-100">
              <CheckCircle2 size={16} className="text-emerald-400" />
              <span>Chấm công & tính lương tự động</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
