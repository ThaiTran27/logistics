import { useState, useEffect } from 'react';
import { Store, PackagePlus, ListOrdered, Wallet, LogOut, User, Phone, MapPin, DollarSign, Clock, Truck, CheckCircle, AlertCircle, PackageSearch, Scale, Calculator, Eye, X, Box, MapPinned } from 'lucide-react';

export default function QuanLyDonHang() {
  const [donHang, setDonHang] = useState([]);
  const [form, setForm] = useState({ 
    receiver_name: '', 
    receiver_phone: '', 
    receiver_address: '', 
    cod_amount: '',
    weight_kg: '1',
    item_value: '0',
    distance_km: '5',
    is_remote_area: false
  });
  
  const [shippingFee, setShippingFee] = useState(15000);
  const [tabHienTai, setTabHienTai] = useState('taodon');
  
  // State quản lý xem chi tiết hành trình đơn hàng
  const [donHangDangChon, setDonHangDangChon] = useState(null);
  const [modalMo, setModalMo] = useState(false);
  
  const shopId = localStorage.getItem('user_id');

  const taiDuLieu = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/orders');
      const data = await res.json();
      if (data.success) {
        setDonHang(data.data); 
      }
    } catch (error) {
      console.error("Lỗi tải dữ liệu:", error);
    }
  };

  useEffect(() => { taiDuLieu(); }, []);

  // Hàm tính phí ship tự động theo thuật toán đặc tả
  useEffect(() => {
    const dist = parseFloat(form.distance_km) || 0;
    const weight = parseFloat(form.weight_kg) || 0;
    const value = parseFloat(form.item_value) || 0;
    const isRemote = form.is_remote_area;

    let distanceFee = 15000;
    if (dist > 3) {
      distanceFee += (dist - 3) * 2000;
    }

    let weightFee = 0;
    if (weight > 2) {
      const extraWeight = weight - 2;
      weightFee = Math.ceil(extraWeight / 0.5) * 5000;
    }

    let insuranceFee = 0;
    if (value > 1000000) {
      insuranceFee = value * 0.005;
    }

    let remoteFee = isRemote ? 20000 : 0;

    const total = distanceFee + weightFee + insuranceFee + remoteFee;
    setShippingFee(total);
  }, [form.distance_km, form.weight_kg, form.item_value, form.is_remote_area]);

  const layCuocPhiChuan = (don) => {
    if (don.shipping_fee !== undefined && don.shipping_fee !== null && Number(don.shipping_fee) > 0) {
      return Number(don.shipping_fee);
    }
    return 15000;
  };

  const taoDonMoi = async (e) => {
    e.preventDefault();
    const tracking_code = 'SL' + Math.floor(Math.random() * 100000); 
    
    await fetch('http://localhost:5000/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        receiver_name: form.receiver_name,
        receiver_phone: form.receiver_phone,
        receiver_address: form.receiver_address,
        cod_amount: form.cod_amount,
        shipping_fee: shippingFee,
        weight_kg: form.weight_kg,
        tracking_code, 
        shop_id: shopId 
      })
    });
    
    alert(`🎉 Tạo đơn thành công! Mã vận đơn của bạn là: ${tracking_code} | Cước phí: ${shippingFee.toLocaleString()} đ`);
    setForm({ receiver_name: '', receiver_phone: '', receiver_address: '', cod_amount: '', weight_kg: '1', item_value: '0', distance_km: '5', is_remote_area: false });
    setTabHienTai('danhsach');
    taiDuLieu();
  };

  const dangXuat = () => {
    const xacNhan = window.confirm("Bạn có chắc chắn muốn đăng xuất?");
    if (xacNhan) {
      localStorage.clear();
      window.location.href = '/'; 
    }
  };

  const hienThiTrangThai = (status) => {
    switch(status) {
      case 'pending': return <span className="bg-amber-100 text-amber-700 px-3 py-1.5 rounded-lg text-xs font-bold uppercase flex items-center gap-1.5 w-fit"><Clock size={14}/> Chờ xử lý</span>;
      case 'picking': return <span className="bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg text-xs font-bold uppercase flex items-center gap-1.5 w-fit"><PackageSearch size={14}/> Lấy hàng</span>;
      case 'in_warehouse': return <span className="bg-purple-100 text-purple-700 px-3 py-1.5 rounded-lg text-xs font-bold uppercase flex items-center gap-1.5 w-fit"><Box size={14}/> Đã nhập kho</span>;
      case 'delivering': return <span className="bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded-lg text-xs font-bold uppercase flex items-center gap-1.5 w-fit"><Truck size={14}/> Đang giao</span>;
      case 'completed': return <span className="bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-lg text-xs font-bold uppercase flex items-center gap-1.5 w-fit"><CheckCircle size={14}/> Thành công</span>;
      case 'cancelled': return <span className="bg-red-100 text-red-700 px-3 py-1.5 rounded-lg text-xs font-bold uppercase flex items-center gap-1.5 w-fit"><AlertCircle size={14}/> Đã hủy</span>;
      default: return <span className="bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg text-xs font-bold uppercase">{status}</span>;
    }
  };

  // Hàm vẽ tiến độ chi tiết trong Modal
  const renderChiTietTienDo = (status) => {
    const cacBuoc = [
      { id: 'pending', name: 'Chờ Xử Lý', desc: 'Đơn hàng mới tạo từ Cửa hàng', icon: <Clock size={18} /> },
      { id: 'picking', name: 'Đang Lấy Hàng', desc: 'Tài xế đã nhận việc và đang đến lấy', icon: <PackageSearch size={18} /> },
      { id: 'in_warehouse', name: 'Đã Nhập Kho', desc: 'Hàng đã về hệ thống kho bãi', icon: <Box size={18} /> },
      { id: 'delivering', name: 'Đang Giao Hàng', desc: 'Shipper đang mang hàng đến khách', icon: <Truck size={18} /> },
      { id: 'completed', name: 'Giao Thành Công', desc: 'Khách đã nhận và thanh toán COD', icon: <CheckCircle size={18} /> }
    ];

    let mucHienTai = 0;
    if (status === 'picking') mucHienTai = 1;
    if (status === 'in_warehouse') mucHienTai = 2;
    if (status === 'delivering') mucHienTai = 3;
    if (status === 'completed') mucHienTai = 4;

    if (status === 'cancelled') {
      return (
        <div className="bg-red-50 text-red-600 p-4 rounded-xl font-bold flex items-center gap-2 border border-red-100 my-4">
          <AlertCircle size={20} /> Đơn hàng này đã bị hủy.
        </div>
      );
    }

    return (
      <div className="space-y-6 my-6 relative pl-6 border-l-2 border-blue-100 ml-2">
        {cacBuoc.map((buoc, index) => {
          const daQua = index <= mucHienTai;
          const dangChay = index === mucHienTai;
          
          return (
            <div key={buoc.id} className="relative group">
              {/* Chấm tròn biểu tượng */}
              <div className={`absolute -left-[31px] top-0 w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                daQua ? 'bg-blue-600 text-white shadow-md shadow-blue-200' : 'bg-slate-100 text-slate-400 border border-slate-200'
              } ${dangChay ? 'ring-4 ring-blue-100 scale-110' : ''}`}>
                {buoc.icon}
              </div>
              <div className="pl-4">
                <p className={`font-bold text-base ${daQua ? 'text-slate-800' : 'text-slate-400'}`}>{buoc.name}</p>
                <p className="text-xs text-slate-500 mt-0.5">{buoc.desc}</p>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const tongDon = donHang.length;
  const tongCOD = donHang.reduce((sum, item) => sum + Number(item.cod_amount || 0), 0);
  const donThanhCong = donHang.filter(d => d.status === 'completed').length;

  return (
    <div className="flex min-h-screen bg-[#F0F7FF] font-sans text-slate-700">
      
      {/* SIDEBAR */}
      <div className="w-72 bg-white border-r border-blue-50 shadow-[0_0_20px_rgba(0,0,0,0.02)] flex flex-col z-10 justify-between">
        <div>
          <div className="p-8 border-b border-blue-50 flex items-center gap-3">
            <div className="bg-gradient-to-tr from-blue-600 to-blue-400 p-2.5 rounded-xl shadow-blue-200 shadow-lg">
              <Store className="text-white" size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-800 tracking-tight">Cổng Đối Tác</h2>
              <p className="text-xs font-bold text-blue-500 uppercase tracking-wider mt-0.5">Quản lý Cửa Hàng</p>
            </div>
          </div>
          
          <div className="flex flex-col gap-3 p-5 mt-2">
            <button 
              onClick={() => setTabHienTai('taodon')}
              className={`px-5 py-4 rounded-2xl font-bold text-left transition-all duration-300 flex items-center gap-4 group ${tabHienTai === 'taodon' ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-200' : 'bg-transparent text-slate-500 hover:bg-blue-50 hover:text-blue-600'}`}
            >
              <PackagePlus size={20} className={tabHienTai === 'taodon' ? 'text-white' : 'text-slate-400 group-hover:text-blue-500'} />
              Tạo Đơn Giao Hàng
            </button>
            
            <button 
              onClick={() => setTabHienTai('danhsach')}
              className={`px-5 py-4 rounded-2xl font-bold text-left transition-all duration-300 flex items-center gap-4 group ${tabHienTai === 'danhsach' ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-200' : 'bg-transparent text-slate-500 hover:bg-blue-50 hover:text-blue-600'}`}
            >
              <ListOrdered size={20} className={tabHienTai === 'danhsach' ? 'text-white' : 'text-slate-400 group-hover:text-blue-500'} />
              Quản Lý Vận Đơn
            </button>
          </div>
        </div>

        <div className="p-5 border-t border-blue-50">
          <button 
            onClick={dangXuat}
            className="w-full px-5 py-4 rounded-2xl font-bold text-left transition-all duration-300 flex items-center gap-4 group bg-transparent text-red-500 hover:bg-red-50 hover:text-red-600"
          >
            <LogOut size={20} className="text-red-400 group-hover:text-red-500" />
            Đăng Xuất
          </button>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 p-10 overflow-y-auto">
        <div className="mb-8 flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-black text-slate-800 tracking-tight">
              {tabHienTai === 'taodon' ? 'Khởi Tạo Vận Đơn Mới' : 'Danh Sách Vận Đơn'}
            </h1>
            <p className="text-slate-500 mt-2">
              {tabHienTai === 'taodon' ? 'Nhập thông tin người nhận và hàng hóa để hệ thống tính phí tự động.' : 'Theo dõi tiến độ giao hàng và dòng tiền đối soát COD.'}
            </p>
          </div>
        </div>

        {/* TAB 1: TẠO ĐƠN HÀNG */}
        {tabHienTai === 'taodon' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-5xl">
            <div className="lg:col-span-2 bg-white p-8 rounded-[24px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-blue-50">
              <div className="flex items-center gap-3 mb-8">
                <div className="bg-blue-50 p-3 rounded-xl text-blue-500">
                  <PackagePlus size={24} />
                </div>
                <h3 className="text-xl font-bold text-slate-800">Thông Tin Vận Đơn</h3>
              </div>
              
              <form onSubmit={taoDonMoi} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-bold text-slate-600 mb-2">Tên người nhận</label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input type="text" required
                        className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border-2 border-transparent rounded-xl outline-none focus:bg-white focus:border-blue-400 transition-all font-medium"
                        placeholder="VD: Nguyễn Văn A"
                        value={form.receiver_name} 
                        onChange={e => setForm({...form, receiver_name: e.target.value})} 
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-600 mb-2">Số điện thoại</label>
                    <div className="relative">
                      <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input type="tel" required
                        className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border-2 border-transparent rounded-xl outline-none focus:bg-white focus:border-blue-400 transition-all font-medium"
                        placeholder="VD: 0901234567"
                        value={form.receiver_phone} 
                        onChange={e => setForm({...form, receiver_phone: e.target.value})} 
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-600 mb-2">Địa chỉ giao hàng chi tiết</label>
                  <div className="relative">
                    <MapPin className="absolute left-4 top-4 text-slate-400" size={18} />
                    <textarea rows="2" required
                      className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border-2 border-transparent rounded-xl outline-none focus:bg-white focus:border-blue-400 transition-all font-medium resize-none"
                      placeholder="Số nhà, tên đường, phường/xã, quận/huyện..."
                      value={form.receiver_address} 
                      onChange={e => setForm({...form, receiver_address: e.target.value})} 
                    ></textarea>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-600 mb-2">Trọng lượng (kg)</label>
                    <div className="relative">
                      <Scale className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input type="number" step="0.1" min="0.1" required
                        className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border-2 border-transparent rounded-xl outline-none focus:bg-white focus:border-blue-400 font-medium"
                        value={form.weight_kg} 
                        onChange={e => setForm({...form, weight_kg: e.target.value})} 
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-600 mb-2">Giá trị hàng (đ)</label>
                    <input type="number" min="0" required
                      className="w-full px-4 py-3.5 bg-slate-50 border-2 border-transparent rounded-xl outline-none focus:bg-white focus:border-blue-400 font-medium"
                      placeholder="0"
                      value={form.item_value} 
                      onChange={e => setForm({...form, item_value: e.target.value})} 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-600 mb-2">Khoảng cách (km)</label>
                    <input type="number" min="1" required
                      className="w-full px-4 py-3.5 bg-slate-50 border-2 border-transparent rounded-xl outline-none focus:bg-white focus:border-blue-400 font-medium"
                      value={form.distance_km} 
                      onChange={e => setForm({...form, distance_km: e.target.value})} 
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3 bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                  <input type="checkbox" id="remote" 
                    className="w-5 h-5 accent-blue-600 rounded cursor-pointer"
                    checked={form.is_remote_area}
                    onChange={e => setForm({...form, is_remote_area: e.target.checked})}
                  />
                  <label htmlFor="remote" className="text-sm font-bold text-slate-700 cursor-pointer">
                    Khu vực giao hàng thuộc vùng sâu / vùng xa (Phụ phí +20.000đ)
                  </label>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-600 mb-2">Tiền thu hộ (COD)</label>
                  <div className="relative">
                    <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input type="number" min="0" required
                      className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border-2 border-transparent rounded-xl outline-none focus:bg-white focus:border-blue-400 transition-all font-black text-blue-600 text-lg"
                      placeholder="0"
                      value={form.cod_amount} 
                      onChange={e => setForm({...form, cod_amount: e.target.value})} 
                    />
                  </div>
                </div>

                <button type="submit" className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-200 transition-all flex justify-center items-center gap-2 text-lg mt-4">
                  Đẩy Đơn Lên Hệ Thống
                </button>
              </form>
            </div>

            {/* WIDGET BẢNG TÍNH CƯỚC */}
            <div className="lg:col-span-1">
              <div className="bg-white p-6 rounded-[24px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-blue-50 sticky top-8">
                <div className="flex items-center gap-2 mb-6 text-blue-600">
                  <Calculator size={22} />
                  <h4 className="font-black text-lg">Bảng Tính Cước Tự Động</h4>
                </div>
                <div className="space-y-4 text-sm font-medium text-slate-600">
                  <div className="flex justify-between pb-2 border-b border-slate-50">
                    <span>Khoảng cách ({form.distance_km || 0} km):</span>
                    <span className="font-bold text-slate-800">
                      {(15000 + (form.distance_km > 3 ? (form.distance_km - 3) * 2000 : 0)).toLocaleString()} đ
                    </span>
                  </div>
                  <div className="flex justify-between pb-2 border-b border-slate-50">
                    <span>Trọng lượng ({form.weight_kg || 0} kg):</span>
                    <span className="font-bold text-slate-800">
                      {(form.weight_kg > 2 ? Math.ceil((form.weight_kg - 2) / 0.5) * 5000 : 0).toLocaleString()} đ
                    </span>
                  </div>
                  <div className="flex justify-between pb-2 border-b border-slate-50">
                    <span>Bảo hiểm hàng hóa:</span>
                    <span className="font-bold text-slate-800">
                      {(form.item_value > 1000000 ? form.item_value * 0.005 : 0).toLocaleString()} đ
                    </span>
                  </div>
                  <div className="flex justify-between pb-2 border-b border-slate-50">
                    <span>Phụ phí vùng xa:</span>
                    <span className="font-bold text-slate-800">
                      {form.is_remote_area ? '20,000 đ' : '0 đ'}
                    </span>
                  </div>
                  <div className="pt-2 flex justify-between items-center">
                    <span className="font-black text-slate-800 text-base">Tổng Phí Ship:</span>
                    <span className="font-black text-2xl text-blue-600">{shippingFee.toLocaleString()} đ</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: DANH SÁCH ĐƠN HÀNG */}
        {tabHienTai === 'danhsach' && (
          <div className="space-y-6">
            
            {/* Thống kê nhanh */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-[24px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-blue-50 flex items-center gap-4">
                <div className="bg-blue-50 p-4 rounded-2xl text-blue-600"><ListOrdered size={28}/></div>
                <div>
                  <p className="text-slate-400 font-bold text-xs uppercase tracking-wider mb-1">Tổng Vận Đơn</p>
                  <p className="text-2xl font-black text-slate-800">{tongDon}</p>
                </div>
              </div>
              <div className="bg-white p-6 rounded-[24px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-blue-50 flex items-center gap-4">
                <div className="bg-emerald-50 p-4 rounded-2xl text-emerald-600"><CheckCircle size={28}/></div>
                <div>
                  <p className="text-slate-400 font-bold text-xs uppercase tracking-wider mb-1">Giao Thành Công</p>
                  <p className="text-2xl font-black text-slate-800">{donThanhCong}</p>
                </div>
              </div>
              <div className="bg-white p-6 rounded-[24px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-blue-50 flex items-center gap-4">
                <div className="bg-red-50 p-4 rounded-2xl text-red-500"><Wallet size={28}/></div>
                <div>
                  <p className="text-slate-400 font-bold text-xs uppercase tracking-wider mb-1">Tổng Tiền COD</p>
                  <p className="text-2xl font-black text-red-500">{tongCOD.toLocaleString()} đ</p>
                </div>
              </div>
            </div>

            {/* Bảng dữ liệu */}
            <div className="bg-white rounded-[24px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-blue-50 overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead className="bg-[#F8FAFC] border-b border-slate-100">
                  <tr>
                    <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-wider">Mã VĐ</th>
                    <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-wider">Khách Hàng</th>
                    <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-wider">Liên Hệ</th>
                    <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-wider">Cước Phí</th>
                    <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-wider">Tiền COD</th>
                    <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-wider">Trạng Thái</th>
                    <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-wider text-right">Hành Trình</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {donHang.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="p-16 text-center">
                        <div className="flex flex-col items-center justify-center text-slate-400">
                          <PackagePlus size={48} className="mb-4 opacity-30" />
                          <p className="text-lg font-medium">Bạn chưa tạo đơn hàng nào.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    donHang.map((don) => (
                      <tr key={don.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="p-6">
                          <span className="bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg font-black tracking-wide">
                            {don.tracking_code}
                          </span>
                        </td>
                        <td className="p-6 font-bold text-slate-700">{don.receiver_name}</td>
                        <td className="p-6 text-sm text-slate-500 font-medium">{don.receiver_phone}</td>
                        <td className="p-6 font-bold text-slate-600">{layCuocPhiChuan(don).toLocaleString()} đ</td>
                        <td className="p-6 font-black text-red-500">{Number(don.cod_amount).toLocaleString()} đ</td>
                        <td className="p-6">{hienThiTrangThai(don.status)}</td>
                        <td className="p-6 text-right">
                          <button 
                            onClick={() => { setDonHangDangChon(don); setModalMo(true); }}
                            className="bg-blue-50 hover:bg-blue-100 text-blue-600 px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 ml-auto transition-colors"
                          >
                            <Eye size={16} /> Xem
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* MODAL XEM CHI TIẾT HÀNH TRÌNH ĐƠN HÀNG */}
      {modalMo && donHangDangChon && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[28px] shadow-2xl max-w-lg w-full p-8 relative animate-in fade-in zoom-in-95 duration-200">
            <button 
              onClick={() => setModalMo(false)}
              className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 bg-slate-50 p-2 rounded-full transition-colors"
            >
              <X size={20} />
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="bg-blue-50 p-3 rounded-2xl text-blue-600">
                <MapPinned size={24} />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Mã Vận Đơn</p>
                <h3 className="text-2xl font-black text-blue-600">{donHangDangChon.tracking_code}</h3>
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl mb-6 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Người nhận:</span>
                <span className="font-bold text-slate-800">{donHangDangChon.receiver_name} ({donHangDangChon.receiver_phone})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Địa chỉ:</span>
                <span className="font-bold text-slate-800 text-right truncate max-w-[280px]">{donHangDangChon.receiver_address}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Tiền COD:</span>
                <span className="font-bold text-red-500">{Number(donHangDangChon.cod_amount).toLocaleString()} đ</span>
              </div>
            </div>

            <h4 className="font-bold text-slate-800 text-base mb-2">Tiến độ vận chuyển</h4>
            {renderChiTietTienDo(donHangDangChon.status)}

            <button 
              onClick={() => setModalMo(false)}
              className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3.5 rounded-xl transition-colors mt-4"
            >
              Đóng Cửa Sổ
            </button>
          </div>
        </div>
      )}

    </div>
  );
}