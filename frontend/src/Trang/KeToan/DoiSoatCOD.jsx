import { apiFetch as fetch } from '../../utils/apiFetch.js';
import { useState, useEffect } from 'react';
import { Calculator, Wallet, Building2, Receipt, LogOut, Banknote, Search, ArrowRightLeft, History, Printer, X, ShieldCheck, AlertCircle, FileText } from 'lucide-react';
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
  const [settlementCycle, setSettlementCycle] = useState('T+1');
  const [settlementCycleError, setSettlementCycleError] = useState('');
  const [failureFeeError, setFailureFeeError] = useState('');
  const [failureFeeMessage, setFailureFeeMessage] = useState('');
  const [failureFeeBusy, setFailureFeeBusy] = useState(false);
  const [reportPeriod, setReportPeriod] = useState('month');
  const [reportDate, setReportDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [reportFilters, setReportFilters] = useState({ warehouse_id: '', driver_id: '', shop_id: '' });
  const [reportData, setReportData] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState('');
  const [shippingRates, setShippingRates] = useState([]);
  const [payRules, setPayRules] = useState([]);
  const [pricingError, setPricingError] = useState('');
  const [pricingMessage, setPricingMessage] = useState('');
  const [pricingBusy, setPricingBusy] = useState(false);
  const [pricingList, setPricingList] = useState('rates');
  const [holidayDatesText, setHolidayDatesText] = useState('');
  const [incidents, setIncidents] = useState([]);
  const [incidentDrafts, setIncidentDrafts] = useState({});
  const [incidentError, setIncidentError] = useState('');
  const [incidentMessage, setIncidentMessage] = useState('');
  const [incidentBusyId, setIncidentBusyId] = useState(null);
  const [warehouseIncidentDraft, setWarehouseIncidentDraft] = useState({ incident_type: 'damaged_goods', order_id: '', description: '' });
  const [payrollMonth, setPayrollMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [payrollPeriod, setPayrollPeriod] = useState(null);
  const [payrollLoading, setPayrollLoading] = useState(false);
  const [payrollBusy, setPayrollBusy] = useState(false);
  const [payrollError, setPayrollError] = useState('');
  const [payrollMessage, setPayrollMessage] = useState('');
  const [selectedPayslip, setSelectedPayslip] = useState(null);
  
  const accountantName = localStorage.getItem('full_name') || 'Phòng Kế Toán';
  const canLockPayroll = (localStorage.getItem('role') || localStorage.getItem('user_role')) === 'director';

  const taiKyLuong = async () => {
    setPayrollLoading(true);
    setPayrollError('');
    setPayrollMessage('');
    setSelectedPayslip(null);
    try {
      const response = await fetch(`http://localhost:5000/api/hr/payroll/period/${payrollMonth}`);
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || 'Không tải được kỳ lương.');
      setPayrollPeriod(result.data);
    } catch (error) {
      setPayrollPeriod(null);
      setPayrollError(error.message || 'Không tải được kỳ lương.');
    } finally {
      setPayrollLoading(false);
    }
  };

  const chotKyLuong = async () => {
    if (!canLockPayroll || payrollBusy) return;
    if (!window.confirm(`Chốt kỳ lương ${payrollMonth}? Sau khi chốt, dữ liệu chỉ được thay đổi qua điều chỉnh có audit.`)) return;
    setPayrollBusy(true);
    setPayrollError('');
    setPayrollMessage('');
    try {
      const response = await fetch(`http://localhost:5000/api/hr/payroll/period/${payrollMonth}/lock`, { method: 'POST' });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || 'Không chốt được kỳ lương.');
      await taiKyLuong();
      setPayrollMessage(result.message || 'Đã chốt kỳ lương.');
    } catch (error) {
      setPayrollError(error.message || 'Không chốt được kỳ lương.');
    } finally {
      setPayrollBusy(false);
    }
  };

  const taiChiTietPhieuLuong = async (userId) => {
    setPayrollError('');
    try {
      const response = await fetch(`http://localhost:5000/api/hr/payroll/payslips/${userId}?month=${encodeURIComponent(payrollMonth)}`);
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || 'Không tải được chi tiết phiếu lương.');
      setSelectedPayslip(result.data);
    } catch (error) {
      setPayrollError(error.message || 'Không tải được chi tiết phiếu lương.');
    }
  };

  const taiPhieuLuongPdf = async (userId) => {
    const response = await fetch(`http://localhost:5000/api/hr/payroll/payslips/${userId}/pdf?month=${encodeURIComponent(payrollMonth)}`);
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      throw new Error(result.message || 'Không tải được PDF phiếu lương.');
    }
    const fileUrl = URL.createObjectURL(await response.blob());
    const link = document.createElement('a');
    link.href = fileUrl;
    link.download = `phieu-luong-${userId}-${payrollMonth}.pdf`;
    link.click();
    URL.revokeObjectURL(fileUrl);
  };

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
      const res = await fetch(`http://localhost:5000/api/accountant/history?month=${settlementMonth}`);
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

  const taiChuKyDoiSoat = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/accountant/settlement-cycle');
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Không tải được chu kỳ đối soát.');
      setSettlementCycle(data.data.cycle);
    } catch (error) {
      setSettlementCycleError(error.message || 'Không tải được chu kỳ đối soát.');
    }
  };

  const capNhatChuKyDoiSoat = async (cycle) => {
    setSettlementCycle(cycle);
    setSettlementCycleError('');
    try {
      const response = await fetch('http://localhost:5000/api/accountant/settlement-cycle', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cycle })
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Không lưu được chu kỳ đối soát.');
      setSettlementCycle(data.data.cycle);
    } catch (error) {
      setSettlementCycleError(error.message || 'Không lưu được chu kỳ đối soát.');
      await taiChuKyDoiSoat();
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

  const taiBaoCao = async () => {
    setReportLoading(true);
    setReportError('');
    try {
      const params = new URLSearchParams({ period: reportPeriod, date: reportDate });
      Object.entries(reportFilters).forEach(([key, value]) => {
        if (value.trim()) params.set(key, value.trim());
      });
      const response = await fetch(`http://localhost:5000/api/accountant/reports?${params.toString()}`);
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || 'Không tải được báo cáo.');
      setReportData(result.data);
    } catch (error) {
      setReportError(error.message || 'Không tải được báo cáo.');
    } finally {
      setReportLoading(false);
    }
  };

  const taiBangGiaVaQuyTac = async () => {
    setPricingError('');
    try {
      const [ratesResponse, rulesResponse, holidaysResponse] = await Promise.all([
        fetch('http://localhost:5000/api/accountant/shipping-rates'),
        fetch('http://localhost:5000/api/accountant/pay-rules'),
        fetch('http://localhost:5000/api/accountant/holidays')
      ]);
      const [ratesResult, rulesResult, holidaysResult] = await Promise.all([
        ratesResponse.json(), rulesResponse.json(), holidaysResponse.json()
      ]);
      if (!ratesResponse.ok || !ratesResult.success) throw new Error(ratesResult.message || 'Không tải được bảng giá.');
      if (!rulesResponse.ok || !rulesResult.success) throw new Error(rulesResult.message || 'Không tải được quy tắc lương.');
      if (!holidaysResponse.ok || !holidaysResult.success) throw new Error(holidaysResult.message || 'Không tải được ngày lễ.');
      setShippingRates(ratesResult.data || []);
      setPayRules(rulesResult.data || []);
      setHolidayDatesText((holidaysResult.data?.dates || []).join('\n'));
    } catch (error) {
      setPricingError(error.message || 'Không tải được dữ liệu bảng giá và lương.');
    }
  };

  const taiDanhSachSuCo = async () => {
    setIncidentError('');
    try {
      const response = await fetch('http://localhost:5000/api/dispatcher/incidents');
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || 'Không tải được sự cố.');
      setIncidents(result.data || []);
      setIncidentDrafts(Object.fromEntries((result.data || []).map((incident) => [incident.id, {
        status: incident.status === 'open' ? 'acknowledged' : incident.status,
        fault_party: incident.fault_party || 'company',
        customer_compensation_amount: incident.customer_compensation_amount || '0',
        shop_compensation_amount: incident.shop_compensation_amount || '0',
        driver_deduction_amount: incident.driver_deduction_amount || incident.claim_amount || '0',
        salary_penalty_amount: incident.salary_penalty_amount || '0',
        review_note: incident.review_note || ''
      }])));
    } catch (error) {
      setIncidentError(error.message || 'Không tải được sự cố.');
    }
  };

  const luuXuLySuCo = async (incidentId) => {
    setIncidentBusyId(incidentId);
    setIncidentError('');
    setIncidentMessage('');
    try {
      const response = await fetch(`http://localhost:5000/api/dispatcher/incidents/${incidentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(incidentDrafts[incidentId])
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || 'Không xử lý được sự cố.');
      setIncidentMessage(result.message);
      await taiDanhSachSuCo();
    } catch (error) {
      setIncidentError(error.message || 'Không xử lý được sự cố.');
    } finally {
      setIncidentBusyId(null);
    }
  };

  const taoSuCoKho = async (event) => {
    event.preventDefault();
    setIncidentError('');
    setIncidentMessage('');
    try {
      const response = await fetch('http://localhost:5000/api/dispatcher/incidents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...warehouseIncidentDraft, order_id: warehouseIncidentDraft.order_id || null })
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || 'Không ghi nhận được sự cố kho.');
      setIncidentMessage(result.message);
      setWarehouseIncidentDraft({ incident_type: 'damaged_goods', order_id: '', description: '' });
      await taiDanhSachSuCo();
    } catch (error) {
      setIncidentError(error.message || 'Không ghi nhận được sự cố kho.');
    }
  };

  const taoPhienBanPricing = async (event, endpoint, successMessage) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const body = Object.fromEntries(formData.entries());
    Object.keys(body).forEach((key) => {
      if (body[key] === '') body[key] = null;
    });
    setPricingBusy(true);
    setPricingError('');
    setPricingMessage('');
    try {
      const response = await fetch(`http://localhost:5000/api/accountant/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || 'Không lưu được phiên bản cấu hình.');
      setPricingMessage(successMessage);
      await taiBangGiaVaQuyTac();
    } catch (error) {
      setPricingError(error.message || 'Không lưu được phiên bản cấu hình.');
    } finally {
      setPricingBusy(false);
    }
  };

  const luuNgayLe = async (event) => {
    event.preventDefault();
    setPricingBusy(true);
    setPricingError('');
    setPricingMessage('');
    try {
      const dates = holidayDatesText.split(/[\s,;]+/).map((date) => date.trim()).filter(Boolean);
      const response = await fetch('http://localhost:5000/api/accountant/holidays', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dates })
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || 'Không lưu được ngày lễ.');
      setHolidayDatesText(result.data.dates.join('\n'));
      setPricingMessage(result.message);
    } catch (error) {
      setPricingError(error.message || 'Không lưu được ngày lễ.');
    } finally {
      setPricingBusy(false);
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

  const capNhatPhiGiaoThatBai = async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    setFailureFeeBusy(true);
    setFailureFeeError('');
    setFailureFeeMessage('');
    try {
      const orderId = String(formData.get('order_id') || '').trim();
      const response = await fetch(`http://localhost:5000/api/accountant/orders/${encodeURIComponent(orderId)}/failure-fee`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: formData.get('amount'), note: formData.get('note') })
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Không ghi nhận được phí giao thất bại.');
      setFailureFeeMessage(data.message);
      form.reset();
    } catch (error) {
      setFailureFeeError(error.message || 'Không ghi nhận được phí giao thất bại.');
    } finally {
      setFailureFeeBusy(false);
    }
  };

  useEffect(() => {
    taiDuLieuCongNo();
    taiChuKyDoiSoat();
  }, []);

  useEffect(() => {
    taiDuLieuCongNo();
    taiLichSuDoiSoat();
  }, [settlementMonth]);

  const taiHoaDon = async (settlementId) => {
    const response = await fetch(`http://localhost:5000/api/accountant/settlements/${settlementId}`);
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.message || 'Không tải được hóa đơn đối soát.');
    setHoaDon(data.data);
  };

  const xacNhanThanhToan = async (shopId, shopName, amount) => {
    const paymentReference = window.prompt(`Nhập mã giao dịch chuyển khoản cho shop ${shopName} (có thể để trống):`, '');
    if (paymentReference === null) return;
    const xacNhan = window.confirm(`Xác nhận bạn đã chuyển khoản ${Number(amount).toLocaleString()} đ cho shop [${shopName}]?`);
    if (!xacNhan) return;

    try {
      const res = await fetch(`http://localhost:5000/api/accountant/pay/${shopId}?month=${settlementMonth}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payment_method: 'bank_transfer', payment_reference: paymentReference.trim() })
      });
      const data = await res.json();

      if (!res.ok || !data.success) throw new Error(data.message || 'Không thể hoàn tất đối soát.');
      alert(`✅ Đã đối soát thành công cho shop ${shopName}!`);
      taiDuLieuCongNo();
      taiLichSuDoiSoat();
      await taiHoaDon(data.settlement_id);
    } catch (error) {
      alert(error.message || 'Lỗi kết nối đến hệ thống!');
    }
  };

  const xacNhanNopTienTaiXe = async (remittance) => {
    const difference = Number(remittance.variance_amount || 0);
    if (!window.confirm(
      `Xác nhận đã nhận ${Number(remittance.amount).toLocaleString()} đ tiền mặt từ Shipper ${remittance.driver_name}?\n` +
      `Ngày làm việc: ${remittance.work_date} · Phải nộp: ${Number(remittance.expected_amount).toLocaleString()} đ · Chênh lệch: ${difference.toLocaleString()} đ`
    )) return;
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
    const rows = anToanLichSu
      .filter((item) => String(item.settled_at).slice(0, 7) === settlementMonth)
      .map((item) => ({
      'Mã đối soát': item.settlement_id,
      'Mã Shop': item.shop_id,
      'Cửa hàng': item.shop_name,
      Email: item.email,
      'Số đơn': item.total_orders,
      'Tổng COD': Number(item.total_cod),
      'Cước shop trả': Number(item.total_shipping_fee),
      'Phí dịch vụ': Number(item.total_service_fee || 0),
      'Phí bảo hiểm': Number(item.total_insurance_fee || 0),
      'Phí giao thất bại': Number(item.total_failure_fee || 0),
      'Shop nhận': Number(item.total_paid),
      'Chu kỳ': item.cycle_code || settlementCycle,
      'Từ ngày': item.period_start || '',
      'Đến ngày': item.period_end || '',
      'Mã tham chiếu chuyển tiền': item.payment_reference || '',
      'Phương thức': item.payment_method || '',
      'Thời gian': new Date(item.settled_at).toLocaleString('vi-VN')
    }));
    if (!rows.length) {
      window.alert('Không có phiếu đối soát trong tháng được chọn để xuất.');
      return;
    }
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), 'Lenh chuyen tien');
    XLSX.writeFile(workbook, `lenh-chuyen-tien-cod-${settlementMonth}.xlsx`);
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
  const pricingInput = (name, label, { value = '', min = undefined, step = '1', type = 'number', required = false } = {}) => (
    <label key={name} className="text-xs font-bold text-slate-500">
      {label}
      <input name={name} type={type} min={min} step={step} defaultValue={value} required={required} className="mt-1 w-full rounded-lg border p-2 text-sm" />
    </label>
  );
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
                    <p className="mb-4 text-sm text-slate-500">{hoaDon.email} · {new Date(hoaDon.settled_at).toLocaleString('vi-VN')} · Chu kỳ {hoaDon.cycle_code} ({hoaDon.period_start}–{hoaDon.period_end})</p>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[650px] text-left text-sm">
                        <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-3">Mã đơn</th><th className="p-3">Người nhận</th><th className="p-3">COD</th><th className="p-3">Cước</th><th className="p-3">Phí dịch vụ + bảo hiểm</th><th className="p-3">Phí giao thất bại</th><th className="p-3">Shop nhận</th></tr></thead>
                        <tbody className="divide-y divide-slate-100">
                          {hoaDon.orders.map((order) => {
                            const shopReceives = Number(order.cod_amount || 0)
                              - (order.fee_payer === 'sender' ? Number(order.shipping_fee || 0) : 0)
                              - Number(order.service_fee || 0) - Number(order.insurance_fee || 0) - Number(order.failure_fee || 0);
                            return <tr key={order.id}><td className="p-3 font-bold">{order.tracking_code}</td><td className="p-3">{order.receiver_name}<br /><span className="text-xs text-slate-500">{order.receiver_phone}</span></td><td className="p-3">{Number(order.cod_amount || 0).toLocaleString()} đ</td><td className="p-3">{Number(order.shipping_fee || 0).toLocaleString()} đ · {order.fee_payer === 'sender' ? 'Shop' : 'Khách'}</td><td className="p-3">{(Number(order.service_fee || 0) + Number(order.insurance_fee || 0)).toLocaleString()} đ</td><td className="p-3 text-rose-700">{Number(order.failure_fee || 0).toLocaleString()} đ</td><td className="p-3 font-bold">{shopReceives.toLocaleString()} đ</td></tr>;
                          })}
                        </tbody>
                      </table>
                    </div>
                    <div className="ml-auto mt-6 max-w-sm space-y-2 border-t border-slate-200 pt-4 text-sm">
                      <div className="flex justify-between"><span>Tổng COD</span><strong>{Number(hoaDon.total_cod).toLocaleString()} đ</strong></div>
                      <div className="flex justify-between"><span>Cước trừ của Shop</span><strong>-{Number(hoaDon.total_shipping_fee).toLocaleString()} đ</strong></div>
                      <div className="flex justify-between"><span>Phí dịch vụ</span><strong>-{Number(hoaDon.total_service_fee || 0).toLocaleString()} đ</strong></div>
                      <div className="flex justify-between"><span>Phí bảo hiểm</span><strong>-{Number(hoaDon.total_insurance_fee || 0).toLocaleString()} đ</strong></div>
                      <div className="flex justify-between"><span>Phí giao thất bại</span><strong>-{Number(hoaDon.total_failure_fee || 0).toLocaleString()} đ</strong></div>
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
                    <thead><tr>{['Mã đơn', 'Người nhận', 'COD', 'Cước', 'Người trả cước', 'Phí giao thất bại', 'Shop nhận'].map((heading) => <th key={heading} className="border border-slate-400 p-2">{heading}</th>)}</tr></thead>
                    <tbody>{hoaDon.orders.map((order) => <tr key={order.id}><td className="border border-slate-400 p-2">{order.tracking_code}</td><td className="border border-slate-400 p-2">{order.receiver_name}<br />{order.receiver_phone}</td><td className="border border-slate-400 p-2">{Number(order.cod_amount || 0).toLocaleString()} đ</td><td className="border border-slate-400 p-2">{Number(order.shipping_fee || 0).toLocaleString()} đ</td><td className="border border-slate-400 p-2">{order.fee_payer === 'sender' ? 'Người gửi' : 'Người nhận'}</td><td className="border border-slate-400 p-2">{Number(order.failure_fee || 0).toLocaleString()} đ</td><td className="border border-slate-400 p-2">{(Number(order.cod_amount || 0) - (order.fee_payer === 'sender' ? Number(order.shipping_fee || 0) : 0) - Number(order.service_fee || 0) - Number(order.insurance_fee || 0) - Number(order.failure_fee || 0)).toLocaleString()} đ</td></tr>)}</tbody>
                  </table>
                  <div className="ml-auto mt-6 max-w-sm space-y-2 text-right">
                    <p>Tổng COD: <strong>{Number(hoaDon.total_cod).toLocaleString()} đ</strong></p>
                    <p>Cước trừ của Shop: <strong>-{Number(hoaDon.total_shipping_fee).toLocaleString()} đ</strong></p>
                    <p>Phí dịch vụ: <strong>-{Number(hoaDon.total_service_fee || 0).toLocaleString()} đ</strong></p>
                    <p>Bảo hiểm: <strong>-{Number(hoaDon.total_insurance_fee || 0).toLocaleString()} đ</strong></p>
                    <p>Phí giao thất bại: <strong>-{Number(hoaDon.total_failure_fee || 0).toLocaleString()} đ</strong></p>
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
            <button
              onClick={() => { setTabHienTai('reports'); taiBaoCao(); }}
              className={`w-full px-5 py-4 rounded-2xl font-bold flex items-center gap-4 transition-all ${tabHienTai === 'reports' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              <History size={20} /> Báo Cáo & Đối Soát
            </button>
            <button
              onClick={() => { setTabHienTai('pricing'); taiBangGiaVaQuyTac(); }}
              className={`w-full px-5 py-4 rounded-2xl font-bold flex items-center gap-4 transition-all ${tabHienTai === 'pricing' ? 'bg-blue-50 text-blue-700 border border-blue-100 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              <Calculator size={20} /> Bảng Giá & Quy Tắc Lương
            </button>
            <button
              onClick={() => { setTabHienTai('incidents'); taiDanhSachSuCo(); }}
              className={`w-full px-5 py-4 rounded-2xl font-bold flex items-center gap-4 transition-all ${tabHienTai === 'incidents' ? 'bg-rose-50 text-rose-700 border border-rose-100 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              <AlertCircle size={20} /> Xử Lý Sự Cố
            </button>
            {canLockPayroll && (
              <button
                onClick={() => { setTabHienTai('payroll'); taiKyLuong(); }}
                className={`w-full px-5 py-4 rounded-2xl font-bold flex items-center gap-4 transition-all ${tabHienTai === 'payroll' ? 'bg-violet-50 text-violet-700 border border-violet-100 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
              >
                <FileText size={20} /> Chốt Lương & Phiếu Lương
              </button>
            )}
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
            <h1 className="text-3xl font-black text-slate-800 tracking-tight">{tabHienTai === 'incidents' ? 'Xử lý sự cố và bồi thường' : tabHienTai === 'tai-xe' ? 'Xác nhận tiền COD từ Tài xế' : tabHienTai === 'ky-quy' ? 'Quản lý ký quỹ tài xế' : tabHienTai === 'phu-phi' ? 'Duyệt phụ phí tài xế' : tabHienTai === 'reports' ? 'Báo cáo tài chính và đối soát' : tabHienTai === 'pricing' ? 'Bảng giá vận chuyển & quy tắc lương' : tabHienTai === 'payroll' ? 'Chốt kỳ lương & phiếu lương chi tiết' : 'Thanh Toán Thu Hộ (COD)'}</h1>
            <p className="text-slate-500 mt-2 font-medium">{tabHienTai === 'incidents' ? 'Đối chiếu giá khai, bên chịu trách nhiệm, bồi thường khách/Shop, khấu trừ ký quỹ và phạt lương.' : tabHienTai === 'tai-xe' ? 'Đối chiếu số tiền mặt tài xế nộp và xác nhận tiền mặt thực tế.' : tabHienTai === 'ky-quy' ? 'Ghi nhận tiền ký quỹ sau khi Kế toán đã xác minh nhận tiền thực tế.' : tabHienTai === 'phu-phi' ? 'Kiểm tra biên lai; khoản được duyệt sẽ cộng vào bảng lương tháng phát sinh.' : tabHienTai === 'reports' ? 'Lọc theo ngày, tuần hoặc tháng; tổng hợp đơn, COD, phiếu thu và phiếu chi.' : tabHienTai === 'pricing' ? 'Mỗi lần lưu sẽ tạo phiên bản mới có ngày hiệu lực và ghi nhật ký audit.' : tabHienTai === 'payroll' ? 'Xem trạng thái kỳ lương, chốt kỳ và mở phiếu lương đã chốt.' : 'Đối soát theo chu kỳ đã cấu hình; trừ cước, phí dịch vụ, bảo hiểm và phí giao thất bại đã được ghi nhận.'}</p>
          </div>
          <div className="flex items-center gap-4">
            {tabHienTai === 'payroll' ? (
              <div className="flex flex-wrap items-end gap-2">
                <label className="text-xs font-bold text-slate-500">Tháng lương
                  <input type="month" value={payrollMonth} onChange={(event) => setPayrollMonth(event.target.value)} className="mt-1 block rounded-lg border border-slate-200 bg-white p-2 text-sm font-bold" />
                </label>
                <button type="button" onClick={taiKyLuong} disabled={payrollLoading} className="rounded-lg bg-violet-700 px-4 py-2 font-bold text-white disabled:opacity-50">{payrollLoading ? 'Đang tải...' : 'Tải kỳ lương'}</button>
              </div>
            ) : tabHienTai === 'reports' ? (
              <div className="flex flex-wrap items-end gap-2">
                <label className="text-xs font-bold text-slate-500">Kỳ báo cáo<select value={reportPeriod} onChange={(event) => setReportPeriod(event.target.value)} className="mt-1 block rounded-lg border border-slate-200 bg-white p-2 text-sm font-bold"><option value="day">Ngày</option><option value="week">Tuần</option><option value="month">Tháng</option></select></label>
                <label className="text-xs font-bold text-slate-500">Ngày<input type="date" value={reportDate} onChange={(event) => setReportDate(event.target.value)} className="mt-1 block rounded-lg border border-slate-200 bg-white p-2 text-sm font-bold" /></label>
                {Object.entries(reportFilters).map(([key, value]) => <label key={key} className="text-xs font-bold text-slate-500">{({ warehouse_id: 'ID kho/khu vực', driver_id: 'ID tài xế', shop_id: 'ID Shop' })[key]}<input type="number" min="1" value={value} onChange={(event) => setReportFilters((current) => ({ ...current, [key]: event.target.value }))} className="mt-1 block w-28 rounded-lg border border-slate-200 bg-white p-2 text-sm font-bold" /></label>)}
                <button type="button" onClick={taiBaoCao} disabled={reportLoading} className="rounded-lg bg-emerald-700 px-4 py-2 font-bold text-white disabled:opacity-50">{reportLoading ? 'Đang tải...' : 'Lọc báo cáo'}</button>
              </div>
            ) : tabHienTai === 'cho-duyet' || tabHienTai === 'lich-su' ? (
              <div className="flex flex-wrap items-end gap-3">
                <label className="text-xs font-bold text-slate-500">Tháng đối soát
                  <input type="month" value={settlementMonth} onChange={(event) => setSettlementMonth(event.target.value)} className="mt-1 block rounded-lg border border-slate-200 bg-white p-2 text-sm font-bold text-slate-700" />
                </label>
                <label className="text-xs font-bold text-slate-500">Chu kỳ thanh toán Shop
                  <select value={settlementCycle} onChange={(event) => capNhatChuKyDoiSoat(event.target.value)} className="mt-1 block rounded-lg border border-slate-200 bg-white p-2 text-sm font-bold text-slate-700">
                    <option value="T+1">T+1</option><option value="T+2">T+2</option><option value="T+3">T+3</option><option value="WEEKLY">Theo tuần</option>
                  </select>
                </label>
                {settlementCycleError && <span role="alert" className="text-xs font-semibold text-rose-700">{settlementCycleError}</span>}
              </div>
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
              <div className="text-right">
                <button type="button" onClick={xuatExcel} className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">Xuất danh sách chuyển tiền</button>
                <p className="mt-1 text-[11px] text-slate-500">Excel chưa gồm số tài khoản ngân hàng Shop do hồ sơ hiện chưa lưu dữ liệu này.</p>
              </div>
            )}
          </div>
        </div>

        {tabHienTai === 'incidents' ? (
          <section className="space-y-5">
            {incidentError && <p role="alert" className="rounded-xl bg-rose-50 p-4 font-bold text-rose-700">{incidentError}</p>}
            {incidentMessage && <p role="status" className="rounded-xl bg-emerald-50 p-4 font-bold text-emerald-700">{incidentMessage}</p>}
            <form onSubmit={taoSuCoKho} className="grid gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-5 md:grid-cols-[1fr_1fr_2fr_auto]">
              <select value={warehouseIncidentDraft.incident_type} onChange={(event) => setWarehouseIncidentDraft((current) => ({ ...current, incident_type: event.target.value }))} className="rounded-lg border border-amber-200 bg-white p-2">
                <option value="damaged_goods">Hư hỏng tại kho tổng</option><option value="lost_goods">Thất lạc tại kho tổng</option>
              </select>
              <input type="number" min="1" value={warehouseIncidentDraft.order_id} onChange={(event) => setWarehouseIncidentDraft((current) => ({ ...current, order_id: event.target.value }))} placeholder="Mã đơn (không bắt buộc)" className="rounded-lg border border-amber-200 p-2" />
              <input required maxLength={2000} value={warehouseIncidentDraft.description} onChange={(event) => setWarehouseIncidentDraft((current) => ({ ...current, description: event.target.value }))} placeholder="Mô tả sự cố kho tổng (lỗi công ty, không gắn tài xế)" className="rounded-lg border border-amber-200 p-2" />
              <button className="rounded-lg bg-amber-700 px-4 py-2 font-bold text-white">Ghi nhận sự cố kho</button>
            </form>
            {incidents.map((incident) => {
              const draft = incidentDrafts[incident.id] || {};
              const updateDraft = (field, value) => setIncidentDrafts((current) => ({
                ...current, [incident.id]: { ...current[incident.id], [field]: value }
              }));
              return (
                <article key={incident.id} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap justify-between gap-2">
                    <div>
                      <h2 className="font-black">{incident.driver_name} · {incident.incident_type.replaceAll('_', ' ')}</h2>
                      <p className="text-sm text-slate-500">Đơn {incident.tracking_code || incident.order_id || 'không gắn đơn'} · Lý do {incident.reason_code || 'chưa gán'} · Giá khai {String(incident.declared_value || '0')} đ</p>
                      <p className="mt-2 text-sm">{incident.description}</p>
                      {incident.evidence_url && <a className="text-sm font-bold text-blue-700 underline" href={`http://localhost:5000${incident.evidence_url}`} target="_blank" rel="noreferrer">Xem bằng chứng</a>}
                    </div>
                    <span className="text-sm font-bold">{incident.status === 'resolved' ? 'Đã giải quyết' : incident.status === 'acknowledged' ? 'Đã tiếp nhận' : 'Mới'}</span>
                  </div>
                  {incident.status !== 'resolved' && (
                    <div className="grid gap-2 border-t pt-3 md:grid-cols-3 xl:grid-cols-4">
                      <select value={draft.status || 'acknowledged'} onChange={(event) => updateDraft('status', event.target.value)} className="rounded-lg border p-2"><option value="acknowledged">Tiếp nhận</option><option value="resolved">Giải quyết</option></select>
                      <select value={draft.fault_party || 'company'} onChange={(event) => updateDraft('fault_party', event.target.value)} className="rounded-lg border p-2"><option value="customer">Khách</option><option value="shop">Shop</option><option value="driver">Tài xế</option><option value="company">Công ty</option><option value="force_majeure">Bất khả kháng</option></select>
                      <input type="number" min="0" step="1" value={draft.customer_compensation_amount || '0'} onChange={(event) => updateDraft('customer_compensation_amount', event.target.value)} placeholder="Bồi thường khách (đ)" className="rounded-lg border p-2" />
                      <input type="number" min="0" step="1" value={draft.shop_compensation_amount || '0'} onChange={(event) => updateDraft('shop_compensation_amount', event.target.value)} placeholder="Bồi thường Shop (đ)" className="rounded-lg border p-2" />
                      <input type="number" min="0" step="1" value={draft.driver_deduction_amount || '0'} onChange={(event) => updateDraft('driver_deduction_amount', event.target.value)} placeholder="Khấu trừ ký quỹ (đ)" className="rounded-lg border p-2" />
                      <input type="number" min="0" step="1" value={draft.salary_penalty_amount || '0'} onChange={(event) => updateDraft('salary_penalty_amount', event.target.value)} placeholder="Phạt lương (đ)" className="rounded-lg border p-2" />
                      <input value={draft.review_note || ''} onChange={(event) => updateDraft('review_note', event.target.value)} placeholder="Ghi chú; tối thiểu 5 ký tự khi giải quyết" className="rounded-lg border p-2 xl:col-span-2" />
                      <button type="button" onClick={() => luuXuLySuCo(incident.id)} disabled={incidentBusyId === incident.id} className="rounded-lg bg-slate-900 px-4 py-2 font-bold text-white disabled:opacity-50">{incidentBusyId === incident.id ? 'Đang lưu...' : 'Lưu xử lý'}</button>
                    </div>
                  )}
                </article>
              );
            })}
            {!incidents.length && <p className="rounded-xl bg-white p-8 text-center text-slate-500">Không có sự cố cần hiển thị.</p>}
          </section>
        ) : tabHienTai === 'pricing' ? (
          <section className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
              <div><h2 className="font-black text-slate-800">Cấu hình theo ngày hiệu lực</h2><p className="mt-1 text-sm text-slate-500">Tạo phiên bản mới; không sửa giá đã được snapshot trên đơn cũ.</p></div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setPricingList('rates')} className={`rounded-lg px-4 py-2 text-sm font-bold ${pricingList === 'rates' ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-600'}`}>Bảng giá</button>
                <button type="button" onClick={() => setPricingList('rules')} className={`rounded-lg px-4 py-2 text-sm font-bold ${pricingList === 'rules' ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-600'}`}>Quy tắc lương</button>
                <button type="button" onClick={taiBangGiaVaQuyTac} className="rounded-lg border px-4 py-2 text-sm font-bold">Làm mới</button>
              </div>
            </div>
            {(pricingError || pricingMessage) && <p role={pricingError ? 'alert' : 'status'} className={`rounded-lg p-3 text-sm font-semibold ${pricingError ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>{pricingError || pricingMessage}</p>}
            {pricingList === 'rates' ? (
              <>
                <form onSubmit={(event) => taoPhienBanPricing(event, 'shipping-rates', 'Đã lưu phiên bản bảng giá và audit.')} className="grid gap-3 rounded-2xl border bg-white p-5 shadow-sm md:grid-cols-4">
                  <h3 className="font-black md:col-span-4">Thêm phiên bản cước vận chuyển</h3>
                  {pricingInput('area_code', 'Khu vực', { value: 'GOVAP_ALL', type: 'text', required: true })}
                  <label className="text-xs font-bold text-slate-500">Dịch vụ<select name="service_type" defaultValue="standard" className="mt-1 w-full rounded-lg border p-2 text-sm"><option value="economy">Tiết kiệm</option><option value="standard">Tiêu chuẩn</option><option value="express">Nhanh</option></select></label>
                  {pricingInput('min_weight_kg', 'Khối lượng từ (kg)', { value: '0', min: '0', step: '0.001', required: true })}
                  {pricingInput('max_weight_kg', 'Đến kg (trống = mở)', { min: '0.001', step: '0.001' })}
                  {pricingInput('base_fee', 'Phí nền (VND)', { min: '0', required: true })}
                  {pricingInput('included_distance_km', 'Km đã gồm', { value: '0', min: '0', step: '0.001', required: true })}
                  {pricingInput('distance_fee_per_km', 'Phí / km vượt (VND)', { value: '0', min: '0', required: true })}
                  {pricingInput('included_weight_kg', 'Kg đã gồm', { value: '0', min: '0', step: '0.001', required: true })}
                  {pricingInput('weight_step_kg', 'Bước kg', { value: '1', min: '0.001', step: '0.001', required: true })}
                  {pricingInput('weight_step_fee', 'Phí / bước kg (VND)', { value: '0', min: '0', required: true })}
                  {pricingInput('remote_area_fee', 'Phụ phí khu vực xa (VND)', { value: '0', min: '0', required: true })}
                  {pricingInput('fragile_fee', 'Phụ phí hàng dễ vỡ (VND)', { value: '0', min: '0', required: true })}
                  {pricingInput('motorbike_multiplier_milli', 'Hệ số xe máy (x1000)', { value: '1000', min: '1', required: true })}
                  {pricingInput('van_multiplier_milli', 'Hệ số xe van (x1000)', { value: '1500', min: '1', required: true })}
                  {pricingInput('truck_multiplier_milli', 'Hệ số xe tải (x1000)', { value: '2500', min: '1', required: true })}
                  {pricingInput('rounding_increment', 'Bước làm tròn (VND)', { value: '1000', min: '1', required: true })}
                  {pricingInput('effective_from', 'Có hiệu lực từ', { type: 'date', value: new Date().toISOString().slice(0, 10), required: true })}
                  {pricingInput('effective_to', 'Đến hết ngày', { type: 'date' })}
                  <button type="submit" disabled={pricingBusy} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-black text-white disabled:opacity-50 md:col-span-4">{pricingBusy ? 'Đang lưu...' : 'Lưu phiên bản bảng giá'}</button>
                </form>
                <div className="overflow-x-auto rounded-2xl border bg-white shadow-sm">
                  <table className="w-full min-w-[780px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-3">Khu vực / dịch vụ</th><th className="p-3">Khoảng kg</th><th className="p-3">Phí nền</th><th className="p-3">Phí km / bước kg</th><th className="p-3">Phụ phí</th><th className="p-3">Hiệu lực</th></tr></thead>
                    <tbody className="divide-y">{shippingRates.map((rate) => <tr key={rate.id}><td className="p-3 font-bold">{rate.area_code} · {rate.service_type}</td><td className="p-3">{rate.min_weight_kg}–{rate.max_weight_kg ?? '∞'} kg</td><td className="p-3">{Number(rate.base_fee).toLocaleString()} đ</td><td className="p-3">{Number(rate.distance_fee_per_km).toLocaleString()} đ/km · {Number(rate.weight_step_fee).toLocaleString()} đ/{rate.weight_step_kg} kg</td><td className="p-3">{Number(rate.remote_area_fee).toLocaleString()} / {Number(rate.fragile_fee).toLocaleString()} đ</td><td className="p-3">{String(rate.effective_from).slice(0, 10)} – {rate.effective_to ? String(rate.effective_to).slice(0, 10) : 'mở'}</td></tr>)}{!shippingRates.length && <tr><td colSpan="6" className="p-8 text-center text-slate-500">Chưa có bảng giá. Hãy chạy migration 006.</td></tr>}</tbody>
                  </table>
                </div>
              </>
            ) : (
              <>
                <form onSubmit={luuNgayLe} className="grid gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-5 md:grid-cols-[1fr_auto] md:items-end">
                  <label className="text-xs font-bold text-amber-900">Ngày áp dụng hệ số lễ (mỗi dòng một ngày YYYY-MM-DD)
                    <textarea value={holidayDatesText} onChange={(event) => setHolidayDatesText(event.target.value)} rows="3" placeholder="2026-01-01&#10;2026-02-17" className="mt-1 w-full rounded-lg border border-amber-200 bg-white p-2 text-sm" />
                  </label>
                  <button type="submit" disabled={pricingBusy} className="rounded-lg bg-amber-700 px-4 py-2 text-sm font-black text-white disabled:opacity-50">{pricingBusy ? 'Đang lưu...' : 'Lưu ngày lễ'}</button>
                </form>
                <form onSubmit={(event) => taoPhienBanPricing(event, 'pay-rules', 'Đã lưu phiên bản quy tắc lương và audit.')} className="grid gap-3 rounded-2xl border bg-white p-5 shadow-sm md:grid-cols-4">
                  <h3 className="font-black md:col-span-4">Thêm phiên bản quy tắc lương</h3>
                  <label className="text-xs font-bold text-slate-500">Sự kiện<select name="event_type" defaultValue="delivery_success" className="mt-1 w-full rounded-lg border p-2 text-sm"><option value="delivery_success">Giao thành công</option><option value="pickup">Lấy hàng</option><option value="failed_valid">Thất bại hợp lệ</option><option value="return">Hoàn hàng</option></select></label>
                  {pricingInput('area_code', 'Khu vực', { value: 'GOVAP_ALL', type: 'text', required: true })}
                  {pricingInput('min_weight_kg', 'Khối lượng từ (kg)', { value: '0', min: '0', step: '0.001', required: true })}
                  {pricingInput('max_weight_kg', 'Đến kg (tùy chọn)', { min: '0.001', step: '0.001' })}
                  {pricingInput('start_time', 'Giờ bắt đầu', { type: 'time' })}
                  {pricingInput('end_time', 'Giờ kết thúc', { type: 'time' })}
                  {pricingInput('holiday_multiplier_milli', 'Hệ số lễ (x1000)', { value: '1000', min: '1', required: true })}
                  {pricingInput('amount_vnd', 'Mức tiền cố định (VND)')}
                  {pricingInput('percent_rate', 'Hoặc tỷ lệ %', { min: '0', step: '0.001' })}
                  {pricingInput('effective_from', 'Có hiệu lực từ', { type: 'date', value: new Date().toISOString().slice(0, 10), required: true })}
                  {pricingInput('effective_to', 'Đến hết ngày', { type: 'date' })}
                  <p className="text-xs text-slate-500 md:col-span-4">Chỉ nhập một trong hai trường mức tiền hoặc tỷ lệ phần trăm.</p>
                  <button type="submit" disabled={pricingBusy} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-black text-white disabled:opacity-50 md:col-span-4">{pricingBusy ? 'Đang lưu...' : 'Lưu phiên bản quy tắc lương'}</button>
                </form>
                <div className="overflow-x-auto rounded-2xl border bg-white shadow-sm">
                  <table className="w-full min-w-[700px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-3">Sự kiện</th><th className="p-3">Khu vực / kg</th><th className="p-3">Mức trả</th><th className="p-3">Khung giờ / lễ</th><th className="p-3">Hiệu lực</th></tr></thead>
                    <tbody className="divide-y">{payRules.map((rule) => <tr key={rule.id}><td className="p-3 font-bold">{rule.event_type}</td><td className="p-3">{rule.area_code} · {rule.min_weight_kg}–{rule.max_weight_kg ?? '∞'} kg</td><td className="p-3">{rule.amount_vnd != null ? `${Number(rule.amount_vnd).toLocaleString()} đ` : `${rule.percent_rate}%`}</td><td className="p-3">{rule.start_time || 'Cả ngày'}–{rule.end_time || ''} · x{(Number(rule.holiday_multiplier_milli) / 1000).toFixed(3)}</td><td className="p-3">{String(rule.effective_from).slice(0, 10)} – {rule.effective_to ? String(rule.effective_to).slice(0, 10) : 'mở'}</td></tr>)}{!payRules.length && <tr><td colSpan="5" className="p-8 text-center text-slate-500">Chưa có quy tắc lương. Hãy chạy migration 006.</td></tr>}</tbody>
                  </table>
                </div>
              </>
            )}
          </section>
        ) : tabHienTai === 'phu-phi' ? (
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
                  <input name="amount" type="number" required min="1" max="100000000" step="1" placeholder="Số tiền đã nhận (VND nguyên)" className="min-w-0 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
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
                <div>
                  <p className="font-black text-slate-800">Shipper {remittance.driver_name}</p>
                  <p className="mt-1 text-xs text-slate-500">Phiếu #{remittance.id} · Ngày làm việc {remittance.work_date} · {new Date(remittance.created_at).toLocaleString('vi-VN')}</p>
                  <p className="mt-1 text-xs text-slate-600">Phải nộp: {Number(remittance.expected_amount).toLocaleString('vi-VN')} đ · Chênh lệch: {Number(remittance.variance_amount).toLocaleString('vi-VN')} đ</p>
                  {remittance.variance_reason && <p className="mt-1 text-xs font-semibold text-amber-800">Lý do: {remittance.variance_reason}</p>}
                </div>
                <strong className="text-xl text-amber-700">Thực nộp {Number(remittance.amount).toLocaleString()} đ</strong>
                <button type="button" onClick={() => xacNhanNopTienTaiXe(remittance)} className="rounded-xl bg-emerald-600 px-4 py-2.5 font-bold text-white">Đã nhận tiền mặt</button>
              </article>)}
              {!driverRemittances.length && <p className="p-10 text-center text-slate-500">Không có phiếu nộp tiền nào đang chờ.</p>}
            </div>
          </section>
        ) : tabHienTai === 'payroll' ? (
          <section className="space-y-5">
            {(payrollError || payrollMessage) && (
              <p role={payrollError ? 'alert' : 'status'} className={`rounded-xl p-4 text-sm font-bold ${payrollError ? 'bg-rose-50 text-rose-800' : 'bg-emerald-50 text-emerald-800'}`}>
                {payrollError || payrollMessage}
              </p>
            )}
            <aside className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              API kỳ lương hiện thuộc quyền HR/giám đốc. Tài khoản Kế toán có thể nhận 403 cho đến khi quyền API được điều chỉnh; giao diện không bỏ qua kiểm tra quyền.
            </aside>
            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-black text-slate-900">Kỳ lương {payrollMonth}</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Trạng thái: <strong>{payrollPeriod ? payrollPeriod.status === 'locked' ? 'Đã chốt' : 'Đang mở' : 'Chưa tải'}</strong>
                    {payrollPeriod?.locked_at ? ` · Chốt lúc ${new Date(payrollPeriod.locked_at).toLocaleString('vi-VN')}` : ''}
                  </p>
                </div>
                {canLockPayroll && payrollPeriod?.status !== 'locked' && (
                  <button type="button" onClick={chotKyLuong} disabled={payrollBusy || payrollLoading || !payrollPeriod} className="rounded-xl bg-violet-700 px-5 py-3 font-black text-white disabled:opacity-50">
                    {payrollBusy ? 'Đang chốt...' : 'Chốt kỳ lương'}
                  </button>
                )}
              </div>
              {!canLockPayroll && <p className="mt-4 text-xs font-semibold text-slate-500">Chỉ tài khoản giám đốc/HR có quyền chốt kỳ theo API hiện tại.</p>}
            </article>
            <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <h3 className="border-b border-slate-100 p-5 font-black text-slate-800">Danh sách phiếu lương đã chốt</h3>
              {payrollLoading ? <p className="p-5 text-sm text-slate-500">Đang tải kỳ lương...</p>
                : !payrollPeriod ? <p className="p-5 text-sm text-slate-500">Chưa có dữ liệu kỳ lương.</p>
                  : payrollPeriod.status !== 'locked' ? <p className="p-5 text-sm text-slate-500">Chưa chốt kỳ này nên chưa có phiếu lương snapshot.</p>
                    : (payrollPeriod.payslips || []).length ? (
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[780px] text-left text-sm">
                          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                            <tr><th className="p-3">Nhân viên</th><th className="p-3">Vai trò</th><th className="p-3">Tổng thu nhập</th><th className="p-3">Khấu trừ</th><th className="p-3">Thực nhận</th><th className="p-3">Chi tiết</th></tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {payrollPeriod.payslips.map((slip) => (
                              <tr key={slip.user_id}>
                                <td className="p-3 font-bold">{slip.full_name}</td><td className="p-3">{slip.role}</td>
                                <td className="p-3">{Number(slip.gross_amount || 0).toLocaleString('vi-VN')} đ</td>
                                <td className="p-3 text-rose-700">{Number(slip.deduction_amount || 0).toLocaleString('vi-VN')} đ</td>
                                <td className="p-3 font-black text-emerald-800">{Number(slip.net_amount || 0).toLocaleString('vi-VN')} đ</td>
                                <td className="p-3">
                                  <div className="flex flex-wrap gap-2">
                                    <button type="button" onClick={() => taiChiTietPhieuLuong(slip.user_id)} className="rounded-lg border border-violet-200 px-3 py-2 text-xs font-bold text-violet-800">Xem chi tiết</button>
                                    <button type="button" onClick={() => taiPhieuLuongPdf(slip.user_id).catch((error) => setPayrollError(error.message))} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700">Tải PDF</button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : <p className="p-5 text-sm text-slate-500">Không có phiếu lương trong kỳ này.</p>}
            </article>
            {selectedPayslip && (
              <article className="overflow-hidden rounded-2xl border border-violet-200 bg-white shadow-sm">
                <header className="flex flex-wrap items-center justify-between gap-3 border-b border-violet-100 bg-violet-50 p-5">
                  <div>
                    <h3 className="font-black text-violet-950">Phiếu lương chi tiết · {selectedPayslip.full_name}</h3>
                    <p className="mt-1 text-sm text-violet-800">Kỳ {selectedPayslip.payroll_month} · Thực nhận {Number(selectedPayslip.net_amount || 0).toLocaleString('vi-VN')} đ</p>
                  </div>
                  <button type="button" onClick={() => setSelectedPayslip(null)} className="rounded-lg border border-violet-200 bg-white px-3 py-2 text-sm font-bold text-violet-900">Đóng</button>
                </header>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-3">Loại</th><th className="p-3">Nội dung</th><th className="p-3">Mã đơn</th><th className="p-3">Số tiền</th></tr></thead>
                    <tbody className="divide-y divide-slate-100">
                      {(selectedPayslip.lines || []).map((line, index) => (
                        <tr key={`${line.source_type || line.line_type}-${line.source_id || line.order_id || index}`}>
                          <td className="p-3">{line.line_type}</td><td className="p-3">{line.description}</td><td className="p-3">{line.order_id || '—'}</td>
                          <td className={`p-3 font-bold ${Number(line.amount) < 0 ? 'text-rose-700' : 'text-slate-800'}`}>{Number(line.amount || 0).toLocaleString('vi-VN')} đ</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!selectedPayslip.lines?.length && <p className="p-5 text-sm text-slate-500">Phiếu không có dòng chi tiết.</p>}
                </div>
              </article>
            )}
          </section>
        ) : tabHienTai === 'reports' ? (
          <section className="space-y-6">
            <form onSubmit={capNhatPhiGiaoThatBai} className="grid gap-3 rounded-2xl border border-rose-100 bg-white p-5 shadow-sm md:grid-cols-[1fr_1fr_2fr_auto] md:items-end">
              <label className="text-xs font-bold text-slate-500">Mã đơn giao thất bại
                <input name="order_id" type="number" min="1" required className="mt-1 block w-full rounded-lg border border-slate-200 p-2 text-sm" />
              </label>
              <label className="text-xs font-bold text-slate-500">Phí ghi nhận (đồng)
                <input name="amount" type="number" min="0" step="1" max="100000000" required className="mt-1 block w-full rounded-lg border border-slate-200 p-2 text-sm" />
              </label>
              <label className="text-xs font-bold text-slate-500">Lý do / căn cứ kế toán
                <input name="note" type="text" minLength="5" maxLength="500" required className="mt-1 block w-full rounded-lg border border-slate-200 p-2 text-sm" />
              </label>
              <button type="submit" disabled={failureFeeBusy} className="rounded-lg bg-rose-700 px-4 py-2 font-bold text-white disabled:opacity-50">{failureFeeBusy ? 'Đang lưu...' : 'Ghi phí'}</button>
              {(failureFeeError || failureFeeMessage) && <p role={failureFeeError ? 'alert' : 'status'} className={`md:col-span-4 text-sm font-semibold ${failureFeeError ? 'text-rose-700' : 'text-emerald-700'}`}>{failureFeeError || failureFeeMessage}</p>}
              <p className="text-xs text-slate-500 md:col-span-4">Chỉ nhập khoản phí đã được kế toán xác nhận cho đơn giao thất bại/hoàn trước khi đối soát. Thao tác được ghi audit.</p>
            </form>
            {reportError && <p role="alert" className="rounded-xl bg-rose-50 p-4 font-bold text-rose-700">{reportError}</p>}
            {reportLoading && <p className="rounded-xl bg-white p-5 text-slate-500">Đang tải báo cáo...</p>}
            {reportData && (
              <>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  {[
                    ['Tổng đơn', reportData.summary.total_orders, 'đơn'],
                    ['Giao thành công', reportData.summary.successful_orders, 'đơn'],
                    ['Giao thất bại', reportData.summary.failed_orders, 'đơn'],
                    ['Shop cần thanh toán', `${Number(reportData.summary.shop_payable || 0).toLocaleString('vi-VN')} đ`, 'COD đủ điều kiện đối soát']
                  ].map(([label, value, description]) => <article key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm font-bold text-slate-500">{label}</p><p className="mt-2 text-2xl font-black text-slate-900">{value}</p><p className="mt-1 text-xs text-slate-400">{description}</p></article>)}
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <article className="rounded-2xl border border-amber-100 bg-amber-50 p-5"><p className="text-sm font-bold text-amber-800">COD tiền mặt</p><p className="mt-2 text-xl font-black text-amber-900">{Number(reportData.summary.cash_collected || 0).toLocaleString('vi-VN')} đ</p></article>
                  <article className="rounded-2xl border border-blue-100 bg-blue-50 p-5"><p className="text-sm font-bold text-blue-800">COD chuyển khoản</p><p className="mt-2 text-xl font-black text-blue-900">{Number(reportData.summary.bank_transfer_collected || 0).toLocaleString('vi-VN')} đ</p></article>
                  <article className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5"><p className="text-sm font-bold text-emerald-800">Tổng tiền thu hộ</p><p className="mt-2 text-xl font-black text-emerald-900">{Number(reportData.summary.total_cod_collected || 0).toLocaleString('vi-VN')} đ</p></article>
                </div>
                {[
                  ['Theo khu vực', reportData.by_area, 'Khu vực'],
                  ['Theo tài xế', reportData.by_driver, 'Tài xế'],
                  ['Theo Shop', reportData.by_shop, 'Shop']
                ].map(([title, rows, nameLabel]) => <article key={title} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <h2 className="border-b border-slate-100 p-5 font-black text-slate-800">{title}</h2>
                  <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-3">{nameLabel}</th><th className="p-3">Tổng đơn</th><th className="p-3">Thành công</th><th className="p-3">Thất bại</th><th className="p-3">COD</th><th className="p-3">Cần trả Shop</th></tr></thead>
                    <tbody className="divide-y divide-slate-100">{rows?.map((row) => <tr key={row.id ?? 'unassigned'}><td className="p-3 font-bold">{row.name || 'Chưa phân khu vực/tài xế'}</td><td className="p-3">{row.total_orders || 0}</td><td className="p-3 text-emerald-700">{row.successful_orders || 0}</td><td className="p-3 text-rose-700">{row.failed_orders || 0}</td><td className="p-3">{Number(row.total_cod_collected || 0).toLocaleString('vi-VN')} đ</td><td className="p-3">{Number(row.shop_payable || 0).toLocaleString('vi-VN')} đ</td></tr>)}</tbody>
                  </table>{!rows?.length && <p className="p-5 text-sm text-slate-500">Không có dữ liệu trong khoảng thời gian này.</p>}</div>
                </article>)}
                <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <h2 className="border-b border-slate-100 p-5 font-black text-slate-800">Lịch sử phiếu thu COD tài xế</h2>
                  <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-3">Mã phiếu</th><th className="p-3">Tài xế</th><th className="p-3">Ngày làm việc</th><th className="p-3">Phải nộp</th><th className="p-3">Thực nộp</th><th className="p-3">Chênh lệch / lý do</th><th className="p-3">Trạng thái</th><th className="p-3">Thu ngân xác nhận</th></tr></thead><tbody className="divide-y divide-slate-100">{reportData.remittances?.map((item) => <tr key={item.id}><td className="p-3">#{item.id}</td><td className="p-3 font-bold">{item.driver_name}</td><td className="p-3">{item.work_date}</td><td className="p-3">{Number(item.expected_amount).toLocaleString('vi-VN')} đ</td><td className="p-3">{Number(item.amount).toLocaleString('vi-VN')} đ</td><td className="p-3">{Number(item.variance_amount).toLocaleString('vi-VN')} đ{item.variance_reason && <span className="block text-xs text-slate-500">{item.variance_reason}</span>}</td><td className="p-3">{item.status === 'received' ? 'Đã nhận' : 'Chờ nộp'}</td><td className="p-3">{item.received_by_name || '—'}</td></tr>)}</tbody></table>{!reportData.remittances?.length && <p className="p-5 text-sm text-slate-500">Không có phiếu thu trong khoảng thời gian này.</p>}</div>
                </article>
                <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <h2 className="border-b border-slate-100 p-5 font-black text-slate-800">Lịch sử phiếu chi/đối soát Shop</h2>
                  <div className="overflow-x-auto"><table className="w-full min-w-[1000px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-3">Mã phiếu</th><th className="p-3">Shop</th><th className="p-3">Số đơn</th><th className="p-3">Chu kỳ</th><th className="p-3">Phí giao thất bại</th><th className="p-3">Số tiền</th><th className="p-3">Phương thức</th><th className="p-3">Mã tham chiếu</th><th className="p-3">Người chi</th><th className="p-3">Ngày chi</th></tr></thead><tbody className="divide-y divide-slate-100">{reportData.settlements?.map((item) => <tr key={item.settlement_id}><td className="p-3">#{item.settlement_id}</td><td className="p-3 font-bold">{item.shop_name}</td><td className="p-3">{item.order_count}</td><td className="p-3">{item.cycle_code} · {item.period_start}–{item.period_end}</td><td className="p-3">{Number(item.total_failure_fee || 0).toLocaleString('vi-VN')} đ</td><td className="p-3">{Number(item.total_paid).toLocaleString('vi-VN')} đ</td><td className="p-3">{item.payment_method === 'cash' ? 'Tiền mặt' : 'Chuyển khoản'}</td><td className="p-3">{item.payment_reference || '—'}</td><td className="p-3">{item.paid_by_name || '—'}</td><td className="p-3">{new Date(item.settled_at).toLocaleString('vi-VN')}</td></tr>)}</tbody></table>{!reportData.settlements?.length && <p className="p-5 text-sm text-slate-500">Không có phiếu chi trong khoảng thời gian này.</p>}</div>
                </article>
              </>
            )}
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