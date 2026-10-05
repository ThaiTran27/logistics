import { apiFetch as fetch } from '../../utils/apiFetch.js';
import { useCallback, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { Headphones, MessageCircle, Phone, Send, UserRound, XCircle } from 'lucide-react';

const API_URL = 'http://localhost:5000';

export default function TrungTamHoTro() {
  const token = localStorage.getItem('access_token');
  const staffName = localStorage.getItem('full_name') || 'Nhân viên hỗ trợ';
  const [sessions, setSessions] = useState([]);
  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]);
  const [context, setContext] = useState({ customer: null, orders: [] });
  const [messageText, setMessageText] = useState('');
  const [error, setError] = useState(token ? '' : 'Phiên đăng nhập chưa có thông tin xác thực. Vui lòng đăng nhập lại.');
  const [loading, setLoading] = useState(Boolean(token));
  const [sending, setSending] = useState(false);
  const endRef = useRef(null);
  const socketRef = useRef(null);
  const selectedIdRef = useRef(null);

  useEffect(() => {
    selectedIdRef.current = selected?.id || null;
  }, [selected?.id]);

  const loadSessions = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const response = await fetch(`${API_URL}/api/chat/sessions`, { headers: { Authorization: `Bearer ${token}` } });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || 'Không thể tải hàng đợi.');
      setSessions(result.data);
      setError('');
    } catch (requestError) {
      setError(requestError.message || 'Lỗi kết nối máy chủ.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!token) return undefined;
    const socket = io(API_URL, { auth: { token } });
    socketRef.current = socket;
    socket.on('connect_error', (socketError) => setError(socketError.message || 'Không thể kết nối chat realtime.'));
    socket.on('chat_session_updated', () => loadSessions());
    socket.on('receive_message', (message) => {
      if (String(message.session_id) !== String(selectedIdRef.current)) return;
      setMessages((current) => current.some((item) => String(item.id) === String(message.id)) ? current : [...current, message]);
      setSessions((current) => current.map((session) => String(session.id) === String(message.session_id)
        ? { ...session, latest_message: message.message, status: 'active' }
        : session));
    });
    socket.on('chat_closed', ({ session_id: sessionId }) => {
      setSessions((current) => current.filter((session) => String(session.id) !== String(sessionId)));
      if (String(selectedIdRef.current) === String(sessionId)) {
        setSelected(null);
        setMessages([]);
      }
    });
    socket.on('chat_session_updated', ({ session_id: sessionId, status }) => {
      setSessions((current) => current.map((session) => String(session.id) === String(sessionId) ? { ...session, status } : session));
      if (String(selectedIdRef.current) === String(sessionId)) setSelected((current) => current ? { ...current, status } : current);
    });
    const initialLoad = window.setTimeout(() => { loadSessions(); }, 0);
    return () => {
      window.clearTimeout(initialLoad);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [loadSessions, token]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const selectSession = async (session) => {
    setSelected(session);
    selectedIdRef.current = session.id;
    setContext({ customer: null, orders: [] });
    setError('');
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [messagesResponse, contextResponse] = await Promise.all([
        fetch(`${API_URL}/api/chat/sessions/${session.id}/messages`, { headers }),
        fetch(`${API_URL}/api/chat/sessions/${session.id}/context`, { headers })
      ]);
      const [messagesResult, contextResult] = await Promise.all([messagesResponse.json(), contextResponse.json()]);
      if (!messagesResponse.ok || !messagesResult.success) throw new Error(messagesResult.message || 'Không thể tải hội thoại.');
      if (!contextResponse.ok || !contextResult.success) throw new Error(contextResult.message || 'Không thể tải thông tin khách.');
      setMessages(messagesResult.data.messages);
      setContext(contextResult.data);
      socketRef.current?.emit('join_chat', { session_id: session.id }, (joined) => {
        if (!joined?.success) setError(joined?.message || 'Không thể tham gia phòng chat.');
      });
    } catch (requestError) {
      setError(requestError.message || 'Lỗi tải hội thoại.');
    }
  };

  const sendMessage = (event) => {
    event.preventDefault();
    const message = messageText.trim();
    if (!message || !selected || sending) return;
    setSending(true);
    setMessageText('');
    socketRef.current?.emit('send_message', { session_id: selected.id, message }, (result) => {
      if (!result?.success) {
        setError(result?.message || 'Không gửi được tin nhắn.');
        setMessageText(message);
      } else {
        setError('');
        setMessages((current) => current.some((item) => String(item.id) === String(result.data.id)) ? current : [...current, result.data]);
      }
      setSending(false);
    });
  };

  const closeSession = async () => {
    if (!selected || !window.confirm('Kết thúc phiên hỗ trợ này?')) return;
    try {
      const response = await fetch(`${API_URL}/api/chat/sessions/${selected.id}/close`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || 'Không thể kết thúc phiên.');
      setSelected(null);
      setMessages([]);
      await loadSessions();
    } catch (requestError) {
      setError(requestError.message || 'Lỗi kết nối máy chủ.');
    }
  };

  return (
    <main className="min-h-screen bg-slate-100 p-4 font-sans text-slate-800 md:p-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-black"><Headphones className="text-blue-700" /> Trung tâm Hỗ trợ</h1>
            <p className="mt-1 text-sm text-slate-500">Hàng chờ khách hàng và hội thoại trực tiếp.</p>
            <p className="mt-1 text-sm font-bold text-slate-700">{staffName}</p>
          </div>
          <button onClick={loadSessions} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold hover:bg-slate-50">Làm mới hàng chờ</button>
        </header>

        {error && <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}

        <div className="grid min-h-[70vh] grid-cols-1 gap-4 lg:grid-cols-[280px_minmax(0,1fr)_300px]">
          <aside className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b p-4">
              <h2 className="font-black">Khách cần hỗ trợ</h2>
              <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-black text-amber-800">{sessions.filter((session) => session.status === 'waiting').length}</span>
            </div>
            <div className="max-h-[65vh] overflow-y-auto">
              {loading && <p className="p-4 text-sm text-slate-500">Đang tải hàng chờ...</p>}
              {!loading && sessions.length === 0 && <p className="p-5 text-sm text-slate-500">Chưa có khách chờ hỗ trợ.</p>}
              {sessions.map((session) => (
                <button key={session.id} onClick={() => selectSession(session)} className={`w-full border-b p-4 text-left hover:bg-blue-50 ${String(selected?.id) === String(session.id) ? 'bg-blue-50' : ''}`}>
                  <span className="flex items-center justify-between gap-2">
                    <b className="truncate">{session.customer_name}</b>
                    {session.status === 'waiting' && <span className="shrink-0 rounded bg-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-800">CHỜ</span>}
                  </span>
                  <span className="mt-1 block truncate text-xs text-slate-500">{session.customer_phone || 'Chưa có số điện thoại'}</span>
                  <span className="mt-2 block truncate text-xs text-slate-600">{session.latest_message || 'Khách vừa gửi yêu cầu hỗ trợ'}</span>
                </button>
              ))}
            </div>
          </aside>

          <section className="flex min-h-[65vh] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white">
            {selected ? (
              <>
                <div className="flex items-center justify-between border-b p-4">
                  <div><h2 className="font-black">{selected.customer_name}</h2><p className="text-xs text-slate-500">Phiên #{selected.id}</p></div>
                  <button onClick={closeSession} className="flex items-center gap-1 rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-100"><XCircle size={15} /> Kết thúc</button>
                </div>
                <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50 p-4">
                  {messages.map((message) => (
                    <div key={message.id} className={`flex ${message.sender_type === 'customer' ? 'justify-start' : 'justify-end'}`}>
                      <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${message.sender_type === 'customer' ? 'border border-slate-200 bg-white' : 'bg-blue-700 text-white'}`}>
                        {message.sender_type === 'agent' && <span className="mb-1 block text-[10px] font-black uppercase text-blue-100">{message.sender_name || 'Nhân viên'}</span>}
                        {message.message}
                      </div>
                    </div>
                  ))}
                  <div ref={endRef} />
                </div>
                <form onSubmit={sendMessage} className="flex gap-2 border-t p-3">
                  <input value={messageText} onChange={(event) => setMessageText(event.target.value)} maxLength={2000} placeholder="Nhập tin nhắn trả lời..." className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none" />
                  <button disabled={sending || !messageText.trim()} className="rounded-lg bg-blue-700 px-4 text-white disabled:opacity-50"><Send size={17} /></button>
                </form>
              </>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center p-8 text-center text-slate-400">
                <MessageCircle size={42} />
                <p className="mt-3 font-bold">Chọn một hội thoại để bắt đầu hỗ trợ.</p>
              </div>
            )}
          </section>

          <aside className="rounded-2xl border border-slate-200 bg-white p-4">
            <h2 className="mb-4 flex items-center gap-2 font-black"><UserRound size={18} className="text-blue-700" /> Thông tin khách</h2>
            {context.customer ? (
              <>
                <p className="font-bold">{context.customer.customer_name}</p>
                <a href={`tel:${context.customer.customer_phone || ''}`} className="mt-1 flex items-center gap-1 text-sm text-blue-700"><Phone size={14} />{context.customer.customer_phone || 'Chưa có số điện thoại'}</a>
                <h3 className="mb-2 mt-6 text-xs font-black uppercase tracking-wide text-slate-500">Đơn hàng gần đây</h3>
                {!context.orders.length && <p className="text-sm text-slate-500">Không tìm thấy đơn hàng theo số điện thoại.</p>}
                <div className="space-y-2">
                  {context.orders.map((order) => (
                    <div key={order.tracking_code} className="rounded-lg border border-slate-200 p-3 text-xs">
                      <p className="font-mono font-black text-blue-700">{order.tracking_code}</p>
                      <p className="mt-1 text-slate-600">{order.status}</p>
                      <p className="mt-1 text-slate-500">{new Date(order.created_at).toLocaleDateString('vi-VN')}</p>
                    </div>
                  ))}
                </div>
              </>
            ) : <p className="text-sm text-slate-500">Thông tin khách hàng sẽ hiển thị khi chọn hội thoại.</p>}
          </aside>
        </div>
      </div>
    </main>
  );
}
