import { useState } from 'react';
import { Routes, Route } from 'react-router-dom';

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

import BaoVeTuyenDuong from './BaoVeTuyenDuong';

function UocTinhCuocPhi() {
  const [trongLuong, setTrongLuong] = useState(2.5);
  const [khoangCach, setKhoangCach] = useState(35);
  const [loaiDichVu, setLoaiDichVu] = useState('standard');
  const [hangDeVo, setHangDeVo] = useState(false);
  const [khuVuc, setKhuVuc] = useState('mien-nam');

  const ketQua = (() => {
    const giaCoBan = Number(trongLuong) * 15000 + Number(khoangCach) * 1800;
    const heSoDichVu = loaiDichVu === 'express' ? 1.45 : loaiDichVu === 'economy' ? 0.85 : 1.1;
    const heSoKhuVuc = khuVuc === 'mien-bac' ? 1.1 : khuVuc === 'mien-trung' ? 1.05 : 1.0;
    const heSoHang = hangDeVo ? 1.18 : 1;
    const tong = Math.round(giaCoBan * heSoDichVu * heSoKhuVuc * heSoHang);
    return { tong, phanTram: Math.round((tong / 250000) * 100) };
  })();

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <div className="mb-8">
        <p className="text-sm font-black uppercase tracking-[0.22em] text-blue-600">Ước tính cước</p>
        <h1 className="mt-3 text-4xl font-black text-slate-800">Tính chi phí vận chuyển nhanh</h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="grid gap-5 md:grid-cols-2">
            <label className="block text-sm font-bold text-slate-700">
              Trọng lượng (kg)
              <input type="number" min="0.1" step="0.1" value={trongLuong} onChange={(e) => setTrongLuong(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 outline-none focus:border-blue-400 focus:bg-white" />
            </label>

            <label className="block text-sm font-bold text-slate-700">
              Khoảng cách (km)
              <input type="number" min="1" value={khoangCach} onChange={(e) => setKhoangCach(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 outline-none focus:border-blue-400 focus:bg-white" />
            </label>
          </div>

          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <label className="block text-sm font-bold text-slate-700">
              Loại dịch vụ
              <select value={loaiDichVu} onChange={(e) => setLoaiDichVu(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 outline-none focus:border-blue-400 focus:bg-white">
                <option value="standard">Tiêu chuẩn</option>
                <option value="express">Nhanh</option>
                <option value="economy">Tiết kiệm</option>
              </select>
            </label>

            <label className="block text-sm font-bold text-slate-700">
              Khu vực giao hàng
              <select value={khuVuc} onChange={(e) => setKhuVuc(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 outline-none focus:border-blue-400 focus:bg-white">
                <option value="mien-nam">Miền Nam</option>
                <option value="mien-trung">Miền Trung</option>
                <option value="mien-bac">Miền Bắc</option>
              </select>
            </label>
          </div>

          <label className="mt-5 flex items-center gap-3 rounded-2xl border border-orange-200 bg-orange-50 p-4 text-sm font-bold text-orange-700">
            <input type="checkbox" checked={hangDeVo} onChange={(e) => setHangDeVo(e.target.checked)} className="h-4 w-4 accent-orange-500" />
            Hàng dễ vỡ / cần xử lý cẩn thận
          </label>
        </div>

        <div className="rounded-[28px] border border-blue-100 bg-gradient-to-br from-blue-600 to-indigo-700 p-6 text-white shadow-lg shadow-blue-200">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-blue-100">Dự kiến</p>
          <h2 className="mt-4 text-4xl font-black">{ketQua.tong.toLocaleString()} đ</h2>
          <p className="mt-3 text-sm text-blue-100">Tương đương khoảng {ketQua.phanTram}% giá trị đối với gói vận chuyển tiêu chuẩn</p>

          <div className="mt-6 space-y-3 rounded-2xl bg-white/10 p-4 text-sm backdrop-blur-sm">
            <div className="flex justify-between"><span>Trọng lượng</span><strong>{trongLuong} kg</strong></div>
            <div className="flex justify-between"><span>Khoảng cách</span><strong>{khoangCach} km</strong></div>
            <div className="flex justify-between"><span>Dịch vụ</span><strong>{loaiDichVu}</strong></div>
            <div className="flex justify-between"><span>Hàng dễ vỡ</span><strong>{hangDeVo ? 'Có' : 'Không'}</strong></div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TimKiemBuuCuc() {
  const [tuKhoa, setTuKhoa] = useState('');
  const danhSach = [
    { ten: 'Bưu cục Quận 1', diaChi: 'Số 15 Lê Duẩn, Quận 1', gio: '06:00 - 21:00', trangThai: 'Mở' },
    { ten: 'Bưu cục Gò Vấp', diaChi: 'Số 2 Nguyễn Văn Bảo, Gò Vấp', gio: '06:00 - 21:00', trangThai: 'Mở' },
    { ten: 'Bưu cục Bình Thạnh', diaChi: 'Số 88 Hoàng Văn Thụ, Bình Thạnh', gio: '07:00 - 20:00', trangThai: 'Bận' },
    { ten: 'Bưu cục Tân Bình', diaChi: 'Số 90 Phan Huy Ích, Tân Bình', gio: '07:00 - 20:00', trangThai: 'Mở' }
  ];

  const ketQua = danhSach.filter((item) =>
    item.ten.toLowerCase().includes(tuKhoa.toLowerCase()) ||
    item.diaChi.toLowerCase().includes(tuKhoa.toLowerCase())
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <div className="mb-8">
        <p className="text-sm font-black uppercase tracking-[0.22em] text-blue-600">Bưu cục</p>
        <h1 className="mt-3 text-4xl font-black text-slate-800">Tìm bưu cục gần bạn</h1>
      </div>

      <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <input
          value={tuKhoa}
          onChange={(e) => setTuKhoa(e.target.value)}
          placeholder="Tìm theo tên hoặc địa chỉ bưu cục..."
          className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 text-lg outline-none focus:border-blue-400 focus:bg-white"
        />
      </div>

      <div className="mt-6 grid gap-5 md:grid-cols-2">
        {ketQua.length === 0 ? (
          <div className="md:col-span-2 rounded-[24px] border border-dashed border-slate-300 bg-slate-50 p-10 text-center text-slate-500">Không tìm thấy bưu cục phù hợp.</div>
        ) : (
          ketQua.map((item) => (
            <div key={item.ten} className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-xl font-black text-slate-800">{item.ten}</h3>
                  <p className="mt-2 text-sm text-slate-500">{item.diaChi}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-black ${item.trangThai === 'Mở' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                  {item.trangThai}
                </span>
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4 text-sm text-slate-600">
                <span>Giờ làm việc</span>
                <strong>{item.gio}</strong>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default function DieuHuongChinh() {
  return (
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
        <BaoVeTuyenDuong allowedRoles={['content_manager']}><QuanLyTinTuc /></BaoVeTuyenDuong>
      } />
      <Route path="/dang-nhap" element={<DangNhap />} />

      <Route path="/cua-hang" element={
        <BaoVeTuyenDuong allowedRoles={['shop']}><QuanLyDonHang /></BaoVeTuyenDuong>
      } />

      <Route path="/tai-xe" element={
        <BaoVeTuyenDuong allowedRoles={['driver']}><AppTaiXe /></BaoVeTuyenDuong>
      } />

      <Route path="/kho" element={
        <BaoVeTuyenDuong allowedRoles={['warehouse_manager']}><QuetMaVach /></BaoVeTuyenDuong>
      } />

      <Route path="/dieu-hanh" element={
        <BaoVeTuyenDuong allowedRoles={['fleet_manager']}><TrungTamDieuPhoi /></BaoVeTuyenDuong>
      } />

      <Route path="/ke-toan" element={
        <BaoVeTuyenDuong allowedRoles={['accountant']}><DoiSoatCOD /></BaoVeTuyenDuong>
      } />

      <Route path="/nhan-su" element={
        <BaoVeTuyenDuong allowedRoles={['hr_manager']}><HoSoNhanVien /></BaoVeTuyenDuong>
      } />

      <Route path="/admin" element={
        <BaoVeTuyenDuong allowedRoles={['director']}><BanGiamDoc /></BaoVeTuyenDuong>
      } />
    </Routes>
  );
}