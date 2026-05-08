/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { 
  FileText, Scan, Languages, ChevronRight, HelpCircle, Menu, X, 
  CalendarDays, QrCode, Image as ImageIcon, Search, Sparkles, LogIn, LogOut
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import PDFProcessor from './components/PDFProcessor';
import OCRStudio from './components/OCRStudio';
import Scanner from './components/Scanner';
import Calendar from './components/Calendar';

// --- IMPORT FIREBASE ---
import { auth, googleProvider } from './firebase';
import { signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';

type Module = 'calendar' | 'pdf' | 'ocr' | 'scanner'; 

// --- NỘI DUNG TRỢ GIÚP THEO TỪNG CHỨC NĂNG (ĐẦY ĐỦ KHÔNG RÚT GỌN) ---
const HelpContent = ({ module }: { module: string }) => {
  switch (module) {
    case 'calendar':
      return (
        <div className="space-y-4 text-sm text-slate-300 leading-relaxed font-sans">
           <h3 className="font-bold text-brand text-lg">Hướng dẫn sử dụng Lịch</h3>
           <p>Lịch Vạn niên AI được thiết kế theo Công nghệ lõi API Lịch quốc tế kết hợp với thuật toán Phong thủy (Feng Shui Engine), tự động tính Can Chi của Ngày/Tháng/Năm Âm lịch. Thuật toán này sẽ tính toán dựa trên các quy luật cổ học phương Đông và đưa ra đánh giá về ngày tốt xấu (tính từ 1.0 đến 5.0 sao), đồng thời xuất ra thông báo bằng chữ (Ví dụ: Ngày Hắc Đạo - Nguyệt Kỵ).</p>
           <p>Lịch Vạn niên AI được bổ sung đầy đủ các ngày lễ tết theo quy định của Việt Nam. Ngày có đánh dấu màu đỏ là các ngày Chủ Nhật và các ngày lễ, Tết được nghỉ làm việc; ngày đánh dấu màu vàng là các ngày lễ/kỷ niệm thông thường, không được nghỉ; ngày màu trắng là ngày làm việc thông thường.</p>
           <p>Ngoài ra, khác với các Lịch Vạn niên khác, Lịch Vạn niên AI còn có thể giúp người sử dụng lập lịch làm việc, bổ sung các sự kiện cần ghi nhớ vào lịch, đồng thời cài đặt cảnh báo nhắc lịch công việc bằng trình duyệt (tiếng kêu ting ting). Bạn có thể cài đặt cảnh báo trước 30 phút, trước 1 tiếng hoặc trước 1 ngày.</p>
           <p>Để ghi chú vào lịch bạn chỉ cần nháy thực đơn Thêm sự kiện và điền các thông tin cần thiết, sau đó lưu sự kiện.</p>
           <p>Lịch Vạn niên AI còn có tính năng đổi ngày âm sang dương và ngược lại ở cuối giao diện. Đầu tiên bạn chọn kiểu chuyển đôi, sau đó nhập ngày tháng năm cần chuyển và chọn xem kết quả.</p>
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
      className="fixed z-50 bg-[#0f172a]/95 backdrop-blur-xl border-2 border-brand/50 rounded-xl shadow-[0_0_30px_rgba(0,0,0,0.8)] flex flex-col font-sans"
      style={{ left: pos.x, top: pos.y, width: 400, height: 500, resize: 'both', overflow: 'hidden' }}
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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => { setUser(currentUser); });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => { try { await signInWithPopup(auth, googleProvider); } catch (error) { console.error(error); } };
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

  return (
    <div className="flex h-screen w-full max-w-[100vw] bg-[#05070a] text-[#e2e8f0] font-sans selection:bg-brand/30 selection:text-brand overflow-hidden relative">
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
              <h1 className="text-xl font-black tracking-widest text-brand uppercase font-sans whitespace-nowrap">DIGITAL OFFICE</h1>
              <span className="text-[10px] font-sans tracking-normal font-normal text-slate-400 uppercase mt-1">Văn phòng Số Chuyên biệt</span>
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
          {modules.map((m) => (
            <button
              key={m.id}
              onClick={() => { m.isExternal ? window.open(m.url, '_blank') : setActiveModule(m.id as Module); setIsMobileMenuOpen(false); }}
              className={activeModule === m.id ? 'sidebar-link-active w-full whitespace-nowrap' : 'sidebar-link w-full whitespace-nowrap'}
            >
              <m.icon size={18} className={activeModule === m.id ? 'text-brand flex-shrink-0' : 'flex-shrink-0'} />
              {(isSidebarOpen || isMobileMenuOpen) && <span className="text-sm font-medium font-sans truncate">{m.label}</span>}
              {(isSidebarOpen || isMobileMenuOpen) && m.isExternal && <ChevronRight size={14} className="ml-auto opacity-50 flex-shrink-0" />}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-[#1e293b] space-y-4 flex-shrink-0">
          <button onClick={() => setShowHelpModal(true)} className="sidebar-link w-full whitespace-nowrap">
            <HelpCircle size={18} className="flex-shrink-0" />
            {(isSidebarOpen || isMobileMenuOpen) && <span className="text-sm font-medium font-sans">Trợ giúp</span>}
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden bg-[radial-gradient(circle_at_top_right,#0f172a, #05070a)] w-full">
        <header className="h-[70px] bg-[#0f172a]/80 backdrop-blur-md border-b border-[#1e293b] flex items-center justify-between px-4 md:px-8 z-10 flex-shrink-0">
          <div className="flex items-center gap-3 md:gap-4 font-bold text-slate-500">
            <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 -ml-2 text-slate-400 hover:text-brand transition-colors md:hidden"><Menu size={24} /></button>
            <div className="hidden sm:flex items-center gap-3 text-[11px] tracking-widest uppercase font-semibold font-sans">
              <span>Vị trí hiện tại:</span>
              <span className="text-brand flex items-center gap-2"><ChevronRight size={12} className="text-slate-500" />{modules.find(m => m.id === activeModule)?.label || 'Ứng dụng ngoài'}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-4 md:gap-6">
            {/* TÀI KHOẢN ĐĂNG NHẬP NẰM TRƯỚC LOGO */}
            {user ? (
              <div className="flex items-center gap-3 bg-[#1e293b]/50 px-3 py-1.5 rounded-full border border-[#1e293b]">
                 <img src={user.photoURL || ''} alt="Avatar" className="w-7 h-7 rounded-full" title={user.email || ''} />
                 <button onClick={handleLogout} className="text-[10px] uppercase tracking-widest font-bold text-slate-400 hover:text-rose-400 hidden sm:block transition-colors"><LogOut size={14} /></button>
              </div>
            ) : (
              <button onClick={handleLogin} className="flex items-center gap-2 px-4 py-2 bg-brand text-bg-dark text-xs font-bold rounded-full transition-all hover:scale-105 shadow-lg shadow-brand/20">
                 <LogIn size={14} /> Đăng nhập
              </button>
            )}

            {/* LOGO NẰM CUỐI CÙNG BÊN PHẢI */}
            <a href="https://lamchuaigiaoduc.vn" target="_blank" rel="noreferrer" className="flex items-center transition-transform hover:scale-105 border-l border-[#1e293b] pl-4 md:pl-6">
              <img src="Logo_anh.png" alt="AIBTeM Logo" className="h-8 md:h-10 w-auto object-contain rounded-full drop-shadow-[0_0_15px_rgba(56,189,248,0.4)]" />
            </a>
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
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </main>

      {/* HIỂN THỊ BẢNG TRỢ GIÚP NỔI BÊN TRÊN */}
      {showHelpModal && <DraggableHelp activeModule={activeModule} onClose={() => setShowHelpModal(false)} />}
    </div>
  );
}