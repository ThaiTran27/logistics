import { useState } from 'react';
import { Search, Package, MapPin, Truck, CheckCircle, Clock, AlertCircle, User, ShieldCheck, Zap, PhoneCall, Box } from 'lucide-react';

export default function TraCuuHanhTrinh() {
  const [maVanDon, setMaVanDon] = useState('');
  const [ketQua, setKetQua] = useState(null);
  const [dangTim, setDangTim] = useState(false);
  const [loi, setLoi] = useState('');

  const traCuuDonHang = async (e) => {
    e.preventDefault();
    if (!maVanDon.trim()) return;

    setDangTim(true);
    setLoi('');
    setKetQua(null);

    try {
      const res = await fetch(`http://localhost:5000/api/orders/track/${maVanDon.trim()}`);
      const data = await res.json();

      if (data.success) {
        setKetQua(data.data);
      } else {
        setLoi(data.message);
      }
    } catch (error) {
      setLoi('Lỗi kết nối máy chủ, vui lòng thử lại sau.');
    } finally {
      setDangTim(false);
    }
  };

  const renderTienDo = (status) => {
    const cacBuoc = [
      { id: 'pending', name: 'Chờ Xử Lý', icon: <Clock size={20} /> },
      { id: 'picking', name: 'Đang Lấy Hàng', icon: <Box size={20} /> },
      { id: 'in_warehouse', name: 'Đã Nhập Kho', icon: <MapPin size={20} /> },
      { id: 'delivering', name: 'Đang Giao Hàng', icon: <Truck size={20} /> },
      { id: 'completed', name: 'Giao Thành Công', icon: <CheckCircle size={20} /> }
    ];

    let mucHienTai = 0;
    if (status === 'picking') mucHienTai = 1;
    if (status === 'in_warehouse') mucHienTai = 2;
    if (status === 'delivering') mucHienTai = 3;
    if (status === 'completed') mucHienTai = 4;
    
    if (status === 'cancelled') {
      return (
        <div className="bg-red-50 text-red-600 p-6 rounded-2xl border border-red-100 flex items-center justify-center gap-3 font-bold text-lg mt-8">
          <AlertCircle size={24} /> Đơn hàng này đã bị hủy.
        </div>
      );
    }

    return (
      <div className="relative mt-16 mb-8">
        <div className="absolute left-0 top-1/2 transform -translate-y-1/2 w-full h-1.5 bg-gray-100 rounded-full z-0"></div>
        <div 
          className="absolute left-0 top-1/2 transform -translate-y-1/2 h-1.5 bg-gradient-to-r from-blue-400 to-blue-600 rounded-full z-0 transition-all duration-1000 ease-out"
          style={{ width: `${(mucHienTai / (cacBuoc.length - 1)) * 100}%` }}
        ></div>

        <div className="relative z-10 flex justify-between">
          {cacBuoc.map((buoc, index) => {
            const daHoanThanh = index <= mucHienTai;
            const dangHienTai = index === mucHienTai;
            
            return (
              <div key={buoc.id} className="flex flex-col items-center group">
                <div className={`w-14 h-14 rounded-full flex items-center justify-center shadow-sm transition-all duration-500 ${
                  daHoanThanh 
                    ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-blue-200' 
                    : 'bg-white text-gray-300 border-2 border-gray-100'
                } ${dangHienTai ? 'ring-4 ring-blue-100 scale-110 shadow-lg' : ''}`}>
                  {buoc.icon}
                </div>
                <p className={`mt-4 text-sm font-bold w-28 text-center transition-colors duration-300 ${daHoanThanh ? 'text-blue-700' : 'text-gray-400'}`}>
                  {buoc.name}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#F4F7FE] font-sans flex flex-col relative overflow-hidden text-gray-700">
      
      {/* BACKGROUND DECORATION */}
      <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-blue-100/50 to-transparent z-0 pointer-events-none"></div>
      <div className="absolute -top-40 -right-40 w-[500px] h-[500px] bg-blue-400/10 rounded-full blur-3xl z-0 pointer-events-none"></div>
      <div className="absolute top-40 -left-20 w-[300px] h-[300px] bg-indigo-400/10 rounded-full blur-3xl z-0 pointer-events-none"></div>

      {/* NAVBAR */}
      <nav className="w-full px-8 py-6 relative z-10 flex justify-between items-center max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-br from-blue-600 to-blue-500 p-2.5 rounded-xl shadow-lg shadow-blue-200">
            <Truck className="text-white" size={24} />
          </div>
          <span className="text-2xl font-black text-gray-900 tracking-tight">Smart Logistics</span>
        </div>
        <a 
          href="/dang-nhap" 
          className="flex items-center gap-2 bg-white text-blue-600 hover:text-white hover:bg-blue-600 font-bold px-6 py-2.5 rounded-full shadow-sm hover:shadow-lg hover:shadow-blue-200 border border-blue-50 transition-all duration-300 group"
        >
          <User size={18} className="text-blue-500 group-hover:text-white transition-colors" />
          Đăng Nhập Nội Bộ
        </a>
      </nav>

      {/* MAIN CONTENT */}
      <div className="flex-1 w-full max-w-5xl mx-auto px-4 flex flex-col items-center pt-10 relative z-10 pb-20">
        
        {/* HERO SECTION TÌM KIẾM */}
        <div className="w-full max-w-3xl text-center mb-16">
          <h1 className="text-5xl font-black text-gray-900 tracking-tight mb-5 leading-tight">
            Theo dõi hành trình <br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-500">Đơn hàng của bạn</span>
          </h1>
          <p className="text-gray-500 text-lg mb-10 font-medium px-10">
            Nhập mã vận đơn để xem chi tiết tiến độ giao nhận, thông tin tài xế và lịch sử trung chuyển theo thời gian thực.
          </p>
          
          <form onSubmit={traCuuDonHang} className="relative group">
            <div className="absolute inset-0 bg-blue-500/5 rounded-2xl blur-xl group-hover:bg-blue-500/10 transition-all duration-500"></div>
            <div className="relative flex shadow-[0_8px_30px_rgb(59,130,246,0.12)] rounded-2xl overflow-hidden bg-white p-2.5 border border-white focus-within:border-blue-100 transition-all">
              <div className="pl-4 flex items-center text-blue-400">
                <Search size={24} />
              </div>
              <input 
                type="text"
                className="flex-1 px-4 py-4 text-xl font-bold text-gray-700 outline-none uppercase placeholder:normal-case placeholder:font-medium placeholder:text-gray-400 bg-transparent"
                placeholder="Ví dụ: SL12345..."
                value={maVanDon}
                onChange={(e) => setMaVanDon(e.target.value)}
              />
              <button 
                type="submit"
                disabled={dangTim}
                className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white font-bold px-8 py-4 rounded-xl transition-all duration-300 flex items-center gap-2 shadow-md shadow-blue-200 disabled:opacity-70 text-lg"
              >
                {dangTim ? 'Đang xử lý...' : 'Tra Cứu Ngay'}
              </button>
            </div>
          </form>

          {loi && (
            <div className="mt-8 inline-flex items-center gap-2 bg-red-50 text-red-600 px-6 py-3.5 rounded-xl font-bold border border-red-100 animate-in fade-in slide-in-from-bottom-2">
              <AlertCircle size={20} /> {loi}
            </div>
          )}
        </div>

        {/* THẺ TÍNH NĂNG (Chỉ hiện khi chưa có kết quả) */}
        {!ketQua && !loi && !dangTim && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl opacity-80 hover:opacity-100 transition-opacity duration-500">
            <div className="bg-white/80 backdrop-blur-sm p-6 rounded-2xl border border-blue-50 text-center flex flex-col items-center shadow-sm">
              <div className="bg-blue-50 p-3 rounded-full text-blue-500 mb-4"><Zap size={24}/></div>
              <h3 className="font-bold text-gray-800 mb-2">Giao Hàng Hỏa Tốc</h3>
              <p className="text-sm text-gray-500">Mạng lưới phân phối rộng khắp giúp tối ưu hóa thời gian giao nhận.</p>
            </div>
            <div className="bg-white/80 backdrop-blur-sm p-6 rounded-2xl border border-blue-50 text-center flex flex-col items-center shadow-sm">
              <div className="bg-blue-50 p-3 rounded-full text-blue-500 mb-4"><ShieldCheck size={24}/></div>
              <h3 className="font-bold text-gray-800 mb-2">Bảo Hiểm 100%</h3>
              <p className="text-sm text-gray-500">Cam kết đền bù toàn bộ giá trị với các đơn hàng khai giá.</p>
            </div>
            <div className="bg-white/80 backdrop-blur-sm p-6 rounded-2xl border border-blue-50 text-center flex flex-col items-center shadow-sm">
              <div className="bg-blue-50 p-3 rounded-full text-blue-500 mb-4"><PhoneCall size={24}/></div>
              <h3 className="font-bold text-gray-800 mb-2">Hỗ Trợ 24/7</h3>
              <p className="text-sm text-gray-500">Đội ngũ chăm sóc khách hàng luôn sẵn sàng giải đáp mọi thắc mắc.</p>
            </div>
          </div>
        )}

        {/* KẾT QUẢ TRA CỨU */}
        {ketQua && (
          <div className="w-full bg-white rounded-[32px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-8 sm:p-12 border border-gray-50 animate-in fade-in slide-in-from-bottom-8 duration-700">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-gray-100 pb-8 mb-8 gap-6">
              <div>
                <p className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                  <Package size={16} /> Mã Vận Đơn
                </p>
                <h2 className="text-4xl font-black text-blue-600 tracking-tight">{ketQua.tracking_code}</h2>
              </div>
              <div className="text-left md:text-right bg-blue-50/50 p-4 rounded-2xl border border-blue-100/50">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Tiền Thu Hộ (COD)</p>
                <h3 className="text-2xl font-black text-red-500">{Number(ketQua.cod_amount).toLocaleString()} đ</h3>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
              <div className="bg-[#F8FAFC] p-7 rounded-[24px] border border-gray-100 group hover:border-blue-200 transition-colors">
                <p className="text-gray-400 font-bold mb-4 flex items-center gap-2 uppercase text-xs tracking-wider">
                  <MapPin size={16} className="text-blue-500 group-hover:scale-110 transition-transform"/> Thông Tin Nhận Hàng
                </p>
                <p className="font-black text-gray-800 text-xl mb-1">{ketQua.receiver_name}</p>
                <p className="text-blue-600 font-bold mb-3">{ketQua.receiver_phone}</p>
                <p className="text-gray-600 leading-relaxed font-medium bg-white p-3 rounded-xl shadow-sm inline-block w-full">{ketQua.receiver_address}</p>
              </div>
              
              <div className="bg-[#F8FAFC] p-7 rounded-[24px] border border-gray-100 group hover:border-blue-200 transition-colors">
                <p className="text-gray-400 font-bold mb-4 flex items-center gap-2 uppercase text-xs tracking-wider">
                  <Clock size={16} className="text-blue-500 group-hover:scale-110 transition-transform"/> Chi Tiết Giao Dịch
                </p>
                <div className="space-y-4">
                  <div className="flex justify-between items-center bg-white p-3 rounded-xl shadow-sm">
                    <span className="text-gray-500 font-medium">Ngày tạo đơn:</span>
                    <span className="font-bold text-gray-800">
                      {new Date(ketQua.created_at).toLocaleDateString('vi-VN')}
                    </span>
                  </div>
                  <div className="flex justify-between items-center bg-white p-3 rounded-xl shadow-sm">
                    <span className="text-gray-500 font-medium">Đối soát Shop:</span>
                    <span className={`font-bold px-3 py-1 rounded-lg text-sm ${ketQua.is_cod_paid ? 'bg-green-50 text-green-600' : 'bg-orange-50 text-orange-600'}`}>
                      {ketQua.is_cod_paid ? 'Đã thanh toán' : 'Đang ghi nhận nợ'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* THANH TIẾN ĐỘ THỜI GIAN THỰC */}
            <div className="mt-8 bg-white border border-gray-100 p-8 rounded-[24px] shadow-sm">
              <h4 className="font-black text-gray-800 text-xl mb-4 text-center">Tiến độ giao hàng</h4>
              {renderTienDo(ketQua.status)}
            </div>

          </div>
        )}

      </div>
    </div>
  );
}