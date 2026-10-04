import { useEffect, useRef, useState } from 'react';
import { MessageCircle, Send, X, Bot, Headphones, ArrowLeft } from 'lucide-react';
import { io } from 'socket.io-client';

const chatSocket = io('http://localhost:5000');

export default function FloatingChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState('choose');
  const [mode, setMode] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [text, setText] = useState('');
  const [session, setSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const endRef = useRef(null);
  const activeSessionId = useRef(null);

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

  const taoPhienChat = async (selectedMode) => {
    setBusy(true);
    setError('');
    try {
      const response = await fetch('http://localhost:5000/api/chat/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: selectedMode, customer_name: name, customer_phone: phone })
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || 'Không thể mở phiên chat.');
      const nextSession = { ...result.data.session, guest_token: result.data.guest_token };
      activeSessionId.current = nextSession.id;
      setMode(selectedMode);
      setSession(nextSession);
      setMessages([]);
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
        const response = await fetch('http://localhost:5000/api/chat/ai', {
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
              <p className="text-xs text-blue-100">{mode === 'ai' ? 'AI · Hỗ trợ 24/7' : mode === 'live' ? 'Nhân viên CSKH' : 'Chọn kênh hỗ trợ'}</p>
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
                <span><b className="block text-slate-800">Gặp nhân viên CSKH</b><small className="text-slate-500">Để lại tên và số điện thoại để vào hàng chờ.</small></span>
              </button>
            </div>
          )}

          {step === 'identify' && (
            <form onSubmit={(event) => { event.preventDefault(); taoPhienChat('live'); }} className="flex flex-1 flex-col justify-center gap-3 p-5">
              <button type="button" onClick={() => setStep('choose')} className="flex w-fit items-center gap-1 text-sm font-bold text-blue-700"><ArrowLeft size={16} /> Quay lại</button>
              <label className="text-sm font-bold text-slate-700">Tên của bạn
                <input required maxLength={255} value={name} onChange={(event) => setName(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 p-3 font-normal" />
              </label>
              <label className="text-sm font-bold text-slate-700">Số điện thoại
                <input required type="tel" maxLength={20} value={phone} onChange={(event) => setPhone(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 p-3 font-normal" />
              </label>
              <button disabled={busy} className="rounded-lg bg-blue-700 p-3 font-black text-white disabled:opacity-50">{busy ? 'Đang kết nối...' : 'Vào hàng chờ hỗ trợ'}</button>
            </form>
          )}

          {step === 'chat' && (
            <>
              <div className="flex items-center justify-between border-b px-3 py-2">
                <button type="button" onClick={batDauLai} className="flex items-center gap-1 text-xs font-bold text-blue-700"><ArrowLeft size={14} /> Đổi kênh</button>
                {mode === 'live' && session?.status === 'waiting' && <span className="text-xs font-semibold text-amber-700">Đang chờ nhân viên tham gia</span>}
              </div>
              <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50 p-3">
                {!messages.length && <p className="mt-8 text-center text-sm text-slate-500">{mode === 'ai' ? 'Xin chào! Bạn cần mình hỗ trợ gì?' : 'Đã gửi yêu cầu. Nhân viên sẽ tham gia trong ít phút.'}</p>}
                {messages.map((message) => (
                  <div key={message.id} className={`flex ${message.sender_type === 'customer' ? 'justify-end' : 'justify-start'}`}>
                    <p className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${message.sender_type === 'customer' ? 'bg-blue-700 text-white' : 'border border-slate-200 bg-white text-slate-700'}`}>
                      {message.sender_type !== 'customer' && <span className="mb-1 block text-[10px] font-black uppercase text-blue-700">{message.sender_type === 'bot' ? 'AI SmartLogistics' : message.sender_name || 'Nhân viên CSKH'}</span>}
                      {message.message}
                    </p>
                  </div>
                ))}
                <div ref={endRef} />
              </div>
              <form onSubmit={guiTinNhan} className="flex gap-2 border-t p-3">
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
