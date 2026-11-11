import { apiFetch as fetch, resolveApiAssetUrl } from '../../utils/apiFetch.js';
import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Calendar, Share2, Check, Clock } from 'lucide-react';

export default function TinTucChiTiet() {
  const { id } = useParams();
  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const fetchArticle = async () => {
      try {
        const res = await fetch(`${API_URL}/api/news/${id}`);
        const data = await res.json();
        if (data.success) {
          setArticle(data.data);
        }
      } catch (error) {
        console.error('Lỗi tải bài tin tức:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchArticle();
  }, [id]);

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-28 text-center text-slate-400">
        <div className="h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-xs font-bold">Đang tải bài viết...</p>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-28 text-center text-rose-600">
        <p className="text-lg font-bold">Không tìm thấy bài viết hoặc bài đã bị gỡ.</p>
        <Link to="/tin-tuc" className="mt-4 inline-flex items-center gap-2 text-xs font-black text-blue-600 hover:underline">
          <ArrowLeft size={16} /> Quay lại danh sách tin tức
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
      
      <div className="flex items-center justify-between mb-8">
        <Link
          to="/tin-tuc"
          className="inline-flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-blue-600 transition-colors"
        >
          <ArrowLeft size={16} /> Quay lại danh sách tin tức
        </Link>

        <button
          type="button"
          onClick={copyLink}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-soft-sm transition-all"
        >
          {copied ? <Check size={14} className="text-emerald-600" /> : <Share2 size={14} />}
          <span>{copied ? 'Đã sao chép link' : 'Chia sẻ bài viết'}</span>
        </button>
      </div>

      <article className="bg-white rounded-3xl shadow-soft-sm border border-slate-200/90 overflow-hidden">
        {article.image_url && (
          <div className="relative h-72 sm:h-96 w-full overflow-hidden bg-slate-100">
            <img
              src={resolveApiAssetUrl(article.image_url)}
              alt={article.title}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        <div className="p-6 sm:p-10 lg:p-12 space-y-6">
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-blue-50 text-blue-700 border border-blue-200 px-3 py-1 text-xs font-black uppercase tracking-wider">
              {article.category || 'Tin tức'}
            </span>
            <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-400">
              <Calendar size={13} />
              {new Date(article.created_at).toLocaleDateString('vi-VN', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </span>
          </div>

          <h1 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight leading-tight">
            {article.title}
          </h1>

          {article.summary && (
            <p className="text-sm sm:text-base text-slate-600 font-medium leading-relaxed italic border-l-4 border-blue-600 pl-4 py-1 bg-slate-50 rounded-r-xl">
              {article.summary}
            </p>
          )}

          <div className="pt-4 border-t border-slate-100 text-sm sm:text-base leading-relaxed text-slate-700 whitespace-pre-line space-y-4">
            {article.content}
          </div>
        </div>
      </article>

    </div>
  );
}
