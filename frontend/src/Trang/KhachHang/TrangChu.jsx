import { useState } from 'react';
import { Search, Package, MapPin, Truck, CheckCircle, Clock, User, Phone, XCircle, AlertCircle, Box, Camera, Navigation, Calculator, Store, Globe, Headphones, ChevronRight, FileText, Download, Play, MessageCircle, Users, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function TraCuuHanhTrinh() {
  const [maVanDon, setMaVanDon] = useState('');
  const [thongTinDon, setThongTinDon] = useState(null);
  const [loi, setLoi] = useState('');
  const [dangTim, setDangTim] = useState(false);
  const [tabTraCuu, setTabTraCuu] = useState('van-don'); 
  
  const navigate = useNavigate();

  const handleSearchTabAction = (action) => {
    switch (action) {
      case 'tracking':
        setTabTraCuu('van-don');
        break;
      case 'pricing':
        navigate('/bang-gia');
        break;
      case 'agency':
        navigate('/tim-buu-cuc');
        break;
      case 'service':
        navigate('/dich-vu');
        break;
      default:
        setTabTraCuu('van-don');
    }
  };

  const xuLyTraCuu = async (e) => {
    e.preventDefault();
    if (!maVanDon.trim()) {
      setLoi('Vui lòng nhập mã vận đơn!');
      return;
    }

    setLoi('');
    setDangTim(true);
    setThongTinDon(null);

    try {
      const res = await fetch(`http://localhost:5000/api/orders/track/${maVanDon.trim()}`);
      const data = await res.json();

      if (data.success) {
        setThongTinDon(data.data);
      } else {
        setLoi(data.message || 'Không tìm thấy đơn hàng. Vui lòng kiểm tra lại mã!');
      }
    } catch (error) {
      setLoi('Lỗi kết nối máy chủ. Vui lòng thử lại sau!');
    } finally {
      setDangTim(false);
    }
  };

  const cacBuocHanhTrinh = [
    { id: 'pending', ten: 'Chờ Lấy Hàng', desc: 'Đơn hàng đã được Shop tạo và đang chờ hệ thống AI phân tuyến.', icon: Clock },
    { id: 'picking', ten: 'Lộ Trình Lấy Hàng', desc: 'Tài xế đã nhận đơn và đang di chuyển đến địa chỉ Shop để lấy hàng.', icon: Truck },
    { id: 'in_warehouse', ten: 'Đã Nhập Kho', desc: 'Hàng đã được đưa về kho trung tâm, chờ điều phối tuyến giao.', icon: Box },
    { id: 'delivering', ten: 'Đang Giao Hàng', desc: 'Tài xế đang trên đường đi giao hàng đến địa chỉ của bạn.', icon: Navigation },
    { id: 'completed', ten: 'Giao Thành Công', desc: 'Đơn hàng đã được giao tận tay người nhận.', icon: CheckCircle }
  ];

  const layTrangThaiBuoc = (trangThaiHienTai, idBuoc) => {
    const thuTu = ['pending', 'picking', 'in_warehouse', 'delivering', 'completed'];
    if (trangThaiHienTai === 'cancelled' || trangThaiHienTai === 'returning') return 'that-bai';
    
    const viTriHienTai = thuTu.indexOf(trangThaiHienTai);
    const viTriBuoc = thuTu.indexOf(idBuoc);

    if (viTriBuoc < viTriHienTai) return 'da-qua';
    if (viTriBuoc === viTriHienTai) return 'hien-tai';
    return 'chua-toi';
  };

  return (
    <div className="bg-[#F2F4F7] font-sans text-slate-800">
      <section className="relative w-full h-[450px] bg-gradient-to-r from-blue-900 via-blue-800 to-sky-700 flex flex-col justify-center overflow-hidden">
        <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
        <div className="absolute right-0 bottom-0 w-1/2 h-full bg-gradient-to-l from-sky-400/30 to-transparent"></div>

        <div className="relative z-10 px-4 md:px-12 max-w-7xl mx-auto w-full -mt-20">
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-black text-white mb-2 tracking-tight drop-shadow-lg outline-title">
            Dịch vụ phát tận tay xác thực
          </h2>
          <h3 className="text-3xl md:text-4xl lg:text-5xl font-black text-white mb-8 tracking-tight drop-shadow-lg">
            Giao đúng người - An tâm tuyệt đối
          </h3>

          <div className="flex flex-wrap gap-3">
            <span className="bg-white/10 backdrop-blur-md border border-white/30 text-white px-5 py-2 rounded-full text-sm font-bold shadow-md flex items-center gap-2">
              <CheckCircle size={16} className="text-sky-300" /> Xác thực đúng người nhận
            </span>
            <span className="bg-white/10 backdrop-blur-md border border-white/30 text-white px-5 py-2 rounded-full text-sm font-bold shadow-md flex items-center gap-2">
              <ShieldCheck size={16} className="text-sky-300" /> Bảo mật tài liệu quan trọng
            </span>
            <span className="bg-white/10 backdrop-blur-md border border-white/30 text-white px-5 py-2 rounded-full text-sm font-bold shadow-md flex items-center gap-2">
              <MessageCircle size={16} className="text-sky-300" /> Thông báo SMS khi giao hàng
            </span>
          </div>
        </div>
      </section>

      <section className="relative z-20 px-4 -mt-24 w-full max-w-5xl mx-auto mb-16">
        <div className="flex justify-end mb-[-10px] relative z-30 pr-8">
          <div
            onClick={() => navigate('/dich-vu')}
            className="bg-slate-800 text-white flex items-center rounded-t-xl px-4 py-2 cursor-pointer shadow-lg hover:bg-blue-600 transition-colors"
          >
            <div className="bg-blue-500 rounded p-1 mr-2"><Box size={16} /></div>
            <span className="font-bold text-sm">SMART - Tạo đơn nhanh &rarr;</span>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-[0_15px_50px_rgba(0,0,0,0.1)] overflow-hidden border border-slate-100">
          <div className="flex border-b border-slate-200">
            <div className="flex gap-1 px-4 py-3 border-r border-slate-200 items-center">
              <button
                onClick={() => setTabTraCuu('van-don')}
                className={`font-bold px-6 py-2 text-sm rounded transition-colors ${tabTraCuu === 'van-don' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                Tra cứu
              </button>
              <button
                onClick={() => navigate('/dich-vu')}
                className="text-slate-600 font-bold px-6 py-2 text-sm hover:bg-slate-50 rounded transition-colors"
              >
                Dịch vụ
              </button>
            </div>
          </div>

          <div className="flex border-b border-slate-100 bg-slate-50/50 overflow-x-auto custom-scrollbar">
            <button
              onClick={() => setTabTraCuu('van-don')}
              className={`min-w-max px-6 py-4 font-bold text-sm flex items-center gap-2 transition-all ${tabTraCuu === 'van-don' ? 'bg-white text-blue-600 border-t-2 border-t-blue-600 shadow-[0_-2px_0_0_#2563EB]' : 'text-slate-500 hover:text-blue-600'}`}
            >
              <FileText size={16} /> Tra cứu vận đơn
            </button>
            <button
              onClick={() => navigate('/dich-vu')}
              className="min-w-max px-6 py-4 font-bold text-sm text-slate-500 hover:text-blue-600 flex items-center gap-2"
            >
              <MapPin size={16} /> Tra cứu đa hành trình
            </button>
            <button
              onClick={() => navigate('/bang-gia')}
              className="min-w-max px-6 py-4 font-bold text-sm text-slate-500 hover:text-blue-600 flex items-center gap-2"
            >
              <Calculator size={16} /> Ước tính cước phí
            </button>
            <button
              onClick={() => navigate('/tim-buu-cuc')}
              className="min-w-max px-6 py-4 font-bold text-sm text-slate-500 hover:text-blue-600 flex items-center gap-2"
            >
              <Store size={16} /> Tìm kiếm bưu cục
            </button>
            <button
              onClick={() => navigate('/dich-vu')}
              className="min-w-max px-6 py-4 font-bold text-sm text-slate-500 hover:text-blue-600 flex items-center gap-2 ml-auto"
            >
              Câu hỏi thường gặp FAQs
            </button>
          </div>

          <div className="p-8 bg-white">
            {tabTraCuu === 'van-don' && (
              <div className="flex flex-col md:flex-row gap-12">
                <div className="flex-1">
                  <h4 className="font-bold text-slate-800 text-lg mb-1">Mã phiếu gửi</h4>
                  <p className="text-xs text-slate-500 mb-4">(Tra nhiều bill bằng cách thêm dấu phẩy giữa các bill)</p>

                  <form onSubmit={xuLyTraCuu}>
                    <input
                      type="text"
                      placeholder="VD : SL123456VN..."
                      className="w-full border-b-2 border-slate-200 pb-3 outline-none focus:border-blue-600 transition-colors text-lg font-bold text-slate-800 uppercase placeholder:normal-case placeholder:font-normal mb-6"
                      value={maVanDon}
                      onChange={(e) => setMaVanDon(e.target.value.toUpperCase())}
                    />

                    <div className="flex items-center justify-between border border-slate-300 bg-[#F9F9F9] rounded p-3 w-64 mb-6 shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="w-6 h-6 border-2 border-slate-300 rounded-sm bg-white cursor-pointer hover:border-blue-500"></div>
                        <span className="text-sm font-medium text-slate-700">Tôi không phải người máy</span>
                      </div>
                      <div className="flex flex-col items-center">
                        <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/a/ad/RecaptchaLogo.svg/1200px-RecaptchaLogo.svg.png" alt="reCAPTCHA" className="h-6 opacity-70" />
                        <span className="text-[8px] text-slate-500 mt-1">Bảo mật</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <button
                        type="submit"
                        disabled={dangTim}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded transition-colors disabled:opacity-70 flex items-center justify-center gap-2 uppercase text-sm tracking-wide"
                      >
                        {dangTim ? 'ĐANG XỬ LÝ...' : 'TRA CỨU →'}
                      </button>

                      {loi && (
                        <span className="text-red-500 text-sm font-bold flex items-center gap-1">
                          <AlertCircle size={16} /> {loi}
                        </span>
                      )}
                    </div>
                  </form>
                </div>

                <div className="hidden md:flex w-1/3 items-center justify-center relative">
                  <div className="w-full aspect-video bg-blue-50 rounded-2xl border border-blue-100 flex flex-col items-center justify-center text-blue-300 relative overflow-hidden">
                    <Truck size={64} className="mb-2 opacity-50 absolute right-4 bottom-4" />
                    <Package size={48} className="absolute left-4 top-4 opacity-50" />
                    <MapPin size={32} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-20" />
                    <p className="font-bold text-blue-400 z-10 bg-white/80 px-3 py-1 rounded-full text-xs border border-blue-100 backdrop-blur-sm">Giao Hàng Siêu Tốc</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <main className="flex-1 w-full max-w-5xl mx-auto px-4 pb-10">
        {thongTinDon && (
          <div className="w-full bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden animate-in fade-in slide-in-from-bottom-8 duration-700">
            <div className="p-6 md:p-8 border-b border-slate-200 bg-slate-50/50">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Mã Phiếu Gửi</p>
                  <h3 className="text-3xl font-black text-blue-600 tracking-tight">{thongTinDon.tracking_code}</h3>
                </div>
                <div className={`px-5 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 border shadow-sm ${
                  thongTinDon.status === 'completed' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' :
                  (thongTinDon.status === 'cancelled' || thongTinDon.status === 'returning') ? 'bg-red-50 text-red-600 border-red-200' :
                  'bg-sky-50 text-sky-600 border-sky-200'
                }`}>
                  {thongTinDon.status === 'completed' ? <CheckCircle size={18} /> :
                    (thongTinDon.status === 'cancelled' || thongTinDon.status === 'returning') ? <XCircle size={18} /> : <Truck size={18} />}

                  {thongTinDon.status === 'pending' ? 'Chờ Lấy Hàng' :
                    thongTinDon.status === 'picking' ? 'Lộ Trình Lấy Hàng' :
                    thongTinDon.status === 'in_warehouse' ? 'Đã Nhập Kho' :
                    thongTinDon.status === 'delivering' ? 'Đang Giao Hàng' :
                    thongTinDon.status === 'completed' ? 'Giao Thành Công' :
                    thongTinDon.status === 'returning' ? 'Đang Hoàn Hàng' : 'Đã Hủy'}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex gap-4 items-start bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                  <div className="text-slate-400 shrink-0 mt-0.5"><User size={22} /></div>
                  <div>
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Người Nhận</p>
                    <p className="font-bold text-slate-800 text-sm">{thongTinDon.receiver_name}</p>
                    <p className="text-xs font-medium text-slate-500 mt-1 flex items-center gap-1"><Phone size={12} /> {thongTinDon.receiver_phone}</p>
                  </div>
                </div>
                <div className="flex gap-4 items-start bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                  <div className="text-slate-400 shrink-0 mt-0.5"><MapPin size={22} /></div>
                  <div>
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Địa Chỉ Nhận</p>
                    <p className="font-medium text-slate-700 text-xs leading-relaxed">{thongTinDon.receiver_address}</p>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                <div className="bg-white px-5 py-2.5 rounded-lg border border-slate-200 shadow-sm flex items-center gap-3">
                  <span className="text-[11px] font-bold text-slate-500 uppercase">Tiền Thu Hộ (COD)</span>
                  <span className="font-black text-red-500 text-lg">{Number(thongTinDon.cod_amount).toLocaleString()}đ</span>
                </div>
                <div className="bg-white px-5 py-2.5 rounded-lg border border-slate-200 shadow-sm flex items-center gap-3">
                  <span className="text-[11px] font-bold text-slate-500 uppercase">Phí Vận Chuyển</span>
                  <span className="font-black text-slate-800 text-lg">{Number(thongTinDon.shipping_fee).toLocaleString()}đ</span>
                </div>
              </div>
            </div>

            <div className="p-6 md:p-10 bg-white">
              {(thongTinDon.status === 'delivering' || thongTinDon.status === 'picking') && (
                <div className="bg-gradient-to-r from-blue-50 to-sky-50 border border-blue-100 p-5 rounded-xl mb-8 flex items-center justify-between shadow-sm">
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <img
                        src={`https://ui-avatars.com/api/?name=${thongTinDon.shipper_name || 'S'}&background=2563EB&color=fff&size=56`}
                        className="w-12 h-12 rounded-full border-2 border-white shadow-sm"
                        alt="Shipper Avatar"
                      />
                      <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full animate-pulse"></span>
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-0.5">
                        {thongTinDon.status === 'picking' ? 'Bưu tá đang tới lấy hàng' : 'Bưu tá đang phát hàng'}
                      </p>
                      <p className="font-bold text-slate-800 text-base">{thongTinDon.shipper_name || 'Bưu tá khu vực'}</p>
                    </div>
                  </div>
                  <a href={`tel:19008095`} className="bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-full shadow-md transition-colors flex items-center gap-2">
                    <Phone size={18} className="fill-current" />
                  </a>
                </div>
              )}

              <h4 className="text-base font-black text-slate-800 mb-8 uppercase tracking-wide border-l-4 border-blue-600 pl-3">
                Chi Tiết Định Tuyến
              </h4>

              <div className="relative pl-2">
                {(thongTinDon.status !== 'cancelled' && thongTinDon.status !== 'returning') && (
                  <div className="absolute left-[29px] top-4 bottom-8 w-0.5 bg-slate-200 -z-10"></div>
                )}

                {(thongTinDon.status === 'cancelled' || thongTinDon.status === 'returning') ? (
                  <div className="flex gap-6 items-start relative pb-8">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-red-100 text-red-600 shadow-sm border-2 border-white">
                      <XCircle size={20} />
                    </div>
                    <div className="pt-1">
                      <p className="font-bold text-red-600 text-base">Phát Thất Bại</p>
                      <p className="text-sm text-slate-500 mt-1">Lý do: <span className="font-medium text-red-600">{thongTinDon.fail_reason || 'Khách hàng từ chối nhận.'}</span></p>
                    </div>
                  </div>
                ) : (
                  cacBuocHanhTrinh.map((buoc, index) => {
                    const trangThai = layTrangThaiBuoc(thongTinDon.status, buoc.id);
                    const Icon = buoc.icon;

                    let mauNenIcon = 'bg-slate-100 text-slate-400';
                    let mauChu = 'text-slate-400';

                    if (trangThai === 'da-qua') {
                      mauNenIcon = 'bg-blue-600 text-white';
                      mauChu = 'text-slate-800';
                    } else if (trangThai === 'hien-tai') {
                      mauNenIcon = 'bg-white text-blue-600 border-2 border-blue-600';
                      mauChu = 'text-blue-600';
                    }

                    return (
                      <div key={buoc.id} className="flex gap-5 items-start relative pb-8 last:pb-0">
                        {trangThai === 'da-qua' && index !== cacBuocHanhTrinh.length - 1 && (
                          <div className="absolute left-[21px] top-10 bottom-[-8px] w-0.5 bg-blue-600 -z-10"></div>
                        )}

                        <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-all ${mauNenIcon}`}>
                          <Icon size={18} />
                        </div>
                        <div className="pt-1.5 flex-1">
                          <p className={`font-bold text-base transition-colors ${mauChu}`}>{buoc.ten}</p>

                          {trangThai === 'hien-tai' && (
                            <div className="mt-1.5">
                              <p className="text-sm text-slate-500 mb-2">{buoc.desc}</p>
                              <p className="text-[11px] font-bold animate-pulse text-blue-600 bg-blue-50 inline-flex items-center px-2.5 py-1 rounded border border-blue-100 uppercase tracking-wide">
                                Đang xử lý
                              </p>
                            </div>
                          )}

                          {trangThai === 'da-qua' && (
                            <p className="text-[11px] font-bold text-emerald-600 mt-1 uppercase tracking-wide">
                              Đã hoàn tất
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {thongTinDon.proof_image && (
                <div className="mt-8 pt-8 border-t border-slate-100 animate-in zoom-in-95">
                  <h4 className="text-sm font-bold text-slate-800 mb-4 uppercase tracking-wide border-l-4 border-blue-600 pl-3">
                    Minh Chứng Giao Nhận
                  </h4>
                  <div className="bg-slate-50 p-2 rounded-lg border border-slate-200 inline-block">
                    <img
                      src={`http://localhost:5000${thongTinDon.proof_image}`}
                      alt="Minh chứng giao hàng"
                      className="w-full max-w-xs object-cover rounded"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {!thongTinDon && (
        <>
          <section className="max-w-5xl mx-auto px-4 w-full mb-16 animate-in fade-in duration-700">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl md:text-2xl font-black text-slate-800">Tin tức Smart Logistics</h3>
              <div className="hidden md:flex gap-6 text-sm font-bold border-b border-slate-200">
                <span className="text-blue-600 border-b-2 border-blue-600 pb-2 cursor-pointer">TẤT CẢ</span>
                <span className="text-slate-500 hover:text-blue-600 pb-2 cursor-pointer">TIN KHUYẾN MÃI</span>
                <span className="text-slate-500 hover:text-blue-600 pb-2 cursor-pointer">HƯỚNG DẪN SỬ DỤNG</span>
              </div>
              <button className="bg-blue-600 text-white text-xs font-bold px-4 py-2 rounded">XEM TẤT CẢ</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden group cursor-pointer">
                <div className="h-64 bg-slate-100 overflow-hidden">
                  <img src="https://images.unsplash.com/photo-1586528116311-ad8ed7c663be?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80" alt="News" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                </div>
                <div className="p-6">
                  <h4 className="font-bold text-lg text-slate-800 mb-2 group-hover:text-blue-600 transition-colors">Smart Logistics lập kỷ lục với chuỗi 4 giải vàng tại STEVIE AWARDS</h4>
                  <p className="text-sm text-slate-500 line-clamp-2">Với 4 giải Vàng trên tổng số 4 đề cử, Smart Logistics vinh dự là doanh nghiệp Việt Nam đạt thành tích cao nhất...</p>
                </div>
              </div>
              <div className="flex flex-col gap-4">
                {[1, 2, 3].map(item => (
                  <div key={item} className="bg-white p-3 rounded-xl shadow-sm border border-slate-200 flex gap-4 group cursor-pointer">
                    <div className="w-32 h-24 shrink-0 bg-slate-100 rounded-lg overflow-hidden">
                      <img src={`https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&q=80`} alt="News" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-slate-800 mb-1 group-hover:text-blue-600 transition-colors line-clamp-2">SMART LOGISTICS GIẢM 53,7% CHI PHÍ TIỀN ĐIỆN NHỜ HỆ THỐNG BESS</h4>
                      <p className="text-[11px] text-slate-400 mb-1">10 Tháng 9, 2026</p>
                      <p className="text-xs text-slate-500 line-clamp-1">Không chỉ tối ưu hành trình vận chuyển...</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="w-full bg-blue-600 py-10 mb-16">
            <div className="max-w-5xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-8">
              <div className="text-white text-center md:text-left">
                <p className="font-bold mb-2 uppercase tracking-wide">Mạng lưới bưu cục<br />trên 63 tỉnh thành</p>
                <div className="flex gap-2 justify-center md:justify-start">
                  <div className="bg-black text-white text-xs px-3 py-1.5 rounded flex items-center gap-1 cursor-pointer hover:bg-slate-800"><Package size={14} /> App Store</div>
                  <div className="bg-black text-white text-xs px-3 py-1.5 rounded flex items-center gap-1 cursor-pointer hover:bg-slate-800"><Play size={14} /> Google Play</div>
                </div>
              </div>
              <div className="flex items-center gap-4 text-white">
                <Users size={48} className="opacity-80" />
                <div>
                  <h3 className="text-3xl font-black">990.870+</h3>
                  <p className="text-sm font-bold uppercase tracking-wider opacity-80">Khách hàng tin dùng</p>
                </div>
              </div>
              <div className="flex items-center gap-4 text-white">
                <Box size={48} className="opacity-80" />
                <div>
                  <h3 className="text-3xl font-black">483.870+</h3>
                  <p className="text-sm font-bold uppercase tracking-wider opacity-80">Đơn hàng đang vận chuyển</p>
                </div>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}