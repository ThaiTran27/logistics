import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, LogIn, ArrowLeft, Package, ShieldCheck, AlertCircle } from 'lucide-react';

export default function DangNhap() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loi, setLoi] = useState('');
  const [dangXuLy, setDangXuLy] = useState(false);
  
  const navigate = useNavigate();

  const xuLyDangNhap = async (e) => {
    e.preventDefault();
    setLoi('');
    setDangXuLy(true);

    try {
      const res = await fetch('http://localhost:5000/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();

      if (data.success) {
        const role = String(data.user.role || '').trim().toLowerCase();
        
        // [ĐÃ FIX] Thêm 'coordinator' vào từ điển để hệ thống nhận diện
        const roleAliases = {
          hr: 'hr_manager',
          human_resources: 'hr_manager',
          nhan_su: 'hr_manager',
          fleet: 'fleet_manager',
          dispatcher: 'fleet_manager',
          dieu_hanh: 'fleet_manager',
          coordinator: 'fleet_manager', // <-- Bổ sung chức vụ Điều phối
          shipper: 'driver',
          admin: 'director',
          warehouse: 'warehouse_manager', 
          kho: 'warehouse_manager'
        };
        const normalizedRole = roleAliases[role] || role;

        localStorage.setItem('user_id', data.user.id);
        localStorage.setItem('full_name', data.user.full_name);
        localStorage.setItem('role', normalizedRole);
        localStorage.setItem('user_role', normalizedRole);

        switch (normalizedRole) {
          case 'shop': navigate('/cua-hang'); break;
          case 'driver': navigate('/tai-xe'); break;
          case 'warehouse_manager': navigate('/kho'); break;
          case 'fleet_manager': navigate('/dieu-hanh'); break;
          case 'accountant': navigate('/ke-toan'); break;
          case 'director': navigate('/admin'); break;
          case 'hr_manager': navigate('/nhan-su'); break;
          default: 
            setLoi(`Hệ thống không nhận diện được chức vụ: "${role}". Hãy kiểm tra lại Database.`);
        }
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
            <h2 className="text-3xl sm:text-4xl font-black text-slate-800 mb-3 tracking-tight">Đăng Nhập</h2>
            <p className="text-slate-500 font-medium text-base">Hệ thống quản trị trung tâm Smart Logistics.</p>
          </div>

          <form onSubmit={xuLyDangNhap} className="space-y-6">
            <div>
              <label className="block text-sm font-black text-slate-700 mb-2 tracking-wide">ĐỊA CHỈ EMAIL</label>
              <div className="relative group">
                <Mail className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={20} />
                <input 
                  type="email" 
                  required
                  placeholder="admin@smartlogistics.vn"
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
              {dangXuLy ? 'Đang xác thực...' : <><LogIn size={22}/> Truy Cập Hệ Thống</>}
            </button>
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