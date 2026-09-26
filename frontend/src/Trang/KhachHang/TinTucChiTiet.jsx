import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function TinTucChiTiet() {
  const { id } = useParams();
  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchArticle = async () => {
      try {
        const res = await fetch(`http://localhost:5000/api/news/${id}`);
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

  if (loading) {
    return <div className="max-w-4xl mx-auto px-4 py-20 text-center text-slate-500">Đang tải bài viết...</div>;
  }

  if (!article) {
    return <div className="max-w-4xl mx-auto px-4 py-20 text-center text-red-500">Không tìm thấy bài viết.</div>;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <Link to="/tin-tuc" className="inline-flex items-center gap-2 mb-6 text-blue-600 font-bold hover:text-blue-700">
        <ArrowLeft size={18} /> Quay lại tin tức
      </Link>

      <article className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        {article.image_url && (
          <img src={article.image_url} alt={article.title} className="w-full h-80 object-cover" />
        )}

        <div className="p-8 md:p-10">
          <span className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-600">{article.category || 'Tin tức'}</span>
          <h1 className="mt-5 text-3xl md:text-4xl font-black text-slate-800">{article.title}</h1>
          <p className="mt-4 text-sm text-slate-500">{new Date(article.created_at).toLocaleDateString('vi-VN')}</p>

          <div className="mt-8 text-base leading-8 text-slate-700 whitespace-pre-line">
            {article.content}
          </div>
        </div>
      </article>
    </div>
  );
}
