import { useState, useEffect } from 'react';
import { Users, UserCog, CalendarCheck, Send, ShieldBan, CheckCircle, XCircle, FileText, UserMinus, LogOut } from 'lucide-react';

export default function HoSoNhanVien() {
  const [nhanVien, setNhanVien] = useState([]);
  const [donNghiPhep, setDonNghiPhep] = useState([]);
  const [tabHienTai, setTabHienTai] = useState('danhsach'); 

  const [tieuDeBaoCao, setTieuDeBaoCao] = useState('');
  const [noiDungBaoCao, setNoiDungBaoCao] = useState('');
  const userId = localStorage.getItem('user_id');

  const taiDuLieu = async () => {
    // Tải nhân sự
    const resStaff = await fetch('http://localhost:5000/api/hr/staff');
    const dataStaff = await resStaff.json();
    if (dataStaff.success) setNhanVien(dataStaff.data);

    // Tải đơn nghỉ phép
    const resLeave = await fetch('http://localhost:5000/api/hr/leave-requests');
    const dataLeave = await resLeave.json();
    if (dataLeave.success) setDonNghiPhep(dataLeave.data);
  };

  useEffect(() => { taiDuLieu(); }, []);

  const doiTrangThaiTaiKhoan = async (id, trangThaiHienTai) => {
    const trangThaiMoi = trangThaiHienTai === 'active' ? 'inactive' : 'active';
    await fetch(`http://localhost:5000/api/hr/staff/${id}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: trangThaiMoi })
    });
    taiDuLieu();
  };

  const xuLyDonPhep = async (id, trangThai) => {
    await fetch(`http://localhost:5000/api/hr/leave/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: trangThai })
    });
    taiDuLieu();
  };

  const guiBaoCao = async (e) => {
    e.preventDefault();
    if (!tieuDeBaoCao || !noiDungBaoCao) return alert("Vui lòng nhập đủ thông tin báo cáo!");

    await fetch('http://localhost:5000/api/reports/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        department: 'Nhân Sự',
        title: tieuDeBaoCao,
        content: noiDungBaoCao,
        created_by: userId
      })
    });

    alert('Đã gửi báo cáo Nhân sự lên Ban Giám Đốc!');
    setTieuDeBaoCao('');
    setNoiDungBaoCao('');
  };

  const dangXuat = () => {
    const xacNhan = window.confirm("Bạn có chắc chắn muốn đăng xuất?");
    if (xacNhan) {
      localStorage.clear();
      window.location.href = '/'; 
    }
  };

  const soDonChoDuyet = donNghiPhep.filter(d => d.status === 'pending').length;

  return (
    <div className="flex min-h-screen bg-[#FAF5FF] font-sans text-gray-700">
      
      {/* SIDEBAR - TÔNG MÀU TÍM */}
      <div className="w-72 bg-white border-r border-purple-50 shadow-[0_0_20px_rgba(0,0,0,0.02)] flex flex-col z-10 justify-between">
        <div>
          <div className="p-8 border-b border-gray-50 flex items-center gap-3">
            <div className="bg-gradient-to-tr from-purple-600 to-purple-400 p-2.5 rounded-xl shadow-purple-200 shadow-lg">
              <Users className="text-white" size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black text-gray-800 tracking-tight">Nhân Sự HR</h2>
              <p className="text-xs font-bold text-purple-500 uppercase tracking-wider mt-0.5">Quản lý nội bộ</p>
            </div>
          </div>
          
          <div className="flex flex-col gap-3 p-5 mt-2">
            <button 
              onClick={() => setTabHienTai('danhsach')}
              className={`px-5 py-4 rounded-2xl font-bold text-left transition-all duration-300 flex items-center gap-4 group ${tabHienTai === 'danhsach' ? 'bg-gradient-to-r from-purple-600 to-purple-500 text-white shadow-lg shadow-purple-200' : 'bg-transparent text-gray-500 hover:bg-purple-50 hover:text-purple-600'}`}
            >
              <UserCog size={20} className={tabHienTai === 'danhsach' ? 'text-white' : 'text-gray-400 group-hover:text-purple-500'} />
              Danh Sách Nhân Sự
            </button>
            
            <button 
              onClick={() => setTabHienTai('nghiphep')}
              className={`px-5 py-4 rounded-2xl font-bold text-left transition-all duration-300 flex items-center gap-4 justify-between group ${tabHienTai === 'nghiphep' ? 'bg-gradient-to-r from-purple-600 to-purple-500 text-white shadow-lg shadow-purple-200' : 'bg-transparent text-gray-500 hover:bg-purple-50 hover:text-purple-600'}`}
            >
              <div className="flex items-center gap-4">
                <CalendarCheck size={20} className={tabHienTai === 'nghiphep' ? 'text-white' : 'text-gray-400 group-hover:text-purple-500'} />
                Nghỉ Phép & Báo Cáo
              </div>
              {soDonChoDuyet > 0 && (
                <span className={`px-2 py-0.5 rounded-full text-xs ${tabHienTai === 'nghiphep' ? 'bg-white text-purple-600' : 'bg-purple-100 text-purple-600'}`}>
                  {soDonChoDuyet}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Đăng xuất */}
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
              {tabHienTai === 'danhsach' ? 'Quản Lý Quyền Truy Cập' : 'Phê Duyệt & Trình Báo Cáo'}
            </h1>
            <p className="text-gray-500 mt-2">
              {tabHienTai === 'danhsach' ? 'Kiểm soát tài khoản và phân quyền cho toàn bộ hệ thống.' : 'Xử lý đơn từ nhân viên và báo cáo biến động nhân sự.'}
            </p>
          </div>
        </div>

        {/* TAB 1: DANH SÁCH NHÂN SỰ */}
        {tabHienTai === 'danhsach' && (
          <div className="bg-white rounded-[24px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-50 overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead className="bg-[#FAF5FF] border-b border-purple-100">
                <tr>
                  <th className="p-6 text-sm font-black text-purple-400 uppercase tracking-wider">Hồ Sơ</th>
                  <th className="p-6 text-sm font-black text-purple-400 uppercase tracking-wider">Chức Vụ</th>
                  <th className="p-6 text-sm font-black text-purple-400 uppercase tracking-wider">Trạng Thái</th>
                  <th className="p-6 text-sm font-black text-purple-400 uppercase tracking-wider text-right">Phân Quyền</th>
                </tr>
              </thead>
              <tbody>
                {nhanVien.map((nv) => (
                  <tr key={nv.id} className="border-b border-gray-50 hover:bg-[#FAF5FF] transition-colors group">
                    <td className="p-6">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 font-black">
                          {nv.full_name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-bold text-gray-800">{nv.full_name}</p>
                          <p className="text-sm text-gray-500">{nv.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-6">
                      <span className="bg-purple-50 text-purple-600 px-3 py-1.5 rounded-lg font-bold text-xs uppercase flex items-center w-fit gap-2">
                        <ShieldBan size={14} /> {nv.role}
                      </span>
                    </td>
                    <td className="p-6">
                      {nv.status === 'active' ? (
                        <span className="text-green-500 font-bold text-sm flex items-center gap-2">
                          <CheckCircle size={16} /> Hoạt động
                        </span>
                      ) : (
                        <span className="text-red-500 font-bold text-sm flex items-center gap-2">
                          <UserMinus size={16} /> Đã khóa
                        </span>
                      )}
                    </td>
                    <td className="p-6 text-right flex justify-end gap-2">
                      <button 
                        onClick={() => doiTrangThaiTaiKhoan(nv.id, nv.status)}
                        className={`px-5 py-2.5 rounded-xl font-bold transition-all duration-300 shadow-sm flex items-center gap-2 ${nv.status === 'active' ? 'bg-white border-2 border-red-100 text-red-500 hover:bg-red-50' : 'bg-green-500 text-white hover:bg-green-600 border-2 border-green-500'}`}
                      >
                        {nv.status === 'active' ? 'Khóa Tài Khoản' : 'Kích Hoạt'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 2: NGHỈ PHÉP & BÁO CÁO */}
        {tabHienTai === 'nghiphep' && (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
            
            {/* Cột Trái: Đơn xin nghỉ phép */}
            <div className="xl:col-span-7 bg-white rounded-[24px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden h-fit">
              <div className="p-6 border-b border-gray-50 bg-purple-50/50">
                <h3 className="text-xl font-bold text-purple-900 flex items-center gap-2">
                  <CalendarCheck size={20} className="text-purple-500" /> Đơn Xin Nghỉ Phép
                </h3>
              </div>
              <div className="divide-y divide-gray-50">
                {donNghiPhep.length === 0 ? (
                  <div className="p-10 text-center text-gray-400 italic">Không có đơn nghỉ phép nào cần xử lý.</div>
                ) : (
                  donNghiPhep.map((don) => (
                    <div key={don.id} className="p-6 hover:bg-gray-50 transition-colors">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-bold text-gray-800 text-lg">{don.full_name}</p>
                          <p className="text-xs font-bold text-purple-500 uppercase tracking-wider mt-1">{don.role}</p>
                        </div>
                        <div className="text-xs text-gray-400 bg-gray-100 px-3 py-1 rounded-full">
                          {new Date(don.created_at).toLocaleDateString('vi-VN')}
                        </div>
                      </div>
                      <div className="bg-[#FAF5FF] p-4 rounded-xl border border-purple-50 text-gray-600 text-sm mb-4">
                        <span className="font-bold text-purple-900">Lý do: </span>{don.reason}
                      </div>
                      
                      {don.status === 'pending' ? (
                        <div className="flex gap-3">
                          <button onClick={() => xuLyDonPhep(don.id, 'approved')} className="flex-1 bg-green-500 hover:bg-green-600 text-white py-2.5 rounded-xl font-bold flex justify-center items-center gap-2 transition-colors">
                            <CheckCircle size={18} /> Duyệt Đơn
                          </button>
                          <button onClick={() => xuLyDonPhep(don.id, 'rejected')} className="flex-1 bg-white border-2 border-red-100 text-red-500 hover:bg-red-50 py-2.5 rounded-xl font-bold flex justify-center items-center gap-2 transition-colors">
                            <XCircle size={18} /> Từ Chối
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-sm font-bold opacity-70">
                          {don.status === 'approved' ? (
                            <span className="text-green-500 flex items-center gap-2"><CheckCircle size={16}/> Đã duyệt thành công</span>
                          ) : (
                            <span className="text-red-500 flex items-center gap-2"><XCircle size={16}/> Đã từ chối đơn</span>
                          )}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Cột Phải: Form Báo cáo HR */}
            <div className="xl:col-span-5 bg-white p-8 rounded-[24px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] h-fit">
              <div className="flex items-center gap-3 mb-8">
                <div className="bg-purple-50 p-3 rounded-xl text-purple-500">
                  <Send size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-800">Trình Báo Cáo Nhân Sự</h3>
                  <p className="text-xs font-bold text-gray-400 uppercase mt-1">Gửi Ban Giám Đốc</p>
                </div>
              </div>
              
              <form onSubmit={guiBaoCao} className="space-y-6">
                <div>
                  <label className="block font-bold text-gray-600 mb-2 text-sm">Tiêu đề báo cáo</label>
                  <input 
                    type="text" 
                    className="w-full bg-[#FAF5FF] border-2 border-transparent p-4 rounded-xl outline-none focus:border-purple-400 focus:bg-white transition-all font-medium text-gray-700" 
                    placeholder="VD: Đánh giá KPI tài xế tháng 3..."
                    value={tieuDeBaoCao}
                    onChange={(e) => setTieuDeBaoCao(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-600 mb-2 text-sm">Nội dung chi tiết</label>
                  <textarea 
                    rows="8" 
                    className="w-full bg-[#FAF5FF] border-2 border-transparent p-4 rounded-xl outline-none focus:border-purple-400 focus:bg-white transition-all font-medium text-gray-700 resize-none"
                    placeholder="Nhập tình hình nhân sự, biến động đội ngũ..."
                    value={noiDungBaoCao}
                    onChange={(e) => setNoiDungBaoCao(e.target.value)}
                  ></textarea>
                </div>
                <button type="submit" className="w-full bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-700 hover:to-purple-600 text-white font-bold py-4 rounded-xl shadow-lg shadow-purple-200 transition-all flex justify-center items-center gap-2 text-lg">
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