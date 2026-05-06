/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  FileText, 
  Scan, 
  Languages, 
  LayoutDashboard, 
  Share2,
  ChevronRight,
  Settings,
  HelpCircle,
  Menu,
  X,
  CalendarDays, 
  QrCode, 
  Image as ImageIcon, 
  BookOpen
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import PDFProcessor from './components/PDFProcessor';
import OCRStudio from './components/OCRStudio';
import Scanner from './components/Scanner';
import Dashboard from './components/Dashboard';
import Calendar from './components/Calendar'; // Bổ sung import file Lịch

type Module = 'dashboard' | 'pdf' | 'ocr' | 'scanner' | 'calendar'; // Đã cập nhật Type

export default function App() {
  const [activeModule, setActiveModule] = useState<Module>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // --- MẢNG MENU ĐÃ ĐƯỢC CẬP NHẬT THEO YÊU CẦU MỚI ---
  const modules = [
    { id: 'dashboard', label: 'Tổng quan', icon: LayoutDashboard },
    { id: 'pdf', label: 'Xử lý PDF', icon: FileText },
    { id: 'ocr', label: 'Trích xuất OCR', icon: Languages },
    { id: 'scanner', label: 'Scan Tài liệu', icon: Scan },
    { id: 'calendar', label: 'Lịch Vạn Niên', icon: CalendarDays },
    // Các chức năng liên kết ra website ngoài
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
      id: 'handbook', 
      label: 'Cẩm nang cấp xã', 
      icon: BookOpen, 
      isExternal: true, 
      url: 'https://camnang.hungvdtn.vn/' 
    },
  ];

  const handleModuleChange = (mod: Module) => {
    setActiveModule(mod);
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="flex h-screen bg-[#05070a] text-[#e2e8f0] font-sans selection:bg-brand/30 selection:text-brand overflow-hidden">
      {/* Mobile Backdrop */}
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

      {/* Sidebar - Desktop & Mobile */}
      <aside 
        className={`
          fixed inset-y-0 left-0 z-40 md:relative md:z-20
          ${isSidebarOpen ? 'w-64' : 'w-20'} 
          bg-[#0f172a] border-r border-[#1e293b] flex flex-col transition-all duration-300 ease-in-out shadow-2xl
          ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        <div className="p-6 flex items-center justify-between border-b border-[#1e293b]">
          {(isSidebarOpen || isMobileMenuOpen) ? (
            <div className="flex flex-col">
              <h1 className="serif text-xl font-bold tracking-widest text-brand">
                EDUPRO
              </h1>
              <span className="text-[10px] font-sans tracking-normal font-normal text-slate-400 uppercase mt-1">Trợ lý Số Chuyên biệt</span>
            </div>
          ) : (
            <div className="w-8 h-8 rounded bg-brand/10 flex items-center justify-center text-brand font-bold text-xs">ED</div>
          )}
          <button 
            onClick={() => {
              if (window.innerWidth < 768) {
                setIsMobileMenuOpen(false);
              } else {
                setIsSidebarOpen(!isSidebarOpen);
              }
            }}
            className="p-1.5 hover:bg-[#1e293b] rounded-md text-slate-500 transition-colors"
          >
            {isMobileMenuOpen ? <X size={18} /> : (isSidebarOpen ? <X size={18} className="hidden md:block" /> : <Menu size={18} className="hidden md:block" />)}
            {!isMobileMenuOpen && <X size={18} className="md:hidden" />}
          </button>
        </div>

        <nav className="flex-1 py-6 space-y-1 overflow-y-auto custom-scrollbar">
          {modules.map((m) => (
            <button
              key={m.id}
              onClick={() => {
                // Xử lý mở tab mới nếu là link ngoài
                if (m.isExternal) {
                  window.open(m.url, '_blank');
                } else {
                  handleModuleChange(m.id as Module);
                }
              }}
              className={activeModule === m.id ? 'sidebar-link-active w-full' : 'sidebar-link w-full'}
            >
              <m.icon size={18} className={activeModule === m.id ? 'text-brand' : ''} />
              {(isSidebarOpen || isMobileMenuOpen) && <span>{m.label}</span>}
              
              {/* Thêm mũi tên nhỏ cho các link ngoài để người dùng dễ nhận biết */}
              {(isSidebarOpen || isMobileMenuOpen) && m.isExternal && (
                <ChevronRight size={14} className="ml-auto opacity-50" />
              )}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-[#1e293b] space-y-4">
          {(isSidebarOpen || isMobileMenuOpen) && (
            <div className="bg-[#05070a]/50 p-4 border border-[#1e293b] rounded-xl text-[10px]">
              <div className="flex justify-between mb-2">
                <span className="text-slate-500 uppercase tracking-wider">Mã hóa SSL/TLS</span>
                <span className="text-emerald-500">Hoạt động</span>
              </div>
              <div className="w-full bg-[#1e293b] h-1 rounded-full overflow-hidden">
                <div className="bg-brand w-full h-full" />
              </div>
            </div>
          )}
          <div className="space-y-1">
            <button className="sidebar-link w-full">
              <Settings size={18} />
              {(isSidebarOpen || isMobileMenuOpen) && <span>Cài đặt</span>}
            </button>
            <button className="sidebar-link w-full">
              <HelpCircle size={18} />
              {(isSidebarOpen || isMobileMenuOpen) && <span>Trợ giúp</span>}
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden bg-[radial-gradient(circle_at_top_right,#0f172a, #05070a)] w-full">
        {/* Header */}
        <header className="h-[70px] bg-[#0f172a]/80 backdrop-blur-md border-b border-[#1e293b] flex items-center justify-between px-4 md:px-8 z-10">
          <div className="flex items-center gap-3 md:gap-4 font-bold text-slate-500">
            <button 
              onClick={() => setIsMobileMenuOpen(true)}
              className="p-2 -ml-2 text-slate-400 hover:text-brand transition-colors md:hidden"
            >
              <Menu size={24} />
            </button>
            
            <div className="hidden sm:flex items-center gap-3 text-[11px] tracking-widest uppercase">
              <span>Vị trí hiện tại:</span>
              <span className="text-brand flex items-center gap-2">
                <ChevronRight size={12} className="text-slate-500" />
                {modules.find(m => m.id === activeModule)?.label || 'Ứng dụng ngoài'}
              </span>
            </div>

            <div className="flex sm:hidden items-center gap-2 text-xs text-brand truncate max-w-[150px]">
              {modules.find(m => m.id === activeModule)?.label}
            </div>
          </div>
          
          <div className="flex items-center gap-4 md:gap-8">
            <button className="office-button-secondary border-none bg-brand/10 text-brand hover:bg-brand/20 py-2 hidden sm:flex">
              <Share2 size={16} />
              <span className="text-xs font-bold uppercase tracking-wider">Gửi Zalo OA</span>
            </button>
            <div className="flex items-center gap-3 md:gap-4">
              <div className="text-right hidden lg:block">
                <div className="text-sm font-bold text-slate-100">Tiến sĩ Xuân Hùng</div>
                <div className="text-[10px] text-slate-500 uppercase tracking-tighter">Chuyên gia Giáo dục</div>
              </div>
              <div className="w-8 h-8 md:w-10 md:h-10 bg-brand rounded-full flex items-center justify-center text-[#05070a] font-black cursor-pointer shadow-lg shadow-brand/20 hover:scale-105 transition-transform text-xs md:text-sm">
                XH
              </div>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-10 relative">
          <div className="absolute inset-0 dot-grid opacity-10 pointer-events-none" />
          
          <div className="max-w-6xl mx-auto relative z-10 overflow-x-hidden">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeModule}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
              >
                {activeModule === 'dashboard' && <Dashboard onNav={setActiveModule} />}
                {activeModule === 'pdf' && <PDFProcessor />}
                {activeModule === 'ocr' && <OCRStudio />}
                {activeModule === 'scanner' && <Scanner />}
                
                {/* HIỂN THỊ CHỨC NĂNG LỊCH MỚI */}
                {activeModule === 'calendar' && <Calendar />}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </main>
    </div>
  );
}