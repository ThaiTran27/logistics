import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Mail, Lock, LogIn, ArrowLeft, Package, ShieldCheck, AlertCircle,
  User, Phone, MapPin, UserPlus
} from 'lucide-react';
import { apiFetch as fetch } from '../../utils/apiFetch.js';
import { useLocation } from 'react-router-dom';
import { getWorkspacePath, normalizeRole } from '../../utils/workspaceRoutes.js';

export default function DangNhap() {
  const location = useLocation();
  const [cheDoDangKy, setCheDoDangKy] = useState(() => location.state?.registration === true);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [shopAddress, setShopAddress] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loi, setLoi] = useState(() => {
    if (sessionStorage.getItem('auth_expired_notice') !== '1') return '';
    sessionStorage.removeItem('auth_expired_notice');
    return 'Phiên đăng nhập đã hết hạn';
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

  const xuLyDangNhap = async (e) => {
    e.preventDefault();
    setLoi('');
    setDangXuLy(true);

    try {
      const res = await fetch(`http://localhost:5000/api/${cheDoDangKy ? 'register' : 'login'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cheDoDangKy
          ? { full_name: fullName, phone, shop_address: shopAddress, email, password }
          : { email, password })
      });
      const data = await res.json();

      if (data.success) {
        const role = String(data.user.role || '').trim().toLowerCase();
        
        // [ĐÃ FIX] Thêm 'coordinator' vào từ điển để hệ thống nhận diện
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
      setLoi('Không thể kết nối đến máy chủ. Vui lòng kiểm tra Backend!');
    } finally {
      setDangXuLy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F0F7FF] flex items-center justify-center p-4 sm:p-8 font-sans text-slate-800 relative overflow-hidden">
      
      {/* Background Decorators */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-blue-200/50 rounded-full mix-blend-multiply filter blur-[100px] opacity-70"></div>
      <div className="absolute bottom-[-10%] right-[-5%] w-[400px] h-[400px] bg-indigo-200/50 rounded-full mix-blend-multiply filter blur-[100px] opacity-70"></div>

      <div className="max-w-[1100px] w-full bg-white rounded-[40px] shadow-[0_20px_60px_rgba(0,0,0,0.05)] overflow-hidden flex flex-col md:flex-row relative z-10 border border-white/50 backdrop-blur-xl">
        
        {/* NỬA TRÁI: FORM ĐĂNG NHẬP */}
        <div className="w-full md:w-1/2 p-10 sm:p-16 flex flex-col justify-center bg-white relative z-10">
          
          <button onClick={() => navigate('/')} className="inline-flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-blue-600 transition-colors w-fit mb-12">
            <ArrowLeft size={16} /> Quay lại trang chủ
          </button>

          <div className="mb-10">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl mb-6 shadow-inner">
              <Package size={28} />
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-800 mb-3 tracking-tight">
              {cheDoDangKy ? 'Đăng Ký Shop' : 'Đăng Nhập'}
            </h2>
            <p className="text-slate-500 font-medium text-base">
              {cheDoDangKy
                ? 'Tạo tài khoản Shop để quản lý đơn hàng và đối soát.'
                : 'Hệ thống quản trị trung tâm Smart Logistics.'}
            </p>
          </div>

          <form onSubmit={xuLyDangNhap} className="space-y-6">
            {cheDoDangKy && (
              <>
                <div>
                  <label className="block text-sm font-black text-slate-700 mb-2 tracking-wide">TÊN SHOP / NGƯỜI ĐẠI DIỆN</label>
                  <div className="relative group">
                    <User className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={20} />
                    <input
                      type="text"
                      required
                      maxLength={255}
                      autoComplete="name"
                      placeholder="Tên cửa hàng hoặc người đại diện"
                      className="w-full pl-14 pr-5 py-4 bg-[#F8FAFC] border-2 border-transparent rounded-2xl outline-none focus:bg-white focus:border-blue-400 transition-all font-medium text-slate-700 placeholder:text-slate-400"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-black text-slate-700 mb-2 tracking-wide">SỐ ĐIỆN THOẠI</label>
                  <div className="relative group">
                    <Phone className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={20} />
                    <input
                      type="tel"
                      required
                      autoComplete="tel"
                      placeholder="0901234567"
                      className="w-full pl-14 pr-5 py-4 bg-[#F8FAFC] border-2 border-transparent rounded-2xl outline-none focus:bg-white focus:border-blue-400 transition-all font-medium text-slate-700 placeholder:text-slate-400"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-black text-slate-700 mb-2 tracking-wide">ĐỊA CHỈ SHOP (KHÔNG BẮT BUỘC)</label>
                  <div className="relative group">
                    <MapPin className="absolute left-5 top-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={20} />
                    <input
                      type="text"
                      maxLength={1000}
                      autoComplete="street-address"
                      placeholder="Địa chỉ lấy hàng"
                      className="w-full pl-14 pr-5 py-4 bg-[#F8FAFC] border-2 border-transparent rounded-2xl outline-none focus:bg-white focus:border-blue-400 transition-all font-medium text-slate-700 placeholder:text-slate-400"
                      value={shopAddress}
                      onChange={(e) => setShopAddress(e.target.value)}
                    />
                  </div>
                </div>
              </>
            )}
            <div>
              <label className="block text-sm font-black text-slate-700 mb-2 tracking-wide">ĐỊA CHỈ EMAIL</label>
              <div className="relative group">
                <Mail className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={20} />
                <input 
                  type="email" 
                  required
                  placeholder="email@example.com"
                  autoComplete="email"
                  className="w-full pl-14 pr-5 py-4 bg-[#F8FAFC] border-2 border-transparent rounded-2xl outline-none focus:bg-white focus:border-blue-400 focus:shadow-[0_0_0_4px_rgba(59,130,246,0.1)] transition-all font-medium text-slate-700 placeholder:text-slate-400"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-black text-slate-700 mb-2 tracking-wide">MẬT KHẨU</label>
              <div className="relative group">
                <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={20} />
                <input 
                  type="password" 
                  required
                  minLength={cheDoDangKy ? 8 : undefined}
                  maxLength={128}
                  autoComplete={cheDoDangKy ? 'new-password' : 'current-password'}
                  placeholder="••••••••"
                  className="w-full pl-14 pr-5 py-4 bg-[#F8FAFC] border-2 border-transparent rounded-2xl outline-none focus:bg-white focus:border-blue-400 focus:shadow-[0_0_0_4px_rgba(59,130,246,0.1)] transition-all font-medium text-slate-700 placeholder:text-slate-400"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            {loi && (
              <div className="p-4 bg-red-50 text-red-600 rounded-2xl font-bold text-sm flex items-start gap-3 border border-red-100">
                <AlertCircle size={20} className="shrink-0 mt-0.5" />
                <p>{loi}</p>
              </div>
            )}

            <button 
              type="submit" 
              disabled={dangXuLy}
              className="w-full bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-black py-4.5 rounded-2xl shadow-[0_8px_20px_rgba(37,99,235,0.25)] transition-all flex items-center justify-center gap-2 mt-8 disabled:opacity-70 disabled:cursor-not-allowed text-lg"
            >
              {dangXuLy
                ? (cheDoDangKy ? 'Đang tạo tài khoản...' : 'Đang xác thực...')
                : cheDoDangKy
                  ? <><UserPlus size={22}/> Tạo tài khoản Shop</>
                  : <><LogIn size={22}/> Truy Cập Hệ Thống</>}
            </button>
            <p className="text-center text-sm font-medium text-slate-500">
              {cheDoDangKy ? 'Đã có tài khoản?' : 'Chưa có tài khoản Shop?'}
              {' '}
              <button
                type="button"
                className="font-black text-blue-600 hover:text-blue-800"
                onClick={() => {
                  setCheDoDangKy(!cheDoDangKy);
                  setLoi('');
                }}
              >
                {cheDoDangKy ? 'Đăng nhập' : 'Đăng ký Shop'}
              </button>
            </p>
          </form>
        </div>

        {/* NỬA PHẢI: BANNER */}
        <div className="hidden md:flex w-1/2 relative bg-gradient-to-br from-blue-500 to-indigo-700 p-14 text-white flex-col justify-center overflow-hidden">
          <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-cyan-400/30 rounded-full mix-blend-overlay filter blur-[80px]"></div>
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-blue-600/40 rounded-full mix-blend-overlay filter blur-[80px]"></div>

          <div className="relative z-20">
            <div className="inline-flex bg-white/10 backdrop-blur-md px-5 py-2.5 rounded-full text-sm font-bold flex items-center gap-2 mb-8 border border-white/20 shadow-xl shadow-black/5">
              <ShieldCheck size={18} className="text-cyan-300"/>
              Bảo mật đa tầng cấp doanh nghiệp
            </div>
            <h2 className="text-4xl lg:text-5xl font-black leading-[1.15] mb-6 drop-shadow-md">
              Quản lý chuỗi cung ứng <br/><span className="text-cyan-300">dễ dàng hơn</span> bao giờ hết.
            </h2>
            <p className="text-blue-100/90 text-lg leading-relaxed max-w-md font-medium">
              Từ tạo đơn, điều phối kho bãi đến đối soát COD kế toán. Mọi thao tác được đồng bộ mượt mà theo thời gian thực.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}