import { useEffect, useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import { API_URL, apiFetch as fetch } from '../utils/apiFetch.js';

import PublicLayout from '../Layouts/PublicLayout';
import TrangChu from '../Trang/KhachHang/TrangChu';
import DichVu from '../Trang/KhachHang/DichVu';
import BangGia from '../Trang/KhachHang/BangGia';
import TinTuc from '../Trang/KhachHang/TinTuc';
import TuyenDung from '../Trang/KhachHang/TuyenDung';
import TinTucChiTiet from '../Trang/KhachHang/TinTucChiTiet';

import QuanLyTinTuc from '../Trang/PhongBan/QuanLyTinTuc';
import DangNhap from '../Trang/Chung/DangNhap';
import QuanLyDonHang from '../Trang/CuaHang/QuanLyDonHang';
import AppTaiXe from '../Trang/TaiXe/AppTaiXe';
import QuetMaVach from '../Trang/Kho/QuetMaVach';
import TrungTamDieuPhoi from '../Trang/DieuHanh/TrungTamDieuPhoi';
import DoiSoatCOD from '../Trang/KeToan/DoiSoatCOD';
import BanGiamDoc from '../Trang/Admin/BanGiamDoc';
import HoSoNhanVien from '../Trang/NhanSu/HoSoNhanVien';
import ChamCong from '../Trang/NhanSu/ChamCong';
import TrungTamHoTro from '../Trang/HoTro/TrungTamHoTro';
import KhongTimThay from '../Trang/KhongTimThay.jsx';
import { Link, useLocation } from 'react-router-dom';
import { CalendarCheck } from 'lucide-react';
import { normalizeRole } from '../utils/workspaceRoutes.js';

import BaoVeTuyenDuong from './BaoVeTuyenDuong';
import RouteErrorBoundary from './RouteErrorBoundary';

function UocTinhCuocPhi() {
  const [trongLuong, setTrongLuong] = useState(2.5);
  const [khoangCach, setKhoangCach] = useState(35);
  const [loaiDichVu, setLoaiDichVu] = useState('standard');
  const [hangDeVo, setHangDeVo] = useState(false);
  const [ketQua, setKetQua] = useState(null);
  const [loiCuocPhi, setLoiCuocPhi] = useState('');

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams({
      weight_kg: String(trongLuong),
      distance_km: String(khoangCach),
      service_type: loaiDichVu,
      fragile: String(hangDeVo)
    });
    fetch(`${API_URL}/api/pricing/estimate?${params}`)
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.message || 'Không tải được bảng giá hiện hành.');
        if (active) {
          const total = Number(result.data.shipping_fee);
          setKetQua({ tong: total, phanTram: Math.round((total / 250000) * 100) });
          setLoiCuocPhi('');
        }
      })
      .catch((error) => {
        if (active) {
          setKetQua(null);
          setLoiCuocPhi(error.message || 'Không tải được bảng giá hiện hành.');
        }
      });
    return () => { active = false; };
  }, [trongLuong, khoangCach, loaiDichVu, hangDeVo]);

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-14">
      <div className="mb-10 text-center max-w-2xl mx-auto space-y-2">
        <span className="text-xs font-black uppercase tracking-wider text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
          Công Cụ Tính Cước
        </span>
        <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">Ước Tính Chi Phí Vận Chuyển</h1>
        <p className="text-xs sm:text-sm text-slate-500 font-medium">Báo giá theo biểu cước niêm yết mới nhất của Smart Logistics.</p>
      </div>

      <div className="grid gap-8 lg:grid-cols-12 items-start">
        <div className="lg:col-span-7 rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-8 shadow-soft-sm space-y-6">
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-xs font-bold text-slate-700">Trọng lượng kiện hàng (kg)</label>
              <div className="flex gap-1">
                {[0.5, 1, 2, 5, 10].map((w) => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => setTrongLuong(w)}
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                      Number(trongLuong) === w
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {w}kg
                  </button>
                ))}
              </div>
            </div>
            <input
              type="number"
              min="0.1"
              step="0.1"
              value={trongLuong}
              onChange={(e) => setTrongLuong(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-sm font-bold text-slate-800 outline-none focus:bg-white focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Khoảng cách dự kiến (km)</label>
            <input
              type="number"
              min="1"
              value={khoangCach}
              onChange={(e) => setKhoangCach(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-sm font-bold text-slate-800 outline-none focus:bg-white focus:border-blue-500"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Gói dịch vụ</label>
              <select
                value={loaiDichVu}
                onChange={(e) => setLoaiDichVu(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-sm font-bold text-slate-800 outline-none focus:bg-white focus:border-blue-500"
              >
                <option value="standard">Tiêu chuẩn (24h)</option>
                <option value="express">Hỏa tốc / Nhanh (4h)</option>
                <option value="economy">Tiết kiệm (48h)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Khu vực phục vụ</label>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-sm font-bold text-slate-700">
                Gò Vấp, TP. Hồ Chí Minh
              </div>
            </div>
          </div>

          <label className="flex items-center gap-3 rounded-2xl border border-orange-200 bg-orange-50/80 p-4 text-xs font-bold text-orange-800 cursor-pointer">
            <input
              type="checkbox"
              checked={hangDeVo}
              onChange={(e) => setHangDeVo(e.target.checked)}
              className="h-4 w-4 rounded accent-orange-600"
            />
            <span>Kiện hàng dễ vỡ / chất lỏng / cần bọc chống sốc đặc biệt (+12.000đ)</span>
          </label>
        </div>

        <div className="lg:col-span-5 rounded-3xl bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 p-8 text-white shadow-xl shadow-blue-500/20">
          <p className="text-xs font-black uppercase tracking-wider text-blue-200">Tổng Cước Dự Kiến</p>
          <h2 className="mt-3 text-4xl sm:text-5xl font-black tracking-tight">{ketQua ? `${ketQua.tong.toLocaleString('vi-VN')} đ` : '—'}</h2>
          <p className="mt-3 text-xs text-blue-100 font-medium leading-relaxed">
            {loiCuocPhi || (ketQua ? `Đã áp dụng theo bảng giá mới nhất với gói ${loaiDichVu === 'express' ? 'Hỏa tốc' : loaiDichVu === 'economy' ? 'Tiết kiệm' : 'Tiêu chuẩn'}.` : 'Đang tính theo bảng giá hiện hành...')}
          </p>

          <div className="mt-6 space-y-3 rounded-2xl bg-white/10 p-5 text-xs font-medium backdrop-blur-md">
            <div className="flex justify-between border-b border-white/10 pb-2">
              <span className="text-blue-100">Trọng lượng:</span>
              <strong className="text-white">{trongLuong} kg</strong>
            </div>
            <div className="flex justify-between border-b border-white/10 pb-2">
              <span className="text-blue-100">Khoảng cách:</span>
              <strong className="text-white">{khoangCach} km</strong>
            </div>
            <div className="flex justify-between border-b border-white/10 pb-2">
              <span className="text-blue-100">Dịch vụ:</span>
              <strong className="text-white">{loaiDichVu === 'express' ? 'Nhanh' : loaiDichVu === 'economy' ? 'Tiết kiệm' : 'Tiêu chuẩn'}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-blue-100">Xử lý đặc biệt:</span>
              <strong className="text-white">{hangDeVo ? 'Hàng dễ vỡ' : 'Tiêu chuẩn'}</strong>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-white/20 text-[11px] text-blue-200">
            * Phí thực tế có thể thay đổi tùy thuộc vào địa chỉ lấy hàng và kích thước đo đạc thực tế tại bưu cục.
          </div>
        </div>
      </div>
    </div>
  );
}

function TimKiemBuuCuc() {
  const [tuKhoa, setTuKhoa] = useState('');
  const [khuVucFilter, setKhuVucFilter] = useState('all');

  const danhSach = [
    { ten: 'Bưu cục Gò Vấp (Tổng kho)', diaChi: 'Số 2 Nguyễn Văn Bảo, Phường 4, Gò Vấp', gio: '06:00 - 22:00', trangThai: 'Mở', sdt: '1900 8095', khuVuc: 'govap' },
    { ten: 'Bưu cục Quận 1 - Lê Duẩn', diaChi: 'Số 15 Lê Duẩn, Bến Nghé, Quận 1', gio: '07:00 - 21:00', trangThai: 'Mở', sdt: '028 3822 1234', khuVuc: 'q1' },
    { ten: 'Bưu cục Bình Thạnh - Hoàng Văn Thụ', diaChi: 'Số 88 Hoàng Văn Thụ, Phường 9, Bình Thạnh', gio: '07:00 - 20:00', trangThai: 'Mở', sdt: '028 3510 5678', khuVuc: 'binhthanh' },
    { ten: 'Bưu cục Tân Bình - Phan Huy Ích', diaChi: 'Số 90 Phan Huy Ích, Phường 15, Tân Bình', gio: '07:00 - 20:00', trangThai: 'Mở', sdt: '028 3815 9012', khuVuc: 'tanbinh' }
  ];

  const ketQua = danhSach.filter((item) => {
    const matchText = item.ten.toLowerCase().includes(tuKhoa.toLowerCase()) || item.diaChi.toLowerCase().includes(tuKhoa.toLowerCase());
    const matchFilter = khuVucFilter === 'all' || item.khuVuc === khuVucFilter;
    return matchText && matchFilter;
  });

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-14">
      <div className="mb-10 text-center max-w-2xl mx-auto space-y-2">
        <span className="text-xs font-black uppercase tracking-wider text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
          Mạng Lưới Điểm Gửi Hàng
        </span>
        <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">Tìm Bưu Cục Gần Bạn</h1>
        <p className="text-xs sm:text-sm text-slate-500 font-medium">Hơn 50+ điểm gửi và tiếp nhận hàng hóa tại TP. Hồ Chí Minh.</p>
      </div>

      <div className="rounded-3xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-soft-sm space-y-4">
        <input
          value={tuKhoa}
          onChange={(e) => setTuKhoa(e.target.value)}
          placeholder="Tìm theo tên đường, phường hoặc quận..."
          className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 text-base font-bold text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition-all placeholder:text-slate-400 placeholder:font-normal"
        />

        <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
          <span className="font-bold text-slate-400">Khu vực:</span>
          {[
            { id: 'all', label: 'Tất cả' },
            { id: 'govap', label: 'Gò Vấp' },
            { id: 'q1', label: 'Quận 1' },
            { id: 'binhthanh', label: 'Bình Thạnh' },
            { id: 'tanbinh', label: 'Tân Bình' }
          ].map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setKhuVucFilter(f.id)}
              className={`font-bold px-3 py-1.5 rounded-xl border transition-all ${
                khuVucFilter === f.id
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-8 grid gap-5 md:grid-cols-2">
        {ketQua.length === 0 ? (
          <div className="md:col-span-2 rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-400">
            Không tìm thấy bưu cục nào phù hợp với từ khóa của bạn.
          </div>
        ) : (
          ketQua.map((item) => (
            <div key={item.ten} className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-soft-sm hover:shadow-soft-md transition-all space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-black text-slate-900">{item.ten}</h3>
                  <p className="mt-1 text-xs font-medium text-slate-500 leading-relaxed">{item.diaChi}</p>
                </div>
                <span className="rounded-full px-2.5 py-1 text-[11px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                  {item.trangThai}
                </span>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
                <span>Giờ mở cửa: <strong className="text-slate-800">{item.gio}</strong></span>
                <a href={`tel:${item.sdt.replace(/\s+/g, '')}`} className="font-bold text-blue-600 hover:underline">
                  {item.sdt}
                </a>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default function DieuHuongChinh() {
  const location = useLocation();
  const userRole = localStorage.getItem('role') || localStorage.getItem('user_role');
  const isPublicCustomerPage = location.pathname === '/'
    || ['/dich-vu', '/bang-gia', '/tin-tuc', '/tuyen-dung', '/uoc-tinh-cuoc', '/tim-buu-cuc'].includes(location.pathname)
    || location.pathname.startsWith('/tin-tuc/');
  const allowedRolesByPath = {
    '/phong-ban-noi-dung': ['content_manager', 'director'],
    '/cua-hang': ['shop'],
    '/tai-xe': ['driver', 'pickup_driver', 'delivery_driver', 'linehaul_driver'],
    '/kho': ['warehouse_manager', 'fleet_manager', 'director'],
    '/quan-ly-kho': ['director'],
    '/dieu-hanh': ['fleet_manager', 'director'],
    '/ke-toan': ['accountant', 'director'],
    '/nhan-su': ['hr_manager', 'director'],
    '/cham-cong': ['pickup_driver', 'delivery_driver', 'warehouse_manager', 'fleet_manager', 'linehaul_driver', 'accountant', 'hr_manager', 'director', 'shop', 'content_manager', 'customer_service'],
    '/admin': ['director'],
    '/ho-tro': ['director', 'customer_service', 'fleet_manager']
  };
  const normalizedUserRole = normalizeRole(userRole);
  const showAttendanceShortcut = userRole
    && allowedRolesByPath[location.pathname]?.includes(normalizedUserRole)
    && !isPublicCustomerPage
    && location.pathname !== '/cham-cong';

  return (
    <>
    <RouteErrorBoundary key={location.pathname}>
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<TrangChu />} />
        <Route path="/dich-vu" element={<DichVu />} />
        <Route path="/bang-gia" element={<BangGia />} />
        <Route path="/tin-tuc" element={<TinTuc />} />
        <Route path="/tin-tuc/:id" element={<TinTucChiTiet />} />
        <Route path="/tuyen-dung" element={<TuyenDung />} />
        <Route path="/uoc-tinh-cuoc" element={<UocTinhCuocPhi />} />
        <Route path="/tim-buu-cuc" element={<TimKiemBuuCuc />} />
      </Route>

      <Route path="/phong-ban-noi-dung" element={
        <BaoVeTuyenDuong allowedRoles={['content_manager', 'director']}><QuanLyTinTuc /></BaoVeTuyenDuong>
      } />
      <Route path="/dang-nhap" element={<DangNhap />} />

      <Route path="/cua-hang" element={
        <BaoVeTuyenDuong allowedRoles={['shop']}><QuanLyDonHang /></BaoVeTuyenDuong>
      } />

      <Route path="/tai-xe" element={
        <BaoVeTuyenDuong allowedRoles={['driver', 'pickup_driver', 'delivery_driver', 'linehaul_driver']}><AppTaiXe /></BaoVeTuyenDuong>
      } />

      <Route path="/kho" element={
        <BaoVeTuyenDuong allowedRoles={['warehouse_manager', 'fleet_manager', 'director']}><QuetMaVach /></BaoVeTuyenDuong>
      } />

      <Route path="/quan-ly-kho" element={
        <BaoVeTuyenDuong allowedRoles={['director']}><QuetMaVach /></BaoVeTuyenDuong>
      } />

      <Route path="/dieu-hanh" element={
        <BaoVeTuyenDuong allowedRoles={['fleet_manager', 'director']}><TrungTamDieuPhoi /></BaoVeTuyenDuong>
      } />

      <Route path="/ke-toan" element={
        <BaoVeTuyenDuong allowedRoles={['accountant', 'director']}><DoiSoatCOD /></BaoVeTuyenDuong>
      } />

      <Route path="/nhan-su" element={
        <BaoVeTuyenDuong allowedRoles={['hr_manager', 'director']}><HoSoNhanVien /></BaoVeTuyenDuong>
      } />

      <Route path="/cham-cong" element={
        <BaoVeTuyenDuong allowedRoles={['pickup_driver', 'delivery_driver', 'warehouse_manager', 'fleet_manager', 'linehaul_driver', 'accountant', 'hr_manager', 'director', 'shop', 'content_manager', 'customer_service']}><ChamCong /></BaoVeTuyenDuong>
      } />

      <Route path="/admin" element={
        <BaoVeTuyenDuong allowedRoles={['director']}><BanGiamDoc /></BaoVeTuyenDuong>
      } />
      <Route path="/ho-tro" element={
        <BaoVeTuyenDuong allowedRoles={['admin', 'director', 'customer_service', 'customer_support', 'cskh', 'support', 'fleet_manager', 'fleet', 'coordinator', 'dispatcher', 'dieu_hanh']}><TrungTamHoTro /></BaoVeTuyenDuong>
      } />
      <Route path="*" element={<KhongTimThay />} />
    </Routes>
    </RouteErrorBoundary>
    {showAttendanceShortcut && (
      <Link
        to="/cham-cong"
        title="Mở chấm công ca làm việc"
        className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom)+12px)] right-5 z-40 flex items-center gap-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 px-4 py-3 text-xs sm:text-sm font-black text-white shadow-xl shadow-emerald-600/25 transition-all"
      >
        <CalendarCheck size={18} />
        <span>Chấm công</span>
      </Link>
    )}
    </>
  );
}