import { API_URL, apiFetch as fetch, resolveApiAssetUrl } from '../../utils/apiFetch.js';
import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { MapContainer, Marker, Popup, useMap } from 'react-leaflet';
import { GOVAP_MAP_CENTER, MapTileLayer } from '../../utils/govapMap.js';
import { OrderStatusBadge, getOrderStatusLabel } from '../../utils/orderStatus.jsx';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Search, Package, MapPin, Truck, CheckCircle, Clock, User, Phone,
  XCircle, AlertCircle, Box, Navigation, Calculator, Store, ShieldCheck,
  PackageSearch, Sparkles, ArrowRight, X, Copy, Check, MessageCircle,
  TrendingUp, Users, Award, Zap, ChevronRight, Star, Shield, RefreshCw
} from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

const trackingSocket = io(API_URL);
const movingTruckIcon = L.divIcon({
  className: 'live-tracking-truck',
  html: `
    <div style="position:relative;display:flex;align-items:center;justify-content:center;width:44px;height:44px;">
      <span style="position:absolute;inset:0;border-radius:50%;background:rgba(37,99,235,0.35);animation:pulseGlow 2s infinite;"></span>
      <span style="position:relative;background:#2563eb;color:white;width:34px;height:34px;border-radius:50%;display:grid;place-items:center;box-shadow:0 4px 14px rgba(37,99,235,0.5);border:2px solid white;font-size:16px;">🚚</span>
    </div>
  `,
  iconSize: [44, 44],
  iconAnchor: [22, 22]
});

function FollowDriver({ location }) {
  const map = useMap();
  useEffect(() => {
    if (location) {
      map.flyTo([Number(location.lat), Number(location.lng)], Math.max(map.getZoom(), 14), { duration: 0.6 });
    }
  }, [location, map]);
  return null;
}

const SAMPLE_TRACKING_CODES = [
  { code: 'SLTEST260901VN', note: 'Đơn đang giao' },
  { code: 'SLTEST260902VN', note: 'Tại kho tổng' },
  { code: 'SLTEST260903VN', note: 'Chờ lấy hàng' }
];

export default function TraCuuHanhTrinh() {
  const location = useLocation();
  const [maVanDon, setMaVanDon] = useState(() => String(location.state?.trackingCode || '').trim().toUpperCase());
  const [thongTinDon, setThongTinDon] = useState(null);
  const [loi, setLoi] = useState('');
  const [dangTim, setDangTim] = useState(false);
  const [tabTraCuu, setTabTraCuu] = useState('van-don');
  const [copiedCode, setCopiedCode] = useState(false);

  const [duLieuTinhCuoc, setDuLieuTinhCuoc] = useState({
    weight: '2.5',
    length: '10',
    width: '10',
    height: '10',
    distance: '35',
    serviceType: 'standard',
    remoteArea: false,
    fragile: false
  });
  const [tinTuc, setTinTuc] = useState([]);
  const [dangTaiTin, setDangTaiTin] = useState(true);
  const [loiTinTuc, setLoiTinTuc] = useState(false);
  const [danhMucTin, setDanhMucTin] = useState('all');

  const navigate = useNavigate();

  useEffect(() => {
    const orderId = thongTinDon?.id;
    if (!orderId) return undefined;
    const updateDriverPosition = (position) => {
      if (String(position.order_id) !== String(orderId)) return;
      setThongTinDon((current) => current && ({
        ...current,
        driver_location: { lat: position.lat, lng: position.lng, updated_at: position.timestamp }
      }));
    };
    trackingSocket.emit('join_order_tracking', { tracking_code: thongTinDon.tracking_code });
    trackingSocket.on('driver_location_changed', updateDriverPosition);
    return () => trackingSocket.off('driver_location_changed', updateDriverPosition);
  }, [thongTinDon?.id]);

  useEffect(() => {
    const taiTinTuc = async () => {
      try {
        const response = await fetch(`${API_URL}/api/news`);
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.message || 'Không tải được tin tức');
        setTinTuc(Array.isArray(data.data) ? data.data : []);
      } catch (error) {
        console.error('Lỗi tải tin tức trang chủ:', error);
        setLoiTinTuc(true);
      } finally {
        setDangTaiTin(false);
      }
    };

    taiTinTuc();
  }, []);

  const xuLyTraCuu = async (e, codeToSearch = null) => {
    if (e) e.preventDefault();
    const queryCode = String(codeToSearch || maVanDon).trim().toUpperCase();
    if (!queryCode) {
      setLoi('Vui lòng nhập mã vận đơn để tra cứu!');
      return;
    }

    setLoi('');
    setDangTim(true);
    setThongTinDon(null);
    setMaVanDon(queryCode);

    try {
      const res = await fetch(`${API_URL}/api/orders/track/${queryCode}`);
      const data = await res.json();

      if (data.success) {
        setThongTinDon(data.data);
        const trackingCode = String(data.data.tracking_code || queryCode).toUpperCase();
        localStorage.setItem('last_tracking_code', trackingCode);
        window.dispatchEvent(new CustomEvent('order-tracking-found', {
          detail: { tracking_code: trackingCode }
        }));
      } else {
        setLoi(data.message || 'Không tìm thấy đơn hàng. Vui lòng kiểm tra lại mã vận đơn!');
      }
    } catch {
      setLoi('Lỗi kết nối máy chủ backend. Vui lòng kiểm tra lại sau!');
    } finally {
      setDangTim(false);
    }
  };

  const copyTrackingCode = (code) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const cacBuocHanhTrinh = [
    { id: 'pending', ten: 'Chờ Lấy Hàng', desc: 'Shop đã tạo đơn và đang chờ phân công tài xế lấy hàng.', icon: Clock },
    { id: 'picking', ten: 'Đang Lấy Hàng', desc: 'Tài xế đang đến Shop để nhận kiện hàng.', icon: Truck },
    { id: 'picked_up', ten: 'Đã Lấy Hàng', desc: 'Kiện hàng đang được đưa về kho tổng Gò Vấp.', icon: PackageSearch },
    { id: 'at_central_warehouse', ten: 'Đang Xử Lý Tại Kho Tổng', desc: 'Kho tổng Gò Vấp đã nhận kiện hàng và chuẩn bị giao.', icon: Box },
    { id: 'delivering', ten: 'Đang Giao Hàng', desc: 'Tài xế đang trên đường giao hàng đến địa chỉ của bạn.', icon: Navigation },
    { id: 'completed', ten: 'Giao Thành Công', desc: 'Đơn hàng đã được giao tận tay người nhận.', icon: CheckCircle }
  ];

  const mapTarget = thongTinDon?.driver_location;
  const mapCenter = mapTarget
    ? [Number(mapTarget.lat), Number(mapTarget.lng)]
    : GOVAP_MAP_CENTER;

  const layTrangThaiBuoc = (trangThaiHienTai, idBuoc) => {
    const thuTu = cacBuocHanhTrinh.map((step) => step.id);
    if (['pickup_failed', 'delivery_failed', 'return_pending', 'returning', 'returned', 'cancelled'].includes(trangThaiHienTai)) return 'that-bai';

    const canonicalStatus = ['at_origin_warehouse', 'transferring_to_central', 'transferring_to_destination', 'at_destination_warehouse'].includes(trangThaiHienTai)
      ? 'at_central_warehouse' : trangThaiHienTai;
    const viTriHienTai = thuTu.indexOf(canonicalStatus);
    const viTriBuoc = thuTu.indexOf(idBuoc);

    if (viTriBuoc < viTriHienTai) return 'da-qua';
    if (viTriBuoc === viTriHienTai) return 'hien-tai';
    return 'chua-toi';
  };

  const tinTheoDanhMuc = tinTuc.filter((baiViet) => {
    const danhMuc = String(baiViet.category || '').toLocaleLowerCase('vi');
    if (danhMucTin === 'promotion') return danhMuc.includes('khuyến mãi');
    if (danhMucTin === 'guide') return danhMuc.includes('hướng dẫn');
    return true;
  }).slice(0, 3);

  // Tính cước nhanh
  const weight = Number(duLieuTinhCuoc.weight) || 0;
  const length = Number(duLieuTinhCuoc.length) || 0;
  const width = Number(duLieuTinhCuoc.width) || 0;
  const height = Number(duLieuTinhCuoc.height) || 0;
  const distance = Math.max(1, Number(duLieuTinhCuoc.distance) || 1);
  const volumetricWeight = (length * width * height) / 5000;
  const chargeableWeight = Math.max(weight, volumetricWeight);
  const baseFee = { economy: 18000, standard: 28000, express: 45000 }[duLieuTinhCuoc.serviceType] || 28000;
  const serviceFactor = { economy: 0.88, standard: 1, express: 1.5 }[duLieuTinhCuoc.serviceType] || 1;
  const distanceFee = Math.max(0, distance - 5) * 1700;
  const weightFee = chargeableWeight > 2 ? Math.ceil((chargeableWeight - 2) / 0.5) * 4500 : 0;
  const estimatedFee = Math.round((
    baseFee
    + distanceFee
    + weightFee
    + (duLieuTinhCuoc.remoteArea ? 22000 : 0)
    + (duLieuTinhCuoc.fragile ? 12000 : 0)
  ) * serviceFactor / 1000) * 1000;

  return (
    <div className="bg-[#FAFBFD] font-sans text-slate-800 antialiased">
      
      {/* HERO SECTION: ULTRA-MODERN DARK AESTHETIC */}
      <section className="relative w-full bg-[#080C15] text-white pt-20 pb-36 px-4 sm:px-6 lg:px-8 overflow-hidden bg-grid-pattern-dark">
        {/* Ambient luminous glow effects */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[550px] bg-radial-glow-dark pointer-events-none" />
        <div className="absolute top-20 right-10 w-96 h-96 bg-cyan-500/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute -bottom-20 -left-10 w-96 h-96 bg-indigo-600/15 rounded-full blur-[140px] pointer-events-none" />

        <div className="relative z-10 max-w-4xl mx-auto text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/[0.08] backdrop-blur-xl border border-white/15 text-xs font-bold text-cyan-300 shadow-inner">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
            </span>
            <span>Hệ Thống Logistics & Định Vị GPS Thời Gian Thực</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-black tracking-tight leading-[1.1]">
            Vận Tải Thông Minh, <br />
            <span className="text-gradient-aurora">
              Chuẩn Xác Từng Giây
            </span>
          </h1>

          <p className="text-slate-300 text-sm sm:text-base max-w-2xl mx-auto leading-relaxed font-normal">
            Nền tảng quản lý giao nhận khép kín từ Shop đến người nhận. Theo dõi bưu tá trực tuyến trên bản đồ, minh chứng ảnh giao hàng và đối soát COD minh bạch.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
            <button
              type="button"
              onClick={() => {
                const el = document.getElementById('tracking-search-box');
                el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }}
              className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-xs sm:text-sm shadow-glow-blue active:scale-95 transition-all flex items-center gap-2"
            >
              <Search size={16} />
              <span>Tra Cứu Vận Đơn Ngay</span>
            </button>

            <Link
              to="/dang-nhap"
              state={{ registration: true }}
              className="px-6 py-3.5 rounded-2xl bg-white/[0.08] hover:bg-white/[0.14] border border-white/15 text-white font-bold text-xs sm:text-sm backdrop-blur-md active:scale-95 transition-all flex items-center gap-2"
            >
              <span>Mở Tài Khoản Shop</span>
              <ArrowRight size={15} />
            </Link>
          </div>

          <div className="pt-4 flex flex-wrap items-center justify-center gap-6 text-xs text-slate-400 font-medium">
            <span className="flex items-center gap-2"><CheckCircle size={15} className="text-emerald-400" /> Bưu tá lấy hàng trong 30p</span>
            <span className="flex items-center gap-2"><CheckCircle size={15} className="text-cyan-400" /> Không phát sinh phí ẩn</span>
            <span className="flex items-center gap-2"><CheckCircle size={15} className="text-amber-400" /> Bảo hiểm 100% hàng hóa</span>
          </div>
        </div>
      </section>

      {/* TRACKING & UTILITY CONSOLE */}
      <section className="relative z-20 px-4 -mt-20 w-full max-w-5xl mx-auto mb-16">
        <div id="tracking-search-box" className="frosted-glass rounded-[32px] overflow-hidden shadow-soft-xl border border-white/80">
          
          {/* Modern Tabs */}
          <div className="flex flex-wrap border-b border-slate-200/60 bg-slate-50/70 px-3 sm:px-6 pt-3 gap-2">
            <button
              type="button"
              onClick={() => setTabTraCuu('van-don')}
              className={`px-5 py-3.5 font-black text-xs sm:text-sm rounded-2xl flex items-center gap-2 transition-all ${
                tabTraCuu === 'van-don'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <PackageSearch size={17} />
              <span>Tra Cứu Vận Đơn</span>
            </button>

            <button
              type="button"
              onClick={() => setTabTraCuu('uoc-tinh')}
              className={`px-5 py-3.5 font-black text-xs sm:text-sm rounded-2xl flex items-center gap-2 transition-all ${
                tabTraCuu === 'uoc-tinh'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <Calculator size={17} />
              <span>Ước Tính Cước Phí</span>
            </button>

            <button
              type="button"
              onClick={() => navigate('/tim-buu-cuc')}
              className="px-5 py-3.5 font-bold text-xs sm:text-sm rounded-2xl text-slate-600 hover:text-slate-900 hover:bg-slate-200/50 flex items-center gap-2 ml-auto"
            >
              <Store size={17} />
              <span>Bưu Cục Gần Nhất</span>
            </button>
          </div>

          {/* TAB 1: TRA CỨU */}
          {tabTraCuu === 'van-don' && (
            <div className="p-6 sm:p-10">
              <form onSubmit={xuLyTraCuu}>
                <div className="flex flex-col sm:flex-row items-stretch gap-3">
                  <div className="relative flex-1 group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" size={22} />
                    <input
                      type="text"
                      placeholder="Nhập mã vận đơn (VD: SLTEST260901VN...)"
                      value={maVanDon}
                      onChange={(e) => setMaVanDon(e.target.value.toUpperCase())}
                      className="w-full pl-13 pr-11 py-4 bg-slate-50/80 border-2 border-slate-200/80 rounded-2xl outline-none focus:bg-white focus:border-blue-500 focus:shadow-[0_0_0_4px_rgba(37,99,235,0.12)] transition-all font-bold text-slate-900 text-base placeholder:text-slate-400 placeholder:font-normal uppercase"
                    />
                    {maVanDon && (
                      <button
                        type="button"
                        onClick={() => { setMaVanDon(''); setThongTinDon(null); setLoi(''); }}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600 rounded-full"
                        aria-label="Xóa nội dung"
                      >
                        <X size={18} />
                      </button>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={dangTim}
                    className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 active:scale-95 text-white font-black px-8 py-4 rounded-2xl shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-70 whitespace-nowrap"
                  >
                    {dangTim ? (
                      <>
                        <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Đang tra cứu...</span>
                      </>
                    ) : (
                      <>
                        <Search size={18} />
                        <span>TRA CỨU NGAY</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Sample quick search pills */}
                <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-bold text-slate-400">Bấm thử mã đơn mẫu:</span>
                  {SAMPLE_TRACKING_CODES.map((item) => (
                    <button
                      key={item.code}
                      type="button"
                      onClick={(e) => xuLyTraCuu(e, item.code)}
                      className="font-bold text-blue-700 bg-blue-50/80 hover:bg-blue-100/80 border border-blue-200 px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 shadow-soft-sm active:scale-95"
                    >
                      <Sparkles size={12} className="text-amber-500" />
                      <span>{item.code}</span>
                      <span className="text-[10px] text-blue-500 font-normal">({item.note})</span>
                    </button>
                  ))}
                </div>

                {loi && (
                  <div className="mt-4 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 flex items-start gap-3 animate-in fade-in">
                    <AlertCircle size={20} className="shrink-0 text-rose-600 mt-0.5" />
                    <div>
                      <p className="font-bold text-sm">{loi}</p>
                      <p className="text-xs text-rose-600 mt-0.5">Vui lòng kiểm tra lại mã vận đơn hoặc bấm vào một trong các mã mẫu phía trên.</p>
                    </div>
                  </div>
                )}
              </form>
            </div>
          )}

          {/* TAB 2: TÍNH CƯỚC */}
          {tabTraCuu === 'uoc-tinh' && (
            <div className="p-6 sm:p-10">
              <div className="grid gap-8 lg:grid-cols-12 items-start">
                <div className="lg:col-span-7 space-y-4">
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-xs font-bold text-slate-700">Trọng lượng (kg)</label>
                      <div className="flex gap-1">
                        {[0.5, 1, 2, 5, 10].map((w) => (
                          <button
                            key={w}
                            type="button"
                            onClick={() => setDuLieuTinhCuoc({ ...duLieuTinhCuoc, weight: String(w) })}
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                              Number(duLieuTinhCuoc.weight) === w
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'bg-slate-50 text-slate-600 border-slate-200'
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
                      value={duLieuTinhCuoc.weight}
                      onChange={(e) => setDuLieuTinhCuoc({ ...duLieuTinhCuoc, weight: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-bold text-slate-800 outline-none focus:bg-white focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Khoảng cách dự kiến: <strong className="text-blue-600">{duLieuTinhCuoc.distance} km</strong></label>
                    <input
                      type="range"
                      min="1"
                      max="150"
                      value={duLieuTinhCuoc.distance}
                      onChange={(e) => setDuLieuTinhCuoc({ ...duLieuTinhCuoc, distance: e.target.value })}
                      className="w-full accent-blue-600 h-2 bg-slate-200 rounded-lg cursor-pointer"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <label className="text-xs font-bold text-slate-700">
                      Gói dịch vụ
                      <select
                        value={duLieuTinhCuoc.serviceType}
                        onChange={(e) => setDuLieuTinhCuoc({ ...duLieuTinhCuoc, serviceType: e.target.value })}
                        className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-bold text-slate-800 outline-none focus:bg-white focus:border-blue-500"
                      >
                        <option value="standard">Tiêu chuẩn (24h)</option>
                        <option value="express">Hỏa tốc / Nhanh (4h)</option>
                        <option value="economy">Tiết kiệm (48h)</option>
                      </select>
                    </label>

                    <div className="flex flex-col justify-end gap-2 pb-1">
                      <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={duLieuTinhCuoc.fragile}
                          onChange={(e) => setDuLieuTinhCuoc({ ...duLieuTinhCuoc, fragile: e.target.checked })}
                          className="h-4 w-4 rounded accent-blue-600"
                        />
                        Hàng dễ vỡ (+12k)
                      </label>
                      <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={duLieuTinhCuoc.remoteArea}
                          onChange={(e) => setDuLieuTinhCuoc({ ...duLieuTinhCuoc, remoteArea: e.target.checked })}
                          className="h-4 w-4 rounded accent-blue-600"
                        />
                        Khu vực ngoại thành (+22k)
                      </label>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-5 rounded-3xl bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 p-6 sm:p-8 text-white shadow-xl shadow-blue-500/25">
                  <p className="text-xs font-black uppercase tracking-wider text-blue-200">Tổng Cước Dự Kiến</p>
                  <p className="text-3xl sm:text-4xl font-black mt-2 tracking-tight">{estimatedFee.toLocaleString('vi-VN')} đ</p>
                  
                  <div className="mt-4 pt-4 border-t border-white/20 space-y-2 text-xs text-blue-100">
                    <div className="flex justify-between">
                      <span>Cự ly vận chuyển:</span>
                      <strong className="text-white">{duLieuTinhCuoc.distance} km</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Thời gian cam kết:</span>
                      <strong className="text-white">{duLieuTinhCuoc.serviceType === 'express' ? 'Trong 4 giờ' : duLieuTinhCuoc.serviceType === 'economy' ? 'Trong 48 giờ' : 'Trong 24 giờ'}</strong>
                    </div>
                  </div>

                  <Link
                    to="/bang-gia"
                    className="mt-6 flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-white text-blue-700 font-black text-xs hover:bg-slate-100 transition-colors shadow-sm"
                  >
                    <span>Xem Bảng Giá Toàn Phần</span>
                    <ArrowRight size={14} />
                  </Link>
                </div>
              </div>
            </div>
          )}

        </div>
      </section>

      {/* TRACKING RESULTS VIEW */}
      {thongTinDon && (
        <section className="max-w-5xl mx-auto px-4 pb-20 animate-in fade-in duration-500">
          <div className="bg-white rounded-[32px] shadow-soft-xl border border-slate-200/90 overflow-hidden">
            
            {/* Header info bar */}
            <div className="p-6 sm:p-8 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Kiện Hàng Vận Chuyển:</span>
                  <button
                    type="button"
                    onClick={() => copyTrackingCode(thongTinDon.tracking_code)}
                    className="inline-flex items-center gap-1.5 text-xs text-cyan-300 hover:text-cyan-200 font-bold bg-white/10 px-2.5 py-1 rounded-lg backdrop-blur-md"
                    title="Sao chép mã vận đơn"
                  >
                    {copiedCode ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                    <span>{copiedCode ? 'Đã sao chép' : 'Sao chép mã'}</span>
                  </button>
                </div>
                <h3 className="text-2xl sm:text-4xl font-black text-white tracking-tight">{thongTinDon.tracking_code}</h3>
              </div>

              <div className="flex items-center gap-3">
                <OrderStatusBadge status={thongTinDon.status} className="text-sm px-4 py-2" />
              </div>
            </div>

            {/* LIVE DRIVER MAP */}
            <div className="p-6 sm:p-8 border-b border-slate-100">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-black text-slate-900 uppercase tracking-wide flex items-center gap-2">
                  <Navigation size={17} className="text-blue-600" />
                  Định Vị Bưu Tá & Tuyến Đường Trực Tuyến
                </h4>
                {thongTinDon.driver_location && (
                  <span className="inline-flex items-center gap-2 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    GPS thời gian thực
                  </span>
                )}
              </div>

              <div className="h-80 rounded-2xl overflow-hidden border border-slate-200 shadow-inner relative">
                <MapContainer center={mapCenter} zoom={mapTarget ? 14 : 12} className="h-full w-full">
                  <MapTileLayer />
                  <FollowDriver location={mapTarget} />
                  {mapTarget && (
                    <Marker position={mapCenter} icon={movingTruckIcon}>
                      <Popup>
                        <div className="text-xs font-sans p-1">
                          <p className="font-bold text-slate-800">Tài xế đang giao kiện</p>
                          <p className="text-slate-500 text-[11px] mt-0.5">Tọa độ: {Number(mapTarget.lat).toFixed(4)}, {Number(mapTarget.lng).toFixed(4)}</p>
                        </div>
                      </Popup>
                    </Marker>
                  )}
                </MapContainer>
              </div>
            </div>

            {/* SENDER, RECEIVER & FINANCIAL OVERVIEW */}
            <div className="p-6 sm:p-8 bg-slate-50/60 border-b border-slate-100">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                
                {/* Receiver Info */}
                <div className="p-5 bg-white rounded-2xl border border-slate-200/90 shadow-soft-sm space-y-1.5">
                  <div className="flex items-center gap-2 text-slate-400 text-xs font-bold uppercase tracking-wider">
                    <User size={15} className="text-blue-600" />
                    <span>Người Nhận Hàng</span>
                  </div>
                  <p className="font-bold text-slate-900 text-base">{thongTinDon.receiver_name}</p>
                  <p className="text-xs font-semibold text-slate-500 flex items-center gap-1.5 pt-0.5">
                    <Phone size={13} /> {thongTinDon.receiver_phone}
                  </p>
                </div>

                {/* Delivery Address */}
                <div className="p-5 bg-white rounded-2xl border border-slate-200/90 shadow-soft-sm space-y-1.5">
                  <div className="flex items-center gap-2 text-slate-400 text-xs font-bold uppercase tracking-wider">
                    <MapPin size={15} className="text-blue-600" />
                    <span>Địa Chỉ Phát Hàng</span>
                  </div>
                  <p className="text-xs font-medium text-slate-700 leading-relaxed pt-0.5">
                    {thongTinDon.receiver_address || 'Địa chỉ được bảo mật trên giao diện công khai.'}
                  </p>
                </div>

                {/* COD & Shipping Fee Card */}
                <div className="p-5 bg-white rounded-2xl border border-slate-200/90 shadow-soft-sm space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-500">Tiền thu hộ (COD):</span>
                    <strong className="text-rose-600 font-black text-base">{Number(thongTinDon.cod_amount).toLocaleString()} đ</strong>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-500">Phí vận chuyển:</span>
                    <strong className="text-slate-900 font-black text-sm">{Number(thongTinDon.shipping_fee).toLocaleString()} đ</strong>
                  </div>
                  {thongTinDon.delivery_driver_name && (
                    <button
                      type="button"
                      onClick={() => window.dispatchEvent(new CustomEvent('open-driver-chat', {
                        detail: { tracking_code: thongTinDon.tracking_code }
                      }))}
                      className="w-full mt-2 inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold text-xs transition-colors"
                    >
                      <MessageCircle size={15} /> Nhắn tin với bưu tá giao
                    </button>
                  )}
                </div>

              </div>
            </div>

            {/* ROUTING TIMELINE STEPPER */}
            <div className="p-6 sm:p-10">
              <h4 className="text-base font-black text-slate-900 mb-8 uppercase tracking-wide border-l-4 border-blue-600 pl-3">
                Lộ Trình Xử Lý Đơn Hàng
              </h4>

              <div className="relative pl-3 space-y-8">
                {cacBuocHanhTrinh.map((buoc, index) => {
                  const trangThai = layTrangThaiBuoc(thongTinDon.status, buoc.id);
                  const Icon = buoc.icon;

                  let mauNenIcon = 'bg-slate-100 text-slate-400 border border-slate-200';
                  let mauChu = 'text-slate-400';

                  if (trangThai === 'da-qua') {
                    mauNenIcon = 'bg-emerald-600 text-white shadow-md shadow-emerald-500/20';
                    mauChu = 'text-slate-900 font-black';
                  } else if (trangThai === 'hien-tai') {
                    mauNenIcon = 'bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/30 ring-4 ring-blue-100';
                    mauChu = 'text-blue-700 font-black';
                  }

                  return (
                    <div key={buoc.id} className="flex items-start gap-4 relative">
                      {/* Line connector */}
                      {index < cacBuocHanhTrinh.length - 1 && (
                        <div
                          className={`absolute left-5 top-10 bottom-[-32px] w-0.5 ${
                            trangThai === 'da-qua' ? 'bg-emerald-500' : 'bg-slate-200'
                          }`}
                        />
                      )}

                      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 z-10 transition-all ${mauNenIcon}`}>
                        <Icon size={19} />
                      </div>

                      <div className="pt-1 flex-1">
                        <div className="flex items-center gap-2">
                          <p className={`text-sm sm:text-base ${mauChu}`}>{buoc.ten}</p>
                          {trangThai === 'hien-tai' && (
                            <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-black uppercase tracking-wider animate-pulse">
                              Đang thực hiện
                            </span>
                          )}
                          {trangThai === 'da-qua' && (
                            <span className="text-emerald-600 text-xs font-bold flex items-center gap-0.5">
                              <Check size={14} /> Hoàn tất
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-1 leading-relaxed max-w-xl">{buoc.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Status history log if present */}
              {thongTinDon.status_history?.length > 0 && (
                <div className="mt-10 pt-8 border-t border-slate-100">
                  <h5 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-4">
                    Nhật Ký Chuyển Trạng Thái (Audit Trail)
                  </h5>
                  <div className="space-y-3">
                    {thongTinDon.status_history.map((event) => (
                      <div key={event.id} className="flex items-start gap-3 text-xs bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                        <span className="mt-1 h-2 w-2 rounded-full bg-blue-600 shrink-0" />
                        <div className="flex-1 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                          <span className="font-bold text-slate-800">{getOrderStatusLabel(event.to_status)}</span>
                          {event.note && <span className="text-slate-500 italic">{event.note}</span>}
                          <time className="text-slate-400 font-medium">{new Date(event.created_at).toLocaleString('vi-VN')}</time>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Delivery Proof Photo */}
              {thongTinDon.proof_image && (
                <div className="mt-8 pt-8 border-t border-slate-100">
                  <h5 className="text-xs font-black uppercase tracking-wider text-slate-800 mb-3 flex items-center gap-2">
                    <ShieldCheck size={16} className="text-emerald-600" />
                    Ảnh Chụp Minh Chứng Ký Nhận (POD)
                  </h5>
                  <div className="p-2.5 rounded-2xl bg-slate-50 border border-slate-200 inline-block">
                    <img
                      src={`${API_URL}${thongTinDon.proof_image}`}
                      alt="Ảnh minh chứng giao hàng"
                      className="max-w-xs rounded-xl shadow-sm object-cover"
                    />
                  </div>
                </div>
              )}

            </div>
          </div>
        </section>
      )}

      {/* CORE CAPABILITIES SHOWCASE */}
      {!thongTinDon && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
          <div className="text-center max-w-2xl mx-auto mb-14 space-y-3">
            <span className="text-xs font-black uppercase tracking-wider text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
              Công Nghệ Vận Hành Đỉnh Cao
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
              Giải Pháp Vận Tải Toàn Diện Cho Doanh Nghiệp
            </h2>
            <p className="text-slate-500 text-xs sm:text-sm font-medium">
              Được thiết kế để loại bỏ 100% rủi ro thất lạc, tối ưu hóa cung đường và giải phóng áp lực đối soát tài chính.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="hover-card-premium p-8 rounded-3xl bg-white border border-slate-200/90 shadow-soft-sm space-y-5">
              <div className="h-14 w-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-cyan-500 text-white flex items-center justify-center font-black shadow-md">
                <Truck size={26} />
              </div>
              <h3 className="text-xl font-black text-slate-900">Giao Hỏa Tốc 4H</h3>
              <p className="text-xs text-slate-500 leading-relaxed font-medium">
                Tài xế nhận hàng trong 30 phút sau khi Shop tạo đơn. Hệ thống AI tự động gom đơn và điều phối lộ trình di chuyển thông minh nhất.
              </p>
              <div className="pt-2 flex items-center text-xs font-black text-blue-600">
                <span>Cam kết đúng hạn 99.8%</span>
                <ChevronRight size={14} className="ml-1" />
              </div>
            </div>

            <div className="hover-card-premium p-8 rounded-3xl bg-white border border-slate-200/90 shadow-soft-sm space-y-5">
              <div className="h-14 w-14 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center font-black shadow-md">
                <Award size={26} />
              </div>
              <h3 className="text-xl font-black text-slate-900">Đối Soát COD Minh Bạch</h3>
              <p className="text-xs text-slate-500 leading-relaxed font-medium">
                Tiền thu hộ COD được cập nhật tự động ngay khi người nhận ký xác nhận. Chuyển khoản định kỳ vào tài khoản Shop đúng hẹn.
              </p>
              <div className="pt-2 flex items-center text-xs font-black text-emerald-600">
                <span>Khấu trừ tự động không sai lệch</span>
                <ChevronRight size={14} className="ml-1" />
              </div>
            </div>

            <div className="hover-card-premium p-8 rounded-3xl bg-white border border-slate-200/90 shadow-soft-sm space-y-5">
              <div className="h-14 w-14 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-500 text-white flex items-center justify-center font-black shadow-md">
                <Navigation size={26} />
              </div>
              <h3 className="text-xl font-black text-slate-900">Định Vị GPS Độc Quyền</h3>
              <p className="text-xs text-slate-500 leading-relaxed font-medium">
                Khách mua hàng và Shop đều có thể theo dõi vị trí xe bưu tá trực tuyến trên bản đồ, giảm thiểu tối đa các cuộc gọi hối giao hàng.
              </p>
              <div className="pt-2 flex items-center text-xs font-black text-indigo-600">
                <span>Bản đồ cập nhật từng giây</span>
                <ChevronRight size={14} className="ml-1" />
              </div>
            </div>
          </div>
        </section>
      )}

      {/* METRICS SHOWCASE */}
      {!thongTinDon && (
        <section className="w-full bg-[#0B0F19] text-white py-16 border-y border-slate-800">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div className="space-y-1">
              <p className="text-4xl sm:text-5xl font-black text-blue-400 tracking-tight">99.8%</p>
              <p className="text-xs uppercase font-bold text-slate-400 tracking-wider">Đúng Hẹn Cam Kết</p>
            </div>
            <div className="space-y-1">
              <p className="text-4xl sm:text-5xl font-black text-cyan-400 tracking-tight">200K+</p>
              <p className="text-xs uppercase font-bold text-slate-400 tracking-wider">Kiện Hàng / Tháng</p>
            </div>
            <div className="space-y-1">
              <p className="text-4xl sm:text-5xl font-black text-emerald-400 tracking-tight">63</p>
              <p className="text-xs uppercase font-bold text-slate-400 tracking-wider">Tỉnh Thành Kết Nối</p>
            </div>
            <div className="space-y-1">
              <p className="text-4xl sm:text-5xl font-black text-amber-400 tracking-tight">24/7</p>
              <p className="text-xs uppercase font-bold text-slate-400 tracking-wider">Hỗ Trợ & Đối Soát</p>
            </div>
          </div>
        </section>
      )}

      {/* NEWS SECTION */}
      {!thongTinDon && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-10">
            <div>
              <span className="text-xs font-black uppercase tracking-wider text-blue-600">Bản Tin Vận Hành</span>
              <h3 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mt-1">Tin Tức & Thông Báo Mới</h3>
            </div>

            <Link
              to="/tin-tuc"
              className="inline-flex items-center gap-1.5 text-xs font-black text-blue-600 hover:text-blue-800 transition-colors self-start sm:self-auto"
            >
              <span>Xem Tất Cả Tin Tức</span>
              <ArrowRight size={14} />
            </Link>
          </div>

          {dangTaiTin ? (
            <div className="p-12 text-center text-slate-400 bg-white rounded-3xl border border-slate-200 text-sm">
              Đang tải danh sách bài viết...
            </div>
          ) : tinTheoDanhMuc.length === 0 ? (
            <div className="p-12 text-center text-slate-400 bg-white rounded-3xl border border-slate-200 text-sm">
              Chưa có bài viết mới.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {tinTheoDanhMuc.map((item) => (
                <Link
                  key={item.id}
                  to={`/tin-tuc/${item.id}`}
                  className="hover-card-premium bg-white rounded-3xl border border-slate-200/90 shadow-soft-sm overflow-hidden flex flex-col justify-between"
                >
                  <div>
                    <div className="relative h-48 bg-slate-100 overflow-hidden flex items-center justify-center">
                      <Package size={40} className="text-slate-300" />
                      {item.image_url && (
                        <img
                          src={resolveApiAssetUrl(item.image_url)}
                          alt={item.title}
                          onError={(e) => { e.currentTarget.style.display = 'none'; }}
                          className="absolute inset-0 h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      )}
                      <span className="absolute top-3.5 left-3.5 px-3 py-1 rounded-full bg-slate-900/80 backdrop-blur-md text-white font-bold text-[10px] uppercase">
                        {item.category || 'Tin tức'}
                      </span>
                    </div>

                    <div className="p-6 space-y-2">
                      <h4 className="font-bold text-slate-900 text-base line-clamp-2 hover:text-blue-600 transition-colors">
                        {item.title}
                      </h4>
                      <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed font-medium">
                        {item.summary}
                      </p>
                    </div>
                  </div>

                  <div className="px-6 pb-6 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400 font-medium">
                    <span>{new Date(item.created_at).toLocaleDateString('vi-VN')}</span>
                    <span className="font-black text-blue-600 flex items-center gap-1">
                      Chi tiết <ArrowRight size={12} />
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      )}

    </div>
  );
}
