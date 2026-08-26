import { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { ShieldCheck, TrendingUp, Package, Truck, Inbox, Mail, LogOut, Clock, CalendarDays } from 'lucide-react';

export default function BanGiamDoc() {
  const [thongKe, setThongKe] = useState({
    total_orders: 0,
    total_revenue: 0,
    pending_orders: 0,
    delivering_orders: 0
  });
  const [danhSachBaoCao, setDanhSachBaoCao] = useState([]);
  const [tabHienTai, setTabHienTai] = useState('tongquan');

  const taiDuLieu = async () => {
    try {
      // Tải Thống kê tổng
      const resDash = await fetch('http://localhost:5000/api/admin/dashboard');
      const dataDash = await resDash.json();
      if (dataDash.success) setThongKe(dataDash.data);

      // Tải danh sách Báo cáo từ các phòng ban
      const resRep = await fetch('http://localhost:5000/api/admin/reports');
      const dataRep = await resRep.json();
      if (dataRep.success) setDanhSachBaoCao(dataRep.data);
    } catch (error) {
      console.error("Lỗi tải dữ liệu:", error);
    }
  };

  useEffect(() => { taiDuLieu(); }, []);

  const dangXuat = () => {
    const xacNhan = window.confirm("Bạn có chắc chắn muốn đăng xuất khỏi hệ thống?");
    if (xacNhan) {
      localStorage.clear();
      window.location.href = '/'; 
    }
  };

  // Tính toán dữ liệu cho Biểu đồ Tròn (Pie Chart)
  const soDonHoanThanh = thongKe.total_orders - thongKe.pending_orders - thongKe.delivering_orders;
  const dataBieuDo = [
    { name: 'Chờ xử lý', value: Number(thongKe.pending_orders) || 0, color: '#F87171' },
    { name: 'Đang luân chuyển', value: Number(thongKe.delivering_orders) || 0, color: '#60A5FA' },
    { name: 'Giao thành công', value: soDonHoanThanh > 0 ? soDonHoanThanh : 0, color: '#34D399' }
  ];

  return (
    <div className="flex min-h-screen bg-[#F4F7FE] font-sans text-gray-700">
      
      {/* SIDEBAR SIÊU MƯỢT */}
      <div className="w-72 bg-white border-r border-blue-50 shadow-[0_0_20px_rgba(0,0,0,0.02)] flex flex-col z-10 justify-between">
        <div>
          <div className="p-8 border-b border-gray-50 flex items-center gap-3">
            <div className="bg-gradient-to-tr from-gray-800 to-gray-600 p-2.5 rounded-xl shadow-gray-300 shadow-lg">
              <ShieldCheck className="text-white" size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black text-gray-800 tracking-tight">Ban Giám Đốc</h2>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mt-0.5">Quyền Quản Trị Hệ Thống</p>
            </div>
          </div>
          
          <div className="flex flex-col gap-3 p-5 mt-2">
            <button 
              onClick={() => setTabHienTai('tongquan')}
              className={`px-5 py-4 rounded-2xl font-bold text-left transition-all duration-300 flex items-center gap-4 group ${tabHienTai === 'tongquan' ? 'bg-gradient-to-r from-gray-800 to-gray-700 text-white shadow-lg shadow-gray-200' : 'bg-transparent text-gray-500 hover:bg-gray-100 hover:text-gray-800'}`}
            >
              <TrendingUp size={20} className={tabHienTai === 'tongquan' ? 'text-white' : 'text-gray-400 group-hover:text-gray-800'} />
              Tổng Quan Dòng Chảy
            </button>
            
            <button 
              onClick={() => setTabHienTai('homthu')}
              className={`px-5 py-4 rounded-2xl font-bold text-left transition-all duration-300 flex items-center gap-4 group justify-between ${tabHienTai === 'homthu' ? 'bg-gradient-to-r from-gray-800 to-gray-700 text-white shadow-lg shadow-gray-200' : 'bg-transparent text-gray-500 hover:bg-gray-100 hover:text-gray-800'}`}
            >
              <div className="flex items-center gap-4">
                <Inbox size={20} className={tabHienTai === 'homthu' ? 'text-white' : 'text-gray-400 group-hover:text-gray-800'} />
                Hòm Thư Báo Cáo
              </div>
              {danhSachBaoCao.length > 0 && (
                <span className={`px-2 py-0.5 rounded-full text-xs ${tabHienTai === 'homthu' ? 'bg-white text-gray-800' : 'bg-red-100 text-red-600'}`}>
                  {danhSachBaoCao.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Nút Đăng xuất */}
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
        
        {/* HEADER */}
        <div className="mb-8 flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-black text-gray-800 tracking-tight">
              {tabHienTai === 'tongquan' ? 'Dashboard Tổng Quan Hệ Thống' : 'Hòm Thư Báo Cáo Nội Bộ'}
            </h1>
            <p className="text-gray-500 mt-2">
              {tabHienTai === 'tongquan' ? 'Giám sát sản lượng đơn hàng và dòng tiền theo thời gian thực.' : 'Đọc và phản hồi các đề xuất từ Trưởng phòng ban.'}
            </p>
          </div>
          {tabHienTai === 'tongquan' && (
            <button onClick={taiDuLieu} className="bg-white border-2 border-gray-200 text-gray-600 hover:border-gray-800 hover:text-gray-800 px-5 py-2.5 rounded-xl font-bold transition-all shadow-sm flex items-center gap-2">
              <Clock size={18} /> Cập nhật dữ liệu
            </button>
          )}
        </div>

        {/* TAB 1: DASHBOARD TỔNG QUAN */}
        {tabHienTai === 'tongquan' && (
          <div className="space-y-8">
            {/* 4 Thẻ KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white p-6 rounded-[24px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] relative overflow-hidden group border-b-4 border-green-500">
                <p className="text-gray-400 font-bold mb-2 uppercase text-xs tracking-widest">Doanh thu lưu chuyển</p>
                <p className="text-3xl font-black text-green-600">{Number(thongKe.total_revenue || 0).toLocaleString()} <span className="text-lg text-gray-400">đ</span></p>
              </div>
              
              <div className="bg-white p-6 rounded-[24px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] relative overflow-hidden group border-b-4 border-blue-500">
                <p className="text-gray-400 font-bold mb-2 uppercase text-xs tracking-widest">Tổng sản lượng</p>
                <p className="text-3xl font-black text-blue-600">{thongKe.total_orders} <span className="text-lg text-gray-400">Đơn</span></p>
              </div>

              <div className="bg-white p-6 rounded-[24px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] relative overflow-hidden group border-b-4 border-purple-500">
                <p className="text-gray-400 font-bold mb-2 uppercase text-xs tracking-widest">Đang trên đường giao</p>
                <p className="text-3xl font-black text-purple-600">{thongKe.delivering_orders} <span className="text-lg text-gray-400">Đơn</span></p>
              </div>

              <div className="bg-white p-6 rounded-[24px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] relative overflow-hidden group border-b-4 border-red-500">
                <p className="text-gray-400 font-bold mb-2 uppercase text-xs tracking-widest">Tồn đọng / Chờ xử lý</p>
                <p className="text-3xl font-black text-red-600">{thongKe.pending_orders} <span className="text-lg text-gray-400">Đơn</span></p>
              </div>
            </div>

            {/* Layout Biểu đồ */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              
              {/* Biểu đồ tròn */}
              <div className="lg:col-span-1 bg-white p-8 rounded-[24px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-50 flex flex-col items-center">
                <h4 className="font-bold text-gray-800 mb-4 w-full text-left">Tỉ lệ hoàn thành đơn</h4>
                <div className="w-full h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={dataBieuDo}
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {dataBieuDo.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', fontWeight: 'bold' }} 
                      />
                      <Legend verticalAlign="bottom" height={36} iconType="circle" />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Thông tin hệ thống */}
              <div className="lg:col-span-2 bg-gradient-to-br from-gray-900 to-gray-800 p-8 rounded-[24px] shadow-xl text-white relative overflow-hidden">
                <div className="absolute right-0 top-0 opacity-10 transform translate-x-1/4 -translate-y-1/4">
                  <TrendingUp size={250} />
                </div>
                <h3 className="text-2xl font-black mb-4 flex items-center gap-3 relative z-10">
                  <ShieldCheck className="text-green-400" size={32} />
                  Hệ thống hoạt động ổn định
                </h3>
                <p className="text-gray-300 leading-relaxed mb-6 relative z-10 max-w-lg">
                  Toàn bộ 7 phân hệ của Smart Logistics v2 đang được đồng bộ dữ liệu thời gian thực. Các luồng thông tin từ Cửa hàng, Kho bãi, đến Kế toán đang xử lý khối lượng công việc tự động không xảy ra tắc nghẽn.
                </p>
                <div className="grid grid-cols-2 gap-4 max-w-sm relative z-10">
                  <div className="bg-white/10 p-4 rounded-xl backdrop-blur-sm border border-white/10">
                    <p className="text-gray-400 text-xs font-bold uppercase mb-1">Phiên bản</p>
                    <p className="font-black">Enterprise v2.0</p>
                  </div>
                  <div className="bg-white/10 p-4 rounded-xl backdrop-blur-sm border border-white/10">
                    <p className="text-gray-400 text-xs font-bold uppercase mb-1">Bảo mật</p>
                    <p className="font-black text-green-400">RBAC Active</p>
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* TAB 2: HÒM THƯ BÁO CÁO */}
        {tabHienTai === 'homthu' && (
          <div className="bg-white rounded-[24px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-50 overflow-hidden min-h-[500px]">
            {danhSachBaoCao.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[500px] text-gray-400">
                <Inbox size={64} className="mb-4 opacity-30" />
                <p className="text-xl font-bold">Hòm thư trống</p>
                <p className="text-sm">Chưa có báo cáo nào được gửi lên từ các phòng ban.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {danhSachBaoCao.map((bc) => (
                  <div key={bc.id} className="p-8 hover:bg-[#F8FAFC] transition-colors group">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-4">
                        <div className="bg-blue-50 text-blue-600 p-3 rounded-full">
                          <Mail size={24} />
                        </div>
                        <div>
                          <h4 className="text-lg font-black text-gray-800">{bc.title}</h4>
                          <p className="text-sm font-bold text-gray-500 mt-1">
                            Người gửi: <span className="text-blue-600">{bc.sender_name}</span> 
                            <span className="mx-2">•</span> 
                            Phòng ban: <span className="uppercase text-xs tracking-wider bg-gray-100 px-2 py-1 rounded">{bc.department}</span>
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-sm font-bold text-gray-400 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">
                        <CalendarDays size={16} />
                        {new Date(bc.created_at).toLocaleDateString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                    <div className="pl-16">
                      <div className="bg-white p-5 rounded-xl border border-gray-100 text-gray-600 leading-relaxed shadow-sm">
                        {bc.content}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}