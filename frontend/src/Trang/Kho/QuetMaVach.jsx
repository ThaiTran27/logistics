import { useState, useEffect, useRef } from 'react';
import { ScanLine, Boxes, Send, LogOut, PackageCheck, AlertCircle, ClipboardList, MapPin, PackageSearch } from 'lucide-react';

export default function QuetMaVach() {
  const [hangTrongKho, setHangTrongKho] = useState([]);
  const [maVach, setMaVach] = useState('');
  const [thongBao, setThongBao] = useState({ text: '', type: '' });
  const [tabHienTai, setTabHienTai] = useState('quetma');
  
  const [tieuDeBaoCao, setTieuDeBaoCao] = useState('');
  const [noiDungBaoCao, setNoiDungBaoCao] = useState('');
  
  const userId = localStorage.getItem('user_id');
  const inputRef = useRef(null);

  const taiDuLieuKho = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/warehouse/inventory');
      const data = await res.json();
      if (data.success) setHangTrongKho(data.data);
    } catch (error) {
      console.error("Lỗi tải dữ liệu kho:", error);
    }
  };

  useEffect(() => { 
    taiDuLieuKho(); 
  }, []);

  // Luôn focus vào ô nhập mã khi ở tab Quét Mã
  useEffect(() => {
    if (tabHienTai === 'quetma' && inputRef.current) {
      inputRef.current.focus();
    }
  }, [tabHienTai, hangTrongKho]);

  const xuLyQuetMa = async (e) => {
    e.preventDefault();
    if (!maVach.trim()) return;

    try {
      const res = await fetch('http://localhost:5000/api/warehouse/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tracking_code: maVach.trim() })
      });
      
      const data = await res.json();
      
      if (data.success) {
        setThongBao({ text: data.message, type: 'success' });
        taiDuLieuKho(); // Tải lại danh sách tồn kho
      } else {
        setThongBao({ text: data.message, type: 'error' });
      }
    } catch (error) {
      setThongBao({ text: 'Lỗi kết nối đến máy chủ!', type: 'error' });
    }

    // Xóa mã vừa nhập và focus lại để quét mã tiếp theo
    setMaVach('');
    if (inputRef.current) inputRef.current.focus();
    
    // Tự động xóa thông báo sau 3 giây
    setTimeout(() => setThongBao({ text: '', type: '' }), 3000);
  };

  const guiBaoCao = async (e) => {
    e.preventDefault();
    if (!tieuDeBaoCao || !noiDungBaoCao) return alert("Vui lòng nhập đủ tiêu đề và nội dung!");

    await fetch('http://localhost:5000/api/reports/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        department: 'Kho Bãi',
        title: tieuDeBaoCao,
        content: noiDungBaoCao,
        created_by: userId
      })
    });

    alert('Gửi báo cáo kho bãi lên Ban Giám Đốc thành công!');
    setTieuDeBaoCao('');
    setNoiDungBaoCao('');
  };

  const dangXuat = () => {
    const xacNhan = window.confirm("Bạn có chắc chắn muốn đăng xuất khỏi hệ thống?");
    if (xacNhan) {
      localStorage.clear();
      window.location.href = '/'; 
    }
  };

  return (
    <div className="flex min-h-screen bg-[#F8FAFC] font-sans text-slate-700">
      
      {/* SIDEBAR TÔNG MÀU SLATE & EMERALD */}
      <div className="w-72 bg-white border-r border-slate-100 shadow-[0_0_20px_rgba(0,0,0,0.02)] flex flex-col z-10 justify-between">
        <div>
          <div className="p-8 border-b border-slate-50 flex items-center gap-3">
            <div className="bg-gradient-to-tr from-emerald-600 to-emerald-400 p-2.5 rounded-xl shadow-emerald-200 shadow-lg">
              <Boxes className="text-white" size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-800 tracking-tight">Kho Bãi WMS</h2>
              <p className="text-xs font-bold text-emerald-500 uppercase tracking-wider mt-0.5">Trung Tâm Lưu Trữ</p>
            </div>
          </div>
          
          <div className="flex flex-col gap-3 p-5 mt-2">
            <button 
              onClick={() => setTabHienTai('quetma')}
              className={`px-5 py-4 rounded-2xl font-bold text-left transition-all duration-300 flex items-center gap-4 group ${tabHienTai === 'quetma' ? 'bg-gradient-to-r from-emerald-600 to-emerald-500 text-white shadow-lg shadow-emerald-200' : 'bg-transparent text-slate-500 hover:bg-emerald-50 hover:text-emerald-600'}`}
            >
              <ScanLine size={20} className={tabHienTai === 'quetma' ? 'text-white' : 'text-slate-400 group-hover:text-emerald-500'} />
              Quét Nhập / Xuất Kho
            </button>
            
            <button 
              onClick={() => setTabHienTai('baocao')}
              className={`px-5 py-4 rounded-2xl font-bold text-left transition-all duration-300 flex items-center gap-4 group ${tabHienTai === 'baocao' ? 'bg-gradient-to-r from-emerald-600 to-emerald-500 text-white shadow-lg shadow-emerald-200' : 'bg-transparent text-slate-500 hover:bg-emerald-50 hover:text-emerald-600'}`}
            >
              <ClipboardList size={20} className={tabHienTai === 'baocao' ? 'text-white' : 'text-slate-400 group-hover:text-emerald-500'} />
              Báo Cáo Kiểm Kê
            </button>
          </div>
        </div>

        {/* Nút Đăng xuất */}
        <div className="p-5 border-t border-slate-50">
          <button 
            onClick={dangXuat}
            className="w-full px-5 py-4 rounded-2xl font-bold text-left transition-all duration-300 flex items-center gap-4 group bg-transparent text-red-500 hover:bg-red-50 hover:text-red-600"
          >
            <LogOut size={20} className="text-red-400 group-hover:text-red-500" />
            Đăng Xuất
          </button>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 p-10 overflow-y-auto">
        
        {/* HEADER */}
        <div className="mb-8 flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-black text-slate-800 tracking-tight">
              {tabHienTai === 'quetma' ? 'Máy Quét Mã Vạch Tự Động' : 'Báo Cáo Hiện Trạng Kho'}
            </h1>
            <p className="text-slate-500 mt-2">
              {tabHienTai === 'quetma' ? 'Sử dụng súng quét để ghi nhận hàng hóa nhập kho hoặc xuất kho.' : 'Kiểm đếm số lượng tồn kho và trình báo cáo lên Ban Giám Đốc.'}
            </p>
          </div>
        </div>

        {/* TAB 1: QUÉT MÃ VẠCH */}
        {tabHienTai === 'quetma' && (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
            
            {/* Máy Quét */}
            <div className="xl:col-span-4">
              <div className="bg-white p-8 rounded-[24px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-50 relative overflow-hidden h-full flex flex-col justify-center">
                {/* Tia laser giả lập */}
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent animate-pulse opacity-50"></div>
                
                <div className="text-center mb-8">
                  <div className="inline-flex items-center justify-center p-4 bg-emerald-50 text-emerald-500 rounded-full mb-4">
                    <ScanLine size={36} />
                  </div>
                  <h3 className="text-xl font-bold text-slate-800">Sẵn sàng quét</h3>
                  <p className="text-sm text-slate-400 mt-1">Đưa mã vạch vào khu vực đọc</p>
                </div>
                
                <form onSubmit={xuLyQuetMa} className="mb-4 relative">
                  <input 
                    ref={inputRef}
                    type="text" 
                    value={maVach}
                    onChange={(e) => setMaVach(e.target.value)}
                    className="w-full bg-slate-50 border-2 border-slate-200 p-5 rounded-2xl text-2xl font-black uppercase text-center focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-50 outline-none transition-all text-slate-700 tracking-widest"
                    placeholder="VD: SL12345"
                    autoComplete="off"
                  />
                  <button type="submit" className="hidden">Quét</button>
                </form>

                {/* Khu vực thông báo */}
                <div className="h-16 flex items-center justify-center">
                  {thongBao.text ? (
                    <div className={`px-6 py-3 rounded-xl font-bold text-sm w-full text-center flex items-center justify-center gap-2 animate-in fade-in slide-in-from-bottom-2 ${thongBao.type === 'success' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-red-50 text-red-600 border border-red-100'}`}>
                      {thongBao.type === 'success' ? <PackageCheck size={18}/> : <AlertCircle size={18}/>}
                      {thongBao.text}
                    </div>
                  ) : (
                    <p className="text-slate-300 text-sm font-medium animate-pulse flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                      Đang đợi tín hiệu...
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Bảng Hàng Hóa Tồn Kho */}
            <div className="xl:col-span-8 bg-white rounded-[24px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-50 overflow-hidden flex flex-col">
              <div className="p-6 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <Boxes size={20} className="text-emerald-500" /> Danh sách lưu kho thực tế
                </h3>
                <span className="bg-emerald-100 text-emerald-700 px-4 py-1.5 rounded-lg font-bold text-sm flex items-center gap-2">
                  Tổng: {hangTrongKho.length} kiện
                </span>
              </div>
              
              <div className="overflow-y-auto max-h-[600px]">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-white sticky top-0 z-10 shadow-sm">
                    <tr>
                      <th className="p-5 text-xs font-black text-slate-400 uppercase tracking-wider">Mã Vận Đơn</th>
                      <th className="p-5 text-xs font-black text-slate-400 uppercase tracking-wider">Người Nhận</th>
                      <th className="p-5 text-xs font-black text-slate-400 uppercase tracking-wider">Khu Vực Giao</th>
                      <th className="p-5 text-xs font-black text-slate-400 uppercase tracking-wider text-right">Trạng Thái</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {hangTrongKho.length === 0 ? (
                      <tr>
                        <td colSpan="4" className="p-16 text-center">
                          <div className="flex flex-col items-center justify-center text-slate-400">
                            <PackageSearch size={48} className="mb-4 opacity-30" />
                            <p className="text-lg font-medium">Kho hiện tại đang trống.</p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      hangTrongKho.map((don) => (
                        <tr key={don.id} className="hover:bg-slate-50/50 transition-colors group">
                          <td className="p-5">
                            <span className="bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg font-black tracking-wide">
                              {don.tracking_code}
                            </span>
                          </td>
                          <td className="p-5 font-bold text-slate-700">{don.receiver_name}</td>
                          <td className="p-5 text-sm text-slate-500 font-medium">
                            <div className="flex items-center gap-1.5">
                              <MapPin size={14} className="text-slate-400" />
                              <span className="truncate max-w-[200px]">{don.receiver_address}</span>
                            </div>
                          </td>
                          <td className="p-5 text-right">
                            <span className="bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-lg text-xs font-bold uppercase flex items-center w-fit ml-auto gap-1.5">
                              <Boxes size={14} /> Lưu Kho
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
        )}

        {/* TAB 2: BÁO CÁO KHO BÃI */}
        {tabHienTai === 'baocao' && (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
            <div className="xl:col-span-5 flex flex-col gap-6">
              <div className="bg-white p-8 rounded-[24px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] relative overflow-hidden group border border-slate-50 h-full flex flex-col justify-center items-center text-center">
                <div className="absolute -right-10 -bottom-10 opacity-[0.02] text-emerald-500 group-hover:scale-110 transition-transform duration-500">
                  <Boxes size={200} />
                </div>
                <div className="bg-emerald-50 p-4 rounded-full text-emerald-500 mb-6">
                  <PackageCheck size={40} />
                </div>
                <p className="text-slate-400 font-bold mb-2 uppercase text-sm tracking-widest">
                  Tổng Số Kiện Hàng Tồn
                </p>
                <p className="text-6xl font-black text-slate-800">{hangTrongKho.length}</p>
                <p className="text-slate-500 mt-4 text-sm font-medium px-4">
                  Sử dụng biểu mẫu bên cạnh để báo cáo tình trạng hư hỏng, thất thoát hoặc yêu cầu mở rộng diện tích kho bãi.
                </p>
              </div>
            </div>

            <div className="xl:col-span-7 bg-white p-8 rounded-[24px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-50 h-fit">
              <div className="flex items-center gap-3 mb-8">
                <div className="bg-emerald-50 p-3 rounded-xl text-emerald-500">
                  <Send size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-800">Trình Báo Cáo Kiểm Kê</h3>
                  <p className="text-xs font-bold text-slate-400 uppercase mt-1">Gửi Ban Giám Đốc</p>
                </div>
              </div>
              
              <form onSubmit={guiBaoCao} className="space-y-6">
                <div>
                  <label className="block font-bold text-slate-600 mb-2 text-sm">Tiêu đề báo cáo</label>
                  <input 
                    type="text" 
                    className="w-full bg-[#F8FAFC] border-2 border-transparent p-4 rounded-xl outline-none focus:border-emerald-400 focus:bg-white transition-all font-medium text-slate-700" 
                    placeholder="VD: Đề xuất thanh lý hàng tồn đọng quá 30 ngày..."
                    value={tieuDeBaoCao}
                    onChange={(e) => setTieuDeBaoCao(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-600 mb-2 text-sm">Nội dung chi tiết</label>
                  <textarea 
                    rows="7" 
                    className="w-full bg-[#F8FAFC] border-2 border-transparent p-4 rounded-xl outline-none focus:border-emerald-400 focus:bg-white transition-all font-medium text-slate-700 resize-none"
                    placeholder="Nhập chi tiết tình trạng hàng hóa, sự cố ngập nước, cháy nổ (nếu có)..."
                    value={noiDungBaoCao}
                    onChange={(e) => setNoiDungBaoCao(e.target.value)}
                  ></textarea>
                </div>
                <button type="submit" className="w-full bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white font-bold py-4 rounded-xl shadow-lg shadow-emerald-200 transition-all flex justify-center items-center gap-2 text-lg">
                  <Send size={20} />
                  Gửi Khối Điều Hành
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}