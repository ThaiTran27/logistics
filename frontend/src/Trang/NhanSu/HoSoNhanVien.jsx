import { useState, useEffect } from 'react';
import {
  Users,
  UserCheck,
  UserMinus,
  UserX,
  CalendarDays,
  CheckCircle,
  XCircle,
  LogOut,
  Search,
  ShieldAlert,
  Briefcase,
  CalendarCheck,
  X,
  PlusCircle,
  Pencil,
  Trash2,
} from 'lucide-react';

const defaultForm = {
  full_name: '',
  email: '',
  password: '',
  role: 'driver',
  status: 'active',
};

export default function HoSoNhanVien() {
  const [nhanVienList, setNhanVienList] = useState([]);
  const [nghiPhepList, setNghiPhepList] = useState([]);
  const [tabHienTai, setTabHienTai] = useState('nhan-vien');
  const [tuKhoa, setTuKhoa] = useState('');
  const [modalDuyet, setModalDuyet] = useState({ mo: false, don: null });
  const [ngayBatDau, setNgayBatDau] = useState('');
  const [ngayKetThuc, setNgayKetThuc] = useState('');
  const [formNhanVien, setFormNhanVien] = useState(defaultForm);
  const [editingId, setEditingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const hrName = localStorage.getItem('full_name') || 'Phòng Nhân Sự';

  const taiDuLieuNhanVien = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/hr/staff');
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setNhanVienList(data.data);
      }
    } catch (error) {
      console.error('Lỗi tải danh sách nhân viên:', error);
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
      console.error('Lỗi tải đơn nghỉ phép:', error);
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
        body: JSON.stringify({ status: trangThaiMoi }),
      });
      const data = await res.json();
      if (data.success) {
        taiDuLieuNhanVien();
      }
    } catch (error) {
      alert('Lỗi kết nối máy chủ!');
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormNhanVien((prev) => ({ ...prev, [name]: value }));
  };

  const luuNhanVien = async (e) => {
    e.preventDefault();
    if (!formNhanVien.full_name || !formNhanVien.email || !formNhanVien.role) {
      return alert('Vui lòng nhập đầy đủ họ tên, email và chức vụ.');
    }
    if (!editingId && !formNhanVien.password) {
      return alert('Vui lòng nhập mật khẩu cho nhân viên mới.');
    }

    setSubmitting(true);
    const method = editingId ? 'PUT' : 'POST';
    const url = editingId ? `http://localhost:5000/api/hr/staff/${editingId}` : 'http://localhost:5000/api/hr/staff';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formNhanVien),
      });
      const data = await res.json();

      if (data.success) {
        alert(editingId ? 'Cập nhật nhân viên thành công.' : 'Tạo nhân viên mới thành công.');
        setFormNhanVien(defaultForm);
        setEditingId(null);
        taiDuLieuNhanVien();
      } else {
        alert(data.message || 'Có lỗi khi lưu nhân viên.');
      }
    } catch (error) {
      alert('Lỗi kết nối máy chủ!');
    } finally {
      setSubmitting(false);
    }
  };

  const suaNhanVien = (nv) => {
    setEditingId(nv.id);
    setFormNhanVien({
      full_name: nv.full_name,
      email: nv.email,
      password: '',
      role: nv.role,
      status: nv.status,
    });
    setTabHienTai('nhan-vien');
  };

  const xoaNhanVien = async (id, ten) => {
    if (!window.confirm(`Bạn có chắc muốn xóa nhân viên [${ten}] khỏi hệ thống?`)) return;

    try {
      const res = await fetch(`http://localhost:5000/api/hr/staff/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        alert('Đã xóa nhân viên thành công.');
        if (editingId === id) {
          setEditingId(null);
          setFormNhanVien(defaultForm);
        }
        taiDuLieuNhanVien();
      } else {
        alert(data.message || 'Xóa nhân viên thất bại.');
      }
    } catch (error) {
      alert('Lỗi kết nối máy chủ!');
    }
  };

  const tuChoiDonNghi = async (id) => {
    if (!window.confirm('Xác nhận từ chối đơn xin nghỉ phép này?')) return;
    try {
      const res = await fetch(`http://localhost:5000/api/hr/leave/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'rejected' }),
      });
      if ((await res.json()).success) taiDuLieuNghiPhep();
    } catch (error) {
      alert('Lỗi kết nối máy chủ!');
    }
  };

  const xacNhanDuyetCoThoiGian = async (e) => {
    e.preventDefault();
    if (!ngayBatDau || !ngayKetThuc) {
      return alert('Vui lòng chọn đầy đủ thời gian bắt đầu và kết thúc!');
    }
    if (new Date(ngayBatDau) > new Date(ngayKetThuc)) {
      return alert('Ngày kết thúc không hợp lý!');
    }

    try {
      const res = await fetch(`http://localhost:5000/api/hr/leave/${modalDuyet.don.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'approved' }),
      });
      if ((await res.json()).success) {
        alert(`✅ Đã phê duyệt nghỉ phép từ ${ngayBatDau} đến ${ngayKetThuc} thành công!`);
        setModalDuyet({ mo: false, don: null });
        setNgayBatDau('');
        setNgayKetThuc('');
        taiDuLieuNghiPhep();
      }
    } catch (error) {
      alert('Lỗi kết nối máy chủ!');
    }
  };

  const dangXuat = () => {
    if (window.confirm('Bạn muốn đăng xuất khỏi cổng Nhân Sự?')) {
      localStorage.clear();
      window.location.href = '/';
    }
  };

  const dichTenChucVu = (role) => {
    const roles = {
      shop: 'Cửa Hàng',
      driver: 'Tài Xế',
      warehouse_manager: 'Thủ Kho',
      fleet_manager: 'Điều Phối Viên',
      accountant: 'Kế Toán',
      hr_manager: 'Nhân Sự',
      director: 'Giám Đốc',
      content_manager: 'Phòng Nội Dung',
    };
    return roles[String(role || '').toLowerCase()] || role;
  };

  const anToanNhanVien = Array.isArray(nhanVienList) ? nhanVienList : [];
  const anToanNghiPhep = Array.isArray(nghiPhepList) ? nghiPhepList : [];

  const nhanVienDaLoc = anToanNhanVien.filter((nv) => {
    const ten = nv?.full_name || '';
    const email = nv?.email || '';
    const kw = tuKhoa || '';
    return ten.toLowerCase().includes(kw.toLowerCase()) || email.toLowerCase().includes(kw.toLowerCase());
  });

  return (
    <div className="flex min-h-screen bg-[#FFFBFB] font-sans text-slate-700">
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
              {anToanNghiPhep.filter((p) => p.status === 'pending').length > 0 && (
                <span className="absolute right-4 top-1/2 -translate-y-1/2 bg-rose-500 text-white text-[10px] px-2 py-0.5 rounded-full">
                  {anToanNghiPhep.filter((p) => p.status === 'pending').length}
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
            <LogOut size={20} /> Đăng Xuất
          </button>
        </div>
      </div>

      <div className="flex-1 p-10 overflow-y-auto">
        <div className="mb-8 flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-black text-slate-800 tracking-tight">
              {tabHienTai === 'nhan-vien' ? 'Hồ Sơ Nhân Sự' : 'Đơn Từ Xin Nghỉ Phép'}
            </h1>
            <p className="text-slate-500 mt-2 font-medium">
              {tabHienTai === 'nhan-vien'
                ? 'Quản lý tài khoản, chức vụ và trạng thái hoạt động của toàn bộ nhân sự trong hệ thống.'
                : 'Xem xét và phê duyệt các yêu cầu nghỉ phép, vắng mặt của nhân sự.'}
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

        {tabHienTai === 'nhan-vien' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-white p-6 rounded-[24px] shadow-sm border border-rose-100 flex items-center gap-5">
                <div className="bg-blue-50 p-4 rounded-2xl text-blue-600"><Users size={28} /></div>
                <div>
                  <p className="text-slate-400 font-bold text-xs uppercase tracking-wider mb-1">Tổng Nhân Sự</p>
                  <p className="text-3xl font-black text-slate-800">{anToanNhanVien.length}</p>
                </div>
              </div>
              <div className="bg-white p-6 rounded-[24px] shadow-sm border border-rose-100 flex items-center gap-5">
                <div className="bg-emerald-50 p-4 rounded-2xl text-emerald-600"><UserCheck size={28} /></div>
                <div>
                  <p className="text-slate-400 font-bold text-xs uppercase tracking-wider mb-1">Đang Hoạt Động</p>
                  <p className="text-3xl font-black text-slate-800">{anToanNhanVien.filter((nv) => nv.status === 'active').length}</p>
                </div>
              </div>
              <div className="bg-white p-6 rounded-[24px] shadow-sm border border-rose-100 flex items-center gap-5">
                <div className="bg-rose-50 p-4 rounded-2xl text-rose-600"><UserMinus size={28} /></div>
                <div>
                  <p className="text-slate-400 font-bold text-xs uppercase tracking-wider mb-1">Bị Đình Chỉ</p>
                  <p className="text-3xl font-black text-rose-600">{anToanNhanVien.filter((nv) => nv.status === 'inactive').length}</p>
                </div>
              </div>
            </div>

            <div className="mb-8 rounded-[28px] border border-rose-100 bg-white p-6 shadow-sm">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.2em] text-rose-500">Quản lý</p>
                  <h2 className="mt-2 text-2xl font-black text-slate-800">{editingId ? 'Cập nhật nhân sự' : 'Thêm nhân sự mới'}</h2>
                </div>
                <div className="rounded-full bg-rose-50 p-2 text-rose-600">
                  {editingId ? <Pencil size={18} /> : <PlusCircle size={18} />}
                </div>
              </div>

              <form onSubmit={luuNhanVien} className="grid gap-5 md:grid-cols-2">
                <label className="block text-sm font-bold text-slate-700">
                  Họ và tên
                  <input
                    type="text"
                    name="full_name"
                    value={formNhanVien.full_name}
                    onChange={handleInputChange}
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 outline-none focus:border-rose-400 focus:bg-white"
                    placeholder="VD: Nguyễn Văn A"
                  />
                </label>

                <label className="block text-sm font-bold text-slate-700">
                  Email
                  <input
                    type="email"
                    name="email"
                    value={formNhanVien.email}
                    onChange={handleInputChange}
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 outline-none focus:border-rose-400 focus:bg-white"
                    placeholder="nhanvien@smartlogistics.vn"
                  />
                </label>

                <label className="block text-sm font-bold text-slate-700">
                  Mật khẩu
                  <input
                    type="password"
                    name="password"
                    value={formNhanVien.password}
                    onChange={handleInputChange}
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 outline-none focus:border-rose-400 focus:bg-white"
                    placeholder={editingId ? 'Để trống nếu không đổi' : 'Nhập mật khẩu'}
                  />
                </label>

                <label className="block text-sm font-bold text-slate-700">
                  Chức vụ
                  <select
                    name="role"
                    value={formNhanVien.role}
                    onChange={handleInputChange}
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 outline-none focus:border-rose-400 focus:bg-white"
                  >
                    <option value="driver">Tài xế</option>
                    <option value="warehouse_manager">Thủ kho</option>
                    <option value="fleet_manager">Điều phối viên</option>
                    <option value="accountant">Kế toán</option>
                    <option value="hr_manager">Nhân sự</option>
                    <option value="director">Giám đốc</option>
                    <option value="shop">Cửa hàng</option>
                    <option value="content_manager">Phòng nội dung</option>
                  </select>
                </label>

                <label className="block text-sm font-bold text-slate-700 md:col-span-2">
                  Trạng thái tài khoản
                  <select
                    name="status"
                    value={formNhanVien.status}
                    onChange={handleInputChange}
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 outline-none focus:border-rose-400 focus:bg-white"
                  >
                    <option value="active">Hoạt động</option>
                    <option value="inactive">Tạm khóa</option>
                  </select>
                </label>

                <div className="md:col-span-2 flex items-center gap-3">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="rounded-xl bg-rose-500 px-5 py-3 font-bold text-white shadow-lg shadow-rose-200 transition hover:bg-rose-600 disabled:opacity-60"
                  >
                    {submitting ? 'Đang lưu...' : editingId ? 'Cập nhật' : 'Thêm nhân sự'}
                  </button>
                  {editingId && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(null);
                        setFormNhanVien(defaultForm);
                      }}
                      className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-3 font-bold text-slate-600"
                    >
                      Hủy
                    </button>
                  )}
                </div>
              </form>
            </div>

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
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => suaNhanVien(nv)}
                              className="bg-sky-50 border border-sky-200 text-sky-600 hover:bg-sky-500 hover:text-white px-3 py-2 rounded-xl font-bold text-xs transition-colors flex items-center gap-2"
                            >
                              <Pencil size={14} /> Sửa
                            </button>
                            <button
                              onClick={() => xoaNhanVien(nv.id, nv.full_name)}
                              className="bg-red-50 border border-red-200 text-red-600 hover:bg-red-500 hover:text-white px-3 py-2 rounded-xl font-bold text-xs transition-colors flex items-center gap-2"
                            >
                              <Trash2 size={14} /> Xóa
                            </button>
                            {nv.status === 'active' ? (
                              <button
                                onClick={() => capNhatTrangThaiTaiKhoan(nv.id, nv.full_name, 'inactive')}
                                className="bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 px-4 py-2 rounded-xl font-bold text-xs transition-colors flex items-center gap-2"
                              >
                                <UserX size={16} /> Đình Chỉ
                              </button>
                            ) : (
                              <button
                                onClick={() => capNhatTrangThaiTaiKhoan(nv.id, nv.full_name, 'active')}
                                className="bg-emerald-50 border border-emerald-200 text-emerald-600 hover:bg-emerald-500 hover:text-white px-4 py-2 rounded-xl font-bold text-xs transition-colors flex items-center gap-2"
                              >
                                <UserCheck size={16} /> Mở Khóa
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {tabHienTai === 'nghi-phep' && (
          <div className="bg-white rounded-[24px] shadow-sm border border-rose-100 overflow-hidden animate-in fade-in duration-300">
            <div className="divide-y divide-rose-50">
              {anToanNghiPhep.length === 0 ? (
                <div className="p-16 text-center text-slate-400 font-medium">Hiện không có đơn xin nghỉ phép nào.</div>
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
                            <CalendarCheck size={16} /> Duyệt & Quy Định
                          </button>
                          <button
                            onClick={() => tuChoiDonNghi(don.id)}
                            className="bg-rose-50 hover:bg-rose-500 hover:text-white text-rose-600 font-bold px-4 py-2.5 rounded-xl text-sm transition-colors border border-rose-100 flex items-center justify-center"
                          >
                            <XCircle size={18} />
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
}
