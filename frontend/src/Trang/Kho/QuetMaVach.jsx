import { useState, useEffect, useRef } from 'react';
import { ScanLine, Barcode, LogOut, Box, ArrowRightLeft, CheckCircle, AlertCircle, PackageSearch, Camera, X } from 'lucide-react';
import { Html5QrcodeScanner } from 'html5-qrcode';

export default function QuetMaVach() {
  const [maVanDon, setMaVanDon] = useState('');
  const [tonKho, setTonKho] = useState([]);
  const [thongBao, setThongBao] = useState({ loai: '', thongDiep: '' });
  const [dangXuLy, setDangXuLy] = useState(false);
  
  // State quản lý việc bật/tắt Camera
  const [moCamera, setMoCamera] = useState(false);
  
  const inputRef = useRef(null);
  const warehouseName = localStorage.getItem('full_name') || 'Thủ Kho';

  const taiTonKho = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/warehouse/inventory');
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setTonKho(data.data);
      }
    } catch (error) {
      console.error("Lỗi tải tồn kho:", error);
    }
  };

  useEffect(() => {
    taiTonKho();
    // Focus vào input trừ khi camera đang mở
    if (inputRef.current && !moCamera) inputRef.current.focus();
  }, [moCamera]);

  // HÀM XỬ LÝ CHUNG CHO CẢ SÚNG QUÉT, NHẬP TAY VÀ CAMERA
  const xuLyQuetMa = async (e, maTuCamera = null) => {
    if (e) e.preventDefault();
    
    // Lấy mã từ Camera hoặc từ ô Input
    const maCanXuly = maTuCamera || maVanDon;
    if (!maCanXuly.trim()) return;

    setDangXuLy(true);
    setThongBao({ loai: '', thongDiep: '' });

    try {
      const res = await fetch('http://localhost:5000/api/warehouse/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tracking_code: maCanXuly.trim().toUpperCase() })
      });
      const data = await res.json();

      if (data.success) {
        setThongBao({ loai: 'thanhcong', thongDiep: data.message });
        taiTonKho(); 
      } else {
        setThongBao({ loai: 'loi', thongDiep: data.message });
      }
    } catch (error) {
      setThongBao({ loai: 'loi', thongDiep: 'Lỗi kết nối đến máy chủ!' });
    } finally {
      setDangXuLy(false);
      setMaVanDon(''); 
      if (inputRef.current && !moCamera) inputRef.current.focus();
      
      // Ẩn thông báo sau 3 giây
      setTimeout(() => setThongBao({ loai: '', thongDiep: '' }), 3000);
    }
  };

  // HOOK QUẢN LÝ THƯ VIỆN CAMERA (HTML5-QRCODE)
  useEffect(() => {
    if (moCamera) {
      // Cấu hình máy quét: quét barcode 1D với fps cao
      const scanner = new Html5QrcodeScanner('camera-reader', { 
        qrbox: { width: 250, height: 100 }, 
        fps: 10,
        rememberLastUsedCamera: true
      });

      scanner.render(
        (decodedText) => {
          // Khi đọc được mã vạch thành công
          scanner.clear(); // Tắt máy quét
          setMoCamera(false); // Ẩn giao diện camera
          setMaVanDon(decodedText); // Đổ text vào ô input
          xuLyQuetMa(null, decodedText); // Đẩy lên API ngay lập tức
          
          // Tạo tiếng "Tít" giống siêu thị
          const audio = new Audio('https://www.soundjay.com/button/beep-07.wav');
          audio.play().catch(() => {});
        },
        (error) => {
          // Hàm này chạy liên tục khi khung hình mờ/chưa thấy mã, ta bỏ qua để không in log rác
        }
      );

      // Cleanup function: Tắt camera nếu người dùng chuyển trang
      return () => {
        scanner.clear().catch(() => {});
      };
    }
  }, [moCamera]);

  const dangXuat = () => {
    if (window.confirm("Bạn muốn kết thúc ca trực Kho?")) {
      localStorage.clear();
      window.location.href = '/'; 
    }
  };

  const anToanTonKho = Array.isArray(tonKho) ? tonKho : [];

  return (
    <div className="flex min-h-screen bg-[#F1F5F9] font-sans text-slate-800">
      
      {/* SIDEBAR */}
      <div className="w-72 bg-slate-900 border-r border-slate-800 shadow-xl flex flex-col z-10 justify-between text-slate-300">
        <div>
          <div className="p-8 border-b border-slate-800 flex items-center gap-3 bg-slate-950/50">
            <div className="bg-gradient-to-tr from-indigo-500 to-purple-500 p-2.5 rounded-xl shadow-lg shadow-indigo-500/20">
              <Barcode className="text-white" size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black text-white tracking-tight">Kho Bãi</h2>
              <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mt-0.5">Quản lý Xuất Nhập</p>
            </div>
          </div>
          
          <div className="p-5 mt-2 space-y-2">
            <button className="w-full px-5 py-4 rounded-2xl font-bold flex items-center gap-4 transition-all bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <ScanLine size={20} /> Máy Quét Mã Vạch
            </button>
            <button className="w-full px-5 py-4 rounded-2xl font-bold flex items-center gap-4 transition-all text-slate-500 hover:bg-slate-800 hover:text-slate-300 cursor-not-allowed" title="Tính năng đang cập nhật">
              <Box size={20} /> Kiểm Kê Định Kỳ
            </button>
          </div>
        </div>

        <div className="p-5 border-t border-slate-800 bg-slate-950/30">
          <div className="flex items-center gap-3 px-5 py-4 mb-3 bg-slate-800/50 rounded-xl border border-slate-700/50">
            <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center font-black text-indigo-400">
              {(warehouseName || 'K').charAt(0)}
            </div>
            <div>
              <p className="text-sm font-bold text-white">{warehouseName}</p>
              <p className="text-xs text-slate-500">Thủ kho ca hiện tại</p>
            </div>
          </div>
          <button onClick={dangXuat} className="w-full px-5 py-4 rounded-2xl font-bold text-left text-red-400 hover:bg-red-500/10 transition-colors flex items-center gap-3">
            <LogOut size={18}/> Đăng Xuất
          </button>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 p-10 overflow-y-auto flex flex-col xl:flex-row gap-8">
        
        {/* CỘT TRÁI: MÁY QUÉT */}
        <div className="xl:w-1/3 flex flex-col gap-6">
          <div className="bg-white p-8 rounded-[32px] shadow-sm border border-slate-200 text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-indigo-500 to-purple-500"></div>
            
            <div className="inline-flex items-center justify-center w-20 h-20 bg-indigo-50 text-indigo-600 rounded-full mb-6">
              <ScanLine size={36} />
            </div>
            <h2 className="text-2xl font-black text-slate-800 mb-2">Quét Mã Vận Đơn</h2>
            <p className="text-slate-500 text-sm mb-6 font-medium">Sử dụng súng quét, nhập tay, hoặc mở Camera thiết bị.</p>

            {/* VÙNG CHỨA CAMERA / NÚT BẬT CAMERA */}
            {!moCamera ? (
              <button 
                onClick={() => setMoCamera(true)}
                className="w-full mb-6 bg-slate-100 hover:bg-slate-200 text-indigo-600 font-bold py-3.5 rounded-2xl transition-all flex justify-center items-center gap-2 border border-slate-200"
              >
                <Camera size={18} /> Mở Camera Quét Mã
              </button>
            ) : (
              <div className="mb-6 bg-slate-900 rounded-2xl overflow-hidden relative border-4 border-indigo-100">
                <button 
                  onClick={() => setMoCamera(false)} 
                  className="absolute top-2 right-2 z-50 bg-red-500 text-white p-1.5 rounded-full shadow-lg hover:bg-red-600"
                >
                  <X size={16} />
                </button>
                <div id="camera-reader" className="w-full"></div>
              </div>
            )}

            <div className="relative flex items-center py-2 mb-6">
              <div className="flex-grow border-t border-slate-200"></div>
              <span className="flex-shrink-0 mx-4 text-slate-400 text-[10px] font-bold uppercase tracking-wider">Hoặc Súng quét / Nhập tay</span>
              <div className="flex-grow border-t border-slate-200"></div>
            </div>

            <form onSubmit={(e) => xuLyQuetMa(e, null)} className="space-y-4">
              <input 
                ref={inputRef}
                type="text" 
                placeholder="SL123456VN..." 
                className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-200 rounded-2xl outline-none focus:bg-white focus:border-indigo-400 focus:shadow-[0_0_0_4px_rgba(99,102,241,0.1)] transition-all text-center text-2xl font-black text-slate-700 tracking-wider uppercase"
                value={maVanDon}
                onChange={(e) => setMaVanDon(e.target.value)}
                autoComplete="off"
                disabled={moCamera}
              />
              <button 
                type="submit" 
                disabled={dangXuLy || moCamera}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-4.5 rounded-2xl shadow-lg shadow-indigo-200 transition-all text-lg disabled:opacity-50 disabled:scale-100 active:scale-[0.98]"
              >
                {dangXuLy ? 'Đang Xử Lý...' : 'Xác Nhận Quét (Enter)'}
              </button>
            </form>

            {/* HIỂN THỊ KẾT QUẢ QUÉT */}
            {thongBao.thongDiep && (
              <div className={`mt-6 p-5 rounded-2xl text-left flex gap-4 items-start animate-in zoom-in-95 duration-200 border ${
                thongBao.loai === 'thanhcong' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-red-50 text-red-600 border-red-100'
              }`}>
                {thongBao.loai === 'thanhcong' ? <CheckCircle size={24} className="shrink-0 mt-0.5 text-emerald-500"/> : <AlertCircle size={24} className="shrink-0 mt-0.5 text-red-500"/>}
                <div>
                  <p className="font-black text-base">{thongBao.loai === 'thanhcong' ? 'Xử Lý Thành Công!' : 'Quét Thất Bại'}</p>
                  <p className="text-sm mt-1 font-medium opacity-90">{thongBao.thongDiep}</p>
                </div>
              </div>
            )}
          </div>

          <div className="bg-white p-6 rounded-[32px] shadow-sm border border-slate-200 flex items-center gap-5">
            <div className="bg-amber-50 p-4 rounded-2xl text-amber-600"><PackageSearch size={32}/></div>
            <div>
              <p className="text-slate-400 font-bold text-xs uppercase tracking-wider mb-1">Đang Lưu Kho</p>
              <p className="text-3xl font-black text-slate-800">{anToanTonKho.length} <span className="text-base text-slate-400 font-bold">đơn</span></p>
            </div>
          </div>
        </div>

        {/* CỘT PHẢI: LƯỚI TỒN KHO */}
        <div className="xl:w-2/3 flex flex-col">
          <div className="bg-white rounded-[32px] shadow-sm border border-slate-200 flex-1 overflow-hidden flex flex-col">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-[#F8FAFC]">
              <h3 className="font-black text-slate-800 text-xl flex items-center gap-3">
                <Box className="text-indigo-600" size={24} /> 
                Danh Sách Tồn Kho Hiện Tại
              </h3>
            </div>

            <div className="flex-1 overflow-auto p-2">
              <table className="w-full text-left border-collapse">
                <thead className="bg-white sticky top-0 z-10">
                  <tr>
                    <th className="p-5 text-xs font-black text-slate-400 uppercase tracking-wider border-b border-slate-100">Mã Vận Đơn</th>
                    <th className="p-5 text-xs font-black text-slate-400 uppercase tracking-wider border-b border-slate-100">Khách Hàng</th>
                    <th className="p-5 text-xs font-black text-slate-400 uppercase tracking-wider border-b border-slate-100">Cân Nặng</th>
                    <th className="p-5 text-xs font-black text-slate-400 uppercase tracking-wider border-b border-slate-100 text-right">Trạng Thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {anToanTonKho.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="p-20 text-center text-slate-400 font-medium">
                        Kho đang trống. Không có đơn hàng nào đang lưu kho.
                      </td>
                    </tr>
                  ) : (
                    anToanTonKho.map((item) => (
                      <tr key={item?.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-5">
                          <p className="font-black text-slate-700 tracking-wide">{item?.tracking_code}</p>
                        </td>
                        <td className="p-5">
                          <p className="font-bold text-slate-800 text-sm">{item?.receiver_name}</p>
                          <p className="text-xs text-slate-500 mt-1 line-clamp-1 max-w-[200px]">{item?.receiver_address}</p>
                        </td>
                        <td className="p-5">
                          <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-md font-bold text-xs">
                            {item?.weight_kg || 1} kg
                          </span>
                        </td>
                        <td className="p-5 text-right">
                          <span className="bg-amber-50 text-amber-600 border border-amber-100 px-4 py-2 rounded-xl font-bold text-xs inline-flex items-center gap-1.5 shadow-sm">
                            <ArrowRightLeft size={14} /> Chờ Xuất Kho
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}