import { Routes, Route } from 'react-router-dom';

// Import các trang Khách Hàng mới
import TrangChu from '../Trang/KhachHang/TrangChu';

import DangNhap from '../Trang/Chung/DangNhap';
import QuanLyDonHang from '../Trang/CuaHang/QuanLyDonHang';
import AppTaiXe from '../Trang/TaiXe/AppTaiXe';
import QuetMaVach from '../Trang/Kho/QuetMaVach';
import TrungTamDieuPhoi from '../Trang/DieuHanh/TrungTamDieuPhoi';
import DoiSoatCOD from '../Trang/KeToan/DoiSoatCOD';
import BanGiamDoc from '../Trang/Admin/BanGiamDoc';
import HoSoNhanVien from '../Trang/NhanSu/HoSoNhanVien';

// Import Component Bảo Vệ
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
      {/* KHU VỰC PUBLIC (Trang chủ tra cứu và các dịch vụ công khai cho khách hàng) */}
      <Route path="/" element={<TrangChu />} />
      <Route path="/uoc-tinh-cuoc" element={<UocTinhCuocPhi />} />
      <Route path="/tim-buu-cuc" element={<TimKiemBuuCuc />} />
      
      <Route path="/dang-nhap" element={<DangNhap />} />

      {/* KHU VỰC PRIVATE (Phải đăng nhập đúng Role mới được vào) */}
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