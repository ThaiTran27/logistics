import { useEffect, useState } from 'react';
import { FileText, ImageIcon, Newspaper, Sparkles, CheckCircle2, LogOut, Briefcase, LayoutGrid, PlusCircle } from 'lucide-react';

const initialForm = {
  title: '',
  summary: '',
  content: '',
  category: 'Tin tức',
  image_url: '',
  created_by: 'content_team',
};

export default function QuanLyTinTuc() {
  const [form, setForm] = useState(initialForm);
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingList, setLoadingList] = useState(true);
  const [message, setMessage] = useState('');
  const [activeTab, setActiveTab] = useState('bai-viet');

  const contentName = localStorage.getItem('full_name') || 'Phòng Nội Dung';

  const fetchArticles = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/news');
      const data = await res.json();
      if (data.success) {
        setArticles(data.data || []);
      }
    } catch (error) {
      console.error('Lỗi tải tin tức:', error);
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    fetchArticles();
  }, []);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const res = await fetch('http://localhost:5000/api/news', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const data = await res.json();
      if (data.success) {
        setMessage('Đã lưu bài tin tức thành công.');
        setForm(initialForm);
        await fetchArticles();
      } else {
        setMessage(data.message || 'Có lỗi khi lưu bài tin tức.');
      }
    } catch (error) {
      setMessage('Lỗi kết nối server.');
    } finally {
      setLoading(false);
    }
  };

  const dangXuat = () => {
    if (window.confirm('Bạn muốn đăng xuất khỏi phòng ban nội dung?')) {
      localStorage.clear();
      window.location.href = '/';
    }
  };

  const totalArticles = articles.length;
  const categoryCount = new Set(articles.map(item => item.category)).size;

  return (
    <div className="flex min-h-screen bg-[#FFFBFB] font-sans text-slate-700">
      <aside className="w-72 bg-white border-r border-blue-100 shadow-sm flex flex-col justify-between z-10">
        <div>
          <div className="p-8 border-b border-blue-50 flex items-center gap-3">
            <div className="bg-gradient-to-tr from-blue-500 to-indigo-500 p-2.5 rounded-xl shadow-lg shadow-blue-200">
              <Briefcase className="text-white" size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-800 tracking-tight">Nội dung</h2>
              <p className="text-xs font-bold text-blue-500 uppercase tracking-wider mt-0.5">Quản trị tin tức</p>
            </div>
          </div>

          <div className="p-5 mt-2 space-y-3">
            <button
              onClick={() => setActiveTab('bai-viet')}
              className={`w-full px-5 py-4 rounded-2xl font-bold flex items-center gap-4 transition-all ${activeTab === 'bai-viet' ? 'bg-blue-50 text-blue-600 border border-blue-200 shadow-sm' : 'text-slate-500 hover:bg-blue-50/50'}`}
            >
              <LayoutGrid size={20} /> Bài viết
            </button>
            <button
              onClick={() => setActiveTab('tao-moi')}
              className={`w-full px-5 py-4 rounded-2xl font-bold flex items-center gap-4 transition-all ${activeTab === 'tao-moi' ? 'bg-blue-50 text-blue-600 border border-blue-200 shadow-sm' : 'text-slate-500 hover:bg-blue-50/50'}`}
            >
              <PlusCircle size={20} /> Tạo mới
            </button>
          </div>
        </div>

        <div className="p-5 border-t border-blue-50">
          <div className="flex items-center gap-3 px-5 py-4 mb-2 bg-blue-50/50 rounded-xl border border-blue-100">
            <div className="w-10 h-10 rounded-full bg-blue-200 flex items-center justify-center font-black text-blue-700">
              {(contentName || 'N').charAt(0)}
            </div>
            <div>
              <p className="text-sm font-bold text-slate-700 truncate w-36">{contentName}</p>
            </div>
          </div>
          <button onClick={dangXuat} className="w-full px-5 py-4 rounded-2xl font-bold text-left text-red-500 hover:bg-red-50 transition-colors flex items-center gap-3">
            <LogOut size={20}/> Đăng Xuất
          </button>
        </div>
      </aside>

      <main className="flex-1 p-10 overflow-y-auto">
        <div className="mb-8 flex justify-between items-end">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.24em] text-blue-600">Phòng ban nội dung</p>
            <h1 className="mt-3 text-4xl font-black text-slate-800">Quản lý tin tức</h1>
          </div>
        </div>

        <div className="mb-8 grid gap-4 md:grid-cols-3">
          <div className="bg-white rounded-[24px] border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-slate-500">Tổng bài viết</span>
              <Newspaper className="text-blue-500" size={20} />
            </div>
            <p className="mt-4 text-3xl font-black text-slate-800">{totalArticles}</p>
          </div>

          <div className="bg-white rounded-[24px] border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-slate-500">Chuyên mục</span>
              <Sparkles className="text-violet-500" size={20} />
            </div>
            <p className="mt-4 text-3xl font-black text-slate-800">{categoryCount}</p>
          </div>

          <div className="bg-white rounded-[24px] border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-slate-500">Trạng thái</span>
              <CheckCircle2 className="text-emerald-500" size={20} />
            </div>
            <p className="mt-4 text-xl font-black text-emerald-600">Đang hoạt động</p>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.7fr_0.9fr]">
          <form onSubmit={handleSubmit} className="space-y-5 rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-4">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Tạo bài mới</p>
                <h2 className="mt-2 text-2xl font-black text-slate-800">Nội dung tin tức</h2>
              </div>
              <div className="rounded-full bg-blue-50 p-2 text-blue-600">
                <FileText size={18} />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-slate-700">Tiêu đề</label>
              <input
                name="title"
                value={form.title}
                onChange={handleChange}
                placeholder="Nhập tiêu đề bài viết..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3.5 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-50"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-slate-700">Tóm tắt</label>
              <textarea
                name="summary"
                value={form.summary}
                onChange={handleChange}
                rows={3}
                placeholder="Viết mô tả ngắn gọn về nội dung bài viết..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3.5 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-50"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-slate-700">Nội dung</label>
              <textarea
                name="content"
                value={form.content}
                onChange={handleChange}
                rows={8}
                placeholder="Nhập nội dung bài viết chi tiết..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3.5 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-50"
              />
            </div>

            <div className="grid gap-5 md:grid-cols-[0.9fr_1.7fr]">
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">Phân loại</label>
                <select
                  name="category"
                  value={form.category}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3.5 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-50"
                >
                  <option>Tin tức</option>
                  <option>Hướng dẫn</option>
                  <option>Công nghệ</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">URL ảnh</label>
                <input
                  name="image_url"
                  value={form.image_url}
                  onChange={handleChange}
                  placeholder="https://..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3.5 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-50"
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-4 border-t border-slate-200 pt-4">
              <button
                type="submit"
                disabled={loading}
                className="rounded-xl bg-blue-600 px-6 py-3 font-bold text-white shadow-[0_10px_20px_rgba(59,130,246,0.25)] transition hover:bg-blue-700 disabled:opacity-60"
              >
                {loading ? 'Đang lưu...' : 'Lưu tin tức'}
              </button>

              {message && <p className="text-sm font-semibold text-emerald-600">{message}</p>}
            </div>
          </form>

          <aside className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3 border-b border-slate-200 pb-4">
              <div className="rounded-full bg-indigo-50 p-2 text-indigo-600">
                <ImageIcon size={18} />
              </div>
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Preview</p>
                <h3 className="text-lg font-black text-slate-800">Bài viết xem trước</h3>
              </div>
            </div>

            <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
              <img
                src={form.image_url || 'https://images.unsplash.com/photo-1586528116311-ad8ed7c663be?auto=format&fit=crop&w=800&q=80'}
                alt={form.title || 'Preview'}
                className="h-40 w-full object-cover"
              />
              <div className="p-4">
                <span className="inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-blue-600">
                  {form.category || 'Tin tức'}
                </span>
                <h4 className="mt-3 text-xl font-black text-slate-800">
                  {form.title || 'Tiêu đề bài viết'}
                </h4>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {form.summary || 'Tóm tắt nội dung sẽ hiển thị ở đây khi bạn viết bài.'}
                </p>
              </div>
            </div>
          </aside>
        </div>

        <div className="mt-8 rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Danh sách</p>
              <h3 className="mt-2 text-2xl font-black text-slate-800">Bài viết gần đây</h3>
            </div>
          </div>

          {loadingList ? (
            <p className="py-6 text-sm text-slate-500">Đang tải danh sách bài viết...</p>
          ) : articles.length === 0 ? (
            <p className="py-6 text-sm text-slate-500">Chưa có bài viết nào được đăng.</p>
          ) : (
            <div className="space-y-3">
              {articles.map((item) => (
                <div key={item.id} className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:flex-row md:items-center md:justify-between">
                  <div className="flex gap-3">
                    <img src={item.image_url || 'https://images.unsplash.com/photo-1586528116311-ad8ed7c663be?auto=format&fit=crop&w=800&q=80'} alt={item.title} className="h-16 w-24 rounded-xl object-cover" />
                    <div>
                      <span className="inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-blue-600">
                        {item.category || 'Tin tức'}
                      </span>
                      <h4 className="mt-2 text-base font-black text-slate-800">{item.title}</h4>
                      <p className="mt-1 text-sm text-slate-500">{new Date(item.created_at).toLocaleDateString('vi-VN')}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">
                      {item.status || 'published'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
