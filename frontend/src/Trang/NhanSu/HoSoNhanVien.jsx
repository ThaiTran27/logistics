import { useState, useEffect } from 'react';
import { Users, UserCheck, UserMinus, UserX, CalendarDays, CheckCircle, XCircle, LogOut, Search, ShieldAlert, Briefcase, CalendarCheck, X } from 'lucide-react';

export default function HoSoNhanVien() {
  const [nhanVienList, setNhanVienList] = useState([]);
  const [nghiPhepList, setNghiPhepList] = useState([]);
  const [tabHienTai, setTabHienTai] = useState('nhan-vien'); // 'nhan-vien' hoặc 'nghi-phep'
  const [tuKhoa, setTuKhoa] = useState('');
  
  // State quản lý Modal quy định thời gian nghỉ phép
  const [modalDuyet, setModalDuyet] = useState({ mo: false, don: null });
  const [ngayBatDau, setNgayBatDau] = useState('');
  const [ngayKetThuc, setNgayKetThuc] = useState('');
  
  const hrName = localStorage.getItem('full_name') || 'Phòng Nhân Sự';

  const taiDuLieuNhanVien = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/hr/staff');
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setNhanVienList(data.data);
      }
    } catch (error) {
      console.error("Lỗi tải danh sách nhân viên:", error);
    }
  };

  const taiDuLieuNghiPhep = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/hr/leave-requests');
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setNghiPhepList(data.data);
      }
    } catch (error) {
      console.error("Lỗi tải đơn nghỉ phép:", error);
    }
  };

  useEffect(() => {
    taiDuLieuNhanVien();
    taiDuLieuNghiPhep();
  }, []);

  const capNhatTrangThaiTaiKhoan = async (id, ten, trangThaiMoi) => {
    const hanhDong = trangThaiMoi === 'active' ? 'MỞ KHÓA' : 'ĐÌNH CHỈ';
    if (!window.confirm(`Xác nhận ${hanhDong} tài khoản của nhân viên [${ten}]?`)) return;

    try {
      const res = await fetch(`http://localhost:5000/api/hr/staff/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: trangThaiMoi })
      });
      const data = await res.json();
      if (data.success) {
        taiDuLieuNhanVien();
      }
    } catch (error) {
      alert("Lỗi kết nối máy chủ!");
    }
  };

  // Nút Từ Chối đơn (Xử lý trực tiếp)
  const tuChoiDonNghi = async (id) => {
    if (!window.confirm(`Xác nhận TỪ CHỐI đơn xin nghỉ phép này?`)) return;
    try {
      const res = await fetch(`http://localhost:5000/api/hr/leave/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'rejected' })
      });
      if ((await res.json()).success) taiDuLieuNghiPhep();
    } catch (error) {
      alert("Lỗi kết nối máy chủ!");
    }
  };

  // Nút Xác nhận trong Modal Duyệt (Kèm quy định thời gian)
  const xacNhanDuyetCoThoiGian = async (e) => {
    e.preventDefault();
    if (!ngayBatDau || !ngayKetThuc) {
      return alert("Vui lòng chọn đầy đủ thời gian bắt đầu và kết thúc!");
    }
    
    if (new Date(ngayBatDau) > new Date(ngayKetThuc)) {
      return alert("Ngày kết thúc không hợp lý!");
    }

    try {
      const res = await fetch(`http://localhost:5000/api/hr/leave/${modalDuyet.don.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'approved' })
      });
      if ((await res.json()).success) {
        alert(`✅ Đã phê duyệt nghỉ phép từ ${ngayBatDau} đến ${ngayKetThuc} thành công!`);
        setModalDuyet({ mo: false, don: null });
        setNgayBatDau('');
        setNgayKetThuc('');
        taiDuLieuNghiPhep();
      }
    } catch (error) {
      alert("Lỗi kết nối máy chủ!");
    }
  };

  const dangXuat = () => {
    if (window.confirm("Bạn muốn đăng xuất khỏi cổng Nhân Sự?")) {
      localStorage.clear();
      window.location.href = '/'; 
    }
  };

  const dichTenChucVu = (role) => {
    const roles = {
      'shop': 'Cửa Hàng',
      'driver': 'Tài Xế',
      'warehouse_manager': 'Thủ Kho',
      'fleet_manager': 'Điều Phối Viên',
      'accountant': 'Kế Toán',
      'hr_manager': 'Nhân Sự',
      'director': 'Giám Đốc'
    };
    return roles[role?.toLowerCase()] || role;
  };

  // Áo giáp chống sập
  const anToanNhanVien = Array.isArray(nhanVienList) ? nhanVienList : [];
  const anToanNghiPhep = Array.isArray(nghiPhepList) ? nghiPhepList : [];

  const nhanVienDaLoc = anToanNhanVien.filter(nv => {
    const ten = nv?.full_name || '';
    const email = nv?.email || '';
    const kw = tuKhoa || '';
    return ten.toLowerCase().includes(kw.toLowerCase()) || 
           email.toLowerCase().includes(kw.toLowerCase());
  });

  return (
    <div className="flex min-h-screen bg-[#FFFBFB] font-sans text-slate-700">
      
      {/* SIDEBAR */}
      <div className="w-72 bg-white border-r border-rose-100 shadow-sm flex flex-col z-10 justify-between">
        <div>
          <div className="p-8 border-b border-rose-50 flex items-center gap-3">
            <div className="bg-gradient-to-tr from-rose-500 to-pink-400 p-2.5 rounded-xl shadow-lg shadow-rose-200">
              <Briefcase className="text-white" size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-800 tracking-tight">Hành Chính</h2>
              <p className="text-xs font-bold text-rose-500 uppercase tracking-wider mt-0.5">Quản Trị Nhân Sự</p>
            </div>
          </div>
          
          <div className="p-5 mt-2 space-y-3">
            <button 
              onClick={() => setTabHienTai('nhan-vien')}
              className={`w-full px-5 py-4 rounded-2xl font-bold flex items-center gap-4 transition-all ${tabHienTai === 'nhan-vien' ? 'bg-rose-50 text-rose-600 border border-rose-200 shadow-sm' : 'text-slate-500 hover:bg-rose-50/50'}`}
            >
              <Users size={20} /> Hồ Sơ Nhân Viên
            </button>
            <button 
              onClick={() => setTabHienTai('nghi-phep')}
              className={`w-full px-5 py-4 rounded-2xl font-bold flex items-center gap-4 transition-all ${tabHienTai === 'nghi-phep' ? 'bg-rose-50 text-rose-600 border border-rose-200 shadow-sm relative' : 'text-slate-500 hover:bg-rose-50/50 relative'}`}
            >
              <CalendarDays size={20} /> Duyệt Nghỉ Phép
              {anToanNghiPhep.filter(p => p.status === 'pending').length > 0 && (
                <span className="absolute right-4 top-1/2 -translate-y-1/2 bg-rose-500 text-white text-[10px] px-2 py-0.5 rounded-full">
                  {anToanNghiPhep.filter(p => p.status === 'pending').length}
                </span>
              )}
            </button>
          </div>
        </div>

        <div className="p-5 border-t border-rose-50">
          <div className="flex items-center gap-3 px-5 py-4 mb-2 bg-rose-50/50 rounded-xl border border-rose-100">
            <div className="w-10 h-10 rounded-full bg-rose-200 flex items-center justify-center font-black text-rose-700">
              {(hrName || 'H').charAt(0)}
            </div>
            <div>
              <p className="text-sm font-bold text-slate-700 truncate w-36">{hrName}</p>
            </div>
          </div>
          <button onClick={dangXuat} className="w-full px-5 py-4 rounded-2xl font-bold text-left text-red-500 hover:bg-red-50 transition-colors flex items-center gap-3">
            <LogOut size={20}/> Đăng Xuất
          </button>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 p-10 overflow-y-auto">
        <div className="mb-8 flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-black text-slate-800 tracking-tight">
              {tabHienTai === 'nhan-vien' ? 'Hồ Sơ Nhân Sự' : 'Đơn Từ Xin Nghỉ Phép'}
            </h1>
            <p className="text-slate-500 mt-2 font-medium">
              {tabHienTai === 'nhan-vien' ? 'Quản lý tài khoản truy cập hệ thống của toàn bộ cán bộ nhân viên.' : 'Xem xét và phê duyệt các yêu cầu nghỉ phép, vắng mặt của nhân sự.'}
            </p>
          </div>
          
          {tabHienTai === 'nhan-vien' && (
            <div className="relative w-80">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="Tìm tên nhân viên, email..." 
                className="w-full pl-11 pr-4 py-3 bg-white border border-rose-100 rounded-xl outline-none focus:border-rose-400 focus:ring-4 focus:ring-rose-50 transition-all font-medium"
                value={tuKhoa}
                onChange={(e) => setTuKhoa(e.target.value)}
              />
            </div>
          )}
        </div>

        {/* THỐNG KÊ NHANH */}
        {tabHienTai === 'nhan-vien' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white p-6 rounded-[24px] shadow-sm border border-rose-100 flex items-center gap-5">
              <div className="bg-blue-50 p-4 rounded-2xl text-blue-600"><Users size={28}/></div>
              <div>
                <p className="text-slate-400 font-bold text-xs uppercase tracking-wider mb-1">Tổng Nhân Sự</p>
                <p className="text-3xl font-black text-slate-800">{anToanNhanVien.length}</p>
              </div>
            </div>
            <div className="bg-white p-6 rounded-[24px] shadow-sm border border-rose-100 flex items-center gap-5">
              <div className="bg-emerald-50 p-4 rounded-2xl text-emerald-600"><UserCheck size={28}/></div>
              <div>
                <p className="text-slate-400 font-bold text-xs uppercase tracking-wider mb-1">Đang Hoạt Động</p>
                <p className="text-3xl font-black text-slate-800">{anToanNhanVien.filter(nv => nv.status === 'active').length}</p>
              </div>
            </div>
            <div className="bg-white p-6 rounded-[24px] shadow-sm border border-rose-100 flex items-center gap-5">
              <div className="bg-rose-50 p-4 rounded-2xl text-rose-600"><UserMinus size={28}/></div>
              <div>
                <p className="text-slate-400 font-bold text-xs uppercase tracking-wider mb-1">Bị Đình Chỉ</p>
                <p className="text-3xl font-black text-rose-600">{anToanNhanVien.filter(nv => nv.status === 'inactive').length}</p>
              </div>
            </div>
          </div>
        )}

        {/* TAB 1: DANH SÁCH NHÂN VIÊN */}
        {tabHienTai === 'nhan-vien' && (
          <div className="bg-white rounded-[24px] shadow-sm border border-rose-100 overflow-hidden animate-in fade-in duration-300">
            <table className="w-full text-left border-collapse">
              <thead className="bg-[#FFF5F6] border-b border-rose-100">
                <tr>
                  <th className="p-6 text-xs font-black text-rose-400 uppercase tracking-wider">Nhân Viên</th>
                  <th className="p-6 text-xs font-black text-rose-400 uppercase tracking-wider">Chức Vụ</th>
                  <th className="p-6 text-xs font-black text-rose-400 uppercase tracking-wider">Trạng Thái</th>
                  <th className="p-6 text-xs font-black text-rose-400 uppercase tracking-wider text-right">Hành Động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rose-50">
                {nhanVienDaLoc.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="p-16 text-center text-slate-400 font-medium bg-white">
                      Không tìm thấy dữ liệu nhân viên.
                    </td>
                  </tr>
                ) : (
                  nhanVienDaLoc.map((nv) => (
                    <tr key={nv.id} className="hover:bg-rose-50/30 transition-colors">
                      <td className="p-6">
                        <p className="font-bold text-slate-800 text-base">{nv.full_name}</p>
                        <p className="text-xs text-slate-500 mt-1">{nv.email}</p>
                      </td>
                      <td className="p-6">
                        <span className="bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg font-bold text-xs">
                          {dichTenChucVu(nv.role)}
                        </span>
                      </td>
                      <td className="p-6">
                        {nv.status === 'active' ? (
                          <span className="text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5 w-fit border border-emerald-100">
                            <CheckCircle size={14} /> Hoạt động
                          </span>
                        ) : (
                          <span className="text-rose-600 bg-rose-50 px-3 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5 w-fit border border-rose-100">
                            <ShieldAlert size={14} /> Tạm khóa
                          </span>
                        )}
                      </td>
                      <td className="p-6 text-right">
                        {nv.status === 'active' ? (
                          <button 
                            onClick={() => capNhatTrangThaiTaiKhoan(nv.id, nv.full_name, 'inactive')}
                            className="bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 px-4 py-2 rounded-xl font-bold text-xs transition-colors flex items-center gap-2 ml-auto"
                          >
                            <UserX size={16} /> Đình Chỉ
                          </button>
                        ) : (
                          <button 
                            onClick={() => capNhatTrangThaiTaiKhoan(nv.id, nv.full_name, 'active')}
                            className="bg-emerald-50 border border-emerald-200 text-emerald-600 hover:bg-emerald-500 hover:text-white px-4 py-2 rounded-xl font-bold text-xs transition-colors flex items-center gap-2 ml-auto"
                          >
                            <UserCheck size={16} /> Mở Khóa
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 2: ĐƠN NGHỈ PHÉP */}
        {tabHienTai === 'nghi-phep' && (
          <div className="bg-white rounded-[24px] shadow-sm border border-rose-100 overflow-hidden animate-in fade-in duration-300">
            <div className="divide-y divide-rose-50">
              {anToanNghiPhep.length === 0 ? (
                <div className="p-16 text-center text-slate-400 font-medium">
                  Hiện không có đơn xin nghỉ phép nào.
                </div>
              ) : (
                anToanNghiPhep.map((don) => (
                  <div key={don.id} className="p-8 hover:bg-rose-50/20 transition-colors flex flex-col md:flex-row gap-6 items-start md:items-center">
                    
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="font-black text-slate-800 text-lg">{don.full_name}</h4>
                        <span className="bg-slate-100 text-slate-500 px-2 py-1 rounded text-xs font-bold">
                          {dichTenChucVu(don.role)}
                        </span>
                        <span className="text-xs font-bold text-slate-400 bg-slate-50 px-3 py-1 rounded-lg border border-slate-100 ml-auto">
                          Gửi ngày: {new Date(don.created_at).toLocaleDateString('vi-VN')}
                        </span>
                      </div>
                      <div className="text-sm text-slate-700 bg-[#FFFBFB] border border-rose-50 p-4 rounded-xl">
                        <span className="font-bold text-rose-500 mr-2">Lý do nghỉ:</span> 
                        {don.reason}
                      </div>
                    </div>

                    <div className="shrink-0 md:w-56 flex justify-end">
                      {don.status === 'pending' ? (
                        <div className="flex gap-2 w-full">
                          <button 
                            onClick={() => setModalDuyet({ mo: true, don: don })}
                            className="flex-1 bg-emerald-50 hover:bg-emerald-500 hover:text-white text-emerald-600 font-bold py-2.5 rounded-xl text-sm transition-colors border border-emerald-100 flex items-center justify-center gap-1"
                          >
                            <CalendarCheck size={16}/> Duyệt & Quy Định
                          </button>
                          <button 
                            onClick={() => tuChoiDonNghi(don.id)}
                            className="bg-rose-50 hover:bg-rose-500 hover:text-white text-rose-600 font-bold px-4 py-2.5 rounded-xl text-sm transition-colors border border-rose-100 flex items-center justify-center"
                          >
                            <XCircle size={18}/>
                          </button>
                        </div>
                      ) : (
                        <div className={`w-full text-center px-4 py-2.5 rounded-xl font-bold text-sm border ${
                          don.status === 'approved' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-red-50 text-red-600 border-red-100'
                        }`}>
                          {don.status === 'approved' ? 'Đã Phê Duyệt' : 'Đã Bị Từ Chối'}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* ========================================================= 
          MODAL QUY ĐỊNH THỜI GIAN NGHỈ PHÉP KHI DUYỆT ĐƠN 
          ========================================================= */}
      {modalDuyet.mo && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-8 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-black text-xl text-slate-800 flex items-center gap-2">
                <CalendarDays className="text-emerald-500" /> Quy định thời gian nghỉ
              </h3>
              <button onClick={() => setModalDuyet({ mo: false, don: null })} className="text-slate-400 hover:text-slate-600 bg-slate-100 p-2 rounded-full">
                <X size={18} />
              </button>
            </div>
            
            <p className="text-sm text-slate-500 font-medium mb-6">
              Phê duyệt đơn xin nghỉ phép của <span className="font-bold text-slate-800">{modalDuyet.don?.full_name}</span>. Vui lòng thiết lập thời gian:
            </p>

            <form onSubmit={xacNhanDuyetCoThoiGian} className="space-y-5">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Từ ngày (Bắt đầu nghỉ)</label>
                <input 
                  type="date" 
                  required
                  value={ngayBatDau}
                  onChange={(e) => setNgayBatDau(e.target.value)}
                  className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-emerald-400 font-medium text-slate-700"
                />
              </div>
              
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Đến hết ngày (Kết thúc)</label>
                <input 
                  type="date" 
                  required
                  value={ngayKetThuc}
                  onChange={(e) => setNgayKetThuc(e.target.value)}
                  className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-emerald-400 font-medium text-slate-700"
                />
              </div>

              <button 
                type="submit" 
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-black py-4 rounded-xl shadow-lg shadow-emerald-200 transition-all flex justify-center items-center gap-2 mt-4"
              >
                <CheckCircle size={20} /> Xác Nhận Phê Duyệt
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}`11`