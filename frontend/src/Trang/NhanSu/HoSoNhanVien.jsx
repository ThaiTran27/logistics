import { apiFetch as fetch } from '../../utils/apiFetch.js';
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
  Clock3,
  Wallet,
  Save,
  X,
  PlusCircle,
  Pencil,
  Trash2,
  MapPin,
} from 'lucide-react';
import * as XLSX from 'xlsx';

const API_URL = 'http://localhost:5000';

const defaultForm = {
  full_name: '',
  email: '',
  password: '',
  role: 'pickup_driver',
  status: 'active',
  warehouse_id: '',
};

export default function HoSoNhanVien() {
  const [nhanVienList, setNhanVienList] = useState([]);
  const [danhSachKho, setDanhSachKho] = useState([]);
  const [nghiPhepList, setNghiPhepList] = useState([]);
  const [hoSoUngTuyen, setHoSoUngTuyen] = useState([]);
  const [yeuCauTuVan, setYeuCauTuVan] = useState([]);
  const [tabHienTai, setTabHienTai] = useState('nhan-vien');
  const [tuKhoa, setTuKhoa] = useState('');
  const [modalDuyet, setModalDuyet] = useState({ mo: false, don: null });
  const [ngayBatDau, setNgayBatDau] = useState('');
  const [ngayKetThuc, setNgayKetThuc] = useState('');
  const [formNhanVien, setFormNhanVien] = useState(defaultForm);
  const [editingId, setEditingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [thangXem, setThangXem] = useState(() => new Date().toISOString().slice(0, 7));
  const [chamCongList, setChamCongList] = useState([]);
  const [bangLuong, setBangLuong] = useState([]);
  const [luongChinhSua, setLuongChinhSua] = useState({});
  const [anhChamCongDangXem, setAnhChamCongDangXem] = useState(null);

  const hrName = localStorage.getItem('full_name') || 'Phòng Nhân Sự';

  const taiDanhSachKho = async () => {
    try {
      const response = await fetch(`${API_URL}/api/warehouses`);
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Không tải được danh sách kho.');
      setDanhSachKho((data.data || []).filter((warehouse) => warehouse.is_active));
    } catch (error) {
      console.error('Lỗi tải danh sách kho:', error);
    }
  };

  const renderAttendanceEvidence = (photo, lat, lng, label) => {
    const hasCoordinates = lat !== null && lat !== undefined && lng !== null && lng !== undefined
      && Number.isFinite(Number(lat)) && Number.isFinite(Number(lng));
    const photoUrl = photo
      ? (/^https?:\/\//i.test(photo) ? photo : `${API_URL}${photo.startsWith('/') ? '' : '/'}${photo}`)
      : null;

    return (
      <div className="flex min-w-32 flex-col items-start gap-2">
        {photoUrl ? (
          <button type="button" onClick={() => setAnhChamCongDangXem({ url: photoUrl, label })} className="group relative overflow-hidden rounded-lg border border-slate-200" aria-label={`Xem ảnh ${label}`}>
            <img src={photoUrl} alt={`Ảnh xác thực ${label}`} className="h-16 w-20 object-cover transition-transform group-hover:scale-105" />
          </button>
        ) : <span className="text-xs text-slate-400">Chưa có ảnh</span>}
        {hasCoordinates ? (
          <a
            href={`https://maps.google.com/?q=${encodeURIComponent(`${Number(lat)},${Number(lng)}`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-bold text-blue-700 hover:underline"
          >
            <MapPin size={14} /> Bản đồ
          </a>
        ) : <span className="text-xs text-slate-400">Chưa có GPS</span>}
      </div>
    );
  };

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

  const taiYeuCauWebsite = async () => {
    try {
      const [applicationsResponse, requestsResponse] = await Promise.all([
        fetch('http://localhost:5000/api/hr/job-applications'),
        fetch('http://localhost:5000/api/hr/service-requests'),
      ]);
      const [applications, requests] = await Promise.all([applicationsResponse.json(), requestsResponse.json()]);
      if (applications.success && Array.isArray(applications.data)) setHoSoUngTuyen(applications.data);
      if (requests.success && Array.isArray(requests.data)) setYeuCauTuVan(requests.data);
    } catch (error) {
      console.error('Lỗi tải yêu cầu từ website:', error);
    }
  };

  useEffect(() => {
    taiDuLieuNhanVien();
    taiDuLieuNghiPhep();
    taiYeuCauWebsite();
    taiDanhSachKho();
  }, []);

  useEffect(() => {
    if (tabHienTai === 'cham-cong') {
      fetch(`http://localhost:5000/api/attendance?month=${thangXem}`)
        .then((response) => response.json())
        .then((data) => { if (data.success) setChamCongList(data.data || []); })
        .catch((error) => console.error('Lỗi tải bảng chấm công:', error));
    }
    if (tabHienTai === 'bang-luong') {
      fetch(`http://localhost:5000/api/hr/payroll?month=${thangXem}`)
        .then((response) => response.json())
        .then((data) => { if (data.success) setBangLuong(data.data || []); })
        .catch((error) => console.error('Lỗi tải bảng lương:', error));
    }
  }, [tabHienTai, thangXem]);

  const capNhatLuongNhap = (id, field, value) => {
    setLuongChinhSua((current) => ({
      ...current,
      [id]: { ...current[id], [field]: value },
    }));
  };

  const luuLuong = async (person) => {
    const draft = luongChinhSua[person.id] || {};
    try {
      const response = await fetch(`http://localhost:5000/api/hr/payroll/${person.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          monthly_salary: draft.monthly_salary ?? person.monthly_salary,
          allowance: draft.allowance ?? person.allowance,
          bonus_per_delivery: draft.bonus_per_delivery ?? person.bonus_per_delivery ?? 0,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Không thể lưu mức lương.');
      setBangLuong((current) => current.map((item) => item.id === person.id ? {
        ...item,
        monthly_salary: draft.monthly_salary ?? item.monthly_salary,
        allowance: draft.allowance ?? item.allowance,
        bonus_per_delivery: draft.bonus_per_delivery ?? item.bonus_per_delivery,
      } : item));
      setLuongChinhSua((current) => { const next = { ...current }; delete next[person.id]; return next; });
    } catch (error) {
      alert(error.message || 'Lỗi kết nối máy chủ.');
    }
  };

  const ghiDieuChinhLuong = async (person, adjustmentType) => {
    const amountInput = window.prompt(`Nhập số tiền ${adjustmentType === 'bonus' ? 'thưởng' : 'khấu trừ'} cho ${person.full_name}:`);
    if (amountInput === null) return;
    const amount = Number(amountInput);
    if (!Number.isFinite(amount) || amount <= 0) return alert('Số tiền phải lớn hơn 0.');
    const reason = window.prompt('Nhập lý do điều chỉnh:');
    if (!reason?.trim()) return alert('Cần nhập lý do điều chỉnh.');
    try {
      const response = await fetch(`http://localhost:5000/api/hr/payroll/${person.id}/adjustments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month: thangXem, adjustment_type: adjustmentType, amount, reason: reason.trim() })
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Không lưu được điều chỉnh.');
      const refresh = await fetch(`http://localhost:5000/api/hr/payroll?month=${thangXem}`);
      const payroll = await refresh.json();
      if (!refresh.ok || !payroll.success) throw new Error(payroll.message || 'Không tải lại bảng lương.');
      setBangLuong(payroll.data || []);
    } catch (error) {
      alert(error.message || 'Lỗi kết nối máy chủ.');
    }
  };

  const xuatBangLuong = () => {
    const rows = bangLuong.map((person) => ({
      'Nhân viên': person.full_name,
      Email: person.email,
      'Chức vụ': dichTenChucVu(person.role),
      'Ngày công': Number(person.attendance_days || 0),
      'Đơn giao thành công': Number(person.completed_deliveries || 0),
      'Lương tháng': Number(person.monthly_salary || 0),
      'Phụ cấp': Number(person.allowance || 0),
      'Thưởng giao hàng': Number(person.completed_deliveries || 0) * Number(person.bonus_per_delivery || 0),
      'Thưởng bổ sung': Number(person.manual_bonus || 0),
      'Khấu trừ': Number(person.deductions || 0),
      'Lương dự kiến': Number(person.monthly_salary || 0)
        + Number(person.allowance || 0)
        + Number(person.completed_deliveries || 0) * Number(person.bonus_per_delivery || 0)
        + Number(person.manual_bonus || 0)
        - Number(person.deductions || 0)
    }));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), 'Bang luong');
    XLSX.writeFile(workbook, `bang-luong-${thangXem}.xlsx`);
  };

  const capNhatTrangThaiWebsite = async (loai, id, status) => {
    const endpoint = loai === 'ung-tuyen' ? 'job-applications' : 'service-requests';
    try {
      const response = await fetch(`http://localhost:5000/api/hr/${endpoint}/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Không thể cập nhật trạng thái.');
      taiYeuCauWebsite();
    } catch (error) {
      alert(error.message || 'Lỗi kết nối máy chủ!');
    }
  };

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
    } catch {
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
    } catch {
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
      warehouse_id: nv.warehouse_id ? String(nv.warehouse_id) : '',
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
    } catch {
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
    } catch {
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
    } catch {
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
      linehaul_driver: 'Tài Xế Xe Tải',
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
    <div className="flex h-screen overflow-hidden bg-[#FFFBFB] font-sans text-slate-700">
      <div className="sticky top-0 z-10 flex h-screen w-72 shrink-0 flex-col justify-between border-r border-rose-100 bg-white shadow-sm">
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="p-8 border-b border-rose-50 flex items-center gap-3">
            <div className="bg-gradient-to-tr from-rose-500 to-pink-400 p-2.5 rounded-xl shadow-lg shadow-rose-200">
              <Briefcase className="text-white" size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-800 tracking-tight">Hành Chính</h2>
              <p className="text-xs font-bold text-rose-500 uppercase tracking-wider mt-0.5">Quản Trị Nhân Sự</p>
              <p className="mt-1 max-w-40 truncate text-sm font-bold text-slate-700" title={hrName}>{hrName}</p>
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
            <button
              onClick={() => setTabHienTai('cham-cong')}
              className={`w-full px-5 py-4 rounded-2xl font-bold flex items-center gap-4 transition-all ${tabHienTai === 'cham-cong' ? 'bg-rose-50 text-rose-600 border border-rose-200 shadow-sm' : 'text-slate-500 hover:bg-rose-50/50'}`}
            >
              <Clock3 size={20} /> Bảng Chấm Công
            </button>
            <button
              onClick={() => setTabHienTai('bang-luong')}
              className={`w-full px-5 py-4 rounded-2xl font-bold flex items-center gap-4 transition-all ${tabHienTai === 'bang-luong' ? 'bg-rose-50 text-rose-600 border border-rose-200 shadow-sm' : 'text-slate-500 hover:bg-rose-50/50'}`}
            >
              <Wallet size={20} /> Bảng Lương
            </button>
            <button
              onClick={() => setTabHienTai('website')}
              className={`w-full px-5 py-4 rounded-2xl font-bold flex items-center gap-4 transition-all ${tabHienTai === 'website' ? 'bg-rose-50 text-rose-600 border border-rose-200 shadow-sm relative' : 'text-slate-500 hover:bg-rose-50/50 relative'}`}
            >
              <Briefcase size={20} /> Yêu Cầu Website
              {(hoSoUngTuyen.filter((item) => item.status === 'new').length + yeuCauTuVan.filter((item) => item.status === 'new').length) > 0 && (
                <span className="absolute right-4 top-1/2 -translate-y-1/2 bg-rose-500 text-white text-[10px] px-2 py-0.5 rounded-full">
                  {hoSoUngTuyen.filter((item) => item.status === 'new').length + yeuCauTuVan.filter((item) => item.status === 'new').length}
                </span>
              )}
            </button>
          </div>
        </div>

        <div className="shrink-0 border-t border-rose-50 p-5">
          <button onClick={dangXuat} className="w-full px-5 py-4 rounded-2xl font-bold text-left text-red-500 hover:bg-red-50 transition-colors flex items-center gap-3">
            <LogOut size={20} /> Đăng Xuất
          </button>
        </div>
      </div>

      <div className="min-w-0 flex-1 overflow-y-auto p-10">
        <div className="mb-8 flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-black text-slate-800 tracking-tight">
              {tabHienTai === 'nhan-vien' ? 'Hồ Sơ Nhân Sự' : tabHienTai === 'nghi-phep' ? 'Đơn Từ Xin Nghỉ Phép' : tabHienTai === 'cham-cong' ? 'Bảng Chấm Công' : tabHienTai === 'bang-luong' ? 'Bảng Lương Nhân Sự' : 'Yêu Cầu Từ Website'}
            </h1>
            <p className="text-slate-500 mt-2 font-medium">
              {tabHienTai === 'nhan-vien'
                ? 'Quản lý tài khoản, chức vụ và trạng thái hoạt động của toàn bộ nhân sự trong hệ thống.'
                : tabHienTai === 'nghi-phep'
                  ? 'Xem xét và phê duyệt các yêu cầu nghỉ phép, vắng mặt của nhân sự.'
                  : tabHienTai === 'cham-cong'
                    ? 'Theo dõi giờ vào ca và tan ca của nhân viên, bao gồm đội ngũ tài xế.'
                    : tabHienTai === 'bang-luong'
                      ? 'Xem mức lương tháng, phụ cấp và số ngày chấm công của nhân viên.'
                      : 'Theo dõi hồ sơ ứng tuyển và yêu cầu tư vấn các gói dịch vụ.'}
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
                    <option value="pickup_driver">Tài xế lấy hàng</option>
                    <option value="delivery_driver">Tài xế giao hàng</option>
                    <option value="linehaul_driver">Tài xế xe tải (Line-haul)</option>
                    <option value="warehouse_manager">Thủ kho</option>
                    <option value="fleet_manager">Điều phối viên</option>
                    <option value="accountant">Kế toán</option>
                    <option value="hr_manager">Nhân sự</option>
                    <option value="director">Giám đốc</option>
                    <option value="shop">Cửa hàng</option>
                    <option value="content_manager">Phòng nội dung</option>
                  </select>
                </label>

                {formNhanVien.role === 'warehouse_manager' && (
                  <label className="block text-sm font-bold text-slate-700">
                    Kho được phân công
                    <select
                      name="warehouse_id"
                      value={formNhanVien.warehouse_id}
                      onChange={handleInputChange}
                      required
                      className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 outline-none focus:border-rose-400 focus:bg-white"
                    >
                      <option value="">Chọn kho</option>
                      {danhSachKho.map((warehouse) => (
                        <option key={warehouse.id} value={warehouse.id}>{warehouse.name} · {warehouse.warehouse_type === 'central' ? 'Kho tổng' : 'Kho con'}</option>
                      ))}
                    </select>
                  </label>
                )}

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
                          {nv.warehouse_name && <p className="mt-1 text-xs font-semibold text-indigo-600">Kho: {nv.warehouse_name}</p>}
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

        {tabHienTai === 'cham-cong' && (
          <section className="overflow-hidden border border-rose-100 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-rose-100 p-5">
              <div><h2 className="font-black text-slate-800">Lịch sử chấm công</h2><p className="mt-1 text-sm text-slate-500">Dữ liệu vào ca và tan ca theo tháng đã chọn.</p></div>
              <input type="month" value={thangXem} onChange={(event) => setThangXem(event.target.value)} className="border border-slate-200 bg-white p-2 font-bold text-slate-700" />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1000px] text-left">
                <thead className="bg-[#FFF5F6] text-xs uppercase text-rose-500"><tr><th className="p-4">Nhân viên</th><th className="p-4">Chức vụ</th><th className="p-4">Ngày</th><th className="p-4">Vào ca</th><th className="p-4">Tan ca</th><th className="p-4">Xác thực</th></tr></thead>
                <tbody className="divide-y divide-rose-50">
                  {chamCongList.length ? chamCongList.map((record) => (
                    <tr key={record.id}>
                      <td className="p-4 font-bold">{record.full_name}</td>
                      <td className="p-4">{dichTenChucVu(record.role)}</td>
                      <td className="p-4">{new Date(`${String(record.work_date).slice(0, 10)}T00:00:00`).toLocaleDateString('vi-VN')}</td>
                      <td className="p-4">{record.check_in ? new Date(record.check_in).toLocaleTimeString('vi-VN') : 'Chưa chấm công'}</td>
                      <td className="p-4">{record.check_out ? new Date(record.check_out).toLocaleTimeString('vi-VN') : 'Chưa chấm công'}</td>
                      <td className="p-4">
                        <div className="flex flex-wrap gap-4">
                          <div><p className="mb-1 text-[10px] font-black uppercase text-slate-400">Vào ca</p>{renderAttendanceEvidence(record.check_in_photo, record.check_in_lat, record.check_in_lng, `vào ca - ${record.full_name}`)}</div>
                          <div><p className="mb-1 text-[10px] font-black uppercase text-slate-400">Tan ca</p>{renderAttendanceEvidence(record.check_out_photo, record.check_out_lat, record.check_out_lng, `tan ca - ${record.full_name}`)}</div>
                        </div>
                      </td>
                    </tr>
                  )) : <tr><td colSpan="6" className="p-12 text-center text-slate-400">Chưa có lượt chấm công trong tháng này.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {tabHienTai === 'bang-luong' && (
          <section className="overflow-hidden border border-rose-100 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-rose-100 p-5">
              <div><h2 className="font-black text-slate-800">Bảng lương tháng</h2><p className="mt-1 text-sm text-slate-500">Lương + phụ cấp + thưởng theo đơn + thưởng bổ sung − khấu trừ.</p></div>
              <div className="flex flex-wrap items-center gap-3"><input type="month" value={thangXem} onChange={(event) => setThangXem(event.target.value)} className="border border-slate-200 bg-white p-2 font-bold text-slate-700" /><button type="button" onClick={xuatBangLuong} className="rounded-lg bg-emerald-600 px-4 py-2 font-bold text-white">Xuất Excel</button></div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left">
                <thead className="bg-[#FFF5F6] text-xs uppercase text-rose-500"><tr><th className="p-4">Nhân viên</th><th className="p-4">Chức vụ</th><th className="p-4">Ngày công</th><th className="p-4">Đơn thành công</th><th className="p-4">Lương tháng</th><th className="p-4">Phụ cấp</th><th className="p-4">Thưởng / đơn</th><th className="p-4">Thưởng thêm</th><th className="p-4">Khấu trừ</th><th className="p-4">Tổng dự kiến</th><th className="p-4">Lưu</th></tr></thead>
                <tbody className="divide-y divide-rose-50">
                  {bangLuong.length ? bangLuong.map((person) => {
                    const draft = luongChinhSua[person.id] || {};
                    const salary = Number(draft.monthly_salary ?? person.monthly_salary ?? 0);
                    const allowance = Number(draft.allowance ?? person.allowance ?? 0);
                    const bonusPerDelivery = Number(draft.bonus_per_delivery ?? person.bonus_per_delivery ?? 0);
                    const estimatedSalary = salary + allowance
                      + bonusPerDelivery * Number(person.completed_deliveries || 0)
                      + Number(person.manual_bonus || 0)
                      - Number(person.deductions || 0);
                    return (
                      <tr key={person.id}>
                        <td className="p-4"><p className="font-bold">{person.full_name}</p><p className="text-xs text-slate-500">{person.email}</p></td>
                        <td className="p-4">{dichTenChucVu(person.role)}</td>
                        <td className="p-4">{person.attendance_days}</td>
                        <td className="p-4">{person.completed_deliveries}</td>
                        <td className="p-4"><input type="number" min="0" step="1000" aria-label={`Lương tháng ${person.full_name}`} value={draft.monthly_salary ?? person.monthly_salary} onChange={(event) => capNhatLuongNhap(person.id, 'monthly_salary', event.target.value)} className="w-36 border border-slate-200 p-2" /></td>
                        <td className="p-4"><input type="number" min="0" step="1000" aria-label={`Phụ cấp ${person.full_name}`} value={draft.allowance ?? person.allowance} onChange={(event) => capNhatLuongNhap(person.id, 'allowance', event.target.value)} className="w-32 border border-slate-200 p-2" /></td>
                        <td className="p-4"><input type="number" min="0" step="1000" aria-label={`Thưởng trên đơn ${person.full_name}`} value={draft.bonus_per_delivery ?? person.bonus_per_delivery ?? 0} onChange={(event) => capNhatLuongNhap(person.id, 'bonus_per_delivery', event.target.value)} className="w-32 border border-slate-200 p-2" /></td>
                        <td className="p-4">{Number(person.manual_bonus || 0).toLocaleString('vi-VN')} đ<button type="button" onClick={() => ghiDieuChinhLuong(person, 'bonus')} className="ml-2 rounded bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-800">+</button></td>
                        <td className="p-4">{Number(person.deductions || 0).toLocaleString('vi-VN')} đ<button type="button" onClick={() => ghiDieuChinhLuong(person, 'deduction')} className="ml-2 rounded bg-red-50 px-2 py-1 text-xs font-bold text-red-700">−</button></td>
                        <td className="p-4 font-black text-emerald-700">{estimatedSalary.toLocaleString('vi-VN')} đ</td>
                        <td className="p-4"><button onClick={() => luuLuong(person)} title="Lưu mức lương" className="bg-emerald-50 p-2.5 text-emerald-700 hover:bg-emerald-100"><Save size={17} /></button></td>
                      </tr>
                    );
                  }) : <tr><td colSpan="11" className="p-12 text-center text-slate-400">Chưa có nhân sự để hiển thị.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {tabHienTai === 'website' && (
          <div className="space-y-8">
            <section className="overflow-hidden rounded-[24px] border border-rose-100 bg-white shadow-sm">
              <div className="border-b border-rose-100 bg-[#FFF5F6] p-5">
                <h2 className="font-black text-slate-800">Hồ sơ ứng tuyển ({hoSoUngTuyen.length})</h2>
              </div>
              <div className="divide-y divide-rose-50">
                {hoSoUngTuyen.length === 0 ? (
                  <p className="p-8 text-center text-slate-400">Chưa có hồ sơ ứng tuyển.</p>
                ) : hoSoUngTuyen.map((item) => (
                  <article key={`application-${item.id}`} className="flex flex-col gap-4 p-5 md:flex-row md:items-start md:justify-between">
                    <div>
                      <h3 className="font-bold text-slate-800">{item.full_name} <span className="font-medium text-rose-600">· {item.job_title}</span></h3>
                      <p className="mt-1 text-sm text-slate-600"><a className="text-blue-600 hover:underline" href={`mailto:${item.email}`}>{item.email}</a> · <a className="text-blue-600 hover:underline" href={`tel:${item.phone}`}>{item.phone}</a></p>
                      {item.experience && <p className="mt-2 whitespace-pre-line text-sm text-slate-600">Kinh nghiệm: {item.experience}</p>}
                      {item.message && <p className="mt-1 whitespace-pre-line text-sm text-slate-500">{item.message}</p>}
                      <p className="mt-2 text-xs text-slate-400">Nhận ngày {new Date(item.created_at).toLocaleString('vi-VN')}</p>
                    </div>
                    <select aria-label={`Trạng thái hồ sơ ${item.full_name}`} value={item.status} onChange={(event) => capNhatTrangThaiWebsite('ung-tuyen', item.id, event.target.value)} className="rounded-lg border border-slate-200 bg-white p-2 text-sm font-bold text-slate-700">
                      <option value="new">Mới nhận</option>
                      <option value="reviewing">Đang xem xét</option>
                      <option value="accepted">Đạt yêu cầu</option>
                      <option value="rejected">Không phù hợp</option>
                    </select>
                  </article>
                ))}
              </div>
            </section>

            <section className="overflow-hidden rounded-[24px] border border-rose-100 bg-white shadow-sm">
              <div className="border-b border-rose-100 bg-[#FFF5F6] p-5">
                <h2 className="font-black text-slate-800">Yêu cầu tư vấn gói ({yeuCauTuVan.length})</h2>
              </div>
              <div className="divide-y divide-rose-50">
                {yeuCauTuVan.length === 0 ? (
                  <p className="p-8 text-center text-slate-400">Chưa có yêu cầu tư vấn.</p>
                ) : yeuCauTuVan.map((item) => (
                  <article key={`request-${item.id}`} className="flex flex-col gap-4 p-5 md:flex-row md:items-start md:justify-between">
                    <div>
                      <h3 className="font-bold text-slate-800">{item.full_name} <span className="font-medium text-blue-600">· {item.plan_name}</span></h3>
                      <p className="mt-1 text-sm text-slate-600"><a className="text-blue-600 hover:underline" href={`mailto:${item.email}`}>{item.email}</a> · <a className="text-blue-600 hover:underline" href={`tel:${item.phone}`}>{item.phone}</a></p>
                      {item.message && <p className="mt-2 whitespace-pre-line text-sm text-slate-500">{item.message}</p>}
                      <p className="mt-2 text-xs text-slate-400">Nhận ngày {new Date(item.created_at).toLocaleString('vi-VN')}</p>
                    </div>
                    <select aria-label={`Trạng thái yêu cầu ${item.full_name}`} value={item.status} onChange={(event) => capNhatTrangThaiWebsite('tu-van', item.id, event.target.value)} className="rounded-lg border border-slate-200 bg-white p-2 text-sm font-bold text-slate-700">
                      <option value="new">Mới nhận</option>
                      <option value="contacted">Đã liên hệ</option>
                      <option value="closed">Đã đóng</option>
                    </select>
                  </article>
                ))}
              </div>
            </section>
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

      {anhChamCongDangXem && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/80 p-4" onClick={() => setAnhChamCongDangXem(null)}>
          <section role="dialog" aria-modal="true" aria-label={`Ảnh xác thực ${anhChamCongDangXem.label}`} className="relative max-h-[90vh] max-w-4xl rounded-xl bg-white p-3 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <button type="button" aria-label="Đóng ảnh" onClick={() => setAnhChamCongDangXem(null)} className="absolute -right-3 -top-3 rounded-full bg-white p-2 text-slate-700 shadow-lg hover:bg-slate-100">
              <X size={20} />
            </button>
            <p className="px-2 pb-2 text-sm font-bold text-slate-700">{anhChamCongDangXem.label}</p>
            <img src={anhChamCongDangXem.url} alt={`Ảnh xác thực ${anhChamCongDangXem.label}`} className="max-h-[78vh] max-w-full object-contain" />
          </section>
        </div>
      )}
    </div>
  );
}
