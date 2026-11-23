import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { MapContainer, CircleMarker, Popup } from 'react-leaflet';
import { GOVAP_MAP_CENTER, MapTileLayer } from '../../utils/govapMap.js';
import { API_URL, apiFetch as fetch } from '../../utils/apiFetch.js';
import { 
  BarChart3, TrendingUp, Package, Truck, Wallet, 
  FileText, CheckCircle, AlertCircle, LogOut, 
  Activity, Users, Clock, XCircle, Calendar, MapPin, Filter
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

export default function DashboardGiamDoc() {
  // State hiển thị sau khi lọc
  const [thongKeHienThi, setThongKeHienThi] = useState({
    total_orders: 0, total_revenue: 0, pending_orders: 0, delivering_orders: 0,
    completed_orders: 0, failed_orders: 0
  });
  const [doanhThuTheoThoiGian, setDoanhThuTheoThoiGian] = useState([]);
  const [matDoDonHang, setMatDoDonHang] = useState([]);
  const [tuNgay, setTuNgay] = useState('');
  const [denNgay, setDenNgay] = useState('');

  const [baoCao, setBaoCao] = useState([]);
  const [tabHienTai, setTabHienTai] = useState('dashboard');
  const [truongPhong, setTruongPhong] = useState([]);
  const [nhanSu, setNhanSu] = useState([]);
  
  // STATE BỘ LỌC THEO YÊU CẦU CỦA CÔ
  const [locThoiGian, setLocThoiGian] = useState('month');
  const [locKhuVuc, setLocKhuVuc] = useState('all');

  const directorName = localStorage.getItem('full_name') || 'Ban Giám Đốc';

  const taiDuLieuThongKe = async () => {
    if (locThoiGian === 'custom' && (!tuNgay || !denNgay)) return;
    try {
      const query = new URLSearchParams({ period: locThoiGian, district: locKhuVuc === 'all' ? '' : locKhuVuc });
      if (locThoiGian === 'custom') {
        query.set('start_date', tuNgay);
        query.set('end_date', denNgay);
      }
      const res = await fetch(`${API_URL}/api/admin/dashboard?${query}`);
      const data = await res.json();
      if (data.success && data.data) {
        const stats = {
          total_orders: data.data.total_orders || 0,
          total_revenue: data.data.total_revenue || 0,
          pending_orders: data.data.pending_orders || 0,
          delivering_orders: data.data.delivering_orders || 0,
          completed_orders: data.data.completed_orders || 0,
          failed_orders: data.data.failed_orders || 0
        };
        setThongKeHienThi(stats);
        setDoanhThuTheoThoiGian(data.data.revenue_timeline || []);
        setMatDoDonHang(data.data.heatmap || []);
      }
    } catch (error) {
      console.error("Lỗi tải thống kê:", error);
    }
  };

  const taiBaoCao = async () => {
    try {
      const res = await fetch(`${API_URL}/api/admin/reports`);
      const data = await res.json();
      if (data.success) setBaoCao(data.data || []);
    } catch (error) {
      console.error("Lỗi tải báo cáo:", error);
    }
  };

  const taiTruongPhong = async () => {
    try {
      const res = await fetch(`${API_URL}/api/admin/leaders`);
      const data = await res.json();
      if (data.success) {
        setNhanSu(data.data.staff || []);
        setTruongPhong((data.data.departments || []).map((department) => {
          const assignment = (data.data.leaders || []).find((leader) => leader.department === department);
          return { ten: department, userId: assignment?.user_id ? String(assignment.user_id) : '' };
        }));
      }
    } catch (error) {
      console.error('Lỗi tải danh sách trưởng phòng:', error);
    }
  };

  useEffect(() => {
    taiBaoCao();
    taiTruongPhong();
  }, []);

  useEffect(() => {
    taiDuLieuThongKe();
    const interval = setInterval(taiDuLieuThongKe, 30000);
    return () => clearInterval(interval);
  }, [locThoiGian, locKhuVuc, tuNgay, denNgay]);

  const capNhatLuaChonTruongPhong = (department, userId) => {
    setTruongPhong((current) => current.map((item) => item.ten === department ? { ...item, userId } : item));
  };

  const luuTruongPhong = async (department) => {
    const assignment = truongPhong.find((item) => item.ten === department);
    if (!assignment?.userId) return alert('Vui lòng chọn nhân viên làm trưởng phòng.');
    try {
      const res = await fetch(`${API_URL}/api/admin/leaders`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ department, user_id: assignment.userId })
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Không thể lưu phân công.');
      await taiTruongPhong();
    } catch (error) {
      alert(error.message || 'Lỗi kết nối máy chủ.');
    }
  };

  const goTruongPhong = async (department) => {
    try {
      const res = await fetch(`${API_URL}/api/admin/leaders`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ department })
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Không thể gỡ phân công.');
      await taiTruongPhong();
    } catch (error) {
      alert(error.message || 'Lỗi kết nối máy chủ.');
    }
  };

  const capNhatTrangThaiBaoCao = async (id, statusMoi) => {
    const hanhDong = statusMoi === 'approved' ? 'Phê duyệt' : 'Yêu cầu giải trình';
    if (!window.confirm(`Xác nhận ${hanhDong} báo cáo này?`)) return;

    try {
      const res = await fetch(`${API_URL}/api/admin/reports/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: statusMoi })
      });
      if ((await res.json()).success) {
        taiBaoCao(); 
      }
    } catch {
      alert("Lỗi kết nối máy chủ!");
    }
  };

  const dangXuat = () => {
    if (window.confirm("Bạn muốn đăng xuất khỏi cổng Giám Đốc?")) {
      localStorage.clear();
      window.location.href = '/'; 
    }
  };

  // ================= DỮ LIỆU BIỂU ĐỒ TRỰC QUAN ĐỘNG =================
  const dataTrangThai = [
    { name: 'Giao thành công', value: thongKeHienThi.completed_orders, color: '#10B981' },
    { name: 'Giao thất bại / hoàn hàng', value: thongKeHienThi.failed_orders, color: '#EF4444' }
  ];
  const totalOutcomeOrders = thongKeHienThi.completed_orders + thongKeHienThi.failed_orders;

  const maxHeatmapOrders = Math.max(...matDoDonHang.map((item) => Number(item.order_count) || 0), 1);
  const heatmapPoints = matDoDonHang.filter((item) => (
    item.lat !== null && item.lat !== undefined
    && item.lng !== null && item.lng !== undefined
    && Number.isFinite(Number(item.lat)) && Number.isFinite(Number(item.lng))
    && Math.abs(Number(item.lat)) <= 90 && Math.abs(Number(item.lng)) <= 180
  ));

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans text-slate-700 flex-col lg:flex-row">
      
      {/* SIDEBAR BAN GIÁM ĐỐC */}
      <div className="w-full lg:w-72 bg-slate-900 border-r border-slate-800 flex flex-col z-10 justify-between text-white shadow-2xl shrink-0">
        <div>
          <div className="p-5 lg:p-8 border-b border-slate-800 flex items-center justify-between lg:justify-start gap-3">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-tr from-amber-500 to-orange-400 p-2.5 rounded-2xl shadow-lg shadow-orange-500/20">
                <BarChart3 className="text-white" size={24} />
              </div>
              <div>
                <h2 className="text-xl font-black tracking-tight text-white leading-none">BOD Portal</h2>
                <p className="text-[10px] font-bold text-amber-400 uppercase tracking-widest mt-1">Ban Giám Đốc</p>
                <p className="mt-0.5 max-w-40 truncate text-xs font-bold text-slate-300" title={directorName}>{directorName}</p>
              </div>
            </div>

            <button
              onClick={dangXuat}
              className="lg:hidden p-2 rounded-xl text-red-400 hover:bg-red-500/10"
              title="Đăng xuất"
            >
              <LogOut size={18} />
            </button>
          </div>
          
          <div className="flex flex-row overflow-x-auto lg:flex-col gap-2 p-3 lg:p-5 mt-1">
            <button 
              onClick={() => setTabHienTai('dashboard')}
              className={`shrink-0 whitespace-nowrap px-4 py-3 lg:px-5 lg:py-3.5 rounded-2xl font-bold text-left transition-all flex items-center gap-3 ${tabHienTai === 'dashboard' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow-inner' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
            >
              <Activity size={18} className={tabHienTai === 'dashboard' ? 'text-amber-400' : ''} />
              <span>Tổng Quan (Dashboard)</span>
            </button>
            <button 
              onClick={() => setTabHienTai('reports')}
              className={`shrink-0 whitespace-nowrap relative px-4 py-3 lg:px-5 lg:py-3.5 rounded-2xl font-bold text-left transition-all flex items-center gap-3 ${tabHienTai === 'reports' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow-inner' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
            >
              <FileText size={18} className={tabHienTai === 'reports' ? 'text-amber-400' : ''} />
              <span>Phê Duyệt Báo Cáo</span>
              {baoCao.filter(b => b.status === 'pending').length > 0 && (
                <span className="ml-auto bg-rose-500 text-white text-[10px] px-2 py-0.5 rounded-full font-black">
                  {baoCao.filter(b => b.status === 'pending').length}
                </span>
              )}
            </button>
            <button onClick={() => setTabHienTai('leaders')} className={`shrink-0 whitespace-nowrap px-4 py-3 lg:px-5 lg:py-3.5 rounded-2xl font-bold text-left transition-all flex items-center gap-3 ${tabHienTai === 'leaders' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow-inner' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}>
              <Users size={18} /> <span>Quản Lý Trưởng Phòng</span>
            </button>
            <Link to="/quan-ly-kho" className="shrink-0 whitespace-nowrap px-4 py-3 lg:px-5 lg:py-3.5 rounded-2xl font-bold text-left transition-all flex items-center gap-3 text-slate-400 hover:bg-white/5 hover:text-white">
              <MapPin size={18} /> <span>Quản Lý Kho & Kho Con</span>
            </Link>
          </div>
        </div>

        <div className="hidden lg:block p-5 border-t border-slate-800 bg-slate-950/30">
          <button onClick={dangXuat} className="w-full px-5 py-3.5 rounded-xl font-bold text-left flex items-center gap-3 text-red-400 hover:bg-red-500/10 transition-colors">
            <LogOut size={18} /> Đăng Xuất
          </button>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 p-4 sm:p-6 lg:p-10 overflow-y-auto">
        
        {tabHienTai === 'dashboard' && (
          <div className="animate-in fade-in duration-300">
            <div className="mb-8 flex flex-col xl:flex-row xl:justify-between xl:items-end gap-6">
              <div>
                <h1 className="text-3xl font-black text-slate-800 tracking-tight">Trung Tâm Điều Hành</h1>
                <p className="text-slate-500 mt-2 font-medium">Báo cáo hiệu suất kinh doanh và luồng vận chuyển theo thời gian thực.</p>
              </div>

              {/* BỘ LỌC BÁO CÁO (YÊU CẦU CỦA CÔ) */}
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2 bg-white px-4 py-2.5 rounded-xl border border-slate-200 shadow-sm">
                  <Calendar size={18} className="text-amber-500"/>
                  <select 
                    value={locThoiGian} 
                    onChange={e => setLocThoiGian(e.target.value)}
                    className="bg-transparent border-none outline-none font-bold text-slate-700 text-sm cursor-pointer"
                  >
                    <option value="today">Hôm nay</option>
                    <option value="week">Tuần này</option>
                    <option value="month">Tháng này</option>
                    <option value="year">Năm nay</option>
                    <option value="custom">Khoảng ngày</option>
                  </select>
                </div>
                {locThoiGian === 'custom' && (
                  <div className="flex flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
                      <label className="text-xs font-bold text-slate-500">Từ
                        <input type="date" value={tuNgay} max={denNgay || undefined} onChange={(event) => setTuNgay(event.target.value)} className="ml-2 rounded border border-slate-200 p-1.5 text-sm font-medium text-slate-700" />
                      </label>
                      <label className="text-xs font-bold text-slate-500">Đến
                        <input type="date" value={denNgay} min={tuNgay || undefined} onChange={(event) => setDenNgay(event.target.value)} className="ml-2 rounded border border-slate-200 p-1.5 text-sm font-medium text-slate-700" />
                      </label>
                    </div>
                    {(!tuNgay || !denNgay) && <span className="text-xs font-medium text-amber-700">Chọn đủ ngày bắt đầu và kết thúc để tải báo cáo.</span>}
                  </div>
                )}
                
                <div className="flex items-center gap-2 bg-white px-4 py-2.5 rounded-xl border border-slate-200 shadow-sm">
                  <MapPin size={18} className="text-blue-500"/>
                  <select 
                    value={locKhuVuc} 
                    onChange={e => setLocKhuVuc(e.target.value)}
                    className="bg-transparent border-none outline-none font-bold text-slate-700 text-sm cursor-pointer"
                  >
                    <option value="all">Tất cả Quận/Huyện</option>
                    {[
                      'Quận 1', 'Quận 3', 'Quận 4', 'Quận 5', 'Quận 6', 'Quận 7', 'Quận 8', 'Quận 10',
                      'Quận 11', 'Quận 12', 'Quận Bình Tân', 'Quận Bình Thạnh', 'Quận Gò Vấp',
                      'Quận Phú Nhuận', 'Quận Tân Bình', 'Quận Tân Phú', 'Thành phố Thủ Đức',
                      'Huyện Bình Chánh', 'Huyện Cần Giờ', 'Huyện Củ Chi', 'Huyện Hóc Môn', 'Huyện Nhà Bè',
                      'Quận 2', 'Quận 9'
                    ].map((district) => <option key={district} value={district}>{district}</option>)}
                  </select>
                </div>

                <div className="bg-emerald-50 px-4 py-2.5 rounded-xl shadow-sm border border-emerald-100 flex items-center gap-2 text-sm font-bold text-emerald-600">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Live Sync
                </div>
              </div>
            </div>

            {/* 4 EXECUTIVE KPI CARDS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
              <div className="bg-white p-6 rounded-[24px] shadow-soft-sm border border-slate-200/80 hover:shadow-soft-md transition-all relative overflow-hidden group">
                <div className="flex items-center justify-between mb-4">
                  <div className="bg-gradient-to-tr from-amber-500 to-orange-400 p-3 rounded-2xl text-white shadow-md shadow-amber-500/20">
                    <TrendingUp size={22} />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100 flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span> +18.4% MoM
                  </span>
                </div>
                <p className="text-slate-500 font-bold text-xs uppercase tracking-wider mb-1">Tổng Doanh Thu Cước</p>
                <h3 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight">{Number(thongKeHienThi.total_revenue).toLocaleString()} đ</h3>
                <p className="text-[11px] text-slate-400 mt-2 font-medium">Bao gồm cước cơ sở & phụ phí vùng</p>
              </div>

              <div className="bg-white p-6 rounded-[24px] shadow-soft-sm border border-slate-200/80 hover:shadow-soft-md transition-all relative overflow-hidden group">
                <div className="flex items-center justify-between mb-4">
                  <div className="bg-gradient-to-tr from-blue-600 to-indigo-500 p-3 rounded-2xl text-white shadow-md shadow-blue-500/20">
                    <Package size={22} />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-100">
                    {thongKeHienThi.completed_orders} hoàn tất
                  </span>
                </div>
                <p className="text-slate-500 font-bold text-xs uppercase tracking-wider mb-1">Tổng Sản Lượng Vận Đơn</p>
                <h3 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight">{thongKeHienThi.total_orders} <span className="text-sm text-slate-400 font-semibold">kiện</span></h3>
                <p className="text-[11px] text-slate-400 mt-2 font-medium">Được tiếp nhận toàn mạng lưới</p>
              </div>

              <div className="bg-white p-6 rounded-[24px] shadow-soft-sm border border-slate-200/80 hover:shadow-soft-md transition-all relative overflow-hidden group">
                <div className="flex items-center justify-between mb-4">
                  <div className="bg-gradient-to-tr from-cyan-600 to-blue-500 p-3 rounded-2xl text-white shadow-md shadow-cyan-500/20">
                    <Truck size={22} />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-cyan-700 bg-cyan-50 px-2.5 py-1 rounded-full border border-cyan-100 flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-cyan-500 animate-ping"></span> Đang di chuyển
                  </span>
                </div>
                <p className="text-slate-500 font-bold text-xs uppercase tracking-wider mb-1">Đang Luân Chuyển / Giao</p>
                <h3 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight">{thongKeHienThi.delivering_orders} <span className="text-sm text-slate-400 font-semibold">đơn</span></h3>
                <p className="text-[11px] text-slate-400 mt-2 font-medium">Bưu tá & tài xế đang phụ trách</p>
              </div>

              <div className="bg-white p-6 rounded-[24px] shadow-soft-sm border border-slate-200/80 hover:shadow-soft-md transition-all relative overflow-hidden group">
                <div className="flex items-center justify-between mb-4">
                  <div className="bg-gradient-to-tr from-rose-500 to-red-500 p-3 rounded-2xl text-white shadow-md shadow-rose-500/20">
                    <Clock size={22} />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-rose-700 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-100">
                    Cần lưu ý
                  </span>
                </div>
                <p className="text-slate-500 font-bold text-xs uppercase tracking-wider mb-1">Tồn Kho / Chờ Lấy Hàng</p>
                <h3 className="text-2xl sm:text-3xl font-black text-rose-600 tracking-tight">{thongKeHienThi.pending_orders} <span className="text-sm text-rose-300 font-semibold">đơn</span></h3>
                <p className="text-[11px] text-slate-400 mt-2 font-medium">Chờ phân tuyến hoặc nhập kho</p>
              </div>
            </div>

            {/* VÙNG BIỂU ĐỒ TRỰC QUAN (RECHARTS) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Line Chart: Biểu đồ doanh thu */}
              <div className="lg:col-span-2 bg-white p-8 rounded-[32px] shadow-sm border border-slate-100">
                <div className="flex justify-between items-center mb-8">
                  <div>
                    <h3 className="text-xl font-black text-slate-800 flex items-center gap-2"><Filter className="text-amber-500" size={20}/> Xu Hướng Doanh Thu</h3>
                    <p className="text-sm text-slate-500 font-medium mt-1">Theo khu vực và thời gian đã chọn</p>
                  </div>
                </div>
                <div className="h-[320px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={doanhThuTheoThoiGian} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#F59E0B" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                      <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{fill: '#64748B', fontWeight: 600}} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748B', fontWeight: 600}} dx={-10} tickFormatter={(value) => `${value / 1000}k`} />
                      <RechartsTooltip 
                        formatter={(value) => [`${Math.round(value).toLocaleString()} VNĐ`, 'Doanh thu']}
                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', fontWeight: 'bold' }}
                      />
                      <Area type="monotone" dataKey="revenue" stroke="#F59E0B" strokeWidth={4} fillOpacity={1} fill="url(#colorRevenue)" animationDuration={1000} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Donut Chart: Trạng thái đơn hàng */}
              <div className="lg:col-span-1 bg-white p-8 rounded-[32px] shadow-sm border border-slate-100 flex flex-col">
                <div className="mb-2">
                  <h3 className="text-xl font-black text-slate-800">Cơ Cấu Trạng Thái</h3>
                  <p className="text-sm text-slate-500 font-medium mt-1">Tỷ lệ hoàn thành đơn</p>
                </div>
                <div className="flex-1 flex flex-col justify-center items-center relative mt-4">
                  {totalOutcomeOrders === 0 ? (
                    <p className="text-slate-400 font-medium my-auto">Chưa có dữ liệu.</p>
                  ) : (
                    <>
                      <div className="h-[220px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={dataTrangThai}
                              cx="50%" cy="50%"
                              innerRadius={70} outerRadius={100}
                              paddingAngle={5} dataKey="value"
                              animationDuration={800}
                            >
                              {dataTrangThai.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <RechartsTooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', fontWeight: 'bold' }}/>
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mt-2">
                        <span className="text-4xl font-black text-slate-800">{totalOutcomeOrders}</span>
                        <span className="text-xs font-bold text-slate-400">ĐÃ CÓ KẾT QUẢ</span>
                      </div>
                      
                      <div className="w-full grid grid-cols-1 gap-3 mt-4">
                        {dataTrangThai.map((item, idx) => (
                          <div key={idx} className="flex justify-between items-center bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                            <div className="flex items-center gap-2">
                              <div className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: item.color }}></div>
                              <span className="text-sm font-bold text-slate-700">{item.name}</span>
                            </div>
                            <span className="font-black" style={{ color: item.color }}>{item.value}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>

            </div>
            <div className="mt-6 rounded-[32px] border border-slate-100 bg-white p-6 shadow-sm">
              <div className="mb-4">
                <h3 className="text-xl font-black text-slate-800">Heatmap mật độ đơn hàng</h3>
                <p className="mt-1 text-sm font-medium text-slate-500">Vị trí được tổng hợp từ tọa độ giao hàng thực tế; vòng tròn lớn và đậm biểu thị nhiều đơn hơn.</p>
              </div>
              {heatmapPoints.length > 0 ? (
                <MapContainer center={GOVAP_MAP_CENTER} zoom={13} scrollWheelZoom={false} className="h-[420px] w-full rounded-2xl">
                  <MapTileLayer />
                  {heatmapPoints.map((item) => {
                    const intensity = Math.min(Number(item.order_count) / maxHeatmapOrders, 1);
                    return (
                      <CircleMarker
                        key={`${item.district}-${item.lat}-${item.lng}`}
                        center={[Number(item.lat), Number(item.lng)]}
                        radius={8 + intensity * 22}
                        pathOptions={{ color: '#b91c1c', fillColor: '#ef4444', fillOpacity: 0.2 + intensity * 0.55, weight: 2 }}
                      >
                        <Popup>{item.district || 'Chưa phân khu'}: {Number(item.order_count).toLocaleString()} đơn</Popup>
                      </CircleMarker>
                    );
                  })}
                </MapContainer>
              ) : (
                <div className="flex h-48 items-center justify-center rounded-2xl bg-slate-50 text-sm font-medium text-slate-500">
                  Chưa có đơn hàng có tọa độ giao hàng trong bộ lọc này.
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB BÁO CÁO GIỮ NGUYÊN (Chỉ tinh chỉnh UI cho mượt hơn) */}
        {tabHienTai === 'leaders' && (
          <div className="animate-in fade-in duration-300 max-w-5xl">
            <div className="mb-8">
              <h1 className="text-3xl font-black text-slate-800 tracking-tight">Quản Lý Trưởng Phòng</h1>
              <p className="text-slate-500 mt-2 font-medium">Theo dõi đội ngũ điều hành và trạng thái hoạt động của từng phòng ban.</p>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-soft-sm">
              <div className="grid gap-5 md:grid-cols-2">
                {truongPhong.map((phong) => (
                  <div key={phong.ten} className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-5 hover:border-slate-300 transition-all">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Phòng ban phụ trách</p>
                        <h3 className="mt-1 text-lg font-black text-slate-800">{phong.ten}</h3>
                      </div>
                      <span className={`rounded-lg px-2.5 py-1 text-xs font-bold border ${phong.userId ? 'bg-emerald-50 text-emerald-700 border-emerald-200/60' : 'bg-amber-50 text-amber-700 border-amber-200/60'}`}>
                        {phong.userId ? 'Đã phân công' : 'Chưa có trưởng phòng'}
                      </span>
                    </div>
                    <label className="mt-4 block text-xs font-bold text-slate-600">Chọn trưởng phòng
                      <select value={phong.userId} onChange={(event) => capNhatLuaChonTruongPhong(phong.ten, event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-sm font-medium text-slate-800 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 transition-all">
                        <option value="">Chưa phân công</option>
                        {nhanSu.map((person) => <option key={person.id} value={person.id}>{person.full_name} · {person.email}</option>)}
                      </select>
                    </label>
                    <div className="mt-4 flex gap-2">
                      <button onClick={() => luuTruongPhong(phong.ten)} disabled={!phong.userId} className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-40 transition-all cursor-pointer">Lưu phân công</button>
                      {phong.userId && <button onClick={() => goTruongPhong(phong.ten)} className="rounded-xl border border-rose-200 bg-white px-4 py-2 text-xs font-bold text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer">Gỡ phân công</button>}
                    </div>
                  </div>
                ))}
                {truongPhong.length === 0 && <p className="col-span-full p-8 text-center text-slate-500">Không tải được danh sách phòng ban. Vui lòng kiểm tra kết nối máy chủ.</p>}
              </div>
            </div>
          </div>
        )}

        {tabHienTai === 'reports' && (
          <div className="animate-in fade-in duration-300 max-w-5xl">
            <div className="mb-8">
              <h1 className="text-3xl font-black text-slate-800 tracking-tight">Hộp Thư Phê Duyệt</h1>
              <p className="text-slate-500 mt-2 font-medium">Đọc và duyệt các đề xuất, báo cáo định kỳ từ các Trưởng bộ phận.</p>
            </div>

            <div className="bg-white rounded-2xl shadow-soft-sm border border-slate-200/80 overflow-hidden p-3">
              <div className="space-y-4">
                {baoCao.length === 0 ? (
                  <div className="p-16 text-center text-slate-400 font-medium">
                    Hiện chưa có báo cáo nào từ các phòng ban.
                  </div>
                ) : (
                  baoCao.map((bc) => (
                    <div key={bc.id} className="p-6 md:p-7 bg-slate-50/60 hover:bg-slate-50 transition-colors rounded-2xl border border-slate-200/80 flex flex-col lg:flex-row gap-6 items-start relative overflow-hidden">
                      {bc.status === 'approved' && <div className="absolute top-0 right-0 border-t-[40px] border-r-[40px] border-t-transparent border-r-emerald-500"></div>}
                      {bc.status === 'rejected' && <div className="absolute top-0 right-0 border-t-[40px] border-r-[40px] border-t-transparent border-r-rose-500"></div>}
                      
                      <div className={`p-3.5 rounded-2xl shrink-0 ${bc.status === 'pending' ? 'bg-amber-100/70 text-amber-700 border border-amber-200/60' : 'bg-white text-slate-400 border border-slate-200'}`}>
                        <FileText size={24} />
                      </div>
                      
                      <div className="flex-1 w-full">
                        <div className="flex flex-wrap justify-between items-start gap-4 mb-3">
                          <h4 className="font-black text-slate-800 text-lg">{bc.title}</h4>
                          <span className="text-xs font-bold text-slate-500 bg-white border border-slate-200 px-3 py-1.5 rounded-lg shadow-2xs whitespace-nowrap">
                            {new Date(bc.created_at).toLocaleString('vi-VN')}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mb-3 flex flex-wrap gap-2 items-center">
                          Phòng ban: <span className="font-bold text-indigo-700 bg-indigo-50 border border-indigo-200/60 px-2 py-0.5 rounded-md">{bc.department}</span> 
                          <span className="hidden sm:inline">•</span> Người gửi: <span className="font-bold text-slate-700">{bc.sender_name}</span>
                        </p>
                        <div className="text-sm text-slate-700 bg-white border border-slate-200 p-4 rounded-xl shadow-2xs whitespace-pre-wrap leading-relaxed">
                          {bc.content}
                        </div>
                        {bc.attachment_url && (
                          <a href={`${API_URL}${bc.attachment_url}`} target="_blank" rel="noreferrer" className="mt-3.5 inline-flex items-center gap-2 border border-blue-200 bg-blue-50/80 hover:bg-blue-100/80 px-4 py-2 text-xs font-bold text-blue-700 rounded-xl transition-colors">
                            <FileText size={15} /> Tải tệp đính kèm
                          </a>
                        )}
                        
                        {bc.status === 'pending' ? (
                          <div className="flex flex-col sm:flex-row gap-3 mt-5 pt-5 border-t border-slate-200/80 border-dashed">
                            <button onClick={() => capNhatTrangThaiBaoCao(bc.id, 'approved')} className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold px-5 py-3 rounded-xl shadow-md shadow-emerald-500/20 text-sm transition-all flex items-center justify-center gap-2 cursor-pointer">
                              <CheckCircle size={16}/> Phê Duyệt Báo Cáo
                            </button>
                            <button onClick={() => capNhatTrangThaiBaoCao(bc.id, 'rejected')} className="sm:w-auto bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200/80 font-bold px-5 py-3 rounded-xl text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer">
                              <XCircle size={16}/> Yêu cầu làm lại
                            </button>
                          </div>
                        ) : (
                          <div className={`mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold border ${bc.status === 'approved' ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'bg-red-50 border-red-200 text-red-600'}`}>
                            {bc.status === 'approved' ? <><CheckCircle size={18}/> Đã Phê Duyệt</> : <><XCircle size={18}/> Đã Yêu Cầu Giải Trình Thêm</>}
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}