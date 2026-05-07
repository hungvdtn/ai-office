/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  FileText, 
  Scan, 
  Languages, 
  ChevronRight,
  HelpCircle,
  Menu,
  X,
  CalendarDays, 
  QrCode, 
  Image as ImageIcon, 
  Search,
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import PDFProcessor from './components/PDFProcessor';
import OCRStudio from './components/OCRStudio';
import Scanner from './components/Scanner';
import Calendar from './components/Calendar';

type Module = 'calendar' | 'pdf' | 'ocr' | 'scanner'; 

export default function App() {
  const [activeModule, setActiveModule] = useState<Module>('calendar');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false); // State cho bảng Trợ giúp

  const modules = [
    { id: 'calendar', label: 'Lịch Vạn Niên', icon: CalendarDays },
    { id: 'pdf', label: 'Xử lý PDF', icon: FileText },
    { id: 'ocr', label: 'Trích xuất OCR', icon: Languages },
    { id: 'scanner', label: 'Scan Tài liệu', icon: Scan },
    { 
      id: 'qrcode', 
      label: 'Tạo mã QR', 
      icon: QrCode, 
      isExternal: true, 
      url: 'https://lamchuaigiaoduc.vn/qrcode/' 
    },
    { 
      id: 'idphoto', 
      label: 'Tạo ảnh thẻ', 
      icon: ImageIcon, 
      isExternal: true, 
      url: 'https://lamchuaigiaoduc.vn/id-photo/' 
    },
    { 
      id: 'search', 
      label: 'Tra cứu địa phương', 
      icon: Search, 
      isExternal: true, 
      url: 'https://tracuu.hungvdtn.vn/' 
    },
    { 
      id: 'gemini', 
      label: 'Trợ lý Gemini', 
      icon: Sparkles, 
      isExternal: true, 
      url: 'https://gemini.google.com/app' 
    },
  ];

  const handleModuleChange = (mod: Module) => {
    setActiveModule(mod);
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="flex h-screen w-full max-w-[100vw] bg-[#05070a] text-[#e2e8f0] font-sans selection:bg-brand/30 selection:text-brand overflow-hidden">
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsMobileMenuOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 md:hidden"
          />
        )}
      </AnimatePresence>

      <aside 
        className={`
          fixed inset-y-0 left-0 z-40 md:relative md:z-20
          ${isSidebarOpen ? 'w-64' : 'w-20'} 
          bg-[#0f172a] border-r border-[#1e293b] flex flex-col flex-shrink-0 transition-all duration-300 ease-in-out shadow-2xl overflow-x-hidden
          ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        <div className="p-6 flex items-center justify-between border-b border-[#1e293b] flex-shrink-0">
          {(isSidebarOpen || isMobileMenuOpen) ? (
            <div className="flex flex-col">
              <h1 className="text-xl font-black tracking-widest text-brand uppercase font-sans whitespace-nowrap">
                DIGITAL OFFICE
              </h1>
              <span className="text-[10px] font-sans tracking-normal font-normal text-slate-400 uppercase mt-1">
                Văn phòng Số Chuyên biệt
              </span>
            </div>
          ) : (
            <div className="w-8 h-8 rounded bg-brand/10 flex items-center justify-center text-brand font-bold text-xs flex-shrink-0">
              DO
            </div>
          )}
          <button 
            onClick={() => {
              if (window.innerWidth < 768) {
                setIsMobileMenuOpen(false);
              } else {
                setIsSidebarOpen(!isSidebarOpen);
              }
            }}
            className="p-1.5 hover:bg-[#1e293b] rounded-md text-slate-500 transition-colors flex-shrink-0"
          >
            {isMobileMenuOpen ? <X size={18} /> : (isSidebarOpen ? <X size={18} className="hidden md:block" /> : <Menu size={18} className="hidden md:block" />)}
            {!isMobileMenuOpen && <X size={18} className="md:hidden" />}
          </button>
        </div>

        <nav className="flex-1 py-6 space-y-1 overflow-y-auto overflow-x-hidden custom-scrollbar">
          {modules.map((m) => (
            <button
              key={m.id}
              onClick={() => {
                if (m.isExternal) {
                  window.open(m.url, '_blank');
                } else {
                  handleModuleChange(m.id as Module);
                }
              }}
              className={activeModule === m.id ? 'sidebar-link-active w-full whitespace-nowrap' : 'sidebar-link w-full whitespace-nowrap'}
            >
              <m.icon size={18} className={activeModule === m.id ? 'text-brand flex-shrink-0' : 'flex-shrink-0'} />
              {(isSidebarOpen || isMobileMenuOpen) && <span className="text-sm font-medium font-sans truncate">{m.label}</span>}
              
              {(isSidebarOpen || isMobileMenuOpen) && m.isExternal && (
                <ChevronRight size={14} className="ml-auto opacity-50 flex-shrink-0" />
              )}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-[#1e293b] space-y-4 flex-shrink-0">
          <div className="space-y-1">
            {/* NÚT TRỢ GIÚP - KÍCH HOẠT BẢNG HƯỚNG DẪN */}
            <button onClick={() => setShowHelpModal(true)} className="sidebar-link w-full whitespace-nowrap">
              <HelpCircle size={18} className="flex-shrink-0" />
              {(isSidebarOpen || isMobileMenuOpen) && <span className="text-sm font-medium font-sans">Trợ giúp</span>}
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden bg-[radial-gradient(circle_at_top_right,#0f172a, #05070a)] w-full">
        <header className="h-[70px] bg-[#0f172a]/80 backdrop-blur-md border-b border-[#1e293b] flex items-center justify-between px-4 md:px-8 z-10 flex-shrink-0">
          <div className="flex items-center gap-3 md:gap-4 font-bold text-slate-500">
            <button 
              onClick={() => setIsMobileMenuOpen(true)}
              className="p-2 -ml-2 text-slate-400 hover:text-brand transition-colors md:hidden"
            >
              <Menu size={24} />
            </button>
            
            <div className="hidden sm:flex items-center gap-3 text-[11px] tracking-widest uppercase font-semibold font-sans">
              <span>Vị trí hiện tại:</span>
              <span className="text-brand flex items-center gap-2">
                <ChevronRight size={12} className="text-slate-500" />
                {modules.find(m => m.id === activeModule)?.label || 'Ứng dụng ngoài'}
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-4 md:gap-8">
            {/* LOGO GÓC PHẢI - CLICK ĐỂ VỀ TRANG CHỦ */}
            <a href="https://lamchuaigiaoduc.vn" target="_blank" rel="noreferrer" className="flex items-center transition-transform hover:scale-105">
              <img src="Logo_anh.png" alt="AIBTeM Logo" className="h-8 md:h-10 w-auto object-contain rounded-full shadow-[0_0_15px_rgba(56,189,248,0.4)]" />
            </a>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-6 lg:p-8 relative">
          <div className="absolute inset-0 dot-grid opacity-10 pointer-events-none" />
          
          <div className="w-full mx-auto relative z-10 overflow-x-hidden">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeModule}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="w-full"
              >
                {activeModule === 'pdf' && <PDFProcessor />}
                {activeModule === 'ocr' && <OCRStudio />}
                {activeModule === 'scanner' && <Scanner />}
                {activeModule === 'calendar' && <Calendar />}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </main>

      {/* BẢNG TRỢ GIÚP (MODAL) */}
      <AnimatePresence>
        {showHelpModal && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 font-sans"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }}
              className="bg-[#0f172a] border border-[#1e293b] rounded-2xl p-6 md:p-8 w-full max-w-2xl shadow-2xl relative"
            >
              <button onClick={() => setShowHelpModal(false)} className="absolute top-4 right-4 p-2 text-slate-500 hover:text-white bg-slate-800/50 rounded-lg transition-colors"><X size={20}/></button>
              
              <h2 className="text-xl md:text-2xl font-bold text-brand mb-6 flex items-center gap-3">
                <HelpCircle size={28} /> Hướng dẫn sử dụng
              </h2>
              
              <div className="space-y-4 text-sm md:text-base text-slate-300">
                <div className="bg-[#05070a] p-5 rounded-xl border border-[#1e293b]">
                  <h3 className="text-white font-bold mb-2 flex items-center gap-2"><FileText size={18} className="text-blue-400"/> 1. Xử lý PDF</h3>
                  <p className="leading-relaxed">Cung cấp bộ công cụ cắt, ghép, và sắp xếp lại trang PDF bằng thao tác kéo thả. Đặc biệt có tính năng chuyển PDF sang Word (.docx), tự động làm sạch ký hiệu thừa và định dạng chuẩn font Times New Roman dùng cho hành chính.</p>
                </div>
                
                <div className="bg-[#05070a] p-5 rounded-xl border border-[#1e293b]">
                  <h3 className="text-white font-bold mb-2 flex items-center gap-2"><Languages size={18} className="text-emerald-400"/> 2. Trích xuất OCR</h3>
                  <p className="leading-relaxed">Sử dụng Trí tuệ nhân tạo (AI) chạy nội bộ (Offline) để nhận diện và bóc tách văn bản từ hình ảnh JPG/PNG. Đảm bảo bảo mật tuyệt đối 100% tài liệu nhạy cảm do dữ liệu không bị gửi lên mạng.</p>
                </div>
                
                <div className="bg-[#05070a] p-5 rounded-xl border border-[#1e293b]">
                  <h3 className="text-white font-bold mb-2 flex items-center gap-2"><Scan size={18} className="text-amber-400"/> 3. Scan Tài liệu</h3>
                  <p className="leading-relaxed">Biến thiết bị thành máy quét chuyên nghiệp. Bạn chỉ cần đưa giấy vào khung vàng, hệ thống sẽ tự động cắt viền bàn, khử bóng đổ và tẩy nền trắng tinh y như bản photocopy.</p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
