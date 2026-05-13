import React, { useState } from 'react';
import { UploadCloud, FileText, Check, X, Download, AlertCircle, RefreshCw, FileWarning } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Cấu trúc dữ liệu lỗi giả lập để demo UX
interface TextError {
  id: string;
  original: string;
  suggestion: string;
  type: 'chinh-ta' | 'the-thuc' | 'ngu-phap';
  description: string;
  status: 'pending' | 'fixed' | 'ignored';
}

const MOCK_ERRORS: TextError[] = [
  { id: '1', original: 'CỘNG HOÀ', suggestion: 'CỘNG HÒA', type: 'the-thuc', description: 'Theo Nghị định 30/2020/NĐ-CP về thể thức văn bản hành chính, chữ "Hòa" nên đặt dấu thanh ở chữ "o".', status: 'pending' },
  { id: '2', original: 'Kính rửi', suggestion: 'Kính gửi', type: 'chinh-ta', description: 'Sai phụ âm đầu "r" thay vì "g".', status: 'pending' },
  { id: '3', original: 'ban nghành', suggestion: 'ban ngành', type: 'chinh-ta', description: 'Từ "ngành" không có "h" theo quy tắc chính tả tiếng Việt.', status: 'pending' },
  { id: '4', original: 'thực tiển', suggestion: 'thực tiễn', type: 'chinh-ta', description: 'Sai dấu hỏi/ngã. Dùng thanh ngã.', status: 'pending' },
  { id: '5', original: 'triễn khai', suggestion: 'triển khai', type: 'chinh-ta', description: 'Sai dấu hỏi/ngã. Dùng thanh hỏi.', status: 'pending' }
];

export default function DocReviewStudio() {
  const [step, setStep] = useState<'upload' | 'analyzing' | 'review'>('upload');
  const [errors, setErrors] = useState<TextError[]>(MOCK_ERRORS);
  const [activeErrorId, setActiveErrorId] = useState<string | null>(null);

  // Giả lập quá trình AI phân tích văn bản
  const handleUpload = () => {
    setStep('analyzing');
    setTimeout(() => {
      setStep('review');
    }, 2500); // Đợi 2.5 giây cho giống thật
  };

  const handleAction = (id: string, action: 'fixed' | 'ignored') => {
    setErrors(errors.map(err => err.id === id ? { ...err, status: action } : err));
    setActiveErrorId(null);
  };

  const getStatusBadge = (type: string) => {
    switch (type) {
      case 'chinh-ta': return <span className="bg-rose-500/20 text-rose-400 border border-rose-500/30 px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-widest">Chính tả</span>;
      case 'the-thuc': return <span className="bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-widest">Thể thức</span>;
      default: return <span className="bg-sky-500/20 text-sky-400 border border-sky-500/30 px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-widest">Ngữ pháp</span>;
    }
  };

  // Hàm tạo ra văn bản demo, tự động thay thế từ sai bằng span có màu sắc
  const renderDocumentText = () => {
    let text = `CỘNG HOÀ XÃ HỘI CHỦ NGHĨA VIỆT NAM\nĐộc lập - Tự do - Hạnh phúc\n\nKính rửi các cơ quan, ban nghành đoàn thể,\n\nCăn cứ vào tình hình thực tiển tại địa phương, Ủy ban nhân dân tỉnh yêu cầu các đơn vị khẩn trương triễn khai kế hoạch chuyển đổi số giai đoạn 2026.`;
    
    // Thuật toán thô sơ để demo việc bôi đậm từ bị lỗi trong đoạn text
    errors.forEach(err => {
      if (err.status === 'pending') {
        const span = `<span class="bg-rose-500/30 text-rose-300 border-b-2 border-rose-500 font-semibold px-1 rounded cursor-pointer transition-all ${activeErrorId === err.id ? 'ring-2 ring-rose-500 shadow-[0_0_15px_rgba(225,29,72,0.6)]' : 'hover:bg-rose-500/50'}" data-id="${err.id}">${err.original}</span>`;
        text = text.replace(err.original, span);
      } else if (err.status === 'fixed') {
        const span = `<span class="bg-emerald-500/20 text-emerald-400 font-bold px-1 rounded transition-all">${err.suggestion}</span>`;
        text = text.replace(err.original, span);
      }
    });

    return <div dangerouslySetInnerHTML={{ __html: text.replace(/\n/g, '<br/>') }} 
                onClick={(e) => {
                  const target = e.target as HTMLElement;
                  if (target.tagName === 'SPAN' && target.dataset.id) {
                    setActiveErrorId(target.dataset.id);
                  }
                }}
           />;
  };

  const pendingCount = errors.filter(e => e.status === 'pending').length;

  return (
    <div className="space-y-6 animate-in fade-in duration-700 w-full pb-10 font-sans h-full flex flex-col">
      <div className="flex items-center gap-3 border-b border-[#1e293b] pb-4">
         <div className="w-10 h-10 bg-brand/10 rounded-xl flex items-center justify-center text-brand shadow-lg">
            <FileWarning size={24} />
         </div>
         <div>
            <h2 className="text-xl font-bold text-white uppercase tracking-widest font-sans">Rà soát Văn bản AI</h2>
            <p className="text-xs text-slate-400 font-sans mt-1">Soát lỗi chính tả & Thể thức hành chính bằng Trí tuệ Nhân tạo</p>
         </div>
      </div>

      {step === 'upload' && (
        <div className="flex-1 flex items-center justify-center min-h-[60vh]">
           <div className="bg-[#0f172a] border border-[#1e293b] rounded-2xl p-10 max-w-xl w-full text-center shadow-2xl hover:border-brand/50 transition-all cursor-pointer group" onClick={handleUpload}>
              <div className="w-24 h-24 bg-[#1e293b] rounded-full flex items-center justify-center mx-auto mb-6 group-hover:scale-110 group-hover:bg-brand/20 transition-all">
                 <UploadCloud size={40} className="text-slate-400 group-hover:text-brand" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-2 font-sans">Tải lên file Word (.docx)</h3>
              <p className="text-slate-400 text-sm mb-8 font-sans">Click hoặc kéo thả file văn bản cần rà soát vào đây. Hệ thống sẽ tự động quét lỗi toàn diện.</p>
              <button className="bg-brand text-bg-dark font-bold px-8 py-3 rounded-xl hover:scale-105 transition-transform shadow-[0_0_20px_rgba(56,189,248,0.3)]">
                 BẮT ĐẦU RÀ SOÁT
              </button>
           </div>
        </div>
      )}

      {step === 'analyzing' && (
        <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh] space-y-6">
           <RefreshCw size={50} className="text-brand animate-spin" />
           <h3 className="text-xl font-bold text-white font-sans">AI đang đọc và phân tích văn bản...</h3>
           <p className="text-slate-400 font-sans animate-pulse">Đang đối chiếu với Nghị định 30/2020/NĐ-CP và Từ điển Tiếng Việt</p>
           <div className="w-64 h-2 bg-[#1e293b] rounded-full overflow-hidden">
              <div className="h-full bg-brand w-1/2 animate-[progress_1s_ease-in-out_infinite]" />
           </div>
        </div>
      )}

      {step === 'review' && (
        <div className="flex-1 flex flex-col lg:flex-row gap-6 min-h-[70vh]">
           {/* CỘT TRÁI: HIỂN THỊ VĂN BẢN TRỰC QUAN */}
           <div className="flex-[3] bg-[#0f172a] border border-[#1e293b] rounded-2xl flex flex-col overflow-hidden shadow-xl">
              <div className="bg-[#1e293b]/50 p-4 border-b border-[#1e293b] flex justify-between items-center">
                 <h4 className="font-bold text-slate-200 flex items-center gap-2 text-sm uppercase tracking-widest"><FileText size={18} className="text-sky-400"/> Nội dung văn bản gốc</h4>
                 <div className="text-xs font-semibold text-slate-400 bg-slate-800 px-3 py-1 rounded-full border border-slate-700">
                    Bản nháp (Preview)
                 </div>
              </div>
              <div className="p-8 overflow-y-auto flex-1 bg-[#0a0f18] text-slate-200 text-lg leading-loose font-serif">
                 {renderDocumentText()}
              </div>
           </div>

           {/* CỘT PHẢI: BẢNG ĐIỀU KHIỂN RÀ SOÁT */}
           <div className="flex-[2] bg-[#0f172a] border border-[#1e293b] rounded-2xl flex flex-col shadow-xl overflow-hidden h-[70vh] lg:h-auto">
              <div className="bg-[#1e293b]/50 p-5 border-b border-[#1e293b]">
                 <h4 className="font-bold text-slate-200 uppercase tracking-widest text-sm flex items-center justify-between">
                    <span>Bảng báo lỗi</span>
                    {pendingCount > 0 ? (
                       <span className="bg-rose-500 text-white px-2 py-0.5 rounded-full text-xs animate-pulse">{pendingCount} lỗi cần xử lý</span>
                    ) : (
                       <span className="bg-emerald-500 text-white px-2 py-0.5 rounded-full text-xs">Đã sạch lỗi</span>
                    )}
                 </h4>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-[#05070a]">
                 <AnimatePresence>
                    {errors.map((err) => (
                       err.status === 'pending' && (
                          <motion.div 
                             key={err.id}
                             initial={{ opacity: 0, x: 20 }}
                             animate={{ opacity: 1, x: 0 }}
                             exit={{ opacity: 0, scale: 0.9 }}
                             className={`bg-[#0f172a] p-5 rounded-xl border transition-all ${activeErrorId === err.id ? 'border-brand shadow-[0_0_20px_rgba(56,189,248,0.2)]' : 'border-[#1e293b]'}`}
                             onClick={() => setActiveErrorId(err.id)}
                          >
                             <div className="flex justify-between items-start mb-3">
                                {getStatusBadge(err.type)}
                                <AlertCircle size={16} className="text-rose-400" />
                             </div>
                             
                             <div className="mb-4">
                                <p className="text-sm text-slate-400 mb-1">Từ bị lỗi:</p>
                                <div className="text-lg font-bold text-rose-400 line-through decoration-rose-500/50">{err.original}</div>
                             </div>

                             <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                                <p className="text-xs text-emerald-500/70 font-bold uppercase tracking-widest mb-1">AI Đề xuất sửa thành:</p>
                                <div className="text-lg font-bold text-emerald-400 flex items-center gap-2">
                                   <Check size={18} /> {err.suggestion}
                                </div>
                             </div>

                             <p className="text-sm text-slate-400 mb-5 italic border-l-2 border-[#1e293b] pl-3 py-1">
                                {err.description}
                             </p>

                             <div className="flex gap-2">
                                <button onClick={() => handleAction(err.id, 'fixed')} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-2 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition">
                                   <Check size={16} /> CHẤP NHẬN SỬA
                                </button>
                                <button onClick={() => handleAction(err.id, 'ignored')} className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-lg font-bold transition">
                                   BỎ QUA
                                </button>
                             </div>
                          </motion.div>
                       )
                    ))}
                 </AnimatePresence>
                 
                 {pendingCount === 0 && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full flex flex-col items-center justify-center text-center p-8">
                       <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mb-4">
                          <Check size={32} className="text-emerald-400" />
                       </div>
                       <h4 className="text-emerald-400 font-bold text-lg mb-2">Hoàn tất rà soát!</h4>
                       <p className="text-slate-400 text-sm">Văn bản đã được chỉnh sửa hoàn thiện. Bạn có thể tải file kết quả xuống.</p>
                    </motion.div>
                 )}
              </div>

              <div className="p-4 border-t border-[#1e293b] bg-[#1e293b]/30">
                 <button 
                    className={`w-full py-4 rounded-xl font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${pendingCount === 0 ? 'bg-brand text-bg-dark hover:scale-[1.02] shadow-[0_0_20px_rgba(56,189,248,0.4)]' : 'bg-slate-800 text-slate-500 cursor-not-allowed'}`}
                    disabled={pendingCount > 0}
                 >
                    <Download size={20} /> Tải file Word đã sửa
                 </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}