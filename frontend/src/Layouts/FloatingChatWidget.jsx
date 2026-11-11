import { useEffect, useRef, useState } from 'react';
import { MessageCircle, Send, X, Bot, Headphones, ArrowLeft, ImagePlus } from 'lucide-react';
import { io } from 'socket.io-client';
import { API_URL, apiFetch as fetch, resolveApiAssetUrl } from '../utils/apiFetch.js';

const chatSocket = io(API_URL);

export default function FloatingChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState('choose');
  const [mode, setMode] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [trackingCode, setTrackingCode] = useState('');
  const [text, setText] = useState('');
  const [session, setSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [imageBusy, setImageBusy] = useState(false);
  const endRef = useRef(null);
  const imageInputRef = useRef(null);
  const activeSessionId = useRef(null);

  useEffect(() => {
    const trackingFound = (event) => {
      const code = String(event.detail?.tracking_code || '').trim().toUpperCase();
      if (code) setTrackingCode(code);
    };
    const openDriverChat = (event) => {
      const code = String(event.detail?.tracking_code || localStorage.getItem('last_tracking_code') || '')
        .trim().toUpperCase();
      setTrackingCode(code);
      setMode('live');
      setStep('identify');
      setError('');
      setIsOpen(true);
    };
    window.addEventListener('order-tracking-found', trackingFound);
    window.addEventListener('open-driver-chat', openDriverChat);
    return () => {
      window.removeEventListener('order-tracking-found', trackingFound);
      window.removeEventListener('open-driver-chat', openDriverChat);
    };
  }, []);

  useEffect(() => {
    const receiveMessage = (message) => {
      if (String(activeSessionId.current) !== String(message.session_id)) return;
      setMessages((existing) => existing.some((item) => String(item.id) === String(message.id)) ? existing : [...existing, message]);
    };
    const updateSession = ({ session_id: sessionId, status }) => {
      if (String(activeSessionId.current) === String(sessionId)) {
        setSession((current) => current ? { ...current, status } : current);
      }
    };
    const closeSession = ({ session_id: sessionId }) => {
      if (String(activeSessionId.current) !== String(sessionId)) return;
      setSession((current) => current ? { ...current, status: 'closed' } : current);
      setError('Phiên hỗ trợ đã kết thúc. Bạn có thể chọn “Đổi kênh” để bắt đầu phiên mới.');
    };
    chatSocket.on('receive_message', receiveMessage);
    chatSocket.on('chat_session_updated', updateSession);
    chatSocket.on('chat_closed', closeSession);
    return () => {
      chatSocket.off('receive_message', receiveMessage);
      chatSocket.off('chat_session_updated', updateSession);
      chatSocket.off('chat_closed', closeSession);
    };
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    let cancelled = false;
    const restoreChat = async () => {
      const savedValue = localStorage.getItem('guest_chat_session');
      if (!savedValue) return;
      let saved;
      try {
        saved = JSON.parse(savedValue);
      } catch {
        localStorage.removeItem('guest_chat_session');
        return;
      }
      if (!saved?.session_id || !saved?.guest_token
        || !saved.expires_at || new Date(saved.expires_at).getTime() <= Date.now()) {
        localStorage.removeItem('guest_chat_session');
        return;
      }
      try {
        const response = await fetch(`${API_URL}/api/chat/sessions/${saved.session_id}/messages`, {
          headers: { 'X-Chat-Token': saved.guest_token }
        });
        const result = await response.json();
        if (!response.ok || !result.success) {
          if (response.status === 403 || response.status === 404) {
            localStorage.removeItem('guest_chat_session');
          }
          return;
        }
        if (cancelled) return;
        const restoredSession = {
          ...result.data.session,
          guest_token: saved.guest_token,
          tracking_code: saved.tracking_code || ''
        };
        setMode(saved.mode);
        setSession(restoredSession);
        setMessages(result.data.messages || []);
        setStep('chat');
        activeSessionId.current = restoredSession.id;
        setIsOpen(true);
        chatSocket.emit('join_chat', {
          session_id: restoredSession.id,
          guest_token: saved.guest_token
        }, (joined) => {
          if (!joined?.success && !cancelled) {
            setError(joined?.message || 'Không thể khôi phục kết nối chat realtime.');
          }
        });
      } catch (restoreError) {
        if (!cancelled) setError(restoreError.message || 'Không thể khôi phục phiên chat.');
      }
    };
    restoreChat();
    return () => { cancelled = true; };
  }, []);

  const taoPhienChat = async (selectedMode) => {
    setBusy(true);
    setError('');
    try {
      const normalizedTrackingCode = selectedMode === 'live'
        ? (trackingCode || localStorage.getItem('last_tracking_code') || '').trim().toUpperCase()
        : '';
      const tokenStorageKey = normalizedTrackingCode
        ? `chat_session_token:${normalizedTrackingCode}` : null;
      const storedOrderToken = tokenStorageKey
        ? localStorage.getItem(tokenStorageKey) : null;
      const response = await fetch(`${API_URL}/api/chat/sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(storedOrderToken ? { 'X-Chat-Token': storedOrderToken } : {})
        },
        body: JSON.stringify({
          mode: selectedMode,
          customer_name: name,
          customer_phone: phone,
          tracking_code: normalizedTrackingCode
        })
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || 'Không thể mở phiên chat.');
      const nextSession = { ...result.data.session, guest_token: result.data.guest_token };
      const sessionStorage = {
        session_id: nextSession.id,
        mode: selectedMode,
        tracking_code: normalizedTrackingCode,
        guest_token: nextSession.guest_token,
        expires_at: nextSession.expires_at
      };
      localStorage.setItem('guest_chat_session', JSON.stringify(sessionStorage));
      if (tokenStorageKey) localStorage.setItem(tokenStorageKey, nextSession.guest_token);
      activeSessionId.current = nextSession.id;
      setMode(selectedMode);
      setSession(nextSession);
      const historyResponse = await fetch(`${API_URL}/api/chat/sessions/${nextSession.id}/messages`, {
        headers: { 'X-Chat-Token': nextSession.guest_token }
      });
      const history = await historyResponse.json();
      if (!historyResponse.ok || !history.success) {
        throw new Error(history.message || 'Không tải được lịch sử chat.');
      }
      setMessages(history.data.messages || []);
      setStep('chat');
      chatSocket.emit('join_chat', { session_id: nextSession.id, guest_token: nextSession.guest_token }, (joined) => {
        if (!joined?.success) setError(joined?.message || 'Không thể kết nối phiên chat realtime.');
      });
    } catch (requestError) {
      setError(requestError.message || 'Không thể kết nối máy chủ.');
    } finally {
      setBusy(false);
    }
  };

  const batDauChatAI = () => taoPhienChat('ai');

  const guiAnh = async (event) => {
    const image = event.target.files?.[0];
    event.target.value = '';
    if (!image || !session?.driver_id || mode !== 'live' || imageBusy) return;
    setImageBusy(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('image', image);
      const response = await fetch(`${API_URL}/api/chat/sessions/${session.id}/images`, {
        method: 'POST',
        headers: { 'X-Chat-Token': session.guest_token },
        body: formData
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || 'Không thể gửi ảnh.');
      setMessages((existing) => existing.some((item) => String(item.id) === String(result.data.id))
        ? existing
        : [...existing, result.data]);
    } catch (requestError) {
      setError(requestError.message || 'Không thể gửi ảnh.');
    } finally {
      setImageBusy(false);
    }
  };

  const guiTinNhan = async (event) => {
    event.preventDefault();
    const message = text.trim();
    if (!message || !session || busy) return;
    setText('');
    setError('');
    if (mode === 'ai') {
      setBusy(true);
      setMessages((existing) => [...existing, { id: `local-${Date.now()}`, sender_type: 'customer', message }]);
      try {
        const response = await fetch(`${API_URL}/api/chat/ai`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_id: session.id, guest_token: session.guest_token, message })
        });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.message || 'Chatbot chưa thể trả lời.');
        setMessages((existing) => existing.some((item) => String(item.id) === String(result.data.id)) ? existing : [...existing, result.data]);
      } catch (requestError) {
        setError(requestError.message || 'Lỗi kết nối chatbot.');
      } finally {
        setBusy(false);
      }
      return;
    }
    chatSocket.emit('send_message', {
      session_id: session.id,
      guest_token: session.guest_token,
      message
    }, (result) => {
      if (!result?.success) setError(result?.message || 'Không thể gửi tin nhắn.');
      else {
        setMessages((existing) => existing.some((item) => String(item.id) === String(result.data.id)) ? existing : [...existing, result.data]);
      }
    });
  };

  const batDauLai = () => {
    activeSessionId.current = null;
    localStorage.removeItem('guest_chat_session');
    setSession(null);
    setMessages([]);
    setMode('');
    setStep('choose');
    setError('');
  };

  return (
    <div className="fixed bottom-5 right-5 z-[120]">
      {isOpen && (
        <section className="mb-3 flex h-[min(620px,78vh)] w-[min(400px,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-200" aria-label="Chat hỗ trợ SmartLogistics">
          <header className="flex items-center justify-between bg-gradient-to-r from-blue-700 to-indigo-700 px-5 py-4 text-white shadow-md">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-white/15 flex items-center justify-center backdrop-blur-md">
                {mode === 'ai' ? <Bot size={20} className="text-cyan-300" /> : <Headphones size={20} className="text-cyan-300" />}
              </div>
              <div>
                <p className="font-black text-sm tracking-tight leading-tight">SmartLogistics Trực Tuyến</p>
                <p className="text-[11px] text-blue-200 font-medium">
                  {mode === 'ai' ? 'Trợ lý AI 24/7' : session?.driver_id ? `Tài xế giao đơn #${session.tracking_code || ''}` : mode === 'live' ? 'Nhân viên CSKH' : 'Chọn kênh hỗ trợ'}
                </p>
              </div>
            </div>
            <button
              type="button"
              aria-label="Đóng chat"
              onClick={() => setIsOpen(false)}
              className="rounded-full p-2 hover:bg-white/15 transition-colors"
            >
              <X size={18} />
            </button>
          </header>

          {step === 'choose' && (
            <div className="flex flex-1 flex-col justify-center gap-3.5 p-6 bg-slate-50/50">
              <div className="text-center mb-2">
                <h4 className="font-black text-slate-800 text-base">Chào bạn! Chúng tôi có thể giúp gì?</h4>
                <p className="text-xs text-slate-500 mt-1 font-medium">Chọn phương thức bạn muốn kết nối:</p>
              </div>

              <button
                type="button"
                disabled={busy}
                onClick={batDauChatAI}
                className="flex items-start gap-3.5 rounded-2xl border border-blue-100 bg-white p-4 text-left shadow-soft-sm hover:border-blue-400 hover:shadow-soft-md transition-all disabled:opacity-50 group"
              >
                <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <Bot size={22} />
                </div>
                <div>
                  <b className="block text-slate-900 text-sm font-bold group-hover:text-blue-600 transition-colors">Trợ Lý AI Tự Động</b>
                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed font-medium">Phản hồi tức thì về bảng giá, cước phí, bưu cục và kiểm tra vận đơn.</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => { setMode('live'); setStep('identify'); setError(''); }}
                className="flex items-start gap-3.5 rounded-2xl border border-emerald-100 bg-white p-4 text-left shadow-soft-sm hover:border-emerald-400 hover:shadow-soft-md transition-all group"
              >
                <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <Headphones size={22} />
                </div>
                <div>
                  <b className="block text-slate-900 text-sm font-bold group-hover:text-emerald-600 transition-colors">
                    {trackingCode ? 'Nhắn Tin Trực Tiếp Với Tài Xế' : 'Gặp Nhân Viên CSKH'}
                  </b>
                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed font-medium">
                    {trackingCode ? 'Liên hệ trực tiếp với bưu tá đang cầm kiện hàng của bạn.' : 'Nhân viên hỗ trợ sẽ tiếp nhận và giải quyết khiếu nại.'}
                  </p>
                </div>
              </button>
            </div>
          )}

          {step === 'identify' && (
            <form onSubmit={(event) => { event.preventDefault(); taoPhienChat('live'); }} className="flex flex-1 flex-col justify-center gap-3.5 p-6 bg-slate-50/50">
              <button
                type="button"
                onClick={() => setStep('choose')}
                className="flex w-fit items-center gap-1.5 text-xs font-bold text-blue-700 hover:text-blue-900 mb-2"
              >
                <ArrowLeft size={14} /> Quay lại chọn kênh
              </button>

              {trackingCode ? (
                <div className="rounded-2xl bg-blue-50 border border-blue-200 p-3.5 text-xs text-blue-900 font-medium">
                  Kết nối với tài xế đơn <strong>#{trackingCode}</strong>. Vui lòng nhập số điện thoại người nhận để xác minh quyền sở hữu:
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Tên của bạn</label>
                  <input
                    required
                    maxLength={255}
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Nguyễn Văn A"
                    className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm font-medium text-slate-800 outline-none focus:border-blue-500 shadow-soft-sm"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Số điện thoại liên hệ</label>
                <input
                  required
                  type="tel"
                  maxLength={20}
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="0901234567"
                  className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm font-medium text-slate-800 outline-none focus:border-blue-500 shadow-soft-sm"
                />
              </div>

              <button
                disabled={busy}
                className="mt-2 rounded-xl bg-blue-600 hover:bg-blue-700 p-3.5 font-black text-xs text-white shadow-md shadow-blue-500/25 transition-all disabled:opacity-50"
              >
                {busy ? 'Đang kết nối hệ thống...' : trackingCode.trim() ? 'Nhắn Trực Tiếp Tài Xế' : 'Vào Hàng Chờ Hỗ Trợ'}
              </button>
            </form>
          )}

          {step === 'chat' && (
            <>
              <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-2.5">
                <button
                  type="button"
                  onClick={batDauLai}
                  className="flex items-center gap-1 text-xs font-bold text-slate-600 hover:text-blue-600 transition-colors"
                >
                  <ArrowLeft size={13} /> Đổi kênh
                </button>
                {mode === 'live' && session?.status === 'waiting' && (
                  <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 animate-pulse">
                    Đang chờ kết nối...
                  </span>
                )}
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50/70 p-4">
                {!messages.length && (
                  <div className="mt-12 text-center text-xs text-slate-500 space-y-2">
                    <p className="font-bold text-slate-700">
                      {mode === 'ai' ? '👋 Xin chào! Mình là trợ lý SmartLogistics.' : session?.driver_id ? 'Bạn đang kết nối trực tiếp với tài xế giao đơn.' : 'Yêu cầu hỗ trợ đã được gửi đi.'}
                    </p>
                    <p>Hãy gửi câu hỏi để nhận phản hồi ngay.</p>
                  </div>
                )}

                {messages.map((message) => (
                  <div key={message.id} className={`flex ${message.sender_type === 'customer' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-xs leading-relaxed shadow-soft-sm ${
                      message.sender_type === 'customer'
                        ? 'bg-blue-600 text-white font-medium rounded-br-sm'
                        : 'border border-slate-200 bg-white text-slate-800 rounded-bl-sm'
                    }`}>
                      {message.sender_type !== 'customer' && (
                        <span className="mb-1 block text-[10px] font-black uppercase text-blue-600 tracking-wide">
                          {message.sender_type === 'bot' ? 'Trợ lý AI' : message.sender_type === 'driver' ? message.sender_name || 'Tài xế giao hàng' : message.sender_name || 'CSKH'}
                        </span>
                      )}
                      {message.message && <p>{message.message}</p>}
                      {message.image_url && (
                        <a href={resolveApiAssetUrl(message.image_url)} target="_blank" rel="noreferrer">
                          <img src={resolveApiAssetUrl(message.image_url)} alt="Ảnh đính kèm" className="mt-1.5 max-h-56 max-w-full rounded-xl object-contain border border-slate-200" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}

                {busy && mode === 'ai' && (
                  <div className="w-fit rounded-2xl border border-slate-200 bg-white px-3.5 py-2 text-xs text-slate-500 font-medium flex items-center gap-2" role="status">
                    <span className="h-2 w-2 rounded-full bg-blue-600 animate-ping" />
                    AI đang soạn câu trả lời...
                  </div>
                )}
                <div ref={endRef} />
              </div>

              <form onSubmit={guiTinNhan} className="flex gap-2 border-t border-slate-100 bg-white p-3">
                {mode === 'live' && session?.driver_id && (
                  <>
                    <input ref={imageInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={guiAnh} />
                    <button
                      type="button"
                      disabled={imageBusy || busy || session?.status === 'closed'}
                      aria-label="Gửi ảnh"
                      onClick={() => imageInputRef.current?.click()}
                      className="rounded-full border border-slate-200 hover:bg-slate-50 p-2.5 text-slate-600 transition-colors disabled:opacity-50"
                    >
                      <ImagePlus size={17} />
                    </button>
                  </>
                )}
                <input
                  disabled={session?.status === 'closed'}
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  maxLength={2000}
                  placeholder={session?.status === 'closed' ? 'Phiên hỗ trợ đã kết thúc' : 'Nhập tin nhắn...'}
                  className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-medium outline-none focus:bg-white focus:border-blue-500 disabled:bg-slate-100"
                />
                <button
                  disabled={!text.trim() || busy || session?.status === 'closed'}
                  aria-label="Gửi tin nhắn"
                  className="rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 p-2.5 text-white shadow-md shadow-blue-500/20 disabled:opacity-50 transition-all"
                >
                  <Send size={16} />
                </button>
              </form>
            </>
          )}

          {error && <p role="alert" className="bg-rose-50 px-4 py-2 text-xs font-bold text-rose-700 border-t border-rose-200">{error}</p>}
        </section>
      )}

      {/* Launcher Button with pulse ring */}
      <div className="relative">
        {!isOpen && (
          <span className="absolute -inset-1 rounded-full bg-blue-500 opacity-40 blur animate-pulse" />
        )}
        <button
          type="button"
          aria-label={isOpen ? 'Đóng cửa sổ chat' : 'Mở chat hỗ trợ'}
          onClick={() => setIsOpen((open) => !open)}
          className="relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-tr from-blue-700 to-indigo-600 text-white shadow-xl hover:from-blue-600 hover:to-indigo-500 active:scale-95 transition-all"
        >
          {isOpen ? <X size={22} /> : <MessageCircle size={24} />}
        </button>
      </div>
    </div>
  );
}
