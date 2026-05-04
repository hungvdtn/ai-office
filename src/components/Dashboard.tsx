import React from 'react';
import { 
  FileText, 
  Scan, 
  Languages, 
  Mic, 
  Volume2, 
  ArrowUpRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  LayoutDashboard
} from 'lucide-react';
import { motion } from 'motion/react';

interface DashboardProps {
  onNav: (module: any) => void;
}

export default function Dashboard({ onNav }: DashboardProps) {
  const stats = [
    { label: 'Độ chính xác OCR', value: '99.82%', sub: 'Theo tiêu chuẩn văn bản hành chính', color: 'text-brand' },
    { label: 'Tài nguyên hệ thống', value: '1.2s', sub: 'Độ trễ trung bình xử lý', color: 'text-brand' },
  ];

  const quickActions = [
    { id: 'ocr', label: 'Trích xuất OCR Vision', sub: 'Chuyển ảnh/PDF sang chữ', color: 'bg-brand', icon: Languages },
    { id: 'scanner', label: 'Scan Tài liệu', sub: 'Nhận diện & bóc tách', color: 'bg-emerald-500', icon: Scan },
    { id: 'meeting', label: 'Biên tập Cuộc họp', sub: 'Speech-to-Text Minutes', color: 'bg-blue-500', icon: Mic },
    { id: 'pdf', label: 'Xử lý PDF (PyMuPDF)', sub: 'Cắt, ghép tệp chuyên sâu', color: 'bg-rose-500', icon: FileText },
  ];

  return (
    <div className="space-y-8 pb-10">
      {/* Welcome Hero - Split style suggested by theme */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <section className="lg:col-span-2 office-card p-10 bg-panel shadow-none border-none relative overflow-hidden flex flex-col justify-center min-h-[250px]">
          <div className="relative z-10">
            <span className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-bold mb-4 block">Dashboard chính</span>
            <h1 className="text-4xl serif font-light text-slate-100 mb-4 tracking-tight">Chào buổi sáng, <span className="text-brand">Chuyên viên</span></h1>
            <p className="text-slate-400 max-w-md text-sm leading-relaxed mb-8">
              Hệ thống đã sẵn sàng cho các tác vụ số hóa hồ sơ giáo vụ và xử lý văn bản quy phạm pháp luật.
            </p>
            <div className="flex gap-4">
              <button 
                onClick={() => onNav('ocr')}
                className="office-button-primary"
              >
                Tải lên tài liệu mới
                <ArrowUpRight size={16} />
              </button>
            </div>
          </div>
          <div className="absolute -top-20 -right-20 w-80 h-80 bg-brand/5 rounded-full blur-[100px]" />
          <div className="absolute top-10 right-10 p-8 opacity-5 text-brand">
            <LayoutDashboard size={160} />
          </div>
        </section>

        <section className="flex flex-col gap-5">
          {stats.map((s, i) => (
            <div key={i} className="office-card p-6 flex flex-col justify-center">
              <h3 className="text-[10px] text-slate-500 uppercase tracking-[0.1em] font-bold mb-2">{s.label}</h3>
              <div className={`text-3xl font-light tracking-tighter ${s.color}`}>{s.value}</div>
              <p className="text-[10px] text-slate-600 mt-1 italic">{s.sub}</p>
            </div>
          ))}
          <div className="office-card flex-1 p-6 border-dashed border-slate-700 bg-transparent flex flex-col items-center justify-center text-center group cursor-pointer hover:bg-slate-900/40" onClick={() => onNav('scanner')}>
            <div className="w-10 h-10 rounded-full border border-slate-700 flex items-center justify-center text-slate-500 group-hover:bg-brand group-hover:text-bg-dark transition-all mb-3 text-2xl font-light">+</div>
            <div className="text-sm font-medium text-slate-400">Quick Scan</div>
            <div className="text-[10px] text-slate-600 mt-1 uppercase tracking-tighter">Sử dụng Camera AI</div>
          </div>
        </section>
      </div>

      {/* Tác vụ đang xử lý */}
      <section className="office-card">
        <div className="p-6 border-b border-[#1e293b] flex items-center justify-between">
          <h2 className="serif text-lg font-medium text-slate-200">Tác vụ Đang xử lý</h2>
          <span className="text-[10px] font-sans text-slate-500 uppercase tracking-widest">Cập nhật: 2 phút trước</span>
        </div>
        <div className="divide-y divide-[#1e293b]">
          {[
            { name: 'Hồ sơ_Giáo dục_THPT_2024.pdf', module: 'Cắt ghép PDF', status: '82%', type: 'badge' },
            { name: 'Biên bản_Hội thảo_Chuyên môn.mp3', module: 'Speech-to-Text', status: 'Chờ kiểm tra', type: 'text' },
            { name: 'Công văn_12_UBND_Scan.jpg', module: 'OCR Gemini Vision', status: 'Hoàn tất', type: 'success' },
            { name: 'Kế hoạch_Năm_Học_V2.docx', module: 'Text-to-Speech', status: 'Đang nén...', type: 'text' },
          ].map((item, i) => (
            <div key={i} className="flex items-center justify-between p-6 px-10 hover:bg-[#1e293b]/20 transition-colors">
              <div className="flex flex-col">
                <span className="text-sm font-medium text-slate-200">{item.name}</span>
                <span className="text-[10px] text-slate-500 uppercase tracking-tighter mt-0.5">Mục tiêu: {item.module}</span>
              </div>
              {item.type === 'badge' ? (
                <span className="bg-brand text-bg-dark text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-tighter shadow-lg shadow-brand/10">Đang xử lý {item.status}</span>
              ) : item.type === 'success' ? (
                <span className="text-[10px] text-emerald-400 font-bold uppercase flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  {item.status} - sẵn sàng gửi Zalo
                </span>
              ) : (
                <span className="text-[10px] text-slate-500 italic uppercase">{item.status}</span>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Grid Quick Actions */}
      <section>
        <h2 className="serif text-sm font-medium text-slate-500 uppercase tracking-[0.2em] mb-6 px-2">Cổng kết nối nghiệp vụ</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {quickActions.map((action, i) => (
            <motion.button
              key={i}
              whileHover={{ scale: 1.02 }}
              onClick={() => onNav(action.id)}
              className="office-card p-6 text-left group hover:bg-[#0f172a]"
            >
              <div className={`w-10 h-10 ${action.color} rounded-lg flex items-center justify-center text-bg-dark mb-6 group-hover:scale-110 transition-transform shadow-lg`}>
                <action.icon size={20} />
              </div>
              <h3 className="text-sm font-bold text-slate-200 mb-1">{action.label}</h3>
              <p className="text-[10px] text-slate-500 uppercase tracking-tighter">{action.sub}</p>
            </motion.button>
          ))}
        </div>
      </section>

      {/* Code design trace */}
      <section className="office-card overflow-hidden">
        <div className="p-6 border-b border-[#1e293b] flex items-center justify-between">
          <h2 className="serif text-lg font-medium text-slate-200">Cấu trúc Dữ liệu Chuyển đổi số</h2>
          <div className="flex gap-6">
            <div className="text-[9px] text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Bảo mật SSL Active
            </div>
            <div className="text-[9px] text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              OpenCV.js Loaded
            </div>
          </div>
        </div>
        <div className="flex flex-col lg:flex-row divide-y lg:divide-y-0 lg:divide-x divide-[#1e293b]">
          <div className="flex-1 bg-black/30 p-8 font-mono text-[11px] leading-relaxed text-slate-400">
            <code>
              <span className="text-brand"># Architecture Design Trace</span><br/>
              <span className="text-indigo-400 font-bold">class</span> DocumentProcessor:<br/>
              &nbsp;&nbsp;<span className="text-emerald-400">def</span> <span className="text-blue-400">__init__</span>(self, file_path):<br/>
              &nbsp;&nbsp;&nbsp;&nbsp;self.core = <span className="text-amber-200">"PyMuPDF"</span><br/>
              &nbsp;&nbsp;&nbsp;&nbsp;self.sec_protocol = <span className="text-amber-200">"SSL/TLS"</span><br/><br/>
              <span className="text-brand"># OCR Integration with Gemini Vision API</span><br/>
              <span className="text-emerald-400">def</span> <span className="text-blue-400">extract_tables</span>(img):<br/>
              &nbsp;&nbsp;<span className="text-emerald-400">return</span> gemini.read(img, keep_format=<span className="text-indigo-400">True</span>)
            </code>
          </div>
          <div className="w-full lg:w-72 p-8 flex flex-col gap-6">
            <div className="p-4 bg-brand/5 border border-brand/20 rounded-lg">
              <div className="text-[10px] font-bold text-brand uppercase mb-2">Hướng dẫn</div>
              <p className="text-[11px] text-slate-400 leading-relaxed">Sử dụng phím tắt <span className="text-slate-100">CTRL+P</span> để mở nhanh module xử lý văn bản quy phạm.</p>
            </div>
            <div className="p-4 bg-blue-500/5 border border-blue-500/20 rounded-lg">
              <div className="text-[10px] font-bold text-blue-400 uppercase mb-2">Zalo</div>
              <p className="text-[11px] text-slate-400 leading-relaxed">Kết nối thành công với 12 phòng ban giáo dục thông qua OA SDK.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
