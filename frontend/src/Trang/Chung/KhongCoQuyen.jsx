import { ArrowLeft, Home, LogIn, ShieldAlert } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getWorkspacePath } from '../../utils/workspaceRoutes.js';

const SESSION_KEYS = [
  'access_token',
  'user_id',
  'full_name',
  'role',
  'user_role',
  'warehouse_id',
  'warehouse_type'
];

export default function KhongCoQuyen() {
  const navigate = useNavigate();
  const role = localStorage.getItem('role') || localStorage.getItem('user_role');

  const dangNhapTaiKhoanKhac = () => {
    SESSION_KEYS.forEach((key) => localStorage.removeItem(key));
    navigate('/dang-nhap', { replace: true });
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10 font-sans text-slate-800 dark:bg-slate-950 dark:text-slate-100 sm:px-6">
      <section className="w-full max-w-xl rounded-[2rem] border border-slate-200 bg-white p-7 text-center shadow-xl shadow-slate-200/60 dark:border-slate-800 dark:bg-slate-900 dark:shadow-black/20 sm:p-10">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
          <ShieldAlert size={40} strokeWidth={1.8} aria-hidden="true" />
        </div>
        <p className="mt-6 text-sm font-black uppercase tracking-[0.2em] text-amber-700 dark:text-amber-300">403 · Truy cập bị giới hạn</p>
        <h1 className="mt-3 text-2xl font-black tracking-tight text-slate-900 dark:text-white sm:text-3xl">
          Bạn không có quyền truy cập trang này
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
          Hãy dùng tài khoản có quyền phù hợp hoặc quay lại khu vực làm việc của bạn.
        </p>
        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => navigate(getWorkspacePath(role), { replace: true })}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500"
          >
            <Home size={18} /> Về trang làm việc
          </button>
          <button
            type="button"
            onClick={dangNhapTaiKhoanKhac}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-800 transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
          >
            <LogIn size={18} /> Đăng nhập tài khoản khác
          </button>
        </div>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 underline-offset-4 hover:text-blue-700 hover:underline dark:text-slate-300 dark:hover:text-blue-300"
        >
          <ArrowLeft size={16} /> Quay lại trang trước
        </button>
      </section>
    </main>
  );
}
