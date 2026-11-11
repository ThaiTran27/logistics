import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Headphones, Home, PackageSearch, Search, Truck } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { getWorkspacePath } from '../utils/workspaceRoutes.js';

export default function KhongTimThay() {
  const navigate = useNavigate();
  const [trackingCode, setTrackingCode] = useState('');
  const role = localStorage.getItem('role') || localStorage.getItem('user_role');
  const isAuthenticated = Boolean(role || localStorage.getItem('access_token'));

  useEffect(() => {
    const previousTitle = document.title;
    let robotsMeta = document.querySelector('meta[name="robots"]');
    const previousRobotsContent = robotsMeta?.getAttribute('content');

    if (!robotsMeta) {
      robotsMeta = document.createElement('meta');
      robotsMeta.name = 'robots';
      document.head.appendChild(robotsMeta);
    }
    robotsMeta.content = 'noindex';
    document.title = '404 - Không tìm thấy trang';

    return () => {
      document.title = previousTitle;
      if (previousRobotsContent === null || previousRobotsContent === undefined) {
        robotsMeta.remove();
      } else {
        robotsMeta.content = previousRobotsContent;
      }
    };
  }, []);

  const traCuuDon = (event) => {
    event.preventDefault();
    const code = trackingCode.trim();
    if (!code) return;
    navigate('/', { state: { trackingCode: code } });
  };

  const quayLai = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate('/', { replace: true });
  };

  return (
    <main className="flex min-h-screen items-center justify-center overflow-hidden bg-slate-50 px-4 py-10 font-sans text-slate-800 dark:bg-slate-950 dark:text-slate-100 sm:px-6">
      <section className="w-full max-w-3xl rounded-[2rem] border border-slate-200 bg-white p-6 text-center shadow-xl shadow-slate-200/60 dark:border-slate-800 dark:bg-slate-900 dark:shadow-black/20 sm:p-10">
        <div className="relative mx-auto mb-6 h-44 max-w-md overflow-hidden rounded-3xl bg-gradient-to-br from-blue-50 via-sky-50 to-indigo-100 dark:from-slate-800 dark:via-slate-800 dark:to-indigo-950 sm:h-52">
          <div className="absolute inset-x-8 bottom-8 h-px bg-blue-200 dark:bg-slate-700" />
          <div className="lost-package absolute left-[42%] top-8 z-10 text-amber-600 dark:text-amber-400">
            <svg viewBox="0 0 112 104" className="h-24 w-24 sm:h-28 sm:w-28" role="img" aria-label="Kiện hàng đang bị lạc">
              <path d="m56 8 42 22v45L56 98 14 75V30L56 8Z" fill="currentColor" opacity=".13" />
              <path d="M14 30 56 53l42-23M56 53v45M35 19l42 23v14L35 33V19Z" fill="none" stroke="currentColor" strokeWidth="4" strokeLinejoin="round" />
              <path d="m56 8 42 22-42 23-42-23L56 8Z" fill="none" stroke="currentColor" strokeWidth="4" strokeLinejoin="round" />
              <path d="M48 48h16" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
            </svg>
          </div>
          <div className="lost-truck absolute bottom-3 left-0 flex items-center gap-1 text-blue-700 dark:text-blue-300" aria-hidden="true">
            <Truck size={35} strokeWidth={2.4} />
            <span className="h-1 w-12 rounded-full bg-blue-300/70 dark:bg-blue-500/50" />
          </div>
          <PackageSearch className="absolute right-7 top-6 text-blue-300/70 dark:text-blue-500/60" size={28} aria-hidden="true" />
        </div>

        <p className="text-7xl font-black leading-none tracking-tight text-blue-700 dark:text-blue-400 sm:text-8xl">404</p>
        <h1 className="mt-4 text-2xl font-black tracking-tight text-slate-900 dark:text-white sm:text-3xl">
          Rất tiếc, không tìm thấy trang này
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-600 dark:text-slate-300 sm:text-base">
          Đường dẫn có thể đã thay đổi hoặc không tồn tại.
        </p>

        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => navigate(isAuthenticated ? getWorkspacePath(role) : '/', { replace: true })}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500"
          >
            <Home size={18} />
            {isAuthenticated ? 'Về trang làm việc' : 'Về trang chủ'}
          </button>
          <button
            type="button"
            onClick={quayLai}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-800 transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
          >
            <ArrowLeft size={18} />
            Quay lại trang trước
          </button>
        </div>

        <form onSubmit={traCuuDon} className="mx-auto mt-8 flex max-w-xl flex-col gap-2 text-left sm:flex-row">
          <label className="sr-only" htmlFor="lost-page-tracking-code">Mã vận đơn</label>
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} aria-hidden="true" />
            <input
              id="lost-page-tracking-code"
              value={trackingCode}
              onChange={(event) => setTrackingCode(event.target.value)}
              placeholder="Nhập mã vận đơn để tra cứu"
              className="h-12 w-full rounded-xl border border-slate-300 bg-white pl-10 pr-3 text-sm text-slate-900 outline-none placeholder:text-slate-500 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:placeholder:text-slate-400 dark:focus:ring-blue-900"
            />
          </div>
          <button
            type="submit"
            disabled={!trackingCode.trim()}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-700 dark:hover:bg-slate-600"
          >
            Tra cứu <ArrowRight size={16} />
          </button>
        </form>

        <nav aria-label="Liên kết hữu ích" className="mt-7 flex flex-wrap items-center justify-center gap-x-5 gap-y-3 text-sm font-semibold">
          <Link to="/dang-nhap" state={{ registration: true }} className="text-blue-700 underline-offset-4 hover:underline dark:text-blue-300">
            Đăng ký Shop
          </Link>
          <Link to="/dang-nhap" className="text-blue-700 underline-offset-4 hover:underline dark:text-blue-300">
            Đăng nhập
          </Link>
          <Link to="/dich-vu" className="inline-flex items-center gap-1 text-blue-700 underline-offset-4 hover:underline dark:text-blue-300">
            <Headphones size={16} /> Liên hệ / Hỗ trợ
          </Link>
        </nav>
      </section>
    </main>
  );
}
