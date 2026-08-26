import { useState, useEffect } from 'react';
import { MapPin, PhoneCall, Package, CheckCircle, XCircle, LogOut, Navigation, Wallet, UserCircle, Bike, Clock, AlertCircle } from 'lucide-react';

export default function BanDoGiaoHang() {
  const [donHang, setDonHang] = useState([]);
  const [tabHienTai, setTabHienTai] = useState('donhang'); // 'donhang' hoặc 'canhan'
  
  const taiXeId = localStorage.getItem('user_id');
  const tenTaiXe = localStorage.getItem('user_name');

  const taiDuLieu = async () => {
    if (!taiXeId) return;
    try {
      const res = await fetch(`http://localhost:5000/api/orders/shipper/${taiXeId}`);
      const data = await res.json();
      if (data.success) setDonHang(data.data);
    } catch (error) {
      console.error("Lỗi tải dữ liệu:", error);
    }
  };

  useEffect(() => { taiDuLieu(); }, []);

  const capNhatTrangThai = async (orderId, trangThaiMoi) => {
    const xacNhan = window.confirm(
      trangThaiMoi === 'completed' ? 'Xác nhận ĐÃ GIAO THÀNH CÔNG và THU TIỀN?' :
      trangThaiMoi === 'cancelled' ? 'Xác nhận GIAO THẤT BẠI (Hoàn hàng)?' :
      'Bắt đầu tuyến đường giao hàng này?'
    );
    
    if (!xacNhan) return;

    await fetch(`http://localhost:5000/api/orders/${orderId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: trangThaiMoi })
    });
    taiDuLieu(); 
  };

  const dangXuat = () => {
    const xacNhan = window.confirm("Bạn có muốn đăng xuất khỏi ca làm việc?");
    if (xacNhan) {
      localStorage.clear();
      window.location.href = '/'; 
    }
  };

  // Tính toán nhanh thu nhập
  const donThanhCong = donHang.filter(d => d.status === 'completed');
  const tongTienThuHo = donThanhCong.reduce((sum, item) => sum + Number(item.cod_amount), 0);

  return (
    // Bọc toàn bộ trong một container giả lập màn hình điện thoại
    <div className="bg-slate-100 min-h-screen flex justify-center font-sans text-slate-800">
      <div className="w-full max-w-md bg-white min-h-screen shadow-2xl relative overflow-hidden flex flex-col">
        
        {/* TAB 1: DANH SÁCH ĐƠN HÀNG */}
        {tabHienTai === 'donhang' && (
          <div className="flex-1 overflow-y-auto pb-24">
            {/* Header cong mềm mại */}
            <div className="bg-gradient-to-b from-orange-500 to-orange-600 px-6 pt-12 pb-8 rounded-b-[40px] shadow-lg relative z-10">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <p className="text-orange-100 text-sm font-medium">Bắt đầu ca làm việc,</p>
                  <h2 className="text-2xl font-black text-white truncate">{tenTaiXe} 👋</h2>
                </div>
                <div className="bg-white/20 p-2.5 rounded-2xl backdrop-blur-sm border border-white/20">
                  <Bike className="text-white" size={24} />
                </div>
              </div>
              
              <div className="bg-white p-4 rounded-2xl shadow-sm flex items-center justify-between mt-2">
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase">Đơn cần giao</p>
                  <p className="text-2xl font-black text-orange-600">{donHang.filter(d => d.status === 'picking' || d.status === 'delivering').length}</p>
                </div>
                <div className="h-10 w-px bg-slate-200"></div>
                <div className="text-right">
                  <p className="text-xs font-bold text-slate-400 uppercase">Đã thu COD</p>
                  <p className="text-xl font-black text-emerald-500">{tongTienThuHo.toLocaleString()} đ</p>
                </div>
              </div>
            </div>

            {/* Danh sách đơn hàng */}
            <div className="px-5 pt-6 space-y-5">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-black text-lg text-slate-800">Tuyến đường hôm nay</h3>
                <span className="bg-orange-100 text-orange-600 text-xs font-bold px-3 py-1 rounded-full">
                  Tổng: {donHang.length} đơn
                </span>
              </div>

              {donHang.map(don => (
                <div key={don.id} className="bg-white rounded-[20px] shadow-sm border border-slate-100 overflow-hidden relative group">
                  {/* Dải màu trạng thái */}
                  <div className={`absolute top-0 left-0 w-1.5 h-full ${
                    don.status === 'picking' ? 'bg-blue-500' :
                    don.status === 'delivering' ? 'bg-orange-500' :
                    don.status === 'completed' ? 'bg-emerald-500' : 'bg-red-500'
                  }`}></div>

                  <div className="p-5 pl-6">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <span className="font-black text-lg text-slate-800">{don.tracking_code}</span>
                        <div className="text-xs font-bold mt-1 uppercase tracking-wider">
                          {don.status === 'picking' && <span className="text-blue-500 flex items-center gap-1"><Package size={12}/> Đi lấy hàng</span>}
                          {don.status === 'delivering' && <span className="text-orange-500 flex items-center gap-1"><Bike size={12}/> Đang đi giao</span>}
                          {don.status === 'completed' && <span className="text-emerald-500 flex items-center gap-1"><CheckCircle size={12}/> Thành công</span>}
                          {don.status === 'cancelled' && <span className="text-red-500 flex items-center gap-1"><AlertCircle size={12}/> Đã hủy</span>}
                        </div>
                      </div>
                      <a href={`tel:${don.receiver_phone}`} className="bg-green-50 text-green-600 p-2.5 rounded-full hover:bg-green-100 transition-colors">
                        <PhoneCall size={20} />
                      </a>
                    </div>
                    
                    <div className="space-y-3 mb-5">
                      <div className="flex items-start gap-3">
                        <UserCircle size={18} className="text-slate-400 mt-0.5" />
                        <div>
                          <p className="text-sm font-bold text-slate-700">{don.receiver_name}</p>
                          <p className="text-xs text-slate-500">{don.receiver_phone}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <MapPin size={18} className="text-orange-400 mt-0.5" />
                        <p className="text-sm font-medium text-slate-600 leading-snug">{don.receiver_address}</p>
                      </div>
                      <div className="flex items-start gap-3 bg-red-50 p-3 rounded-xl border border-red-100">
                        <Wallet size={18} className="text-red-500 mt-0.5" />
                        <div>
                          <p className="text-xs font-bold text-red-400 uppercase tracking-wider">Thu hộ COD</p>
                          <p className="text-lg font-black text-red-600">{Number(don.cod_amount).toLocaleString()} VNĐ</p>
                        </div>
                      </div>
                    </div>

                    {/* Các nút hành động */}
                    <div className="grid grid-cols-2 gap-3">
                      {don.status === 'picking' && (
                        <button 
                          onClick={() => capNhatTrangThai(don.id, 'delivering')}
                          className="col-span-2 bg-blue-500 hover:bg-blue-600 text-white font-bold py-3.5 rounded-xl transition-all shadow-md shadow-blue-200 flex justify-center items-center gap-2"
                        >
                          <Package size={18} /> Đã Lấy Hàng
                        </button>
                      )}
                      
                      {don.status === 'delivering' && (
                        <>
                          <button 
                            onClick={() => capNhatTrangThai(don.id, 'completed')}
                            className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3.5 rounded-xl transition-all shadow-md shadow-emerald-200 flex flex-col items-center justify-center gap-1"
                          >
                            <CheckCircle size={18} /> <span className="text-xs">Giao Thành Công</span>
                          </button>
                          <button 
                            onClick={() => capNhatTrangThai(don.id, 'cancelled')}
                            className="bg-red-50 hover:bg-red-100 text-red-500 font-bold py-3.5 rounded-xl transition-all border border-red-100 flex flex-col items-center justify-center gap-1"
                          >
                            <XCircle size={18} /> <span className="text-xs">Báo Thất Bại</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              
              {donHang.length === 0 && (
                <div className="text-center flex flex-col items-center justify-center py-12">
                  <div className="bg-slate-100 p-4 rounded-full text-slate-300 mb-4">
                    <Clock size={48} />
                  </div>
                  <p className="font-bold text-slate-500">Bạn đang trong trạng thái nghỉ.</p>
                  <p className="text-sm text-slate-400">Chưa có đơn hàng nào được phân công!</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: CÁ NHÂN */}
        {tabHienTai === 'canhan' && (
          <div className="flex-1 overflow-y-auto bg-slate-50 pb-24">
            <div className="bg-white p-6 pt-12 rounded-b-[32px] shadow-sm text-center">
              <div className="w-24 h-24 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-white shadow-md">
                <UserCircle size={48} className="text-orange-500" />
              </div>
              <h2 className="text-2xl font-black text-slate-800">{tenTaiXe}</h2>
              <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-1">Đối tác Tài xế</p>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                <p className="font-bold text-slate-800 mb-4 flex items-center gap-2"><Wallet className="text-orange-500" size={20}/> Ví Thu Hộ (COD)</p>
                <div className="bg-orange-50 p-4 rounded-xl text-center">
                  <p className="text-3xl font-black text-orange-600">{tongTienThuHo.toLocaleString()} <span className="text-lg">đ</span></p>
                  <p className="text-xs text-orange-400 font-bold mt-1">Cần nộp lại cho Kế toán cuối ngày</p>
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 space-y-4">
                <p className="font-bold text-slate-800 mb-2">Thống kê ca làm việc</p>
                <div className="flex justify-between items-center py-2 border-b border-slate-50">
                  <span className="text-slate-500 font-medium">Giao thành công</span>
                  <span className="font-black text-emerald-500">{donThanhCong.length} đơn</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-slate-500 font-medium">Đơn thất bại (Hoàn)</span>
                  <span className="font-black text-red-500">{donHang.filter(d => d.status === 'cancelled').length} đơn</span>
                </div>
              </div>

              <button 
                onClick={dangXuat}
                className="w-full bg-white border-2 border-red-100 text-red-500 hover:bg-red-50 font-bold py-4 rounded-2xl transition-all shadow-sm flex items-center justify-center gap-2 mt-4"
              >
                <LogOut size={20} /> Đăng Xuất Ca Làm Việc
              </button>
            </div>
          </div>
        )}

        {/* BOTTOM NAVIGATION (Thanh điều hướng dưới đáy) */}
        <div className="absolute bottom-0 left-0 w-full bg-white border-t border-slate-100 flex justify-around items-center pb-6 pt-3 px-2 shadow-[0_-10px_20px_rgba(0,0,0,0.03)] z-50">
          <button 
            onClick={() => setTabHienTai('donhang')}
            className={`flex flex-col items-center gap-1 w-20 transition-colors ${tabHienTai === 'donhang' ? 'text-orange-500' : 'text-slate-400'}`}
          >
            <Navigation size={24} className={tabHienTai === 'donhang' ? 'fill-orange-100' : ''} />
            <span className="text-[10px] font-bold uppercase tracking-wider">Đơn Hàng</span>
          </button>
          
          <button 
            onClick={() => setTabHienTai('canhan')}
            className={`flex flex-col items-center gap-1 w-20 transition-colors ${tabHienTai === 'canhan' ? 'text-orange-500' : 'text-slate-400'}`}
          >
            <UserCircle size={24} className={tabHienTai === 'canhan' ? 'fill-orange-100' : ''} />
            <span className="text-[10px] font-bold uppercase tracking-wider">Cá Nhân</span>
          </button>
        </div>

      </div>
    </div>
  );
}