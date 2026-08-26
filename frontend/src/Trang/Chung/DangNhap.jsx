import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function DangNhap() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loi, setLoi] = useState('');
  const navigate = useNavigate();

  const xuLyDangNhap = async (e) => {
    e.preventDefault();
    setLoi('');

    try {
      const response = await fetch('http://localhost:5000/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      
      const data = await response.json();

      if (data.success) {
        // Lưu thông tin vào Local Storage
        localStorage.setItem('user_role', data.user.role);
        localStorage.setItem('user_id', data.user.id);
        localStorage.setItem('user_name', data.user.full_name);

        // Điều hướng dựa trên chức vụ (role)
        switch(data.user.role) {
          case 'admin': navigate('/ban-giam-doc'); break;
          case 'dispatcher': navigate('/dieu-hanh'); break;
          case 'shop': navigate('/cua-hang'); break;
          case 'warehouse': navigate('/kho'); break;
          case 'shipper': navigate('/tai-xe'); break;
          case 'accountant': navigate('/ke-toan'); break;
          case 'hr': navigate('/nhan-su'); break;
          default: navigate('/');
        }
      } else {
        setLoi(data.message);
      }
    } catch (error) {
      setLoi('Không thể kết nối đến máy chủ Backend.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md">
        <h2 className="text-2xl font-bold text-center text-blue-600 mb-6">CỔNG ĐĂNG NHẬP NỘI BỘ</h2>
        
        {loi && <div className="bg-red-100 text-red-600 p-3 rounded mb-4 text-sm text-center">{loi}</div>}

        <form onSubmit={xuLyDangNhap} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email đăng nhập</label>
            <input 
              type="email" 
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 outline-none"
              placeholder="VD: admin@logistics.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mật khẩu</label>
            <input 
              type="password" 
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 outline-none"
              placeholder="******"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button 
            type="submit" 
            className="w-full bg-blue-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Đăng Nhập
          </button>
        </form>
      </div>
    </div>
  );
}