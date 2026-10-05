import { apiFetch as fetch } from '../../utils/apiFetch.js';
import { useState, useEffect } from 'react';
import { Calculator, Wallet, Building2, Receipt, LogOut, Banknote, Search, ArrowRightLeft, History, Printer, X, ShieldCheck } from 'lucide-react';
import * as XLSX from 'xlsx';

export default function DoiSoatCOD() {
  const [congNoList, setCongNoList] = useState([]);
  const [lichSuList, setLichSuList] = useState([]);
  const [tuKhoa, setTuKhoa] = useState('');
  const [tabHienTai, setTabHienTai] = useState('cho-duyet'); 
  const [hoaDon, setHoaDon] = useState(null);
  const [driverRemittances, setDriverRemittances] = useState([]);
  const [driverWallets, setDriverWallets] = useState([]);
  const [expenseClaims, setExpenseClaims] = useState([]);
  const [expenseStatus, setExpenseStatus] = useState('pending');
  const [expenseBusyId, setExpenseBusyId] = useState(null);
  const [expenseError, setExpenseError] = useState('');
  const [expenseMessage, setExpenseMessage] = useState('');
  const [walletBusyDriverId, setWalletBusyDriverId] = useState(null);
  const [walletMessage, setWalletMessage] = useState('');
  const [walletError, setWalletError] = useState('');
  const [settlementMonth, setSettlementMonth] = useState(() => new Date().toISOString().slice(0, 7));
  
  const accountantName = localStorage.getItem('full_name') || 'Phòng Kế Toán';

  const taiDuLieuCongNo = async () => {
    try {
      const res = await fetch(`http://localhost:5000/api/accountant/debt?month=${settlementMonth}`);
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

  const taiNopTienTaiXe = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/accountant/driver-remittances?status=pending');
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Không tải được phiếu nộp tiền.');
      setDriverRemittances(data.data || []);
    } catch (error) {
      console.error('Lỗi tải phiếu nộp COD của tài xế:', error);
    }
  };

  const taiViKyQuyTaiXe = async () => {
    setWalletError('');
    try {
      const response = await fetch('http://localhost:5000/api/accountant/driver-wallets');
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Không tải được ví ký quỹ.');
      setDriverWallets(data.data || []);
    } catch (error) {
      setWalletError(error.message || 'Không tải được ví ký quỹ.');
    }
  };

  const taiYeuCauPhuPhi = async (status = expenseStatus) => {
    setExpenseError('');
    try {
      const response = await fetch(`http://localhost:5000/api/accountant/expense-claims?status=${status}`);
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Không tải được phụ phí tài xế.');
      setExpenseClaims(data.data || []);
    } catch (error) {
      setExpenseError(error.message || 'Không tải được phụ phí tài xế.');
    }
  };

  const xuLyYeuCauPhuPhi = async (claim, status) => {
    const enteredNote = window.prompt(status === 'rejected'
      ? 'Nhập lý do từ chối (ít nhất 5 ký tự):'
      : 'Ghi chú duyệt (không bắt buộc):');
    if (enteredNote === null) return;
    const reviewNote = enteredNote.trim();
    if (status === 'rejected' && reviewNote.length < 5) {
      setExpenseError('Lý do từ chối cần tối thiểu 5 ký tự.');
      return;
    }
    if (status === 'approved' && !window.confirm(`Duyệt hoàn ${Number(claim.amount).toLocaleString()} đ cho ${claim.driver_name} và cộng vào bảng lương?`)) return;
    setExpenseBusyId(claim.id);
    setExpenseError('');
    setExpenseMessage('');
    try {
      const response = await fetch(`http://localhost:5000/api/accountant/expense-claims/${claim.id}/review`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, review_note: reviewNote })
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Không xử lý được yêu cầu phụ phí.');
      setExpenseMessage(data.message);
      await taiYeuCauPhuPhi();
    } catch (error) {
      setExpenseError(error.message || 'Không xử lý được yêu cầu phụ phí.');
    } finally {
      setExpenseBusyId(null);
    }
  };

  const napKyQuyTaiXe = async (event, driver) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const amount = Number(formData.get('amount'));
    if (!window.confirm(`Xác nhận đã nhận thực tế ${amount.toLocaleString('vi-VN')} đ ký quỹ từ tài xế ${driver.full_name}?`)) return;
    setWalletBusyDriverId(driver.driver_id);
    setWalletError('');
    setWalletMessage('');
    try {
      const response = await fetch(`http://localhost:5000/api/accountant/driver-wallets/${driver.driver_id}/deposits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: formData.get('amount'), note: formData.get('note') })
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Không cập nhật được ký quỹ.');
      setWalletMessage(`${data.message} · ${driver.full_name}`);
      form.reset();
      await taiViKyQuyTaiXe();
    } catch (error) {
      setWalletError(error.message || 'Không cập nhật được ký quỹ.');
    } finally {
      setWalletBusyDriverId(null);
    }
  };

  useEffect(() => {
    taiDuLieuCongNo();
    taiLichSuDoiSoat();
  }, []);

  useEffect(() => {
    taiDuLieuCongNo();
  }, [settlementMonth]);

  const taiHoaDon = async (settlementId) => {
    const response = await fetch(`http://localhost:5000/api/accountant/settlements/${settlementId}`);
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.message || 'Không tải được hóa đơn đối soát.');
    setHoaDon(data.data);
  };

  const xacNhanThanhToan = async (shopId, shopName, amount) => {
    const xacNhan = window.confirm(`Xác nhận bạn đã chuyển khoản ${Number(amount).toLocaleString()} đ cho shop [${shopName}]?`);
    if (!xacNhan) return;

    try {
      const res = await fetch(`http://localhost:5000/api/accountant/pay/${shopId}?month=${settlementMonth}`, {
        method: 'PUT'
      });
      const data = await res.json();

      if (data.success) {
        alert(`✅ Đã đối soát thành công cho shop ${shopName}!`);
        taiDuLieuCongNo(); 
        taiLichSuDoiSoat();
        await taiHoaDon(data.settlement_id);
      }
    } catch (error) {
      alert(error.message || 'Lỗi kết nối đến hệ thống!');
    }
  };

  const xacNhanNopTienTaiXe = async (remittance) => {
    if (!window.confirm(`Xác nhận đã nhận ${Number(remittance.amount).toLocaleString()} đ tiền mặt từ Shipper ${remittance.driver_name}?`)) return;
    try {
      const response = await fetch(`http://localhost:5000/api/accountant/driver-remittances/${remittance.id}/receive`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountant_id: Number(localStorage.getItem('user_id')) })
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Không xác nhận được phiếu nộp.');
      await taiNopTienTaiXe();
      alert(data.message);
    } catch (error) {
      alert(error.message || 'Lỗi kết nối máy chủ.');
    }
  };

  const xuatExcel = () => {
    const rows = anToanLichSu.map((item) => ({
      'Mã đối soát': item.settlement_id,
      'Cửa hàng': item.shop_name,
      Email: item.email,
      'Số đơn': item.total_orders,
      'Tổng COD': Number(item.total_cod),
      'Cước shop trả': Number(item.total_shipping_fee),
      'Phí dịch vụ': Number(item.total_service_fee || 0),
      'Phí bảo hiểm': Number(item.total_insurance_fee || 0),
      'Shop nhận': Number(item.total_paid),
      'Thời gian': new Date(item.settled_at).toLocaleString('vi-VN')
    }));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), 'Doi soat COD');
    XLSX.writeFile(workbook, `doi-soat-cod-${settlementMonth}.xlsx`);
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

  const tongTienCanTra = anToanCongNo.reduce((sum, item) => sum + Number(item?.total_payable || 0), 0);
  const tongTienDaTra = anToanLichSu.reduce((sum, item) => sum + Number(item?.total_paid || 0), 0);

  const inHoaDonPDF = () => window.print();

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
              <p className="mt-1 max-w-40 truncate text-sm font-bold text-slate-700" title={accountantName}>{accountantName}</p>
            </div>

            {hoaDon && (
              <>
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 print:hidden">
                  <section className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
                    <header className="mb-5 flex items-center justify-between">
                      <div><p className="text-xs font-black uppercase tracking-widest text-teal-600">Hóa đơn đối soát COD</p><h2 className="mt-1 text-2xl font-black text-slate-800">#{hoaDon.settlement_id} · {hoaDon.shop_name}</h2></div>
                      <button type="button" aria-label="Đóng hóa đơn" onClick={() => setHoaDon(null)} className="rounded-full bg-slate-100 p-2 text-slate-600 hover:bg-slate-200"><X size={20} /></button>
                    </header>
                    <p className="mb-4 text-sm text-slate-500">{hoaDon.email} · {new Date(hoaDon.settled_at).toLocaleString('vi-VN')}</p>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[650px] text-left text-sm">
                        <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-3">Mã đơn</th><th className="p-3">Người nhận</th><th className="p-3">COD</th><th className="p-3">Cước</th><th className="p-3">Phí dịch vụ + bảo hiểm</th><th className="p-3">Shop nhận</th></tr></thead>
                        <tbody className="divide-y divide-slate-100">
                          {hoaDon.orders.map((order) => {
                            const shopReceives = Number(order.cod_amount || 0)
                              - (order.fee_payer === 'sender' ? Number(order.shipping_fee || 0) : 0)
                              - Number(order.service_fee || 0) - Number(order.insurance_fee || 0);
                            return <tr key={order.id}><td className="p-3 font-bold">{order.tracking_code}</td><td className="p-3">{order.receiver_name}<br /><span className="text-xs text-slate-500">{order.receiver_phone}</span></td><td className="p-3">{Number(order.cod_amount || 0).toLocaleString()} đ</td><td className="p-3">{Number(order.shipping_fee || 0).toLocaleString()} đ · {order.fee_payer === 'sender' ? 'Shop' : 'Khách'}</td><td className="p-3">{(Number(order.service_fee || 0) + Number(order.insurance_fee || 0)).toLocaleString()} đ</td><td className="p-3 font-bold">{shopReceives.toLocaleString()} đ</td></tr>;
                          })}
                        </tbody>
                      </table>
                    </div>
                    <div className="ml-auto mt-6 max-w-sm space-y-2 border-t border-slate-200 pt-4 text-sm">
                      <div className="flex justify-between"><span>Tổng COD</span><strong>{Number(hoaDon.total_cod).toLocaleString()} đ</strong></div>
                      <div className="flex justify-between"><span>Cước trừ của Shop</span><strong>-{Number(hoaDon.total_shipping_fee).toLocaleString()} đ</strong></div>
                      <div className="flex justify-between"><span>Phí dịch vụ</span><strong>-{Number(hoaDon.total_service_fee || 0).toLocaleString()} đ</strong></div>
                      <div className="flex justify-between"><span>Phí bảo hiểm</span><strong>-{Number(hoaDon.total_insurance_fee || 0).toLocaleString()} đ</strong></div>
                      <div className="flex justify-between border-t border-slate-200 pt-3 text-lg font-black text-teal-700"><span>Tiền trả Shop</span><span>{Number(hoaDon.total_paid).toLocaleString()} đ</span></div>
                    </div>
                    <div className="mt-6 flex flex-wrap gap-3">
                      <button type="button" onClick={inHoaDonPDF} className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-5 py-3 font-bold text-white hover:bg-teal-700"><Printer size={18} /> In / Lưu PDF</button>
                      <button type="button" onClick={async () => {
                        try {
                          const response = await fetch(`http://localhost:5000/api/accountant/settlements/${hoaDon.settlement_id}/email`, { method: 'POST' });
                          const data = await response.json();
                          if (!response.ok || !data.success) throw new Error(data.message || 'Không gửi được email.');
                          alert(data.message);
                        } catch (error) { alert(error.message || 'Lỗi kết nối máy chủ.'); }
                      }} className="inline-flex items-center gap-2 rounded-xl border border-teal-200 bg-white px-5 py-3 font-bold text-teal-700">Gửi phiếu qua email Shop</button>
                    </div>
                  </section>
                </div>
                <article id="cod-settlement-invoice" className="hidden print:block bg-white p-10 text-slate-900">
                  <header className="border-b-2 border-slate-900 pb-5">
                    <h1 className="text-3xl font-black">SMART LOGISTICS</h1>
                    <h2 className="mt-3 text-xl font-bold">HÓA ĐƠN ĐỐI SOÁT COD</h2>
                    <p className="mt-2">Mã đối soát: {hoaDon.settlement_id} · Ngày: {new Date(hoaDon.settled_at).toLocaleString('vi-VN')}</p>
                    <p>Đối tác: {hoaDon.shop_name} · {hoaDon.email}</p>
                  </header>
                  <table className="mt-6 w-full border-collapse text-left text-sm">
                    <thead><tr>{['Mã đơn', 'Người nhận', 'COD', 'Cước', 'Người trả cước', 'Shop nhận'].map((heading) => <th key={heading} className="border border-slate-400 p-2">{heading}</th>)}</tr></thead>
                    <tbody>{hoaDon.orders.map((order) => <tr key={order.id}><td className="border border-slate-400 p-2">{order.tracking_code}</td><td className="border border-slate-400 p-2">{order.receiver_name}<br />{order.receiver_phone}</td><td className="border border-slate-400 p-2">{Number(order.cod_amount || 0).toLocaleString()} đ</td><td className="border border-slate-400 p-2">{Number(order.shipping_fee || 0).toLocaleString()} đ</td><td className="border border-slate-400 p-2">{order.fee_payer === 'sender' ? 'Người gửi' : 'Người nhận'}</td><td className="border border-slate-400 p-2">{(Number(order.cod_amount || 0) - (order.fee_payer === 'sender' ? Number(order.shipping_fee || 0) : 0)).toLocaleString()} đ</td></tr>)}</tbody>
                  </table>
                  <div className="ml-auto mt-6 max-w-sm space-y-2 text-right">
                    <p>Tổng COD: <strong>{Number(hoaDon.total_cod).toLocaleString()} đ</strong></p>
                    <p>Cước trừ của Shop: <strong>-{Number(hoaDon.total_shipping_fee).toLocaleString()} đ</strong></p>
                    <p>Phí dịch vụ: <strong>-{Number(hoaDon.total_service_fee || 0).toLocaleString()} đ</strong></p>
                    <p>Bảo hiểm: <strong>-{Number(hoaDon.total_insurance_fee || 0).toLocaleString()} đ</strong></p>
                    <p className="border-t border-slate-400 pt-3 text-xl font-black">Tiền trả Shop: {Number(hoaDon.total_paid).toLocaleString()} đ</p>
                  </div>
                </article>
              </>
            )}
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
            <button
              onClick={() => { setTabHienTai('tai-xe'); taiNopTienTaiXe(); }}
              className={`w-full px-5 py-4 rounded-2xl font-bold flex items-center gap-4 transition-all ${tabHienTai === 'tai-xe' ? 'bg-amber-50 text-amber-700 border border-amber-100 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              <Banknote size={20} /> Nộp Tiền Shipper
            </button>
            <button
              onClick={() => { setTabHienTai('ky-quy'); taiViKyQuyTaiXe(); }}
              className={`w-full px-5 py-4 rounded-2xl font-bold flex items-center gap-4 transition-all ${tabHienTai === 'ky-quy' ? 'bg-indigo-50 text-indigo-700 border border-indigo-100 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              <ShieldCheck size={20} /> Ký Quỹ Tài Xế
            </button>
            <button
              onClick={() => { setTabHienTai('phu-phi'); taiYeuCauPhuPhi(); }}
              className={`w-full px-5 py-4 rounded-2xl font-bold flex items-center gap-4 transition-all ${tabHienTai === 'phu-phi' ? 'bg-orange-50 text-orange-700 border border-orange-100 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              <Receipt size={20} /> Phụ Phí Tài Xế
            </button>
          </div>
        </div>

        <div className="p-5 border-t border-slate-100">
          <button onClick={dangXuat} className="w-full px-5 py-4 rounded-2xl font-bold text-left text-red-500 hover:bg-red-50 transition-colors flex items-center gap-3">
            <LogOut size={20}/> Đăng Xuất
          </button>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 p-10 overflow-y-auto">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-slate-800 tracking-tight">{tabHienTai === 'tai-xe' ? 'Xác nhận tiền COD từ Tài xế' : tabHienTai === 'ky-quy' ? 'Quản lý ký quỹ tài xế' : tabHienTai === 'phu-phi' ? 'Duyệt phụ phí tài xế' : 'Thanh Toán Thu Hộ (COD)'}</h1>
            <p className="text-slate-500 mt-2 font-medium">{tabHienTai === 'tai-xe' ? 'Đối chiếu số tiền mặt tài xế nộp và xác nhận đã nhận tại quầy.' : tabHienTai === 'ky-quy' ? 'Ghi nhận tiền ký quỹ sau khi Kế toán đã xác minh nhận tiền thực tế.' : tabHienTai === 'phu-phi' ? 'Kiểm tra biên lai; khoản được duyệt sẽ cộng vào bảng lương tháng phát sinh.' : 'Tính khoản Shop nhận sau khi trừ cước Shop trả, phí dịch vụ và bảo hiểm.'}</p>
          </div>
          <div className="flex items-center gap-4">
            {tabHienTai === 'cho-duyet' || tabHienTai === 'lich-su' ? (
              <label className="text-xs font-bold text-slate-500">Tháng đối soát
                <input type="month" value={settlementMonth} onChange={(event) => setSettlementMonth(event.target.value)} className="mt-1 block rounded-lg border border-slate-200 bg-white p-2 text-sm font-bold text-slate-700" />
              </label>
            ) : null}
            {['cho-duyet', 'lich-su'].includes(tabHienTai) && <div className="relative w-80">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="Tìm tên Shop hoặc Email..." 
                className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-xl outline-none focus:border-teal-400 focus:ring-4 focus:ring-teal-50 transition-all font-medium"
                value={tuKhoa}
                onChange={(e) => setTuKhoa(e.target.value)}
              />
            </div>}
            {tabHienTai === 'lich-su' && danhSachDaLoc.length > 0 && (
              <button type="button" onClick={xuatExcel} className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">Xuất Excel tháng</button>
            )}
          </div>
        </div>

        {tabHienTai === 'phu-phi' ? (
          <section className="overflow-hidden rounded-2xl border border-orange-100 bg-white shadow-sm">
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-orange-100 bg-orange-50 p-5">
              <div><h2 className="font-black text-slate-800">Yêu cầu hoàn phụ phí</h2><p className="mt-1 text-sm text-slate-500">Duyệt sẽ ghi khoản hoàn vào bảng lương; từ chối cần nêu lý do.</p></div>
              <div className="flex gap-2">
                <select value={expenseStatus} onChange={(event) => { setExpenseStatus(event.target.value); taiYeuCauPhuPhi(event.target.value); }} className="rounded-lg border border-orange-200 bg-white px-3 py-2 text-sm font-bold">
                  <option value="pending">Chờ duyệt</option><option value="approved">Đã duyệt</option><option value="rejected">Đã từ chối</option>
                </select>
                <button type="button" onClick={() => taiYeuCauPhuPhi()} className="rounded-lg border border-orange-200 bg-white px-3 py-2 text-sm font-bold text-orange-800">Làm mới</button>
              </div>
            </header>
            {(expenseError || expenseMessage) && <p role={expenseError ? 'alert' : 'status'} className={`m-5 rounded-lg p-3 text-sm font-semibold ${expenseError ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>{expenseError || expenseMessage}</p>}
            <div className="divide-y divide-slate-100">
              {expenseClaims.map((claim) => <article key={claim.id} className="grid gap-4 p-5 lg:grid-cols-[1fr_1fr_1fr_auto] lg:items-center">
                <div><p className="font-black text-slate-800">{claim.driver_name}</p><p className="mt-1 text-xs text-slate-500">Phiếu #{claim.id} · {new Date(claim.created_at).toLocaleString('vi-VN')}</p><p className="mt-2 text-sm text-slate-600">{claim.note}</p></div>
                <div><p className="text-xs font-bold uppercase text-slate-400">Khoản chi</p><p className="mt-1 font-bold text-slate-800">{({ toll: 'Cầu đường', parking: 'Gửi xe', fuel: 'Nhiên liệu', other: 'Khác' })[claim.expense_type]}</p><p className="text-lg font-black text-orange-700">{Number(claim.amount).toLocaleString()} đ</p></div>
                <div><a href={`http://localhost:5000${claim.receipt_image}`} target="_blank" rel="noreferrer" className="font-bold text-blue-700 underline">Xem ảnh biên lai</a>{claim.review_note && <p className="mt-2 text-sm text-slate-500">Ghi chú: {claim.review_note}</p>}</div>
                {claim.status === 'pending' && <div className="flex gap-2">
                  <button type="button" disabled={expenseBusyId === claim.id} onClick={() => xuLyYeuCauPhuPhi(claim, 'approved')} className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-50">Duyệt</button>
                  <button type="button" disabled={expenseBusyId === claim.id} onClick={() => xuLyYeuCauPhuPhi(claim, 'rejected')} className="rounded-lg bg-rose-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-50">Từ chối</button>
                </div>}
              </article>)}
              {!expenseClaims.length && !expenseError && <p className="p-10 text-center text-slate-500">Không có yêu cầu phụ phí trong trạng thái này.</p>}
            </div>
          </section>
        ) : tabHienTai === 'ky-quy' ? (
          <section className="overflow-hidden rounded-2xl border border-indigo-100 bg-white shadow-sm">
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-indigo-100 bg-indigo-50 p-5">
              <div><h2 className="font-black text-slate-800">Ký quỹ bảo đảm đơn COD</h2><p className="mt-1 text-sm text-slate-500">Chỉ ghi nhận nạp sau khi đã đối chiếu tiền nhận từ tài xế. Ký quỹ khả dụng = số dư - số đang giữ.</p></div>
              <button type="button" onClick={taiViKyQuyTaiXe} className="rounded-lg border border-indigo-200 bg-white px-3 py-2 text-sm font-bold text-indigo-800">Làm mới</button>
            </header>
            {(walletError || walletMessage) && <p role={walletError ? 'alert' : 'status'} className={`m-5 rounded-lg p-3 text-sm font-semibold ${walletError ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>{walletError || walletMessage}</p>}
            <div className="divide-y divide-slate-100">
              {driverWallets.map((driver) => <article key={driver.driver_id} className="grid gap-4 p-5 lg:grid-cols-[1fr_1fr_2fr] lg:items-center">
                <div><p className="font-black text-slate-800">{driver.full_name}</p><p className="mt-1 text-xs text-slate-500">Tài xế giao hàng · #{driver.driver_id}</p></div>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <p className="rounded-lg bg-indigo-50 p-2 text-indigo-800">Số dư<strong className="mt-1 block">{Number(driver.deposit_balance).toLocaleString()} đ</strong></p>
                  <p className="rounded-lg bg-amber-50 p-2 text-amber-800">Đang giữ<strong className="mt-1 block">{Number(driver.reserved_balance).toLocaleString()} đ</strong></p>
                  <p className="rounded-lg bg-emerald-50 p-2 text-emerald-800">Khả dụng<strong className="mt-1 block">{Number(driver.available_balance).toLocaleString()} đ</strong></p>
                </div>
                <form onSubmit={(event) => napKyQuyTaiXe(event, driver)} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                  <input name="amount" type="number" required min="1" max="100000000" step="0.01" placeholder="Số tiền đã nhận (đ)" className="min-w-0 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                  <input name="note" maxLength={200} placeholder="Mã phiếu / ghi chú (tùy chọn)" className="min-w-0 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                  <button type="submit" disabled={walletBusyDriverId === driver.driver_id} className="rounded-lg bg-indigo-700 px-4 py-2 text-sm font-black text-white hover:bg-indigo-800 disabled:opacity-50">{walletBusyDriverId === driver.driver_id ? 'Đang lưu...' : 'Xác nhận nạp'}</button>
                </form>
              </article>)}
              {!driverWallets.length && !walletError && <p className="p-10 text-center text-slate-500">Chưa có tài xế giao hàng đang hoạt động.</p>}
            </div>
          </section>
        ) : tabHienTai === 'tai-xe' ? (
          <section className="overflow-hidden rounded-2xl border border-amber-100 bg-white shadow-sm">
            <header className="flex items-center justify-between border-b border-amber-100 bg-amber-50 p-5">
              <div><h2 className="font-black text-slate-800">Phiếu chờ nhận tiền</h2><p className="mt-1 text-sm text-slate-500">Tài xế tạo phiếu từ ứng dụng; Kế toán xác nhận tiền mặt thực tế.</p></div>
              <button type="button" onClick={taiNopTienTaiXe} className="rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm font-bold text-amber-800">Làm mới</button>
            </header>
            <div className="divide-y divide-slate-100">
              {driverRemittances.map((remittance) => <article key={remittance.id} className="flex flex-wrap items-center justify-between gap-4 p-5">
                <div><p className="font-black text-slate-800">Shipper {remittance.driver_name}</p><p className="mt-1 text-xs text-slate-500">Phiếu #{remittance.id} · {new Date(remittance.created_at).toLocaleString('vi-VN')}</p></div>
                <strong className="text-xl text-amber-700">{Number(remittance.amount).toLocaleString()} đ</strong>
                <button type="button" onClick={() => xacNhanNopTienTaiXe(remittance)} className="rounded-xl bg-emerald-600 px-4 py-2.5 font-bold text-white">Đã nhận tiền mặt</button>
              </article>)}
              {!driverRemittances.length && <p className="p-10 text-center text-slate-500">Không có phiếu nộp tiền nào đang chờ.</p>}
            </div>
          </section>
        ) : (
          <>
        {/* THỐNG KÊ NHANH */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white p-6 rounded-[24px] shadow-sm border border-slate-200 flex items-center gap-5">
            <div className="bg-teal-50 p-4 rounded-2xl text-teal-600"><Building2 size={32}/></div>
            <div>
              <p className="text-slate-400 font-bold text-xs uppercase tracking-wider mb-1">{tabHienTai === 'cho-duyet' ? 'Đối Tác Cần Chi Trả' : 'Đợt Thanh Toán'}</p>
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
                <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-wider">Tổng COD</th>
                <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-wider">Cước shop trả</th>
                <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-wider">Tiền trả Shop</th>
                <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-wider text-right">Trạng Thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {danhSachDaLoc.length === 0 ? (
                <tr>
                  <td colSpan="6" className="p-16 text-center text-slate-400 font-medium bg-white">
                    {tabHienTai === 'cho-duyet' ? 'Hiện không có khoản công nợ COD nào cần thanh toán.' : 'Chưa có dữ liệu lịch sử thanh toán.'}
                  </td>
                </tr>
              ) : (
                danhSachDaLoc.map((item, index) => (
                  <tr key={tabHienTai === 'cho-duyet' ? `shop-${item?.shop_id || index}` : `settlement-${item?.settlement_id || index}`} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-6">
                      <p className="font-bold text-slate-800 text-base">{item?.shop_name || 'Đang cập nhật'}</p>
                      <p className="text-xs text-slate-500 mt-1">{item?.email || 'N/A'}</p>
                      {tabHienTai === 'lich-su' && item?.settled_at && (
                        <p className="text-xs text-slate-400 mt-1">{new Date(item.settled_at).toLocaleString('vi-VN')}</p>
                      )}
                    </td>
                    <td className="p-6">
                      <span className="bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg font-bold">
                        {item?.total_orders || 0} đơn
                      </span>
                    </td>
                    <td className="p-6 font-bold">{Number(item?.total_cod || 0).toLocaleString()} đ</td>
                    <td className="p-6 font-bold text-amber-700">{Number(item?.total_shipping_fee || 0).toLocaleString()} đ</td>
                    <td className="p-6">
                      <span className={`font-black text-xl ${tabHienTai === 'cho-duyet' ? 'text-red-500' : 'text-slate-700'}`}>
                        {Number(item?.total_payable ?? item?.total_paid ?? 0).toLocaleString()} đ
                      </span>
                    </td>
                    <td className="p-6 text-right">
                      {tabHienTai === 'cho-duyet' ? (
                        <button 
                          onClick={() => xacNhanThanhToan(item.shop_id, item.shop_name, item.total_payable)}
                          className="bg-teal-50 hover:bg-teal-500 hover:text-white text-teal-600 px-5 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 inline-flex"
                        >
                          <Wallet size={18} /> Đã Chuyển Khoản
                        </button>
                      ) : (
                        <button onClick={() => taiHoaDon(item.settlement_id).catch((error) => alert(error.message))} className="bg-emerald-50 text-emerald-700 px-4 py-2.5 rounded-xl font-bold text-sm inline-flex items-center gap-2 border border-emerald-100 hover:bg-emerald-100">
                          <Printer size={18} /> In hóa đơn PDF
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
          </>
        )}

      </div>
    </div>
  );
}