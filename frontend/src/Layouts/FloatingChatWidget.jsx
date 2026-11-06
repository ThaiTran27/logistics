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
        <section className="mb-3 flex h-[min(600px,75vh)] w-[min(380px,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl" aria-label="Chat hỗ trợ SmartLogistics">
          <header className="flex items-center justify-between bg-blue-700 px-4 py-3 text-white">
            <div>
              <p className="font-black">SmartLogistics hỗ trợ</p>
              <p className="text-xs text-blue-100">{mode === 'ai' ? 'AI · Hỗ trợ 24/7' : session?.driver_id ? `Tài xế đơn ${session.tracking_code || ''}` : mode === 'live' ? 'Nhân viên CSKH' : 'Chọn kênh hỗ trợ'}</p>
            </div>
            <button type="button" aria-label="Đóng chat" onClick={() => setIsOpen(false)} className="rounded-full p-2 hover:bg-white/15"><X size={18} /></button>
          </header>

          {step === 'choose' && (
            <div className="flex flex-1 flex-col justify-center gap-3 p-5">
              <p className="mb-2 text-sm text-slate-600">Bạn muốn được hỗ trợ theo cách nào?</p>
              <button type="button" disabled={busy} onClick={batDauChatAI} className="flex items-center gap-3 rounded-xl border border-blue-100 bg-blue-50 p-4 text-left hover:bg-blue-100 disabled:opacity-50">
                <Bot className="text-blue-700" />
                <span><b className="block text-slate-800">Chat với AI SmartLogistics</b><small className="text-slate-500">Trả lời nhanh về cước, giao hàng và vận đơn.</small></span>
              </button>
              <button type="button" onClick={() => { setMode('live'); setStep('identify'); setError(''); }} className="flex items-center gap-3 rounded-xl border border-slate-200 p-4 text-left hover:bg-slate-50">
                <Headphones className="text-emerald-700" />
                <span><b className="block text-slate-800">{trackingCode ? 'Chat trực tiếp với tài xế' : 'Gặp nhân viên CSKH'}</b><small className="text-slate-500">{trackingCode ? 'Nhập số điện thoại người nhận để xác minh đơn đã tra cứu.' : 'Để lại tên và số điện thoại để vào hàng chờ.'}</small></span>
              </button>
            </div>
          )}

          {step === 'identify' && (
            <form onSubmit={(event) => { event.preventDefault(); taoPhienChat('live'); }} className="flex flex-1 flex-col justify-center gap-3 p-5">
              <button type="button" onClick={() => setStep('choose')} className="flex w-fit items-center gap-1 text-sm font-bold text-blue-700"><ArrowLeft size={16} /> Quay lại</button>
              {trackingCode ? (
                <p className="rounded-lg bg-blue-50 p-3 text-sm text-blue-800">
                  Chat về đơn <strong>{trackingCode}</strong>. Nhập số điện thoại người nhận để xác minh.
                </p>
              ) : (
                <label className="text-sm font-bold text-slate-700">Tên của bạn
                  <input required maxLength={255} value={name} onChange={(event) => setName(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 p-3 font-normal" />
                </label>
              )}
              <label className="text-sm font-bold text-slate-700">Số điện thoại
                <input required type="tel" maxLength={20} value={phone} onChange={(event) => setPhone(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 p-3 font-normal" />
              </label>
              {!trackingCode && <span className="text-xs text-slate-500">Nếu đã tra cứu vận đơn, hãy quay lại trang tra cứu để mở chat trực tiếp với tài xế.</span>}
              <button disabled={busy} className="rounded-lg bg-blue-700 p-3 font-black text-white disabled:opacity-50">{busy ? 'Đang kết nối...' : trackingCode.trim() ? 'Nhắn trực tiếp tài xế' : 'Vào hàng chờ hỗ trợ'}</button>
            </form>
          )}

          {step === 'chat' && (
            <>
              <div className="flex items-center justify-between border-b px-3 py-2">
                <button type="button" onClick={batDauLai} className="flex items-center gap-1 text-xs font-bold text-blue-700"><ArrowLeft size={14} /> Đổi kênh</button>
                {mode === 'live' && session?.status === 'waiting' && <span className="text-xs font-semibold text-amber-700">Đang chờ nhân viên tham gia</span>}
              </div>
              <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50 p-3">
                {!messages.length && <p className="mt-8 text-center text-sm text-slate-500">{mode === 'ai' ? 'Xin chào! Bạn cần mình hỗ trợ gì?' : session?.driver_id ? 'Bạn có thể nhắn trực tiếp với tài xế đang giao đơn.' : 'Đã gửi yêu cầu. Nhân viên sẽ tham gia trong ít phút.'}</p>}
                {messages.map((message) => (
                  <div key={message.id} className={`flex ${message.sender_type === 'customer' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${message.sender_type === 'customer' ? 'bg-blue-700 text-white' : 'border border-slate-200 bg-white text-slate-700'}`}>
                      {message.sender_type !== 'customer' && <span className="mb-1 block text-[10px] font-black uppercase text-blue-700">{message.sender_type === 'bot' ? 'AI SmartLogistics' : message.sender_type === 'driver' ? message.sender_name || 'Tài xế giao hàng' : message.sender_name || 'Nhân viên CSKH'}</span>}
                      {message.message && <p>{message.message}</p>}
                      {message.image_url && <a href={resolveApiAssetUrl(message.image_url)} target="_blank" rel="noreferrer"><img src={resolveApiAssetUrl(message.image_url)} alt="Ảnh trong tin nhắn" className="mt-1 max-h-56 max-w-full rounded-lg object-contain" /></a>}
                    </div>
                  </div>
                ))}
                {busy && mode === 'ai' && (
                  <p className="w-fit rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500" role="status">
                    AI đang soạn câu trả lời...
                  </p>
                )}
                <div ref={endRef} />
              </div>
              <form onSubmit={guiTinNhan} className="flex gap-2 border-t p-3">
                {mode === 'live' && session?.driver_id && (
                  <>
                    <input ref={imageInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={guiAnh} />
                    <button type="button" disabled={imageBusy || busy || session?.status === 'closed'} aria-label="Gửi ảnh" onClick={() => imageInputRef.current?.click()} className="rounded-full border border-slate-300 p-3 text-slate-600 disabled:opacity-50"><ImagePlus size={16} /></button>
                  </>
                )}
                <input disabled={session?.status === 'closed'} value={text} onChange={(event) => setText(event.target.value)} maxLength={2000} placeholder={session?.status === 'closed' ? 'Phiên đã kết thúc' : 'Nhập tin nhắn...'} className="min-w-0 flex-1 rounded-full border border-slate-300 px-4 py-2 text-sm outline-none focus:border-blue-500 disabled:bg-slate-100" />
                <button disabled={!text.trim() || busy || session?.status === 'closed'} aria-label="Gửi tin nhắn" className="rounded-full bg-blue-700 p-3 text-white disabled:opacity-50"><Send size={16} /></button>
              </form>
            </>
          )}
          {error && <p role="alert" className="bg-red-50 px-4 py-2 text-xs font-semibold text-red-700">{error}</p>}
        </section>
      )}
      <button type="button" aria-label={isOpen ? 'Đóng cửa sổ chat' : 'Mở chat hỗ trợ'} onClick={() => setIsOpen((open) => !open)} className="ml-auto flex h-14 w-14 items-center justify-center rounded-full bg-blue-700 text-white shadow-xl hover:bg-blue-800">
        {isOpen ? <X size={22} /> : <MessageCircle size={24} />}
      </button>
    </div>
  );
}
