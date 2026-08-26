import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
// Đã thêm icon LogOut (Đăng xuất)
import { Receipt, FileText, Send, CheckCircle, Wallet, Store, LayoutDashboard, AlertCircle, LogOut } from 'lucide-react';

export default function DoiSoatCOD() {
  const [congNo, setCongNo] = useState([]);
  const [tabHienTai, setTabHienTai] = useState('nghiepvu'); 
  
  const [tieuDeBaoCao, setTieuDeBaoCao] = useState('');
  const [noiDungBaoCao, setNoiDungBaoCao] = useState('');
  const userId = localStorage.getItem('user_id');

  const taiDuLieu = async () => {
    const res = await fetch('http://localhost:5000/api/accountant/debt');
    const data = await res.json();
    if (data.success) setCongNo(data.data);
  };

  useEffect(() => { taiDuLieu(); }, []);

  const thanhToan = async (shopId, shopName, amount) => {
    const xacNhan = window.confirm(`Xác nhận đã chuyển khoản ${Number(amount).toLocaleString()} đ cho [${shopName}]?`);
    if (!xacNhan) return;

    await fetch(`http://localhost:5000/api/accountant/pay/${shopId}`, { method: 'PUT' });
    alert('✅ Đã thanh toán và cấn trừ công nợ thành công!');
    taiDuLieu(); 
  };

  const guiBaoCao = async (e) => {
    e.preventDefault();
    if (!tieuDeBaoCao || !noiDungBaoCao) return alert("Vui lòng nhập đủ tiêu đề và nội dung!");

    await fetch('http://localhost:5000/api/reports/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        department: 'Kế Toán',
        title: tieuDeBaoCao,
        content: noiDungBaoCao,
        created_by: userId
      })
    });

    alert('Gửi báo cáo lên Ban Giám Đốc thành công!');
    setTieuDeBaoCao('');
    setNoiDungBaoCao('');
  };

  // Hàm xử lý Đăng xuất
  const dangXuat = () => {
    const xacNhan = window.confirm("Bạn có chắc chắn muốn đăng xuất khỏi hệ thống?");
    if (xacNhan) {
      localStorage.clear(); // Xóa toàn bộ thông tin phiên đăng nhập
      window.location.href = '/'; // Điều hướng về trang Đăng nhập (bạn có thể đổi '/' thành đường dẫn trang đăng nhập của bạn)
    }
  };

  const tongTienNo = congNo.reduce((sum, item) => sum + Number(item.total_cod), 0);
  const tongShopCho = congNo.length;

  return (
    <div className="flex min-h-screen bg-[#F4F7FE] font-sans text-gray-700">
      
      {/* SIDEBAR SIÊU MƯỢT (Chia layout justify-between để đẩy nút đăng xuất xuống đáy) */}
      <div className="w-72 bg-white border-r border-blue-50 shadow-[0_0_20px_rgba(0,0,0,0.02)] flex flex-col z-10 justify-between">
        
        {/* Phần Menu trên cùng */}
        <div>
          <div className="p-8 border-b border-gray-50 flex items-center gap-3">
            <div className="bg-gradient-to-tr from-blue-500 to-blue-300 p-2.5 rounded-xl shadow-blue-200 shadow-lg">
              <Wallet className="text-white" size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black text-gray-800 tracking-tight">Kế Toán COD</h2>
              <p className="text-xs font-bold text-blue-500 uppercase tracking-wider mt-0.5">Phòng Tài Chính</p>
            </div>
          </div>
          
          <div className="flex flex-col gap-3 p-5 mt-2">
            <button 
              onClick={() => setTabHienTai('nghiepvu')}
              className={`px-5 py-4 rounded-2xl font-bold text-left transition-all duration-300 flex items-center gap-4 group ${tabHienTai === 'nghiepvu' ? 'bg-gradient-to-r from-blue-500 to-blue-400 text-white shadow-lg shadow-blue-200' : 'bg-transparent text-gray-500 hover:bg-blue-50 hover:text-blue-600'}`}
            >
              <Receipt size={20} className={tabHienTai === 'nghiepvu' ? 'text-white' : 'text-gray-400 group-hover:text-blue-500'} />
              Nghiệp Vụ Thanh Toán
            </button>
            
            <button 
              onClick={() => setTabHienTai('baocao')}
              className={`px-5 py-4 rounded-2xl font-bold text-left transition-all duration-300 flex items-center gap-4 group ${tabHienTai === 'baocao' ? 'bg-gradient-to-r from-blue-500 to-blue-400 text-white shadow-lg shadow-blue-200' : 'bg-transparent text-gray-500 hover:bg-blue-50 hover:text-blue-600'}`}
            >
              <LayoutDashboard size={20} className={tabHienTai === 'baocao' ? 'text-white' : 'text-gray-400 group-hover:text-blue-500'} />
              Thống Kê & Báo Cáo
            </button>
          </div>
        </div>

        {/* Phần nút Đăng xuất dưới đáy */}
        <div className="p-5 border-t border-gray-50">
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
        
        {/* HEADER XỊN SÒ TRÊN CÙNG */}
        <div className="mb-8 flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-black text-gray-800 tracking-tight">
              {tabHienTai === 'nghiepvu' ? 'Quản lý Công Nợ Đối Tác' : 'Báo Cáo Hoạt Động Tài Chính'}
            </h1>
            <p className="text-gray-500 mt-2">
              {tabHienTai === 'nghiepvu' ? 'Thanh toán tiền thu hộ COD cho các cửa hàng.' : 'Tổng quan dòng tiền và đệ trình báo cáo nội bộ.'}
            </p>
          </div>
        </div>

        {/* TAB 1: NGHIỆP VỤ THANH TOÁN */}
        {tabHienTai === 'nghiepvu' && (
          <div className="bg-white rounded-[24px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-50 overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead className="bg-[#F8FAFC] border-b border-gray-100">
                <tr>
                  <th className="p-6 text-sm font-black text-gray-400 uppercase tracking-wider">ID Shop</th>
                  <th className="p-6 text-sm font-black text-gray-400 uppercase tracking-wider">Tên Cửa Hàng</th>
                  <th className="p-6 text-sm font-black text-gray-400 uppercase tracking-wider">Số Đơn</th>
                  <th className="p-6 text-sm font-black text-gray-400 uppercase tracking-wider">Tiền COD Cần Trả</th>
                  <th className="p-6 text-sm font-black text-gray-400 uppercase tracking-wider text-right">Thao Tác</th>
                </tr>
              </thead>
              <tbody>
                {congNo.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="p-16 text-center">
                      <div className="flex flex-col items-center justify-center text-gray-400">
                        <CheckCircle size={48} className="text-green-400 mb-4 opacity-50" />
                        <p className="text-lg font-medium">Tuyệt vời! Không có công nợ nào đang tồn đọng.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  congNo.map((item) => (
                    <tr key={item.shop_id} className="border-b border-gray-50 hover:bg-[#F8FAFC] transition-colors group">
                      <td className="p-6">
                        <span className="bg-gray-100 text-gray-600 px-3 py-1.5 rounded-lg font-bold text-sm">#{item.shop_id}</span>
                      </td>
                      <td className="p-6 font-bold text-gray-800">{item.shop_name}</td>
                      <td className="p-6">
                        <span className="bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg font-bold text-sm flex items-center w-fit gap-2">
                          <FileText size={14} /> {item.total_orders}
                        </span>
                      </td>
                      <td className="p-6 font-black text-red-500 text-xl tracking-tight">
                        {Number(item.total_cod).toLocaleString()} đ
                      </td>
                      <td className="p-6 text-right">
                        <button 
                          onClick={() => thanhToan(item.shop_id, item.shop_name, item.total_cod)}
                          className="bg-white border-2 border-blue-500 text-blue-500 hover:bg-blue-500 hover:text-white px-5 py-2.5 rounded-xl font-bold transition-all duration-300 shadow-sm flex items-center gap-2 ml-auto"
                        >
                          <CheckCircle size={18} /> Giải Ngân
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 2: THỐNG KÊ VÀ LẬP BÁO CÁO */}
        {tabHienTai === 'baocao' && (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
            
            {/* Cột Trái (Biểu đồ & Số liệu) */}
            <div className="xl:col-span-7 flex flex-col gap-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="bg-white p-7 rounded-[24px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] relative overflow-hidden group">
                  <div className="absolute -right-6 -bottom-6 opacity-[0.03] text-red-500 group-hover:scale-110 transition-transform duration-500">
                    <Wallet size={120} />
                  </div>
                  <p className="text-gray-400 font-bold mb-1 uppercase text-xs tracking-widest flex items-center gap-2">
                    <AlertCircle size={14} className="text-red-400"/> Tổng Nợ COD
                  </p>
                  <p className="text-4xl font-black text-gray-800 mt-2">{tongTienNo.toLocaleString()} <span className="text-xl text-gray-400 font-bold">đ</span></p>
                </div>
                
                <div className="bg-white p-7 rounded-[24px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] relative overflow-hidden group">
                  <div className="absolute -right-6 -bottom-6 opacity-[0.03] text-blue-500 group-hover:scale-110 transition-transform duration-500">
                    <Store size={120} />
                  </div>
                  <p className="text-gray-400 font-bold mb-1 uppercase text-xs tracking-widest flex items-center gap-2">
                    <CheckCircle size={14} className="text-blue-400"/> Cửa Hàng Chờ
                  </p>
                  <p className="text-4xl font-black text-gray-800 mt-2">{tongShopCho} <span className="text-xl text-gray-400 font-bold">Shop</span></p>
                </div>
              </div>

              <div className="bg-white p-8 rounded-[24px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex-1 min-h-[350px]">
                <h4 className="font-bold text-gray-800 mb-8 flex items-center gap-2">
                  <LayoutDashboard className="text-blue-500" size={20} /> Phân bổ công nợ theo đối tác
                </h4>
                {congNo.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={congNo} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="shop_name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12, fontWeight: 600}} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12, fontWeight: 600}} />
                      <Tooltip 
                        cursor={{fill: '#f8fafc'}} 
                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1)', fontWeight: 'bold' }}
                      />
                      <Bar dataKey="total_cod" name="Tiền COD (VNĐ)" fill="url(#colorBlue)" radius={[8, 8, 0, 0]} barSize={45}>
                        <defs>
                          <linearGradient id="colorBlue" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3B82F6" stopOpacity={1}/>
                            <stop offset="95%" stopColor="#60A5FA" stopOpacity={0.8}/>
                          </linearGradient>
                        </defs>
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-gray-400 font-medium bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                    Chưa có dữ liệu để vẽ biểu đồ
                  </div>
                )}
              </div>
            </div>

            {/* Cột Phải (Form Báo cáo) */}
            <div className="xl:col-span-5 bg-white p-8 rounded-[24px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] h-fit">
              <div className="flex items-center gap-3 mb-8">
                <div className="bg-blue-50 p-3 rounded-xl text-blue-500">
                  <Send size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-800">Trình Báo Cáo</h3>
                  <p className="text-xs font-bold text-gray-400 uppercase mt-1">Gửi Ban Giám Đốc</p>
                </div>
              </div>
              
              <form onSubmit={guiBaoCao} className="space-y-6">
                <div>
                  <label className="block font-bold text-gray-600 mb-2 text-sm">Tiêu đề báo cáo</label>
                  <input 
                    type="text" 
                    className="w-full bg-[#F8FAFC] border-2 border-transparent p-4 rounded-xl outline-none focus:border-blue-500 focus:bg-white transition-all font-medium text-gray-700" 
                    placeholder="VD: Đề xuất giải ngân lô hàng 3..."
                    value={tieuDeBaoCao}
                    onChange={(e) => setTieuDeBaoCao(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-600 mb-2 text-sm">Nội dung chi tiết</label>
                  <textarea 
                    rows="7" 
                    className="w-full bg-[#F8FAFC] border-2 border-transparent p-4 rounded-xl outline-none focus:border-blue-500 focus:bg-white transition-all font-medium text-gray-700 resize-none"
                    placeholder="Nhập nội dung số liệu tài chính..."
                    value={noiDungBaoCao}
                    onChange={(e) => setNoiDungBaoCao(e.target.value)}
                  ></textarea>
                </div>
                <button type="submit" className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-200 transition-all flex justify-center items-center gap-2 text-lg">
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