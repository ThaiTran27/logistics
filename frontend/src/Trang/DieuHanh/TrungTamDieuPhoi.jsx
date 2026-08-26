import { useState, useEffect } from 'react';
import { Map, Truck, PackageOpen, Send, LayoutDashboard, UserCheck, AlertTriangle, LogOut } from 'lucide-react';

export default function TrungTamDieuPhoi() {
  const [donHang, setDonHang] = useState([]);
  const [taiXe, setTaiXe] = useState([]);
  const [tabHienTai, setTabHienTai] = useState('phancong');

  const [tieuDeBaoCao, setTieuDeBaoCao] = useState('');
  const [noiDungBaoCao, setNoiDungBaoCao] = useState('');
  const userId = localStorage.getItem('user_id');

  const taiDuLieu = async () => {
    const resDon = await fetch('http://localhost:5000/api/orders');
    const dataDon = await resDon.json();
    if (dataDon.success) setDonHang(dataDon.data);

    const resTaiXe = await fetch('http://localhost:5000/api/shippers');
    const dataTaiXe = await resTaiXe.json();
    if (dataTaiXe.success) setTaiXe(dataTaiXe.data);
  };

  useEffect(() => { taiDuLieu(); }, []);

  const phanCongTaiXe = async (orderId, shipperId) => {
    if (!shipperId) return alert("Vui lòng chọn một tài xế!");
    
    await fetch(`http://localhost:5000/api/orders/${orderId}/assign`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shipper_id: shipperId })
    });
    
    alert("✅ Phân công tài xế thành công!");
    taiDuLieu(); 
  };

  const guiBaoCao = async (e) => {
    e.preventDefault();
    if (!tieuDeBaoCao || !noiDungBaoCao) return alert("Vui lòng nhập đủ thông tin!");

    await fetch('http://localhost:5000/api/reports/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        department: 'Điều Phối',
        title: tieuDeBaoCao,
        content: noiDungBaoCao,
        created_by: userId
      })
    });

    alert('Đã gửi báo cáo vận hành lên Ban Giám Đốc!');
    setTieuDeBaoCao('');
    setNoiDungBaoCao('');
  };

  // Hàm xử lý Đăng xuất
  const dangXuat = () => {
    const xacNhan = window.confirm("Bạn có chắc chắn muốn đăng xuất khỏi hệ thống?");
    if (xacNhan) {
      localStorage.clear();
      window.location.href = '/'; 
    }
  };

  const donChoXuLy = donHang.filter(d => d.status === 'pending').length;

  return (
    <div className="flex min-h-screen bg-[#FFFBEB] font-sans text-gray-700">
      
      {/* SIDEBAR - TÔNG MÀU CAM */}
      <div className="w-72 bg-white border-r border-amber-100 shadow-[0_0_20px_rgba(0,0,0,0.02)] flex flex-col z-10 justify-between">
        <div>
          <div className="p-8 border-b border-gray-50 flex items-center gap-3">
            <div className="bg-gradient-to-tr from-orange-500 to-amber-400 p-2.5 rounded-xl shadow-orange-200 shadow-lg">
              <Map className="text-white" size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black text-gray-800 tracking-tight">Điều Phối</h2>
              <p className="text-xs font-bold text-orange-500 uppercase tracking-wider mt-0.5">Trung tâm vận hành</p>
            </div>
          </div>
          
          <div className="flex flex-col gap-3 p-5 mt-2">
            <button 
              onClick={() => setTabHienTai('phancong')}
              className={`px-5 py-4 rounded-2xl font-bold text-left transition-all duration-300 flex items-center gap-4 group ${tabHienTai === 'phancong' ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-200' : 'bg-transparent text-gray-500 hover:bg-orange-50 hover:text-orange-600'}`}
            >
              <PackageOpen size={20} className={tabHienTai === 'phancong' ? 'text-white' : 'text-gray-400 group-hover:text-orange-500'} />
              Phân Công Giao Nhận
            </button>
            
            <button 
              onClick={() => setTabHienTai('baocao')}
              className={`px-5 py-4 rounded-2xl font-bold text-left transition-all duration-300 flex items-center gap-4 group ${tabHienTai === 'baocao' ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-200' : 'bg-transparent text-gray-500 hover:bg-orange-50 hover:text-orange-600'}`}
            >
              <LayoutDashboard size={20} className={tabHienTai === 'baocao' ? 'text-white' : 'text-gray-400 group-hover:text-orange-500'} />
              Báo Cáo Vận Hành
            </button>
          </div>
        </div>

        {/* Nút Đăng xuất */}
        <div className="p-5 border-t border-gray-50">
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
        
        {/* HEADER */}
        <div className="mb-8 flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-black text-gray-800 tracking-tight">
              {tabHienTai === 'phancong' ? 'Kiểm Soát Vận Đơn' : 'Báo Cáo Điều Phối'}
            </h1>
            <p className="text-gray-500 mt-2">
              {tabHienTai === 'phancong' ? 'Phân bổ đơn hàng cho đội ngũ tài xế theo thời gian thực.' : 'Thống kê tình trạng kẹt đơn và yêu cầu hỗ trợ.'}
            </p>
          </div>
        </div>

        {/* TAB 1: PHÂN CÔNG TÀI XẾ */}
        {tabHienTai === 'phancong' && (
          <div className="bg-white rounded-[24px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-50 overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead className="bg-[#FFF8F1] border-b border-orange-100">
                <tr>
                  <th className="p-6 text-sm font-black text-orange-400 uppercase tracking-wider">Mã VĐ</th>
                  <th className="p-6 text-sm font-black text-orange-400 uppercase tracking-wider">Khách Hàng</th>
                  <th className="p-6 text-sm font-black text-orange-400 uppercase tracking-wider">Tuyến Giao</th>
                  <th className="p-6 text-sm font-black text-orange-400 uppercase tracking-wider">Trạng Thái</th>
                  <th className="p-6 text-sm font-black text-orange-400 uppercase tracking-wider text-right">Điều Phối</th>
                </tr>
              </thead>
              <tbody>
                {donHang.map((don) => (
                  <tr key={don.id} className="border-b border-gray-50 hover:bg-[#FFF8F1] transition-colors group">
                    <td className="p-6">
                      <span className="bg-gray-100 text-gray-600 px-3 py-1.5 rounded-lg font-bold text-sm">
                        {don.tracking_code}
                      </span>
                    </td>
                    <td className="p-6 font-bold text-gray-800">{don.receiver_name}</td>
                    <td className="p-6 text-sm text-gray-500 max-w-xs truncate">{don.receiver_address}</td>
                    <td className="p-6">
                      {don.status === 'pending' ? (
                        <span className="bg-red-50 text-red-500 px-3 py-1.5 rounded-lg font-bold text-xs uppercase flex items-center w-fit gap-2">
                          <AlertTriangle size={14} /> Chờ gán
                        </span>
                      ) : (
                        <span className="bg-green-50 text-green-600 px-3 py-1.5 rounded-lg font-bold text-xs uppercase flex items-center w-fit gap-2">
                          <Truck size={14} /> Đã gán xe
                        </span>
                      )}
                    </td>
                    <td className="p-6 text-right flex justify-end gap-2">
                      {don.status === 'pending' ? (
                        <>
                          <select 
                            id={`shipper-${don.id}`}
                            className="border-2 border-orange-100 bg-orange-50 text-orange-800 p-2.5 rounded-xl text-sm font-bold outline-none focus:border-orange-400"
                            defaultValue=""
                          >
                            <option value="" disabled>-- Chọn tài xế --</option>
                            {taiXe.map(tx => (
                              <option key={tx.id} value={tx.id}>{tx.full_name}</option>
                            ))}
                          </select>
                          <button 
                            onClick={() => phanCongTaiXe(don.id, document.getElementById(`shipper-${don.id}`).value)}
                            className="bg-orange-500 hover:bg-orange-600 text-white px-5 py-2.5 rounded-xl font-bold transition-all duration-300 shadow-sm flex items-center gap-2"
                          >
                            Giao Việc
                          </button>
                        </>
                      ) : (
                        <span className="text-gray-400 italic text-sm font-medium py-2">Đang xử lý</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 2: THỐNG KÊ VÀ BÁO CÁO */}
        {tabHienTai === 'baocao' && (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
            <div className="xl:col-span-6 flex flex-col gap-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="bg-white p-7 rounded-[24px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] relative overflow-hidden group">
                  <div className="absolute -right-6 -bottom-6 opacity-[0.03] text-red-500 group-hover:scale-110 transition-transform duration-500">
                    <PackageOpen size={120} />
                  </div>
                  <p className="text-gray-400 font-bold mb-1 uppercase text-xs tracking-widest flex items-center gap-2">
                    <AlertTriangle size={14} className="text-red-400"/> Đơn Ùn Tắc
                  </p>
                  <p className="text-4xl font-black text-gray-800 mt-2">{donChoXuLy} <span className="text-xl text-gray-400 font-bold">Đơn</span></p>
                </div>
                
                <div className="bg-white p-7 rounded-[24px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] relative overflow-hidden group">
                  <div className="absolute -right-6 -bottom-6 opacity-[0.03] text-orange-500 group-hover:scale-110 transition-transform duration-500">
                    <UserCheck size={120} />
                  </div>
                  <p className="text-gray-400 font-bold mb-1 uppercase text-xs tracking-widest flex items-center gap-2">
                    Tài Xế Sẵn Sàng
                  </p>
                  <p className="text-4xl font-black text-gray-800 mt-2">{taiXe.length} <span className="text-xl text-gray-400 font-bold">Người</span></p>
                </div>
              </div>
            </div>

            <div className="xl:col-span-6 bg-white p-8 rounded-[24px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] h-fit">
              <div className="flex items-center gap-3 mb-8">
                <div className="bg-orange-50 p-3 rounded-xl text-orange-500">
                  <Send size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-800">Trình Báo Cáo Vận Hành</h3>
                  <p className="text-xs font-bold text-gray-400 uppercase mt-1">Gửi Ban Giám Đốc</p>
                </div>
              </div>
              
              <form onSubmit={guiBaoCao} className="space-y-6">
                <div>
                  <label className="block font-bold text-gray-600 mb-2 text-sm">Tiêu đề báo cáo</label>
                  <input 
                    type="text" 
                    className="w-full bg-[#FFF8F1] border-2 border-transparent p-4 rounded-xl outline-none focus:border-orange-400 focus:bg-white transition-all font-medium text-gray-700" 
                    placeholder="VD: Yêu cầu bổ sung tài xế tuyến A..."
                    value={tieuDeBaoCao}
                    onChange={(e) => setTieuDeBaoCao(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-600 mb-2 text-sm">Nội dung tình hình</label>
                  <textarea 
                    rows="6" 
                    className="w-full bg-[#FFF8F1] border-2 border-transparent p-4 rounded-xl outline-none focus:border-orange-400 focus:bg-white transition-all font-medium text-gray-700 resize-none"
                    placeholder="Nhập nội dung sự cố hoặc đề xuất..."
                    value={noiDungBaoCao}
                    onChange={(e) => setNoiDungBaoCao(e.target.value)}
                  ></textarea>
                </div>
                <button type="submit" className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-orange-200 transition-all flex justify-center items-center gap-2 text-lg">
                  <Send size={20} />
                  Gửi Khối Điều Hành
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}