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
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Ước tính cước</h1>
      <p>Trang này đang được phát triển.</p>
    </div>
  );
}

function TimKiemBuuCuc() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Tìm bưu cục</h1>
      <p>Trang này đang được phát triển.</p>
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