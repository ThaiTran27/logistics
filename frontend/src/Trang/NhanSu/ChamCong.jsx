import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Camera, CalendarCheck, Clock3, LogIn, LogOut, RefreshCw, X } from 'lucide-react';
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
  const [cameraAction, setCameraAction] = useState(null);
  const [capturedImage, setCapturedImage] = useState(null);
  const [cameraError, setCameraError] = useState('');
  const [attendanceError, setAttendanceError] = useState('');
  const [attendanceMessage, setAttendanceMessage] = useState('');
  const videoRef = useRef(null);
  const cameraStreamRef = useRef(null);

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