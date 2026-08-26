import { BrowserRouter, Routes, Route } from 'react-router-dom';
import BaoVeTuyenDuong from './BaoVeTuyenDuong';

// Import tất cả các trang
import DangNhap from '../Trang/Chung/DangNhap';
import TraCuuHanhTrinh from '../Trang/KhachHang/TraCuuHanhTrinh';
import BanGiamDoc from '../Trang/Admin/BanGiamDoc';
import TrungTamDieuPhoi from '../Trang/DieuHanh/TrungTamDieuPhoi';
import QuanLyDonHang from '../Trang/CuaHang/QuanLyDonHang';
import QuetMaVach from '../Trang/Kho/QuetMaVach';
import BanDoGiaoHang from '../Trang/TaiXe/BanDoGiaoHang';
import DoiSoatCOD from '../Trang/KeToan/DoiSoatCOD';
import HoSoNhanVien from '../Trang/NhanSu/HoSoNhanVien';

export default function DieuHuongChinh() {
    return (
        <BrowserRouter>
            <Routes>
                {/* 🟢 KHU VỰC CÔNG KHAI (Ai cũng vào được) */}
                <Route path="/" element={<TraCuuHanhTrinh />} />
                <Route path="/dang-nhap" element={<DangNhap />} />

                {/* 🔴 KHU VỰC BẢO MẬT (Kiểm tra Role khắt khe) */}
                
                {/* Ban Giám Đốc (Chỉ Admin) */}
                <Route path="/ban-giam-doc" element={
                    <BaoVeTuyenDuong quyenChoPhep={['admin']}>
                        <BanGiamDoc />
                    </BaoVeTuyenDuong>
                } />

                {/* Điều Hành (Admin & Dispatcher) */}
                <Route path="/dieu-hanh" element={
                    <BaoVeTuyenDuong quyenChoPhep={['admin', 'dispatcher']}>
                        <TrungTamDieuPhoi />
                    </BaoVeTuyenDuong>
                } />

                {/* Cửa Hàng / Đối Tác (Chỉ Shop) */}
                <Route path="/cua-hang" element={
                    <BaoVeTuyenDuong quyenChoPhep={['shop']}>
                        <QuanLyDonHang />
                    </BaoVeTuyenDuong>
                } />

                {/* Quản Lý Kho Bãi (Admin & Warehouse) */}
                <Route path="/kho" element={
                    <BaoVeTuyenDuong quyenChoPhep={['admin', 'warehouse']}>
                        <QuetMaVach />
                    </BaoVeTuyenDuong>
                } />

                {/* Ứng dụng Tài Xế (Chỉ Shipper) */}
                <Route path="/tai-xe" element={
                    <BaoVeTuyenDuong quyenChoPhep={['shipper']}>
                        <BanDoGiaoHang />
                    </BaoVeTuyenDuong>
                } />

                {/* Phòng Kế Toán (Admin & Accountant) */}
                <Route path="/ke-toan" element={
                    <BaoVeTuyenDuong quyenChoPhep={['admin', 'accountant']}>
                        <DoiSoatCOD />
                    </BaoVeTuyenDuong>
                } />

                {/* Phòng Nhân Sự (Admin & HR) */}
                <Route path="/nhan-su" element={
                    <BaoVeTuyenDuong quyenChoPhep={['admin', 'hr']}>
                        <HoSoNhanVien />
                    </BaoVeTuyenDuong>
                } />
            </Routes>
        </BrowserRouter>
    );
}