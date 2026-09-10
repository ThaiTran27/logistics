import { useState, useEffect } from 'react';
import { Calculator, Wallet, CheckCircle, Building2, Receipt, LogOut, Banknote, Search, ArrowRightLeft, History, Download } from 'lucide-react';
import * as XLSX from 'xlsx';

export default function DoiSoatCOD() {
  const [congNoList, setCongNoList] = useState([]);
  const [lichSuList, setLichSuList] = useState([]);
  const [tuKhoa, setTuKhoa] = useState('');
  const [tabHienTai, setTabHienTai] = useState('cho-duyet'); 
  
  const accountantName = localStorage.getItem('full_name') || 'Phòng Kế Toán';

  const taiDuLieuCongNo = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/accountant/debt');
      const data = await res.json();
      if (data.success) setCongNoList(data.data || []);
    } catch (error) {
      console.error("Lỗi tải công nợ:", error);
    }
  };

  const taiLichSuDoiSoat = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/accountant/history');
      const data = await res.json();
      if (data.success) setLichSuList(data.data || []);
    } catch (error) {
      console.error("Lỗi tải lịch sử:", error);
    }
  };

  useEffect(() => {
    taiDuLieuCongNo();
    taiLichSuDoiSoat();
  }, []);

  const xacNhanThanhToan = async (shopId, shopName, amount) => {
    const xacNhan = window.confirm(`Xác nhận bạn đã chuyển khoản ${Number(amount).toLocaleString()} đ cho shop [${shopName}]?`);
    if (!xacNhan) return;

    try {
      const res = await fetch(`http://localhost:5000/api/accountant/pay/${shopId}`, {
        method: 'PUT'
      });
      const data = await res.json();

      if (data.success) {
        alert(`✅ Đã đối soát thành công cho shop ${shopName}!`);
        taiDuLieuCongNo(); 
        taiLichSuDoiSoat();
      }
    } catch (error) {
      alert("Lỗi kết nối đến hệ thống!");
    }
  };

  const dangXuat = () => {
    if (window.confirm("Bạn muốn đăng xuất khỏi hệ thống Kế toán?")) {
      localStorage.clear();
      window.location.href = '/'; 
    }
  };

  const anToanCongNo = Array.isArray(congNoList) ? congNoList : [];
  const anToanLichSu = Array.isArray(lichSuList) ? lichSuList : [];
  const danhSachHienTai = tabHienTai === 'cho-duyet' ? anToanCongNo : anToanLichSu;
  
  const danhSachDaLoc = danhSachHienTai.filter(item => {
    const tenShop = item?.shop_name || '';
    const thuDienTu = item?.email || '';
    const kw = tuKhoa || '';
    return tenShop.toLowerCase().includes(kw.toLowerCase()) || 
           thuDienTu.toLowerCase().includes(kw.toLowerCase());
  });

  const tongTienCanTra = anToanCongNo.reduce((sum, item) => sum + Number(item?.total_cod || 0), 0);
  const tongTienDaTra = anToanLichSu.reduce((sum, item) => sum + Number(item?.total_paid || 0), 0);

  // HÀM XUẤT FILE EXCEL
  const xuatFileExcel = () => {
    if (danhSachDaLoc.length === 0) {
      alert('Không có dữ liệu để xuất Excel!');
      return;
    }

    const duLieuExcel = danhSachDaLoc.map((item, index) => ({
      'STT': index + 1,
      'Tên Đối Tác': item?.shop_name || 'N/A',
      'Email': item?.email || 'N/A',
      'Số Lượng Đơn': item?.total_orders || 0,
      'Tổng Tiền COD (VNĐ)': Number(item?.total_cod || item?.total_paid || 0),
      'Trạng Thái': tabHienTai === 'cho-duyet' ? 'Chưa thanh toán' : 'Đã giải ngân'
    }));

    const worksheet = XLSX.utils.json_to_sheet(duLieuExcel);
    
    // Tự động căn chỉnh độ rộng cột
    const wscols = [
      {wch: 5}, {wch: 25}, {wch: 25}, {wch: 15}, {wch: 20}, {wch: 15}
    ];
    worksheet['!cols'] = wscols;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "DanhSachDoiSoat");
    
    const tenFile = tabHienTai === 'cho-duyet' ? 'BaoCao_CongNo_COD.xlsx' : 'LichSu_DoiSoat_COD.xlsx';
    XLSX.writeFile(workbook, tenFile);
  };

  return (
    <div className="flex min-h-screen bg-[#F8FAFC] font-sans text-slate-700">
      
      {/* SIDEBAR */}
      <div className="w-72 bg-white border-r border-slate-200 shadow-sm flex flex-col z-10 justify-between">
        <div>
          <div className="p-8 border-b border-slate-100 flex items-center gap-3">
            <div className="bg-gradient-to-tr from-teal-500 to-emerald-400 p-2.5 rounded-xl shadow-lg shadow-teal-200">
              <Calculator className="text-white" size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-800 tracking-tight">Kế Toán</h2>
              <p className="text-xs font-bold text-teal-500 uppercase tracking-wider mt-0.5">Kiểm soát dòng tiền</p>
            </div>
          </div>
          
          <div className="p-5 mt-2 space-y-3">
            <button 
              onClick={() => setTabHienTai('cho-duyet')}
              className={`w-full px-5 py-4 rounded-2xl font-bold flex items-center gap-4 transition-all ${tabHienTai === 'cho-duyet' ? 'bg-teal-50 text-teal-600 border border-teal-100 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              <ArrowRightLeft size={20} /> Đối Soát COD
            </button>
            <button 
              onClick={() => setTabHienTai('lich-su')}
              className={`w-full px-5 py-4 rounded-2xl font-bold flex items-center gap-4 transition-all ${tabHienTai === 'lich-su' ? 'bg-teal-50 text-teal-600 border border-teal-100 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              <History size={20} /> Lịch Sử Giao Dịch
            </button>
          </div>
        </div>

        <div className="p-5 border-t border-slate-100">
          <div className="flex items-center gap-3 px-5 py-4 mb-2 bg-slate-50 rounded-xl border border-slate-100">
            <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center font-black text-teal-600">
              {(accountantName || 'P').charAt(0)}
            </div>
            <div>
              <p className="text-sm font-bold text-slate-700">{accountantName}</p>
            </div>
          </div>
          <button onClick={dangXuat} className="w-full px-5 py-4 rounded-2xl font-bold text-left text-red-500 hover:bg-red-50 transition-colors flex items-center gap-3">
            <LogOut size={20}/> Đăng Xuất
          </button>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 p-10 overflow-y-auto">
        <div className="mb-8 flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-black text-slate-800 tracking-tight">Thanh Toán Thu Hộ (COD)</h1>
            <p className="text-slate-500 mt-2 font-medium">Danh sách các đối tác (Shop) cần được thanh toán tiền hàng thu hộ.</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative w-80">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="Tìm tên Shop hoặc Email..." 
                className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-xl outline-none focus:border-teal-400 focus:ring-4 focus:ring-teal-50 transition-all font-medium"
                value={tuKhoa}
                onChange={(e) => setTuKhoa(e.target.value)}
              />
            </div>
            <button 
              onClick={xuatFileExcel}
              className="bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white px-5 py-3 rounded-xl font-bold flex items-center gap-2 transition-colors border border-blue-100"
            >
              <Download size={20} /> Xuất Báo Cáo
            </button>
          </div>
        </div>

        {/* THỐNG KÊ NHANH */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white p-6 rounded-[24px] shadow-sm border border-slate-200 flex items-center gap-5">
            <div className="bg-teal-50 p-4 rounded-2xl text-teal-600"><Building2 size={32}/></div>
            <div>
              <p className="text-slate-400 font-bold text-xs uppercase tracking-wider mb-1">Số Đối Tác {tabHienTai === 'cho-duyet' ? 'Cần Chi Trả' : 'Đã Hợp Tác'}</p>
              <p className="text-3xl font-black text-slate-800">{tabHienTai === 'cho-duyet' ? anToanCongNo.length : anToanLichSu.length}</p>
            </div>
          </div>
          <div className="bg-white p-6 rounded-[24px] shadow-sm border border-slate-200 flex items-center gap-5">
            <div className="bg-amber-50 p-4 rounded-2xl text-amber-600"><Banknote size={32}/></div>
            <div>
              <p className="text-slate-400 font-bold text-xs uppercase tracking-wider mb-1">Tổng Tiền COD {tabHienTai === 'cho-duyet' ? 'Phải Trả' : 'Đã Giải Ngân'}</p>
              <p className={`text-3xl font-black ${tabHienTai === 'cho-duyet' ? 'text-red-500' : 'text-emerald-500'}`}>
                {(tabHienTai === 'cho-duyet' ? tongTienCanTra : tongTienDaTra).toLocaleString()} đ
              </p>
            </div>
          </div>
        </div>

        {/* BẢNG DỮ LIỆU */}
        <div className="bg-white rounded-[24px] shadow-sm border border-slate-200 overflow-hidden animate-in fade-in duration-300">
          <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-[#F8FAFC]">
            <h3 className="font-black text-slate-800 text-lg flex items-center gap-2">
              {tabHienTai === 'cho-duyet' ? <Receipt className="text-teal-600" size={20} /> : <History className="text-teal-600" size={20} />}
              <span>{tabHienTai === 'cho-duyet' ? 'Danh Sách Cần Đối Soát' : 'Lịch Sử Đã Thanh Toán'}</span>
            </h3>
          </div>

          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-wider">Cửa Hàng (Shop)</th>
                <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-wider">Số Đơn</th>
                <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-wider">Tiền COD</th>
                <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-wider text-right">Trạng Thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {danhSachDaLoc.length === 0 ? (
                <tr>
                  <td colSpan="4" className="p-16 text-center text-slate-400 font-medium bg-white">
                    {tabHienTai === 'cho-duyet' ? 'Hiện không có khoản công nợ COD nào cần thanh toán.' : 'Chưa có dữ liệu lịch sử thanh toán.'}
                  </td>
                </tr>
              ) : (
                danhSachDaLoc.map((item, index) => (
                  <tr key={item?.shop_id ? `shop-${item.shop_id}` : `fallback-${index}`} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-6">
                      <p className="font-bold text-slate-800 text-base">{item?.shop_name || 'Đang cập nhật'}</p>
                      <p className="text-xs text-slate-500 mt-1">{item?.email || 'N/A'}</p>
                    </td>
                    <td className="p-6">
                      <span className="bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg font-bold">
                        {item?.total_orders || 0} đơn
                      </span>
                    </td>
                    <td className="p-6">
                      <span className={`font-black text-xl ${tabHienTai === 'cho-duyet' ? 'text-red-500' : 'text-slate-700'}`}>
                        {Number(item?.total_cod || item?.total_paid || 0).toLocaleString()} đ
                      </span>
                    </td>
                    <td className="p-6 text-right">
                      {tabHienTai === 'cho-duyet' ? (
                        <button 
                          onClick={() => xacNhanThanhToan(item.shop_id, item.shop_name, item.total_cod)}
                          className="bg-teal-50 hover:bg-teal-500 hover:text-white text-teal-600 px-5 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 inline-flex"
                        >
                          <Wallet size={18} /> Đã Chuyển Khoản
                        </button>
                      ) : (
                        <span className="bg-emerald-50 text-emerald-600 px-4 py-2.5 rounded-xl font-bold text-sm inline-flex items-center gap-2 border border-emerald-100">
                          <CheckCircle size={18} /> Hoàn Tất
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
}