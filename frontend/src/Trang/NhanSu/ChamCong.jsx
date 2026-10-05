import { apiFetch as fetch } from '../../utils/apiFetch.js';
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Camera, CalendarCheck, Clock3, LogIn, LogOut, RefreshCw, X, MapPin, Users } from 'lucide-react';
import { Link } from 'react-router-dom';

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');

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
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-800 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <Link to="/" className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-emerald-700">
          <ArrowLeft size={17} /> Quay lại hệ thống
        </Link>
        <header className="mt-8 flex flex-col justify-between gap-5 border-b border-slate-200 pb-6 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-black uppercase text-emerald-700">{isHrViewer ? 'Quản lý chấm công' : 'Chấm công cá nhân'}</p>
            <h1 className="mt-2 text-3xl font-black">{isHrViewer ? 'Theo dõi chấm công nhân viên' : `Xin chào, ${fullName}`}</h1>
          </div>
          <div className="flex items-center gap-2 text-sm font-bold text-slate-500">
            <CalendarCheck size={18} className="text-emerald-600" />
            {new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
        </header>

        {attendanceError && <p role="alert" className="mt-5 rounded-lg bg-rose-50 p-3 text-sm font-semibold text-rose-700">{attendanceError}</p>}

        {isHrViewer && (
          <section className="mt-6 grid gap-4 sm:grid-cols-3">
            <div className="border-l-4 border-emerald-500 bg-white p-5 shadow-sm">
              <p className="text-sm font-bold text-slate-500">Tổng ca trong tháng</p>
              <p className="mt-2 text-3xl font-black">{attendanceSummary.shifts}</p>
            </div>
            <div className="border-l-4 border-amber-500 bg-white p-5 shadow-sm">
              <p className="text-sm font-bold text-slate-500">Ca chưa chấm tan</p>
              <p className="mt-2 text-3xl font-black">{attendanceSummary.openShifts}</p>
            </div>
            <div className="border-l-4 border-rose-500 bg-white p-5 shadow-sm">
              <p className="text-sm font-bold text-slate-500">Bản ghi thiếu giờ vào</p>
              <p className="mt-2 text-3xl font-black">{attendanceSummary.missingCheckIn}</p>
            </div>
          </section>
        )}

        <section className={`mt-6 grid gap-5 ${isHrViewer ? '' : 'md:grid-cols-[1fr_1.3fr]'}`}>
          {!isHrViewer && <div className="border-l-4 border-emerald-500 bg-white p-6 shadow-sm">
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
                onClick={() => openCamera('check-in')}
                className="flex flex-1 items-center justify-center gap-2 bg-emerald-600 px-4 py-3 font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
              >
                <Camera size={17} /> Vào ca
              </button>
              <button
                disabled={busy || !currentShift}
                onClick={() => openCamera('check-out')}
                className="flex flex-1 items-center justify-center gap-2 border border-slate-300 px-4 py-3 font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
              >
                <Camera size={17} /> Tan ca
              </button>
            </div>
            {attendanceMessage && <p role="status" className="mt-4 text-sm font-bold text-emerald-700">{attendanceMessage}</p>}
          </div>}

          <div className="bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-black">{isHrViewer ? 'Bảng chấm công nhân viên' : 'Lịch sử chấm công'}</h2>
                <p className="mt-1 text-sm text-slate-500">{isHrViewer ? 'Kiểm tra thời gian, ảnh selfie và vị trí GPS.' : 'Các ca đã ghi nhận trong tháng.'}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {isHrViewer && (
                  <label className="flex items-center gap-2 text-sm font-bold text-slate-600">
                    <Users size={17} />
                    <select value={selectedUserId} onChange={(event) => { setRecordsLoading(true); setSelectedUserId(event.target.value); }} className="max-w-52 border border-slate-200 bg-white px-3 py-2">
                      <option value="">Tất cả nhân viên</option>
                      {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}
                    </select>
                  </label>
                )}
                <label className="flex items-center gap-2 text-sm font-bold text-slate-600">
                  <Clock3 size={17} />
                  <input type="month" value={month} onChange={(event) => { setRecordsLoading(true); setMonth(event.target.value); }} className="border border-slate-200 bg-white px-3 py-2" />
                </label>
              </div>
            </div>
            <div className="mt-5 overflow-x-auto">
              <table className={`w-full ${isHrViewer ? 'min-w-[850px]' : 'min-w-[420px]'} text-left text-sm`}>
                <thead className="border-b border-slate-200 text-xs uppercase text-slate-400">
                  <tr>
                    {isHrViewer && <th className="py-3">Nhân viên</th>}
                    <th className="py-3">Ngày</th>
                    <th className="py-3">Vào ca</th>
                    <th className="py-3">Tan ca</th>
                    {isHrViewer && <><th className="py-3">Ảnh vào ca</th><th className="py-3">Vị trí vào ca</th><th className="py-3">Ảnh tan ca</th><th className="py-3">Vị trí tan ca</th></>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recordsLoading ? (
                    <tr><td colSpan={isHrViewer ? 8 : 3} className="py-10 text-center text-slate-400">Đang tải dữ liệu chấm công...</td></tr>
                  ) : records.length ? records.map((record) => (
                    <tr key={record.id}>
                      {isHrViewer && <td className="py-3 font-semibold">{record.full_name || `Nhân viên ${record.user_id}`}</td>}
                      <td className="py-3 font-bold">{new Date(`${String(record.work_date).slice(0, 10)}T00:00:00`).toLocaleDateString('vi-VN')}</td>
                      <td className="py-3">{record.check_in ? new Date(record.check_in).toLocaleTimeString('vi-VN') : '--'}</td>
                      <td className="py-3">{record.check_out ? new Date(record.check_out).toLocaleTimeString('vi-VN') : '--'}</td>
                      {isHrViewer && <>
                        <td className="py-3">
                          {record.check_in_photo ? (
                            <button type="button" onClick={() => setSelectedEvidence({ url: `${API_URL}${record.check_in_photo}`, label: `${record.full_name || 'Nhân viên'} · ảnh vào ca` })} className="font-bold text-emerald-700 underline">Xem ảnh</button>
                          ) : <span className="text-slate-400">Chưa có</span>}
                        </td>
                        <td className="py-3">
                          {hasCoordinates(record.check_in_lat, record.check_in_lng)
                            ? <a href={`https://www.google.com/maps/search/?api=1&query=${record.check_in_lat},${record.check_in_lng}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-bold text-blue-700"><MapPin size={14} /> Xem bản đồ</a>
                            : <span className="text-slate-400">Chưa có</span>}
                        </td>
                        <td className="py-3">
                          {record.check_out_photo ? (
                            <button type="button" onClick={() => setSelectedEvidence({ url: `${API_URL}${record.check_out_photo}`, label: `${record.full_name || 'Nhân viên'} · ảnh tan ca` })} className="font-bold text-emerald-700 underline">Xem ảnh</button>
                          ) : <span className="text-slate-400">Chưa có</span>}
                        </td>
                        <td className="py-3">
                          {hasCoordinates(record.check_out_lat, record.check_out_lng)
                            ? <a href={`https://www.google.com/maps/search/?api=1&query=${record.check_out_lat},${record.check_out_lng}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-bold text-blue-700"><MapPin size={14} /> Xem bản đồ</a>
                            : <span className="text-slate-400">Chưa có</span>}
                        </td>
                      </>}
                    </tr>
                  )) : <tr><td colSpan={isHrViewer ? 8 : 3} className="py-10 text-center text-slate-400">Chưa có dữ liệu trong tháng này.</td></tr>}
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