import { useEffect, useRef, useState } from 'react';
import { ImagePlus, MessageCircle, Send, X } from 'lucide-react';
import { io } from 'socket.io-client';
import { API_URL, apiFetch as fetch, resolveApiAssetUrl } from '../utils/apiFetch.js';


export default function DriverOrderChat({ order, onClose }) {
  const [session, setSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(true);
  const [imageBusy, setImageBusy] = useState(false);
  const endRef = useRef(null);
  const imageInputRef = useRef(null);
  const sessionIdRef = useRef(null);
  const socketRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    let socket;
    const startChat = async () => {
      try {
        const response = await fetch(`${API_URL}/api/driver/orders/${order.id}/chat`, { method: 'POST' });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.message || 'Không thể mở chat với người nhận.');
        if (cancelled) return;
        setSession(result.data);
        sessionIdRef.current = result.data.id;
        const historyResponse = await fetch(`${API_URL}/api/chat/sessions/${result.data.id}/messages`);
        const history = await historyResponse.json();
        if (!historyResponse.ok || !history.success) throw new Error(history.message || 'Không tải được lịch sử chat.');
        if (cancelled) return;
        setMessages(history.data.messages || []);
        socket = io(API_URL, { auth: { token: localStorage.getItem('access_token') } });
        socketRef.current = socket;
        socket.on('connect', () => setError(''));
        socket.on('connect_error', (connectionError) => {
          setError(connectionError.message || 'Mất kết nối chat realtime.');
        });
        socket.on('receive_message', (message) => {
          if (String(sessionIdRef.current) !== String(message.session_id)) return;
          setMessages((current) => current.some((item) => String(item.id) === String(message.id))
            ? current
            : [...current, message]);
        });
        socket.emit('join_chat', { session_id: result.data.id }, (joined) => {
          if (!joined?.success) setError(joined?.message || 'Không thể kết nối chat realtime.');
        });
      } catch (requestError) {
        if (!cancelled) setError(requestError.message || 'Không thể kết nối máy chủ.');
      } finally {
        if (!cancelled) setBusy(false);
      }
    };
    startChat();
    return () => {
      cancelled = true;
      sessionIdRef.current = null;
      socket?.disconnect();
      socketRef.current = null;
    };
  }, [order.id]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = (event) => {
    event.preventDefault();
    const message = text.trim();
    if (!message || !session || busy) return;
    const socket = socketRef.current;
    if (!socket?.connected) {
      setError('Kết nối chat chưa sẵn sàng. Vui lòng thử lại.');
      return;
    }
    setError('');
    setText('');
    socket.emit('send_message', { session_id: session.id, message }, (result) => {
      if (!result?.success) return setError(result?.message || 'Không thể gửi tin nhắn.');
      setMessages((current) => current.some((item) => String(item.id) === String(result.data.id))
        ? current
        : [...current, result.data]);
    });
  };

  const sendImage = async (event) => {
    const image = event.target.files?.[0];
    event.target.value = '';
    if (!image || !session || imageBusy || busy) return;
    setImageBusy(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('image', image);
      const response = await fetch(`${API_URL}/api/chat/sessions/${session.id}/images`, {
        method: 'POST',
        body: formData
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || 'Không thể gửi ảnh.');
      setMessages((current) => current.some((item) => String(item.id) === String(result.data.id))
        ? current
        : [...current, result.data]);
    } catch (requestError) {
      setError(requestError.message || 'Không thể gửi ảnh.');
    } finally {
      setImageBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[140] flex items-end justify-center bg-slate-950/40 p-3 sm:items-center">
      <section className="flex h-[min(620px,85vh)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <header className="flex items-center justify-between bg-blue-700 px-4 py-3 text-white">
          <div><p className="font-black">Nhắn người nhận</p><p className="text-xs text-blue-100">Đơn {order.tracking_code}</p></div>
          <button type="button" aria-label="Đóng chat" onClick={onClose} className="rounded-full p-2 hover:bg-white/15"><X size={18} /></button>
        </header>
        <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50 p-3">
          {!messages.length && <p className="mt-8 text-center text-sm text-slate-500">{busy ? 'Đang kết nối...' : 'Bắt đầu trao đổi với người nhận.'}</p>}
          {messages.map((message) => (
            <div key={message.id} className={`flex ${message.sender_type === 'driver' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${message.sender_type === 'driver' ? 'bg-blue-700 text-white' : 'border border-slate-200 bg-white text-slate-700'}`}>
                {message.sender_type !== 'driver' && <span className="mb-1 block text-[10px] font-black uppercase text-blue-700">{message.sender_name || 'Người nhận'}</span>}
                {message.message && <p>{message.message}</p>}
                {message.image_url && <a href={resolveApiAssetUrl(message.image_url)} target="_blank" rel="noreferrer"><img src={resolveApiAssetUrl(message.image_url)} alt="Ảnh trong tin nhắn" className="mt-1 max-h-56 max-w-full rounded-lg object-contain" /></a>}
              </div>
            </div>
          ))}
          <div ref={endRef} />
        </div>
        <form onSubmit={sendMessage} className="flex gap-2 border-t p-3">
          <input ref={imageInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={sendImage} />
          <button type="button" disabled={imageBusy || busy} aria-label="Gửi ảnh" onClick={() => imageInputRef.current?.click()} className="rounded-full border border-slate-300 p-3 text-slate-600 disabled:opacity-50"><ImagePlus size={16} /></button>
          <input value={text} onChange={(event) => setText(event.target.value)} maxLength={2000} placeholder="Nhập tin nhắn..." className="min-w-0 flex-1 rounded-full border border-slate-300 px-4 py-2 text-sm outline-none focus:border-blue-500" />
          <button disabled={!text.trim() || busy} aria-label="Gửi tin nhắn" className="rounded-full bg-blue-700 p-3 text-white disabled:opacity-50"><Send size={16} /></button>
        </form>
        {error && <p role="alert" className="bg-red-50 px-4 py-2 text-xs font-semibold text-red-700">{error}</p>}
        <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 text-[11px] text-slate-500"><MessageCircle size={13} /> Chỉ tài xế được phân công và người nhận xác minh đơn mới truy cập được.</div>
      </section>
    </div>
  );
}
