import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

export default function TinTuc() {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const role = localStorage.getItem('role') || localStorage.getItem('user_role');

  useEffect(() => {
    const fetchNews = async () => {
      try {
        const res = await fetch('http://localhost:5000/api/news');
        const data = await res.json();
        if (data.success) setArticles(data.data);
      } catch (error) {
        console.error('Lỗi tải danh sách tin tức:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchNews();
  }, []);

  return (
    <div className="max-w-6xl mx-auto px-4 py-16">
      <div className="mb-10 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-blue-600">Tin tức</p>
          <h1 className="mt-3 text-4xl font-black text-slate-800">Cập nhật từ Smart Logistics</h1>
        </div>
        {role === 'content_manager' && (
          <Link to="/phong-ban-noi-dung" className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-700">
            Quản lý nội dung
          </Link>
        )}
      </div>

      {loading ? (
        <div className="text-center text-slate-500">Đang tải tin tức...</div>
      ) : (
        <div className="grid gap-6 md:grid-cols-3">
          {articles.map((article) => (
            <Link key={article.id} to={`/tin-tuc/${article.id}`} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
              <img src={article.image_url || 'https://images.unsplash.com/photo-1586528116311-ad8ed7c663be?auto=format&fit=crop&w=800&q=80'} alt={article.title} className="h-48 w-full object-cover" />
              <div className="p-6">
                <span className="inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-600">
                  {article.category || 'Tin tức'}
                </span>
                <h3 className="mt-4 text-xl font-bold text-slate-800">{article.title}</h3>
                <p className="mt-3 text-sm text-slate-500">{new Date(article.created_at).toLocaleDateString('vi-VN')}</p>
                <p className="mt-4 text-sm leading-6 text-slate-600">{article.summary}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
