import { useEffect, useState } from 'react';
import { ArrowLeft, CalendarCheck, Clock3, LogIn, LogOut } from 'lucide-react';
import { Link } from 'react-router-dom';

const API_URL = 'http://localhost:5000';

const thangHienTai = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

const ngayHienTai = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

export default function ChamCong() {
  const userId = localStorage.getItem('user_id');
  const fullName = localStorage.getItem('full_name') || 'Nhân viên';
  const [month, setMonth] = useState(thangHienTai);
  const [records, setRecords] = useState([]);
  const [busy, setBusy] = useState(false);

  const loadRecords = async () => {
    if (!userId) return;
    try {
      const response = await fetch(`${API_URL}/api/attendance?user_id=${userId}&month=${month}`);
      const data = await response.json();
      if (data.success) setRecords(data.data || []);
    } catch (error) {
      console.error('Lỗi tải dữ liệu chấm công:', error);
    }
  };

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_URL}/api/attendance?user_id=${userId}&month=${month}`)
      .then((response) => response.json())
      .then((data) => { if (!cancelled && data.success) setRecords(data.data || []); })
      .catch((error) => console.error('Lỗi tải dữ liệu chấm công:', error));
    return () => { cancelled = true; };
  }, [userId, month]);

  const todayRecords = records.filter((record) => String(record.work_date).slice(0, 10) === ngayHienTai());
  const currentShift = todayRecords.find((record) => record.check_in && !record.check_out);
  const todayRecord = currentShift || todayRecords[0];

  const markAttendance = async (action) => {
    setBusy(true);
    try {
      const response = await fetch(`${API_URL}/api/attendance/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Không thể ghi nhận chấm công.');
      await loadRecords();
    } catch (error) {
      alert(error.message || 'Lỗi kết nối máy chủ.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-800 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <Link to="/" className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-emerald-700">
          <ArrowLeft size={17} /> Quay lại hệ thống
        </Link>
        <header className="mt-8 flex flex-col justify-between gap-5 border-b border-slate-200 pb-6 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-black uppercase text-emerald-700">Chấm công cá nhân</p>
            <h1 className="mt-2 text-3xl font-black">Xin chào, {fullName}</h1>
          </div>
          <div className="flex items-center gap-2 text-sm font-bold text-slate-500">
            <CalendarCheck size={18} className="text-emerald-600" />
            {new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
        </header>

        <section className="mt-6 grid gap-5 md:grid-cols-[1fr_1.3fr]">
          <div className="border-l-4 border-emerald-500 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-black">Ca làm hôm nay</h2>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase text-slate-400">Giờ vào</p>
                <p className="mt-2 font-black">{todayRecord?.check_in ? new Date(todayRecord.check_in).toLocaleTimeString('vi-VN') : '--:--'}</p>
              </div>
              <div className="bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase text-slate-400">Giờ ra</p>
                <p className="mt-2 font-black">{todayRecord?.check_out ? new Date(todayRecord.check_out).toLocaleTimeString('vi-VN') : '--:--'}</p>
              </div>
            </div>
            <div className="mt-5 flex gap-3">
              <button
                disabled={busy || Boolean(currentShift)}
                onClick={() => markAttendance('check-in')}
                className="flex flex-1 items-center justify-center gap-2 bg-emerald-600 px-4 py-3 font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
              >
                <LogIn size={17} /> Vào ca
              </button>
              <button
                disabled={busy || !currentShift}
                onClick={() => markAttendance('check-out')}
                className="flex flex-1 items-center justify-center gap-2 border border-slate-300 px-4 py-3 font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
              >
                <LogOut size={17} /> Tan ca
              </button>
            </div>
          </div>

          <div className="bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-black">Lịch sử chấm công</h2>
                <p className="mt-1 text-sm text-slate-500">Các ca đã ghi nhận trong tháng.</p>
              </div>
              <label className="flex items-center gap-2 text-sm font-bold text-slate-600">
                <Clock3 size={17} />
                <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} className="border border-slate-200 bg-white px-3 py-2" />
              </label>
            </div>
            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[420px] text-left text-sm">
                <thead className="border-b border-slate-200 text-xs uppercase text-slate-400">
                  <tr><th className="py-3">Ngày</th><th className="py-3">Vào ca</th><th className="py-3">Tan ca</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {records.length ? records.map((record) => (
                    <tr key={record.id}>
                      <td className="py-3 font-bold">{new Date(`${String(record.work_date).slice(0, 10)}T00:00:00`).toLocaleDateString('vi-VN')}</td>
                      <td className="py-3">{record.check_in ? new Date(record.check_in).toLocaleTimeString('vi-VN') : '--'}</td>
                      <td className="py-3">{record.check_out ? new Date(record.check_out).toLocaleTimeString('vi-VN') : '--'}</td>
                    </tr>
                  )) : <tr><td colSpan="3" className="py-10 text-center text-slate-400">Chưa có dữ liệu trong tháng này.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}