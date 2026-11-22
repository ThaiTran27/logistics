import { apiFetch as fetch, resolveApiAssetUrl } from '../../utils/apiFetch.js';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Newspaper, Search, Calendar, ArrowRight, Sparkles, Filter } from 'lucide-react';
import { normalizeRole } from '../../utils/workspaceRoutes.js';

export default function TinTuc() {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const rawRole = localStorage.getItem('role') || localStorage.getItem('user_role');
  const role = normalizeRole(rawRole);

  useEffect(() => {
    const fetchNews = async () => {
      try {
        const res = await fetch(`${API_URL}/api/news`);
        const data = await res.json();
        if (data.success) setArticles(data.data || []);
      } catch (error) {
        console.error('Lỗi tải danh sách tin tức:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchNews();
  }, []);

  const filteredArticles = articles.filter((art) => {
    const matchSearch = String(art.title || '').toLowerCase().includes(searchTerm.toLowerCase())
      || String(art.summary || '').toLowerCase().includes(searchTerm.toLowerCase());
    const cat = String(art.category || '').toLowerCase();
    const matchCat = categoryFilter === 'all'
      || (categoryFilter === 'promotion' && cat.includes('khuyến mãi'))
      || (categoryFilter === 'guide' && cat.includes('hướng dẫn'))
      || (categoryFilter === 'operation' && (cat.includes('vận hành') || cat.includes('tin tức')));
    return matchSearch && matchCat;
  });

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      
      {/* Header */}
      <div className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-black uppercase tracking-wider border border-blue-200">
            <Newspaper size={14} className="text-blue-600" />
            Cổng Thông Tin & Sự Kiện
          </span>
          <h1 className="mt-3 text-3xl sm:text-5xl font-black text-slate-900 tracking-tight">
            Tin Tức Smart Logistics
          </h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-2 font-medium">
            Thông báo lịch giao vận, cải tiến công nghệ và chính sách ưu đãi dành cho khách hàng.
          </p>
        </div>

        {role === 'content_manager' && (
          <Link
            to="/phong-ban-noi-dung"
            className="rounded-2xl bg-blue-600 px-5 py-3 text-xs font-black text-white hover:bg-blue-700 shadow-md shadow-blue-500/25 transition-all whitespace-nowrap self-start md:self-end"
          >
            Quản Lý Bài Viết
          </Link>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="mb-10 flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-3xl bg-white border border-slate-200/90 shadow-soft-sm">
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {[
            { id: 'all', label: 'Tất cả bài viết' },
            { id: 'promotion', label: 'Khuyến mãi' },
            { id: 'guide', label: 'Hướng dẫn' },
            { id: 'operation', label: 'Vận hành' },
          ].map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setCategoryFilter(cat.id)}
              className={`text-xs font-bold px-3.5 py-2 rounded-xl transition-all ${
                categoryFilter === cat.id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm kiếm bài viết..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:bg-white focus:border-blue-500"
          />
        </div>
      </div>

      {/* Content list */}
      {loading ? (
        <div className="p-16 text-center text-slate-400 bg-white rounded-3xl border border-slate-200">
          <div className="h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs font-bold">Đang tải danh sách bài viết...</p>
        </div>
      ) : filteredArticles.length === 0 ? (
        <div className="p-16 text-center text-slate-400 bg-white rounded-3xl border border-slate-200">
          <p className="text-sm font-bold text-slate-600">Không tìm thấy bài viết phù hợp.</p>
          <p className="text-xs text-slate-400 mt-1">Hãy thử tìm với từ khóa hoặc danh mục khác.</p>
        </div>
      ) : (
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {filteredArticles.map((article) => (
            <Link
              key={article.id}
              to={`/tin-tuc/${article.id}`}
              className="group flex flex-col justify-between overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-soft-sm hover:shadow-soft-lg hover:-translate-y-1 transition-all duration-300"
            >
              <div>
                <div className="relative h-52 w-full overflow-hidden bg-slate-100">
                  <img
                    src={resolveApiAssetUrl(article.image_url) || '/icons.svg'}
                    alt={article.title}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <span className="absolute top-3 left-3 rounded-full bg-slate-900/80 backdrop-blur-md px-3 py-1 text-[10px] font-black uppercase text-white shadow-sm">
                    {article.category || 'Tin tức'}
                  </span>
                </div>

                <div className="p-6">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 mb-2">
                    <Calendar size={13} />
                    <span>{new Date(article.created_at).toLocaleDateString('vi-VN')}</span>
                  </div>
                  <h3 className="text-lg font-black text-slate-900 leading-snug group-hover:text-blue-600 transition-colors line-clamp-2">
                    {article.title}
                  </h3>
                  <p className="mt-3 text-xs text-slate-500 leading-relaxed line-clamp-3 font-medium">
                    {article.summary}
                  </p>
                </div>
              </div>

              <div className="p-6 pt-0 border-t border-slate-100 mt-4">
                <span className="inline-flex items-center gap-1.5 text-xs font-black text-blue-600 group-hover:translate-x-1 transition-transform">
                  Đọc tiếp bài viết <ArrowRight size={14} />
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

    </div>
  );
}
