import React, { useState, useRef } from 'react';
import { UploadCloud, FileText, Check, X, Download, AlertCircle, RefreshCw, FileWarning } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as mammoth from 'mammoth';
import { GoogleGenerativeAI } from '@google/generative-ai';

// ============================================================================
// KHAI BÁO API KEY CỦA GOOGLE GEMINI
// ============================================================================
const GEMINI_API_KEY = 'AIzaSyDkBZdDGW3ARF9YZyuGA2t5p58myRP33Gk'; 

interface TextError {
  id: string;
  original: string;
  suggestion: string;
  type: 'chinh-ta' | 'the-thuc' | 'ngu-phap';
  description: string;
  status: 'pending' | 'fixed' | 'ignored';
}

export default function DocReviewStudio() {
  const [step, setStep] = useState<'upload' | 'analyzing' | 'review'>('upload');
  const [documentText, setDocumentText] = useState<string>('');
  const [errors, setErrors] = useState<TextError[]>([]);
  const [activeErrorId, setActiveErrorId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1. ĐỌC FILE WORD BẰNG MAMMOTH
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setStep('analyzing');
    try {
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      const rawText = result.value;
      setDocumentText(rawText);

      // Gọi AI phân tích
      await analyzeTextWithAI(rawText);
    } catch (error) {
      console.error("Lỗi đọc file:", error);
      alert("Không thể đọc file Word này. Vui lòng đảm bảo định dạng .docx hợp lệ.");
      setStep('upload');
    }
  };

  // 2. GỬI TEXT CHO GEMINI AI ĐỂ TÌM LỖI
  const analyzeTextWithAI = async (text: string) => {
    try {
      const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

      const prompt = `Bạn là một chuyên gia ngôn ngữ và hành chính công của Việt Nam. 
      Hãy rà soát kỹ văn bản sau để tìm các lỗi: 
      1. Sai chính tả tiếng Việt.
      2. Sai ngữ pháp.
      3. Sai thể thức văn bản (như cách viết hoa "CỘNG HÒA", "Kính gửi", các danh từ riêng...).
      
      Trả về kết quả DƯỚI DẠNG MỘT MẢNG JSON hợp lệ. TUYỆT ĐỐI KHÔNG giải thích gì thêm ngoài JSON.
      Cấu trúc mỗi object trong mảng phải là:
      {
        "id": "chuỗi ngẫu nhiên duy nhất",
        "original": "chính xác từ hoặc cụm từ bị sai được trích xuất từ văn bản gốc",
        "suggestion": "từ hoặc cụm từ đúng",
        "type": "chinh-ta" (hoặc "the-thuc", "ngu-phap"),
        "description": "Lý do sai và quy tắc đúng"
      }

      Văn bản cần rà soát:
      """
      ${text}
      """`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      let aiText = response.text();
      
      // Làm sạch chuỗi trả về để ép kiểu JSON
      aiText = aiText.replace(/```json/g, '').replace(/```/g, '').trim();
      
      const parsedErrors: TextError[] = JSON.parse(aiText);
      const formattedErrors = parsedErrors.map(err => ({ ...err, status: 'pending' as const }));
      
      setErrors(formattedErrors);
      setStep('review');
    } catch (error) {
      console.error("Lỗi AI:", error);
      alert("Quá trình kết nối AI thất bại. Vui lòng kiểm tra lại API Key hoặc kết nối mạng.");
      setStep('upload');
    }
  };

  // 3. XỬ LÝ HÀNH ĐỘNG CHẤP NHẬN SỬA HOẶC BỎ QUA
  const handleAction = (id: string, action: 'fixed' | 'ignored') => {
    setErrors(errors.map(err => err.id === id ? { ...err, status: action } : err));
    setActiveErrorId(null);
  };

  // 4. XUẤT FILE WORD KẾT QUẢ ĐÃ SỬA LỖI
  const exportToWord = () => {
    let finalText = documentText;
    
    // Thay thế các từ lỗi bằng từ đúng nếu đã bấm "Chấp nhận sửa"
    errors.forEach(err => {
      if (err.status === 'fixed') {
        const regex = new RegExp(err.original, 'g');
        finalText = finalText.replace(regex, err.suggestion);
      }
    });

    // Ép Text thành định dạng MS Word HTML đơn giản
    const header = "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'></head><body>";
    const footer = "</body></html>";
    const sourceHTML = header + finalText.replace(/\n/g, '<br/>') + footer;
    
    const blob = new Blob(['\ufeff', sourceHTML], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'VanBan_DaRaSoat.doc';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getStatusBadge = (type: string) => {
    switch (type) {
      case 'chinh-ta': return <span className="bg-rose-500/20 text-rose-400 border border-rose-500/30 px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-widest">Chính tả</span>;
      case 'the-thuc': return <span className="bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-widest">Thể thức</span>;
      default: return <span className="bg-sky-500/20 text-sky-400 border border-sky-500/30 px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-widest">Ngữ pháp</span>;
    }
  };

  const renderDocumentText = () => {
    let highlightedText = documentText;
    
    // Bôi màu các lỗi đang chờ xử lý và lỗi đã sửa
    errors.forEach(err => {
      if (err.status === 'pending') {
        const span = `<span class="bg-rose-500/30 text-rose-300 border-b-2 border-rose-500 font-semibold px-1 rounded cursor-pointer transition-all ${activeErrorId === err.id ? 'ring-2 ring-rose-500 shadow-[0_0_15px_rgba(225,29,72,0.6)]' : 'hover:bg-rose-500/50'}" data-id="${err.id}">${err.original}</span>`;
        // Replace lười (lưu ý: RegExp đơn giản này có thể thay thế cả từ nằm trong chữ khác nếu từ quá ngắn, nhưng phù hợp cho ứng dụng thực tế mức độ vừa)
        highlightedText = highlightedText.split(err.original).join(span);
      } else if (err.status === 'fixed') {
        const span = `<span class="bg-emerald-500/20 text-emerald-400 font-bold px-1 rounded transition-all">${err.suggestion}</span>`;
        highlightedText = highlightedText.split(err.original).join(span);
      }
    });

    return <div dangerouslySetInnerHTML={{ __html: highlightedText.replace(/\n/g, '<br/>') }} 
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
            <p className="text-xs text-slate-400 font-sans mt-1">Soát lỗi chính tả & Thể thức hành chính bằng Trí tuệ Nhân tạo Gemini</p>
         </div>
      </div>

      {step === 'upload' && (
        <div className="flex-1 flex items-center justify-center min-h-[60vh]">
           <input type="file" accept=".docx" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
           <div className="bg-[#0f172a] border border-[#1e293b] rounded-2xl p-10 max-w-xl w-full text-center shadow-2xl hover:border-brand/50 transition-all cursor-pointer group" onClick={() => fileInputRef.current?.click()}>
              <div className="w-24 h-24 bg-[#1e293b] rounded-full flex items-center justify-center mx-auto mb-6 group-hover:scale-110 group-hover:bg-brand/20 transition-all">
                 <UploadCloud size={40} className="text-slate-400 group-hover:text-brand" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-2 font-sans">Tải lên file Word (.docx)</h3>
              <p className="text-slate-400 text-sm mb-8 font-sans">Click hoặc kéo thả file văn bản cần rà soát vào đây. Hệ thống sẽ tự động quét lỗi toàn diện bằng công nghệ AI của Google.</p>
              <button className="bg-brand text-bg-dark font-bold px-8 py-3 rounded-xl hover:scale-105 transition-transform shadow-[0_0_20px_rgba(56,189,248,0.3)]">
                 CHỌN FILE ĐỂ BẮT ĐẦU
              </button>
           </div>
        </div>
      )}

      {step === 'analyzing' && (
        <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh] space-y-6">
           <RefreshCw size={50} className="text-brand animate-spin" />
           <h3 className="text-xl font-bold text-white font-sans">AI đang đọc và phân tích văn bản...</h3>
           <p className="text-slate-400 font-sans animate-pulse">Đang rà soát ngôn từ và đối chiếu quy chuẩn Hành chính</p>
           <div className="w-64 h-2 bg-[#1e293b] rounded-full overflow-hidden">
              <div className="h-full bg-brand w-1/2 animate-[progress_1s_ease-in-out_infinite]" />
           </div>
        </div>
      )}

      {step === 'review' && (
        <div className="flex-1 flex flex-col lg:flex-row gap-6 min-h-[70vh]">
           {/* CỘT TRÁI */}
           <div className="flex-[3] bg-[#0f172a] border border-[#1e293b] rounded-2xl flex flex-col overflow-hidden shadow-xl">
              <div className="bg-[#1e293b]/50 p-4 border-b border-[#1e293b] flex justify-between items-center">
                 <h4 className="font-bold text-slate-200 flex items-center gap-2 text-sm uppercase tracking-widest"><FileText size={18} className="text-sky-400"/> Nội dung văn bản gốc</h4>
                 <button onClick={() => {setStep('upload'); setErrors([]); setDocumentText('');}} className="text-xs font-semibold text-slate-400 hover:text-white transition-colors bg-slate-800 px-3 py-1 rounded-full border border-slate-700">
                    Tải file khác
                 </button>
              </div>
              <div className="p-8 overflow-y-auto flex-1 bg-[#0a0f18] text-slate-200 text-lg leading-loose font-serif">
                 {renderDocumentText()}
              </div>
           </div>

           {/* CỘT PHẢI */}
           <div className="flex-[2] bg-[#0f172a] border border-[#1e293b] rounded-2xl flex flex-col shadow-xl overflow-hidden h-[70vh] lg:h-auto">
              <div className="bg-[#1e293b]/50 p-5 border-b border-[#1e293b]">
                 <h4 className="font-bold text-slate-200 uppercase tracking-widest text-sm flex items-center justify-between">
                    <span>Bảng báo lỗi tự động</span>
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
                             className={`bg-[#0f172a] p-5 rounded-xl border transition-all cursor-pointer ${activeErrorId === err.id ? 'border-brand shadow-[0_0_20px_rgba(56,189,248,0.2)]' : 'border-[#1e293b] hover:border-slate-600'}`}
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
                                <button onClick={(e) => { e.stopPropagation(); handleAction(err.id, 'fixed'); }} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-2 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition">
                                   <Check size={16} /> CHẤP NHẬN SỬA
                                </button>
                                <button onClick={(e) => { e.stopPropagation(); handleAction(err.id, 'ignored'); }} className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-lg font-bold transition">
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
                       <p className="text-slate-400 text-sm">Văn bản đã được chỉnh sửa hoàn thiện. Khuyến nghị đối chiếu các vị trí lỗi và sửa trực tiếp trên file Word gốc để giữ nguyên định dạng Bảng biểu, Căn lề chuẩn xác nhất.</p>
                    </motion.div>
                 )}
              </div>

              <div className="p-4 border-t border-[#1e293b] bg-[#1e293b]/30">
                 <button 
                    onClick={exportToWord}
                    className={`w-full py-4 rounded-xl font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${pendingCount === 0 ? 'bg-brand text-bg-dark hover:scale-[1.02] shadow-[0_0_20px_rgba(56,189,248,0.4)]' : 'bg-slate-800 text-slate-500 hover:bg-slate-700'}`}
                 >
                    <Download size={20} /> Tải file Text đã sửa lỗi (.doc)
                 </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}