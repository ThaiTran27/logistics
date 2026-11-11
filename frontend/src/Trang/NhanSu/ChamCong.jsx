import { API_URL, apiFetch as fetch } from '../../utils/apiFetch.js';
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Camera, CalendarCheck, Clock3, LogIn, LogOut, RefreshCw, X, MapPin, Users } from 'lucide-react';
import { Link } from 'react-router-dom';

const thangHienTai = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

const ngayHienTai = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

const hasCoordinates = (latitude, longitude) => latitude !== null && latitude !== undefined && latitude !== ''
  && longitude !== null && longitude !== undefined && longitude !== ''
  && Number.isFinite(Number(latitude)) && Number.isFinite(Number(longitude));

export default function ChamCong() {
  const userId = localStorage.getItem('user_id');
  const fullName = localStorage.getItem('full_name') || 'Nhân viên';
  const role = String(localStorage.getItem('role') || localStorage.getItem('user_role') || '').trim().toLowerCase();
  const isHrViewer = ['hr_manager', 'hr', 'human_resources', 'nhan_su', 'director', 'admin'].includes(role);
  const [month, setMonth] = useState(thangHienTai);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [records, setRecords] = useState([]);
  const [recordsLoading, setRecordsLoading] = useState(true);
  const [selectedEvidence, setSelectedEvidence] = useState(null);
  const [busy, setBusy] = useState(false);
  const [cameraAction, setCameraAction] = useState(null);
  const [capturedImage, setCapturedImage] = useState(null);
  const [cameraError, setCameraError] = useState('');
  const [attendanceError, setAttendanceError] = useState('');
  const [attendanceMessage, setAttendanceMessage] = useState('');
  const videoRef = useRef(null);
  const cameraStreamRef = useRef(null);

  const loadRecords = async () => {
    if (!userId && !isHrViewer) return;
    setRecordsLoading(true);
    try {
      const query = new URLSearchParams({ month });
      if (isHrViewer && selectedUserId) query.set('user_id', selectedUserId);
      else if (!isHrViewer) query.set('user_id', userId);
      const response = await fetch(`${API_URL}/api/attendance?${query}`);
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Không tải được lịch sử chấm công.');
      setRecords(data.data || []);
      setAttendanceError('');
    } catch (error) {
      console.error('Lỗi tải dữ liệu chấm công:', error);
      setAttendanceError(error.message || 'Không tải được lịch sử chấm công.');
    } finally {
      setRecordsLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    if (!userId && !isHrViewer) return undefined;
    const query = new URLSearchParams({ month });
    if (isHrViewer && selectedUserId) query.set('user_id', selectedUserId);
    else if (!isHrViewer) query.set('user_id', userId);
    fetch(`${API_URL}/api/attendance?${query}`)
      .then((response) => response.json())
      .then((data) => {
        if (cancelled) return;
        if (!data.success) throw new Error(data.message || 'Không tải được lịch sử chấm công.');
        setRecords(data.data || []);
        setAttendanceError('');
      })
      .catch((error) => {
        if (cancelled) return;
        console.error('Lỗi tải dữ liệu chấm công:', error);
        setAttendanceError(error.message || 'Không tải được lịch sử chấm công.');
      })
      .finally(() => { if (!cancelled) setRecordsLoading(false); });
    return () => { cancelled = true; };
  }, [userId, month, isHrViewer, selectedUserId]);

  const todayRecords = records.filter((record) => String(record.work_date).slice(0, 10) === ngayHienTai());
  const currentShift = todayRecords.find((record) => record.check_in && !record.check_out);
  const todayRecord = currentShift || todayRecords[0];
  const employees = [...new Map(records.map((record) => [String(record.user_id), {
    id: String(record.user_id),
    name: record.full_name || `Nhân viên ${record.user_id}`,
    role: record.role,
  }])).values()].sort((first, second) => first.name.localeCompare(second.name, 'vi'));
  const attendanceSummary = records.reduce((summary, record) => ({
    shifts: summary.shifts + 1,
    openShifts: summary.openShifts + (record.check_in && !record.check_out ? 1 : 0),
    missingCheckIn: summary.missingCheckIn + (!record.check_in ? 1 : 0),
  }), { shifts: 0, openShifts: 0, missingCheckIn: 0 });

  useEffect(() => {
    if (!cameraAction || capturedImage) return undefined;
    let active = true;

    const startCamera = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError('Trình duyệt này không hỗ trợ camera. Hãy mở trang bằng HTTPS hoặc localhost.');
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: 'user' },
        });
        if (!active) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        cameraStreamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setCameraError('');
      } catch (error) {
        if (!active) return;
        console.error('Không thể mở camera chấm công:', error);
        setCameraError('Không thể truy cập camera. Vui lòng cấp quyền camera rồi thử lại.');
      }
    };

    startCamera();
    return () => {
      active = false;
      cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
    };
  }, [cameraAction, capturedImage]);

  const openCamera = (action) => {
    setCapturedImage(null);
    setCameraError('');
    setAttendanceError('');
    setAttendanceMessage('');
    setCameraAction(action);
  };

  const closeCamera = () => {
    if (capturedImage?.previewUrl) URL.revokeObjectURL(capturedImage.previewUrl);
    setCameraAction(null);
    setCapturedImage(null);
    setCameraError('');
    setAttendanceError('');
    setAttendanceMessage('');
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video?.videoWidth || !video.videoHeight) {
      setCameraError('Camera chưa sẵn sàng. Vui lòng đợi rồi chụp lại.');
      return;
    }
    const scale = Math.min(1, 1280 / video.videoWidth);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const context = canvas.getContext('2d');
    if (!context) {
      setCameraError('Không thể xử lý ảnh chụp trên thiết bị này.');
      return;
    }
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) {
        setCameraError('Không thể tạo ảnh chụp. Vui lòng thử lại.');
        return;
      }
      setCapturedImage({
        file: new File([blob], `attendance-${Date.now()}.jpg`, { type: 'image/jpeg' }),
        previewUrl: URL.createObjectURL(blob),
      });
      setCameraError('');
    }, 'image/jpeg', 0.85);
  };

  const retakePhoto = () => {
    if (capturedImage?.previewUrl) URL.revokeObjectURL(capturedImage.previewUrl);
    setCapturedImage(null);
    setAttendanceError('');
    setAttendanceMessage('');
  };

  const markAttendance = async () => {
    if (!cameraAction || !capturedImage || !userId) return;
    setBusy(true);
    setAttendanceError('');
    setAttendanceMessage('');
    try {
      const position = await new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
          reject(new Error('Trình duyệt này không hỗ trợ xác định vị trí GPS.'));
          return;
        }
        navigator.geolocation.getCurrentPosition(
          resolve,
          (error) => {
            const messages = {
              1: 'Bạn cần cấp quyền vị trí để chấm công.',
              2: 'Không thể xác định vị trí hiện tại. Vui lòng bật GPS và thử lại.',
              3: 'Lấy vị trí GPS quá thời gian chờ. Vui lòng thử lại.',
            };
            reject(new Error(messages[error.code] || 'Không thể lấy vị trí GPS.'));
          },
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
        );
      });
      const formData = new FormData();
      formData.append('user_id', userId);
      formData.append('photo', capturedImage.file);
      formData.append('lat', String(position.coords.latitude));
      formData.append('lng', String(position.coords.longitude));

      const response = await fetch(`${API_URL}/api/attendance/${cameraAction}`, {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Không thể ghi nhận chấm công.');
      await loadRecords();
      setAttendanceMessage(data.message || 'Đã ghi nhận chấm công.');
      if (capturedImage.previewUrl) URL.revokeObjectURL(capturedImage.previewUrl);
      setCapturedImage(null);
      setCameraAction(null);
    } catch (error) {
      setAttendanceError(error.message || 'Lỗi kết nối máy chủ.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50/80 px-4 py-8 text-slate-800 sm:px-8 font-sans">
      <div className="mx-auto max-w-5xl">
        <Link to="/" className="inline-flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-emerald-700 bg-white px-3 py-1.5 rounded-xl border border-slate-200/80 shadow-soft-sm transition-all">
          <ArrowLeft size={15} /> Quay lại trang chủ
        </Link>
        <header className="mt-6 flex flex-col justify-between gap-4 border-b border-slate-200/80 pb-6 sm:flex-row sm:items-end">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <p className="text-xs font-black uppercase tracking-wider text-emerald-700">{isHrViewer ? 'Quản Lý Nhân Sự & Chấm Công' : 'Cổng Chấm Công Nhân Viên'}</p>
            </div>
            <h1 className="mt-1 text-2xl sm:text-3xl font-black text-slate-800 tracking-tight">{isHrViewer ? 'Theo dõi chấm công mạng lưới' : `Xin chào, ${fullName}`}</h1>
          </div>
          <div className="flex items-center gap-2 text-xs font-bold text-slate-600 bg-white px-3.5 py-2 rounded-xl border border-slate-200/80 shadow-soft-sm">
            <CalendarCheck size={16} className="text-emerald-600" />
            {new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
        </header>

        {attendanceError && <p role="alert" className="mt-5 rounded-2xl bg-rose-50 border border-rose-200 p-4 text-xs sm:text-sm font-semibold text-rose-700">{attendanceError}</p>}

        {isHrViewer && (
          <section className="mt-6 grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-soft-sm">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Tổng ca trong tháng</p>
              <p className="mt-2 text-3xl font-black text-slate-800">{attendanceSummary.shifts}</p>
              <p className="mt-1 text-[11px] text-emerald-600 font-semibold">Theo dữ liệu tháng hiện tại</p>
            </div>
            <div className="rounded-2xl border border-amber-200/80 bg-white p-5 shadow-soft-sm">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Ca chưa bấm tan</p>
              <p className="mt-2 text-3xl font-black text-amber-600">{attendanceSummary.openShifts}</p>
              <p className="mt-1 text-[11px] text-amber-700 font-semibold">Đang trong thời gian làm việc</p>
            </div>
            <div className="rounded-2xl border border-rose-200/80 bg-white p-5 shadow-soft-sm">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Bản ghi thiếu giờ vào</p>
              <p className="mt-2 text-3xl font-black text-rose-600">{attendanceSummary.missingCheckIn}</p>
              <p className="mt-1 text-[11px] text-rose-700 font-semibold">Cần giải trình hoặc duyệt bổ sung</p>
            </div>
          </section>
        )}

        <section className={`mt-6 grid gap-6 ${isHrViewer ? '' : 'md:grid-cols-[1fr_1.3fr]'}`}>
          {!isHrViewer && (
            <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-soft-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-black text-slate-800">Ca làm việc hôm nay</h2>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${currentShift ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                  {currentShift ? 'Đang trong ca' : 'Chưa vào ca'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
                  <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Giờ Vào Ca</p>
                  <p className="mt-1 text-lg font-black text-emerald-600">{todayRecord?.check_in ? new Date(todayRecord.check_in).toLocaleTimeString('vi-VN') : '--:--'}</p>
                </div>
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
                  <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Giờ Tan Ca</p>
                  <p className="mt-1 text-lg font-black text-slate-700">{todayRecord?.check_out ? new Date(todayRecord.check_out).toLocaleTimeString('vi-VN') : '--:--'}</p>
                </div>
              </div>
              <div className="mt-5 flex gap-3">
                <button
                  disabled={busy || Boolean(currentShift)}
                  onClick={() => openCamera('check-in')}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-3 text-xs sm:text-sm font-bold text-white shadow-soft-sm hover:from-emerald-700 hover:to-teal-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:from-slate-200 disabled:to-slate-200 disabled:text-slate-400 transition-all"
                >
                  <Camera size={16} /> Vào ca selfie
                </button>
                <button
                  disabled={busy || !currentShift}
                  onClick={() => openCamera('check-out')}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-xs sm:text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300 disabled:border-slate-100 transition-all"
                >
                  <Camera size={16} /> Tan ca
                </button>
              </div>
              {attendanceMessage && <p role="status" className="mt-4 rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs font-bold text-emerald-800">{attendanceMessage}</p>}
            </div>
          )}

          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-soft-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-base font-black text-slate-800">{isHrViewer ? 'Bảng Chấm Công Toàn Mạng Lưới' : 'Lịch Sử Chấm Công Của Bạn'}</h2>
                <p className="mt-0.5 text-xs text-slate-500">{isHrViewer ? 'Kiểm tra thời gian thực tế, vị trí GPS và ảnh selfie nhận diện.' : 'Lịch sử ca làm đã ghi nhận theo tháng.'}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {isHrViewer && (
                  <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200">
                    <Users size={15} />
                    <select value={selectedUserId} onChange={(event) => { setRecordsLoading(true); setSelectedUserId(event.target.value); }} className="bg-transparent border-none outline-none font-semibold text-slate-700">
                      <option value="">Tất cả nhân sự</option>
                      {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}
                    </select>
                  </label>
                )}
                <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200">
                  <Clock3 size={15} />
                  <input type="month" value={month} onChange={(event) => { setRecordsLoading(true); setMonth(event.target.value); }} className="bg-transparent border-none outline-none font-semibold text-slate-700" />
                </label>
              </div>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className={`w-full ${isHrViewer ? 'min-w-[850px]' : 'min-w-[420px]'} text-left text-xs`}>
                <thead className="border-b border-slate-100 text-[10px] uppercase font-black tracking-wider text-slate-400 bg-slate-50/50">
                  <tr>
                    {isHrViewer && <th className="py-3 px-3">Nhân viên</th>}
                    <th className="py-3 px-3">Ngày</th>
                    <th className="py-3 px-3">Vào ca</th>
                    <th className="py-3 px-3">Tan ca</th>
                    {isHrViewer && <>
                      <th className="py-3 px-3">Ảnh vào</th>
                      <th className="py-3 px-3">Tọa độ vào</th>
                      <th className="py-3 px-3">Ảnh ra</th>
                      <th className="py-3 px-3">Tọa độ ra</th>
                    </>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {recordsLoading ? (
                    <tr><td colSpan={isHrViewer ? 8 : 3} className="py-10 text-center text-slate-400 font-medium">Đang tải dữ liệu chấm công...</td></tr>
                  ) : records.length ? records.map((record) => (
                    <tr key={record.id} className="hover:bg-slate-50/50 transition-colors">
                      {isHrViewer && <td className="py-3 px-3 font-bold text-slate-800">{record.full_name || `Nhân viên ${record.user_id}`}</td>}
                      <td className="py-3 px-3 font-semibold text-slate-700">{new Date(`${String(record.work_date).slice(0, 10)}T00:00:00`).toLocaleDateString('vi-VN')}</td>
                      <td className="py-3 px-3 font-mono font-semibold text-emerald-700">{record.check_in ? new Date(record.check_in).toLocaleTimeString('vi-VN') : '--'}</td>
                      <td className="py-3 px-3 font-mono font-semibold text-slate-600">{record.check_out ? new Date(record.check_out).toLocaleTimeString('vi-VN') : '--'}</td>
                      {isHrViewer && <>
                        <td className="py-3 px-3">
                          {record.check_in_photo ? (
                            <button type="button" onClick={() => setSelectedEvidence({ url: `${API_URL}${record.check_in_photo}`, label: `${record.full_name || 'Nhân viên'} · ảnh vào ca` })} className="font-bold text-emerald-700 hover:underline">Xem ảnh</button>
                          ) : <span className="text-slate-400">Chưa có</span>}
                        </td>
                        <td className="py-3 px-3">
                          {hasCoordinates(record.check_in_lat, record.check_in_lng)
                            ? <span className="inline-flex items-center gap-1 font-mono text-[11px] text-slate-600"><MapPin size={12} className="text-slate-400" /> {Number(record.check_in_lat).toFixed(4)}, {Number(record.check_in_lng).toFixed(4)}</span>
                            : <span className="text-slate-400">Chưa có</span>}
                        </td>
                        <td className="py-3 px-3">
                          {record.check_out_photo ? (
                            <button type="button" onClick={() => setSelectedEvidence({ url: `${API_URL}${record.check_out_photo}`, label: `${record.full_name || 'Nhân viên'} · ảnh tan ca` })} className="font-bold text-emerald-700 hover:underline">Xem ảnh</button>
                          ) : <span className="text-slate-400">Chưa có</span>}
                        </td>
                        <td className="py-3 px-3">
                          {hasCoordinates(record.check_out_lat, record.check_out_lng)
                            ? <span className="inline-flex items-center gap-1 font-mono text-[11px] text-slate-600"><MapPin size={12} className="text-slate-400" /> {Number(record.check_out_lat).toFixed(4)}, {Number(record.check_out_lng).toFixed(4)}</span>
                            : <span className="text-slate-400">Chưa có</span>}
                        </td>
                      </>}
                    </tr>
                  )) : <tr><td colSpan={isHrViewer ? 8 : 3} className="py-10 text-center text-slate-400 font-medium">Chưa có dữ liệu trong tháng này.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>

      {selectedEvidence && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/80 p-4" onClick={() => setSelectedEvidence(null)}>
          <section role="dialog" aria-modal="true" aria-label={selectedEvidence.label} className="relative max-h-[90vh] max-w-4xl rounded-xl bg-white p-3 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <button type="button" aria-label="Đóng ảnh" onClick={() => setSelectedEvidence(null)} className="absolute -right-3 -top-3 rounded-full bg-white p-2 text-slate-700 shadow-lg hover:bg-slate-100"><X size={18} /></button>
            <p className="px-2 pb-2 text-sm font-bold text-slate-700">{selectedEvidence.label}</p>
            <img src={selectedEvidence.url} alt={selectedEvidence.label} className="max-h-[78vh] max-w-full object-contain" />
          </section>
        </div>
      )}

      {cameraAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <section role="dialog" aria-modal="true" aria-labelledby="attendance-camera-title" className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
            <header className="flex items-center justify-between border-b border-slate-100 p-5">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-emerald-700">Xác thực chấm công</p>
                <h2 id="attendance-camera-title" className="mt-1 text-xl font-black text-slate-800">
                  Chụp ảnh {cameraAction === 'check-in' ? 'vào ca' : 'tan ca'}
                </h2>
              </div>
              <button type="button" aria-label="Đóng camera" onClick={closeCamera} disabled={busy} className="rounded-full bg-slate-100 p-2 text-slate-500 hover:bg-slate-200 disabled:opacity-50">
                <X size={20} />
              </button>
            </header>
            <div className="space-y-4 p-5">
              <div className="overflow-hidden rounded-xl bg-slate-950">
                {capturedImage ? (
                  <img src={capturedImage.previewUrl} alt="Ảnh selfie chấm công" className="max-h-[55vh] w-full object-contain" />
                ) : (
                  <video ref={videoRef} autoPlay playsInline muted className="max-h-[55vh] min-h-64 w-full object-cover" />
                )}
              </div>
              <p className="text-sm text-slate-600">Ảnh selfie và vị trí GPS sẽ được gửi cùng thời gian chấm công.</p>
              {cameraError && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm font-semibold text-rose-700">{cameraError}</p>}
              {attendanceError && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm font-semibold text-rose-700">{attendanceError}</p>}
              {busy && <p role="status" className="text-sm font-semibold text-blue-700">Đang lấy vị trí GPS và lưu chấm công...</p>}
              <div className="flex flex-wrap justify-end gap-3">
                <button type="button" onClick={closeCamera} disabled={busy} className="border border-slate-200 px-4 py-2.5 font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50">
                  Hủy
                </button>
                {capturedImage ? (
                  <>
                    <button type="button" onClick={retakePhoto} disabled={busy} className="inline-flex items-center gap-2 border border-slate-200 px-4 py-2.5 font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                      <RefreshCw size={17} /> Chụp lại
                    </button>
                    <button type="button" onClick={markAttendance} disabled={busy} className="inline-flex items-center gap-2 bg-emerald-600 px-4 py-2.5 font-bold text-white hover:bg-emerald-700 disabled:cursor-wait disabled:opacity-60">
                      {cameraAction === 'check-in' ? <LogIn size={17} /> : <LogOut size={17} />}
                      {busy ? 'Đang lưu...' : 'Xác nhận chấm công'}
                    </button>
                  </>
                ) : (
                  <button type="button" onClick={capturePhoto} disabled={busy || Boolean(cameraError)} className="inline-flex items-center gap-2 bg-emerald-600 px-4 py-2.5 font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50">
                    <Camera size={17} /> Chụp selfie
                  </button>
                )}
              </div>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}