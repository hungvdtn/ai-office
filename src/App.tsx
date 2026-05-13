/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { 
  FileText, Scan, Languages, ChevronRight, HelpCircle, Menu, X, 
  CalendarDays, QrCode, Image as ImageIcon, Search, Sparkles, LogIn, LogOut, Users, Bell
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import PDFProcessor from './components/PDFProcessor';
import OCRStudio from './components/OCRStudio';
import Scanner from './components/Scanner';
import Calendar from './components/Calendar';

// --- IMPORT FIREBASE ---
import { auth, db, googleProvider } from './firebase';
import { signInWithPopup, signInWithRedirect, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { collection, getDocs } from 'firebase/firestore';

type Module = 'calendar' | 'pdf' | 'ocr' | 'scanner' | 'admin'; 

// --- BẢNG ĐIỀU KHIỂN DÀNH CHO ADMIN ---
const AdminPanel = () => {
  const [stats, setStats] = useState({ users: 0, events: 0, loading: true });
  const [userList, setUserList] = useState<any[]>([]);

  useEffect(() => {
     const fetchStats = async () => {
        try {
           const snap = await getDocs(collection(db, 'events'));
           const uniqueUsers = new Map();
           
           snap.forEach(doc => {
              const data = doc.data();
              if (data.userId && !uniqueUsers.has(data.userId)) {
                 uniqueUsers.set(data.userId, data.email || 'Ẩn danh (Do chính sách bảo mật Firebase)');
              }
           });
           
           setStats({ users: uniqueUsers.size, events: snap.size, loading: false });
           setUserList(Array.from(uniqueUsers.entries()).map(([id, email]) => ({ id, email })));
        } catch(e) { console.error(e); setStats(s => ({...s, loading: false})); }
     }
     fetchStats();
  }, []);

  return (
     <div className="p-4 md:p-8 text-slate-200 animate-in fade-in duration-500 font-sans">
        <h2 className="text-xl md:text-2xl font-bold text-brand mb-8 flex items-center gap-3">
           <Users size={28} /> Bảng điều khiển Quản trị viên (Admin)
        </h2>
        {stats.loading ? (
           <p className="text-slate-400 flex items-center gap-2">Đang tải dữ liệu từ máy chủ đám mây...</p>
        ) : (
           <div className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div className="bg-[#0f172a] p-8 rounded-2xl border border-sky-900/50 shadow-[0_0_30px_rgba(56,189,248,0.1)] relative overflow-hidden group hover:border-sky-500 transition-colors">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><Users size={64}/></div>
                    <h3 className="text-slate-400 font-bold mb-2 uppercase tracking-widest text-sm relative z-10">Số người dùng Lịch</h3>
                    <p className="text-5xl font-black text-sky-400 relative z-10">{stats.users}</p>
                    <p className="text-xs text-slate-500 mt-2 relative z-10">Dựa trên số lượng ID thiết bị đã lưu sự kiện</p>
                 </div>
                 <div className="bg-[#0f172a] p-8 rounded-2xl border border-emerald-900/50 shadow-[0_0_30px_rgba(5,150,105,0.1)] relative overflow-hidden group hover:border-emerald-500 transition-colors">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><CalendarDays size={64}/></div>
                    <h3 className="text-slate-400 font-bold mb-2 uppercase tracking-widest text-sm relative z-10">Tổng số Sự kiện đã lưu</h3>
                    <p className="text-5xl font-black text-emerald-400 relative z-10">{stats.events}</p>
                    <p className="text-xs text-slate-500 mt-2 relative z-10">Dữ liệu công việc trên toàn hệ thống</p>
                 </div>
              </div>

              <div className="bg-[#0f172a] p-6 rounded-2xl border border-[#1e293b]">
                 <h3 className="text-brand font-bold uppercase tracking-widest mb-4">Danh sách tài khoản sử dụng</h3>
                 <div className="overflow-x-auto custom-scrollbar">
                   <table className="w-full text-sm text-left text-slate-300 whitespace-nowrap">
                     <thead className="text-xs text-slate-400 uppercase bg-[#1e293b]/50">
                       <tr>
                         <th className="px-6 py-3 rounded-tl-lg">ID Người dùng (Firebase Auth)</th>
                         <th className="px-6 py-3 rounded-tr-lg">Email / Định danh</th>
                       </tr>
                     </thead>
                     <tbody>
                       {userList.map((u, i) => (
                         <tr key={i} className="border-b border-[#1e293b] hover:bg-[#1e293b]/30 transition-colors">
                           <td className="px-6 py-4 font-mono text-xs text-sky-400">{u.id}</td>
                           <td className="px-6 py-4 text-emerald-400 font-medium">{u.email}</td>
                         </tr>
                       ))}
                       {userList.length === 0 && (
                         <tr><td colSpan={2} className="px-6 py-4 text-center text-slate-500">Chưa có người dùng nào tạo sự kiện.</td></tr>
                       )}
                     </tbody>
                   </table>
                 </div>
              </div>
           </div>
        )}
     </div>
  );
}

// --- NỘI DUNG TRỢ GIÚP THEO TỪNG CHỨC NĂNG ---
const HelpContent = ({ module }: { module: string }) => {
  switch (module) {
    case 'calendar':
      return (
        <div className="space-y-4 text-sm text-slate-300 leading-relaxed font-sans">
           <h3 className="font-bold text-brand text-lg">Hướng dẫn sử dụng Lịch Vạn niên AI</h3>
           <p>Ứng dụng Lịch Vạn niên AI được thiết kế với công nghệ lõi API sử dụng thư viện mã nguồn mở Lunar-javascript, là tài liệu tích hợp các lý luận cổ đại Trung Hoa về thiên văn, trạch cát, thuật số làm nền tảng thuật toán. Ngoài ra, các quy tắc phân tích chọn ngày chuyên sâu được tham chiếu theo bộ sách cổ "Ngọc Hạp Thông Thư" của Việt Nam và những tài liệu kinh điển về phong thủy, trạch cát truyền thống.</p>
           <p>Lịch Vạn niên AI được bổ sung đầy đủ các ngày lễ tết theo quy định của Việt Nam. Ngày có đánh dấu màu đỏ là các ngày Chủ Nhật và các ngày lễ, Tết được nghỉ làm việc; ngày đánh dấu màu vàng là các ngày lễ/kỷ niệm thông thường, không được nghỉ; ngày màu trắng là ngày làm việc bình thường.</p>
           <p>Điểm khác biệt với các Lịch Vạn niên khác, Lịch Vạn niên AI còn có thể giúp người sử dụng lập lịch làm việc, bổ sung các sự kiện cần ghi nhớ vào lịch, đồng thời cài đặt cảnh báo nhắc lịch công việc bằng trình duyệt (tiếng kêu ting ting). Bạn có thể cài đặt cảnh báo trước 15 phút, 30 phút, trước 1 tiếng hoặc trước 1 ngày.</p>
           <p>Để ghi chú vào lịch bạn chỉ cần nháy thực đơn Thêm sự kiện và điền các thông tin cần thiết, sau đó lưu sự kiện.</p>
           <p className="font-bold text-sky-400 mt-4">Ngoài ra, Lịch Vạn niên AI còn có các tính năng chuyên sâu:</p>
           <ul className="list-none space-y-2">
             <li><strong className="text-white">(1). Xem ngày chi tiết:</strong> Để biết tính chất tốt, xấu của ngày đó;</li>
             <li><strong className="text-white">(2). Tìm các ngày tốt trong một tháng:</strong> Có thể tìm ngày tốt chung hoặc có thể tìm ngày tốt cho từng việc;</li>
             <li><strong className="text-white">(3). Đổi ngày:</strong> Đổi ngày âm hoặc dương sang ngày dương hoặc âm tương ứng.</li>
           </ul>
        </div>
      );
    case 'pdf':
      return (
        <div className="space-y-4 text-sm text-slate-300 leading-relaxed font-sans">
          <h3 className="font-bold text-brand text-lg">Hướng dẫn sử dụng Xử lý PDF</h3>
          <p>Cung cấp bộ công cụ cắt, ghép, và sắp xếp lại trang PDF bằng thao tác kéo thả. Đặc biệt có tính năng chuyển PDF sang Word (.docx), tự động làm sạch ký hiệu thừa và định dạng chuẩn font Times New Roman dùng cho hành chính.</p>
          <h4 className="font-bold text-white">Công cụ này có 3 chức năng:</h4>
          <p className="font-bold text-sky-400">1. Cắt và tách file PDF:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Bước 1: Bạn tải lên file PDF bất kỳ;</li>
            <li>Bước 2: Xuất hiện giao diện của từng trang PDF. Tại đây, bạn đưa chuột vào từng trang xuất hiện 3 nút công cụ: Nút màu vàng có chấm đen (di chuyển trang), Nút màu xanh (copy trang), Nút màu đỏ (xóa trang).</li>
            <li>Bước 3: Sau khi edit xong bạn có thể tách bằng nhiều cách:<br/>
            - <strong>Cách 1:</strong> Chọn các trang bất kỳ. Nhấn nút "Xuất n trang chọn" ➔ Lưu file.<br/>
            - <strong>Cách 2:</strong> Chọn khoảng cách chia tách ➔ Nhấn "Tải Zip" để tách hàng loạt.</li>
          </ul>
          <p className="font-bold text-sky-400">2. Ghép file PDF</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Bước 1: Tải lên các file PDF cần ghép.</li>
            <li>Bước 2: Edit hoặc biên tập lại các file PDF (thêm, bớt, xóa, di chuyển).</li>
            <li>Bước 3: Chọn "Ghép & Tải xuống".</li>
          </ul>
          <p className="font-bold text-sky-400">3. Chuyển sang file word</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Bước 1: Tải file PDF cần chuyển.</li>
            <li>Bước 2: Tải file word đã được chuyển.</li>
          </ul>
        </div>
      );
    case 'ocr':
      return (
        <div className="space-y-4 text-sm text-slate-300 leading-relaxed font-sans">
          <h3 className="font-bold text-brand text-lg">Hướng dẫn sử dụng Trích xuất OCR</h3>
          <p>Sử dụng Trí tuệ nhân tạo (AI) chạy nội bộ (Offline) để nhận diện và bóc tách văn bản từ hình ảnh JPG/PNG. Đảm bảo bảo mật tuyệt đối 100% tài liệu nhạy cảm do dữ liệu không bị gửi lên mạng.</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Bước 1: Tải hình ảnh có text cần trích xuất thành văn bản</li>
            <li>Bước 2: Chọn bắt đầu trích xuất</li>
            <li>Bước 3: Kết quả trích xuất ở khung hình bên phải, chọn Docx để dowload xuống</li>
          </ul>
        </div>
      );
    case 'scanner':
      return (
        <div className="space-y-4 text-sm text-slate-300 leading-relaxed font-sans">
          <h3 className="font-bold text-brand text-lg">Hướng dẫn Scan tài liệu</h3>
          <p>Chức năng này bạn nên sử dụng trên điện thoại. Mặc định sau khi scan sẽ xuất thành file PDF ở dạng bản màu hoặc đen trắng.</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Bước 1: Đặt văn bản cần scan ngay ngắn trên mặt phẳng;</li>
            <li>Bước 2: Bật chức năng Scan Tài liệu từ Ứng dụng; nháy chọn Cho phép sử dụng Cam của điện thoại nếu được hỏi.</li>
            <li>Bước 3: Chọn chế độ Scan. Có 2 chế độ: Bản màu và Đen trắng, tùy thuộc vào nhu cầu của bạn. Ví dụ: Cần scan file văn bản có dấu, có hình ảnh màu sắc thì chọn chế độ Màu sắc.</li>
            <li>Bước 4: Đưa điện thoại song song với văn bản cần scan; điều chỉnh tay để văn bản nằm khít trong khung màu vàng của Cam.</li>
            <li>Bước 5: Nháy nút chụp ảnh</li>
            <li>Bước 6: Tiếp tục Scan trang tiếp theo nếu văn bản có nhiều trang</li>
            <li>Bước 7: Khi đã Scan xong thì chọn nút Xong, nếu muốn hủy thì chọn Hủy.</li>
            <li>Bước 8: Lưu file Scan vào zalo hoặc vào các ứng dụng khác để sử dụng</li>
          </ul>
        </div>
      );
    default: return <p>Chọn chức năng để xem hướng dẫn.</p>;
  }
}

// --- BẢNG TRỢ GIÚP NỔI (DRAGGABLE & RESIZABLE) ---
const DraggableHelp = ({ activeModule, onClose }: { activeModule: string, onClose: () => void }) => {
  const [pos, setPos] = useState({ x: window.innerWidth > 768 ? window.innerWidth - 450 : 20, y: 80 });
  const dragRef = useRef({ isDragging: false, origin: { x: 0, y: 0 } });

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    dragRef.current = { isDragging: true, origin: { x: e.clientX - pos.x, y: e.clientY - pos.y } };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current.isDragging) return;
    setPos({ x: e.clientX - dragRef.current.origin.x, y: e.clientY - dragRef.current.origin.y });
  };
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    dragRef.current.isDragging = false;
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  return (
    <div 
      className="fixed z-50 bg-[#0f172a]/95 backdrop-blur-xl border-2 border-brand/50 rounded-xl shadow-[0_0_30px_rgba(0,0,0,0.8)] flex flex-col"
      style={{ left: pos.x, top: pos.y, width: window.innerWidth > 400 ? 400 : window.innerWidth - 40, height: 500, resize: 'both', overflow: 'hidden' }}
    >
      <div 
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
        className="p-3 bg-brand/20 cursor-move flex justify-between items-center border-b border-brand/30 touch-none"
      >
         <h3 className="font-bold text-brand flex items-center gap-2 pointer-events-none">
           <HelpCircle size={18}/> Trợ giúp
         </h3>
         
         <button 
           onPointerDown={(e) => { e.stopPropagation(); onClose(); }}
           onClick={(e) => { e.stopPropagation(); onClose(); }}
           className="p-1.5 bg-rose-500/20 hover:bg-rose-500 rounded-lg text-rose-400 hover:text-white transition-colors cursor-pointer"
         >
           <X size={18}/>
         </button>
      </div>
      <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
         <HelpContent module={activeModule} />
      </div>
    </div>
  );
}

export default function App() {
  const [activeModule, setActiveModule] = useState<Module>('calendar');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false); 

  // QUẢN LÝ TRẠNG THÁI ĐĂNG NHẬP
  const [user, setUser] = useState<User | null>(null);

  // --- TRẠNG THÁI QUẢN LÝ BÁO THỨC (ALARM) ---
  const [ringingEvent, setRingingEvent] = useState<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const alarmedIds = useRef<Set<string>>(new Set());

  // THIẾT LẬP QUYỀN ADMIN
  const ADMIN_EMAILS = ['hungvdtnai@gmail.com', 'hungvdtn@gmail.com'];
  const isAdmin = user && ADMIN_EMAILS.includes(user.email?.toLowerCase() || '');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => { 
        setUser(currentUser); 
    });
    return () => unsubscribe();
  }, []);

  // --- THUẬT TOÁN BÁO THỨC TOÀN CẦU (GLOBAL ALARM) ---
  useEffect(() => {
    // Khởi tạo Audio, tự động lặp lại cho đến khi tắt
    audioRef.current = new Audio('/nhac_bao_hieu.mp3');
    audioRef.current.loop = true;

    const checkAlarms = () => {
      const savedEvents = localStorage.getItem('user_events');
      if (!savedEvents) return;
      const events = JSON.parse(savedEvents);
      const now = new Date();

      events.forEach((ev: any) => {
        const [evY, evMo, evD] = ev.dateStr.split('-').map(Number); 
        const [evH, evM] = ev.time.split(':').map(Number);
        const eventTime = new Date(evY, evMo - 1, evD, evH, evM);
        const remindTime = new Date(eventTime.getTime() - (ev.reminderAdvance * 60000));
        
        const alarmKey = `${ev.id}-${now.getHours()}-${now.getMinutes()}`;

        // Kiểm tra xem đã đến giờ chưa và đã báo ở phút này chưa
        if (
            remindTime.getFullYear() === now.getFullYear() && 
            remindTime.getMonth() === now.getMonth() && 
            remindTime.getDate() === now.getDate() && 
            remindTime.getHours() === now.getHours() && 
            remindTime.getMinutes() === now.getMinutes() &&
            !alarmedIds.current.has(alarmKey)
        ) {
            alarmedIds.current.add(alarmKey);
            setRingingEvent(ev); // Bật giao diện Chuông
            if (audioRef.current) {
                audioRef.current.play().catch(e => console.log('Trình duyệt tạm chặn âm thanh do chưa tương tác', e));
            }
            // Hỗ trợ hiển thị thêm Notification hệ thống
            if ('Notification' in window && Notification.permission === 'granted') { 
                new Notification('Lịch Sự Kiện', { body: `Tới giờ: ${ev.title}\nLúc: ${ev.time}`, icon: '/favicon.ico' }); 
            }
        }
      });
    };

    // Kiểm tra liên tục mỗi 10 giây
    const interval = setInterval(checkAlarms, 10000); 
    return () => clearInterval(interval);
  }, []);

  const stopAlarm = () => {
      if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
      }
      setRingingEvent(null);
  };

  const handleLogin = async () => { 
    try { 
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      if (isMobile) {
         await signInWithRedirect(auth, googleProvider);
      } else {
         await signInWithPopup(auth, googleProvider); 
      }
    } catch (error: any) { 
      console.error("Lỗi đăng nhập:", error); 
      try { await signInWithRedirect(auth, googleProvider); } catch(e) { console.error(e); }
    } 
  };
  
  const handleLogout = async () => { try { await signOut(auth); } catch (error) { console.error(error); } };

  const modules = [
    { id: 'calendar', label: 'Lịch Vạn Niên', icon: CalendarDays },
    { id: 'pdf', label: 'Xử lý PDF', icon: FileText },
    { id: 'ocr', label: 'Trích xuất OCR', icon: Languages },
    { id: 'scanner', label: 'Scan Tài liệu', icon: Scan },
    { id: 'qrcode', label: 'Tạo mã QR', icon: QrCode, isExternal: true, url: 'https://lamchuaigiaoduc.vn/qrcode/' },
    { id: 'idphoto', label: 'Tạo ảnh thẻ', icon: ImageIcon, isExternal: true, url: 'https://lamchuaigiaoduc.vn/id-photo/' },
    { id: 'search', label: 'Tra cứu địa phương', icon: Search, isExternal: true, url: 'https://tracuu.hungvdtn.vn/' },
    { id: 'gemini', label: 'Trợ lý Gemini', icon: Sparkles, isExternal: true, url: 'https://gemini.google.com/app' },
  ];

  const displayModules = [...modules];
  if (isAdmin) {
     displayModules.push({ id: 'admin', label: 'Admin (Quản trị)', icon: Users });
  }

  return (
    <div className="flex h-screen w-full max-w-[100vw] bg-[#05070a] text-[#e2e8f0] overflow-hidden relative">
      <style dangerouslySetInnerHTML={{__html: `
        * {
          font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif !important;
        }
      `}} />

      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsMobileMenuOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 md:hidden"
          />
        )}
      </AnimatePresence>

      <aside className={`fixed inset-y-0 left-0 z-40 md:relative md:z-20 ${isSidebarOpen ? 'w-64' : 'w-20'} bg-[#0f172a] border-r border-[#1e293b] flex flex-col flex-shrink-0 transition-all duration-300 ease-in-out shadow-2xl overflow-x-hidden ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div className="p-6 flex items-center justify-between border-b border-[#1e293b] flex-shrink-0">
          {(isSidebarOpen || isMobileMenuOpen) ? (
            <div className="flex flex-col">
              <h1 className="text-xl font-black tracking-widest text-brand uppercase whitespace-nowrap">DIGITAL OFFICE</h1>
              <span className="text-[10px] tracking-normal font-normal text-slate-400 uppercase mt-1">Văn phòng Số Chuyên biệt</span>
            </div>
          ) : (
            <div className="w-8 h-8 rounded bg-brand/10 flex items-center justify-center text-brand font-bold text-xs flex-shrink-0">DO</div>
          )}
          <button onClick={() => { window.innerWidth < 768 ? setIsMobileMenuOpen(false) : setIsSidebarOpen(!isSidebarOpen); }} className="p-1.5 hover:bg-[#1e293b] rounded-md text-slate-500 transition-colors flex-shrink-0">
            {isMobileMenuOpen ? <X size={18} /> : (isSidebarOpen ? <X size={18} className="hidden md:block" /> : <Menu size={18} className="hidden md:block" />)}
            {!isMobileMenuOpen && <X size={18} className="md:hidden" />}
          </button>
        </div>

        <nav className="flex-1 py-6 space-y-1 overflow-y-auto overflow-x-hidden custom-scrollbar">
          {displayModules.map((m) => (
            <button
              key={m.id}
              onClick={() => { m.isExternal ? window.open(m.url, '_blank') : setActiveModule(m.id as Module); setIsMobileMenuOpen(false); }}
              className={activeModule === m.id ? 'sidebar-link-active w-full whitespace-nowrap' : 'sidebar-link w-full whitespace-nowrap'}
            >
              <m.icon size={18} className={activeModule === m.id ? 'text-brand flex-shrink-0' : 'flex-shrink-0'} />
              {(isSidebarOpen || isMobileMenuOpen) && <span className="text-sm font-medium truncate">{m.label}</span>}
              {(isSidebarOpen || isMobileMenuOpen) && m.isExternal && <ChevronRight size={14} className="ml-auto opacity-50 flex-shrink-0" />}
            </button>
          ))}
        </nav>

        <div className="pb-6 border-t border-[#1e293b] flex-shrink-0 flex flex-col">
          <button onClick={() => setShowHelpModal(true)} className="sidebar-link w-full whitespace-nowrap mb-2 mt-4 px-6">
            <HelpCircle size={18} className="flex-shrink-0" />
            {(isSidebarOpen || isMobileMenuOpen) && <span className="text-sm font-medium">Trợ giúp</span>}
          </button>

          <div className="px-6 mt-2">
            <a href="https://lamchuaigiaoduc.vn" target="_blank" rel="noreferrer" className={`flex items-center transition-transform hover:scale-105 origin-left ${!(isSidebarOpen || isMobileMenuOpen) ? 'hidden' : ''}`}>
              <img src="Logo_anh.png" alt="AIBTeM Logo" className="h-10 w-auto object-contain rounded-full drop-shadow-[0_0_15px_rgba(56,189,248,0.4)]" />
            </a>
            {!(isSidebarOpen || isMobileMenuOpen) && (
              <img src="Logo_anh.png" alt="AIBTeM Logo" className="h-8 w-8 object-contain rounded-full opacity-50" />
            )}
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden bg-[radial-gradient(circle_at_top_right,#0f172a, #05070a)] w-full">
        <header className="h-[70px] bg-[#0f172a]/80 backdrop-blur-md border-b border-[#1e293b] flex items-center justify-between px-4 md:px-8 z-10 flex-shrink-0">
          <div className="flex items-center gap-3 md:gap-4 font-bold text-slate-500">
            <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 -ml-2 text-slate-400 hover:text-brand transition-colors md:hidden"><Menu size={24} /></button>
            <div className="hidden sm:flex items-center gap-3 text-[11px] tracking-widest uppercase font-semibold">
              <span>Vị trí hiện tại:</span>
              <span className="text-brand flex items-center gap-2"><ChevronRight size={12} className="text-slate-500" />{displayModules.find(m => m.id === activeModule)?.label || 'Ứng dụng ngoài'}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-4 md:gap-6">
            {user ? (
              <div className="flex items-center gap-2 bg-[#1e293b]/50 p-1.5 pr-3 rounded-full border border-[#1e293b]">
                 <img src={user.photoURL || ''} alt="Avatar" className="w-8 h-8 rounded-full shadow-[0_0_10px_rgba(56,189,248,0.3)]" title={user.email || ''} />
                 <button onClick={handleLogout} className="text-slate-400 hover:text-rose-400 transition-colors ml-1" title="Đăng xuất"><LogOut size={18} /></button>
              </div>
            ) : (
              <button onClick={handleLogin} className="flex items-center gap-2 px-5 py-2.5 bg-brand text-bg-dark text-xs font-bold rounded-full transition-all hover:scale-105 shadow-lg shadow-brand/20">
                 <LogIn size={16} /> Đăng nhập
              </button>
            )}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-6 lg:p-8 relative">
          <div className="absolute inset-0 dot-grid opacity-10 pointer-events-none" />
          <div className="w-full mx-auto relative z-10 overflow-x-hidden">
            <AnimatePresence mode="wait">
              <motion.div key={activeModule} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3, ease: "easeOut" }} className="w-full">
                {activeModule === 'pdf' && <PDFProcessor />}
                {activeModule === 'ocr' && <OCRStudio />}
                {activeModule === 'scanner' && <Scanner />}
                {activeModule === 'calendar' && <Calendar />}
                {activeModule === 'admin' && <AdminPanel />}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </main>

      {/* --- GIAO DIỆN BÁO ĐỘNG SỰ KIỆN TOÀN CẦU --- */}
      <AnimatePresence>
         {ringingEvent && (
            <motion.div 
               initial={{ opacity: 0, scale: 0.9, y: 50 }} 
               animate={{ opacity: 1, scale: 1, y: 0 }} 
               exit={{ opacity: 0, scale: 0.9, y: 50 }} 
               className="fixed bottom-10 left-1/2 transform -translate-x-1/2 z-[200] bg-rose-600 rounded-2xl shadow-[0_0_80px_rgba(225,29,72,0.6)] p-6 md:p-8 flex flex-col items-center gap-4 border-2 border-rose-400 w-[90%] max-w-sm"
            >
               <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-inner animate-bounce">
                  <Bell className="text-rose-600 animate-pulse" size={40} />
               </div>
               <div className="text-center">
                 <p className="text-rose-100 font-bold uppercase tracking-widest text-xs mb-1">Báo thức sự kiện</p>
                 <h3 className="text-xl md:text-2xl font-black text-white">{ringingEvent.title}</h3>
                 <p className="text-base font-bold text-rose-200 mt-2 flex items-center justify-center gap-2">
                    <Clock size={18}/> Thời gian: {ringingEvent.time}
                 </p>
                 {ringingEvent.location && (
                    <p className="text-sm font-medium text-rose-100 mt-1 flex items-center justify-center gap-1">
                       <MapPin size={16}/> {ringingEvent.location}
                    </p>
                 )}
               </div>
               <button 
                  onClick={stopAlarm} 
                  className="mt-4 bg-white text-rose-600 hover:bg-rose-100 w-full px-6 py-3 rounded-xl font-black uppercase tracking-widest transition-colors shadow-lg"
               >
                  ĐÃ HIỂU / TẮT CHUÔNG
               </button>
            </motion.div>
         )}
      </AnimatePresence>

      {showHelpModal && <DraggableHelp activeModule={activeModule} onClose={() => setShowHelpModal(false)} />}
    </div>
  );
}