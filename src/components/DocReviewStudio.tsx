import React, { useState, useRef, useEffect } from 'react';
import { UploadCloud, FileText, Check, X, Download, AlertCircle, RefreshCw, FileWarning, Copy, Type, Settings2, ShieldCheck, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as mammoth from 'mammoth';
import { GoogleGenerativeAI } from '@google/generative-ai';

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
// Mô hình 2.5-flash đã chứng minh độ ổn định cao với tài khoản của Bạn
const API_MODEL_NAME = "gemini-2.5-flash"; 

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
  
  const [inputType, setInputType] = useState<'upload' | 'paste'>('upload');
  const [docType, setDocType] = useState<'hanh-chinh' | 'qppl'>('hanh-chinh');
  const [pasteText, setPasteText] = useState('');
  
  const [selectedFileName, setSelectedFileName] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [progress, setProgress] = useState({ current: 0, total: 0 });

  useEffect(() => {
    (window as any).isDocReviewing = step === 'analyzing' || (step === 'review' && errors.some(e => e.status === 'pending'));
    return () => { (window as any).isDocReviewing = false; };
  }, [step, errors]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if ((window as any).isDocReviewing) { e.preventDefault(); e.returnValue = ''; }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { setSelectedFileName(file.name); setSelectedFile(file); }
  };

  const removeSelectedFile = () => {
    setSelectedFileName(''); setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ============================================================================
  // ĐỘNG CƠ RÀ SOÁT AI - CÓ BỘ CHỐNG LỖI QUOTA 429 VÀ DELAY 4 GIÂY
  // ============================================================================
  const runAIReview = async (fullText: string) => {
    if (!GEMINI_API_KEY) return alert("Lỗi: Không tìm thấy API Key!");
    setStep('analyzing');
    
    // Nâng khối lượng đọc lên 15000 ký tự (khoảng 5 trang) để giảm số lần gọi API
    const CHUNK_SIZE = 15000; 
    const chunks: string[] = [];
    for (let i = 0; i < fullText.length; i += CHUNK_SIZE) {
        chunks.push(fullText.substring(i, i + CHUNK_SIZE));
    }
    
    setProgress({ current: 0, total: chunks.length });
    let allErrors: TextError[] = [];
    let isQuotaExceeded = false;

    try {
      const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ 
          model: API_MODEL_NAME,
          generationConfig: { responseMimeType: "application/json" }
      });

      for (let i = 0; i < chunks.length; i++) {
          setProgress({ current: i + 1, total: chunks.length });
          
          const prompt = `Bạn là Chuyên gia Rà soát Văn bản Hành chính cực kỳ khắt khe.
          Quét ĐOẠN VĂN BẢN sau để tìm CÁC LỖI:
          1. Lỗi chính tả, đánh máy ("chinh-ta"): Sai dấu, sai vần, thiếu/thừa chữ, dính chữ (ví dụ: phát trien, Xác địnhh).
          2. Lỗi thể thức ("the-thuc"): Viết hoa, viết tắt, dấu câu theo ${docType === 'hanh-chinh' ? 'NĐ 30/2020' : 'VB QPPL'}.
          3. Lỗi ngữ pháp ("ngu-phap"): Lủng củng, dùng từ không chuẩn mực.

          YÊU CẦU: Trả về MẢNG JSON hợp lệ.
          [ { "original": "trích chính xác từ bị sai", "suggestion": "từ đúng", "type": "chinh-ta", "description": "Lý do" } ]
          
          ĐOẠN VĂN BẢN:
          ${chunks[i]}`;

          try {
              const result = await model.generateContent(prompt);
              let rawJson = result.response.text().replace(/```json/gi, '').replace(/```/g, '').trim();
              rawJson = rawJson.replace(/,\s*([\]}])/g, '$1'); 
              if (!rawJson.endsWith(']')) rawJson += ']';

              const parsedData = JSON.parse(rawJson);
              const chunkErrors = Array.isArray(parsedData) ? parsedData : (parsedData.errors || []);
              allErrors = [...allErrors, ...chunkErrors];
              
              // BỘ PHANH NHÂN TẠO: Nghỉ 4 giây để chống lỗi 429 của Google
              if (i < chunks.length - 1) {
                  await new Promise(resolve => setTimeout(resolve, 4000));
              }
          } catch (chunkErr: any) {
              console.warn(`Lỗi phân tích phần ${i+1}:`, chunkErr);
              const errMsg = chunkErr?.message || chunkErr?.toString() || "";
              // Bắt lỗi 429 và thông báo cho người dùng biết
              if (errMsg.includes("429") || errMsg.includes("Quota")) {
                  isQuotaExceeded = true;
                  break; // Dừng lại, giữ những lỗi đã tìm được ở các trang trước
              }
          }
      }

      if (isQuotaExceeded) {
          alert("CẢNH BÁO: Bạn đã vượt quá giới hạn truy cập miễn phí của Google (Lỗi 429). Hệ thống đã tự động lưu lại các lỗi bắt được ở những trang đầu tiên. Bạn vui lòng đợi khoảng 1 phút trước khi rà soát tiếp các đoạn còn lại.");
      }

      const uniqueErrors = Array.from(new Set(allErrors.map(e => e.original)))
          .map(original => allErrors.find(e => e.original === original))
          .filter(e => e && e.original.length > 0);

      setErrors(uniqueErrors.map((err: any, idx: number) => ({ ...err, id: `ai_${idx}`, status: 'pending' })));
      setStep('review');

    } catch (error) {
      alert(`Lỗi mạng nội bộ. Hãy kiểm tra kết nối và thử lại.`);
      setStep('upload');
    }
  };

  const runOfflineReview = (text: string) => {
    setStep('analyzing'); setProgress({ current: 1, total: 1 });
    setTimeout(() => {
      let foundErrors: TextError[] = [];
      let errCount = 0;
      const rules = [
        { regex: /kỷ niệm/g, original: "kỷ niệm", suggestion: "kỉ niệm", desc: "QĐ 1989: Âm 'i' sau phụ âm đầu không có âm đệm viết là 'i'." },
        { regex: /ban nghành/gi, original: "ban nghành", suggestion: "ban ngành", desc: "Lỗi chính tả." }
      ];
      rules.forEach(rule => {
        let match; const regex = new RegExp(rule.regex);
        while ((match = regex.exec(text)) !== null) {
          foundErrors.push({ id: `off_${errCount++}`, original: match[0], suggestion: rule.suggestion, type: 'the-thuc', description: rule.desc, status: 'pending' });
        }
      });
      setErrors(foundErrors); setStep('review');
    }, 1000);
  };

  const startReview = async (mode: 'offline' | 'ai') => {
    let content = inputType === 'paste' ? pasteText : "";
    if (inputType === 'upload') {
      if (!selectedFile) return alert("Vui lòng chọn hoặc tải file Word (.docx) lên trước!");
      try {
        const arrayBuffer = await selectedFile.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        content = result.value;
      } catch (e) {
        return alert("Lỗi trích xuất chữ từ file Word.");
      }
    }
    if (!content.trim()) return alert("Nội dung văn bản trống!");
    setDocumentText(content);
    mode === 'offline' ? runOfflineReview(content) : runAIReview(content);
  };

  // ============================================================================
  // HIỂN THỊ VĂN BẢN (THUẬT TOÁN TÌM KIẾM REGEX BẤT CHẤP HOA/THƯỜNG)
  // ============================================================================
  const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const renderDocumentText = () => {
    let highlightedText = documentText;
    const sortedErrors = [...errors].sort((a, b) => (b.original || "").length - (a.original || "").length);

    sortedErrors.forEach(err => {
      if (!err.original) return;
      // gi: global (toàn bộ) & insensitive (không phân biệt chữ hoa/thường)
      const regex = new RegExp(escapeRegExp(err.original), 'gi'); 
      
      if (err.status === 'pending') {
        const span = `<span class="bg-rose-500/30 text-rose-300 border-b-2 border-rose-500 font-semibold px-1 rounded cursor-pointer transition-all ${activeErrorId === err.id ? 'ring-2 ring-rose-500 shadow-[0_0_15px_rgba(225,29,72,0.6)]' : 'hover:bg-rose-500/50'}" data-id="${err.id}">$&</span>`;
        highlightedText = highlightedText.replace(regex, span);
      } else if (err.status === 'fixed') {
        const span = `<span class="bg-emerald-500/20 text-emerald-400 font-bold px-1 rounded transition-all">${err.suggestion}</span>`;
        highlightedText = highlightedText.replace(regex, span);
      }
    });

    return <div dangerouslySetInnerHTML={{ __html: highlightedText.split('\n').join('<br/>') }} 
                onClick={(e) => {
                  const target = e.target as HTMLElement;
                  if (target.tagName === 'SPAN' && target.dataset.id) {
                    setActiveErrorId(target.dataset.id);
                  }
                }}
           />;
  };

  const getFinalText = () => {
    let finalText = documentText;
    errors.forEach(err => { 
        if (err.status === 'fixed' && err.original) {
            const regex = new RegExp(escapeRegExp(err.original), 'gi');
            finalText = finalText.replace(regex, err.suggestion);
        }
    });
    return finalText;
  };

  const copyToClipboard = () => navigator.clipboard.writeText(getFinalText()).then(() => alert("Đã copy văn bản đã sửa vào bộ nhớ tạm!"));
  
  const exportToWord = () => {
    const sourceHTML = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'></head><body>${getFinalText().replace(/\n/g, '<br/>')}</body></html>`;
    const blob = new Blob(['\ufeff', sourceHTML], { type: 'application/msword' });
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob);
    link.download = `VanBan_DaSua_${docType}.doc`; link.click();
  };

  return (
    <div className="space-y-6 w-full pb-10 font-sans h-full flex flex-col">
      <div className="flex items-center gap-3 border-b border-[#1e293b] pb-4">
         <FileWarning size={24} className="text-brand" />
         <h2 className="text-xl font-bold text-white uppercase tracking-widest">Rà soát Văn bản</h2>
      </div>

      {step === 'upload' && (
        <div className="flex-1 flex items-center justify-center min-h-[60vh]">
           <div className="bg-[#0f172a] border border-[#1e293b] rounded-2xl p-8 max-w-4xl w-full shadow-2xl grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                 <h3 className="text-lg font-bold text-sky-400 flex items-center gap-2 uppercase"><Settings2 size={18}/> 1. Đầu vào</h3>
                 <div className="flex bg-[#1e293b]/50 p-1 rounded-lg">
                    <button onClick={() => setInputType('upload')} className={`flex-1 py-2 text-xs font-bold rounded ${inputType === 'upload' ? 'bg-sky-600 text-white' : 'text-slate-400'}`}>Tải file Word</button>
                    <button onClick={() => setInputType('paste')} className={`flex-1 py-2 text-xs font-bold rounded ${inputType === 'paste' ? 'bg-sky-600 text-white' : 'text-slate-400'}`}>Dán văn bản</button>
                 </div>
                 
                 {inputType === 'upload' ? (
                    selectedFile ? (
                        <div className="border-2 border-sky-500 rounded-xl p-8 text-center bg-sky-900/20 relative">
                            <FileText size={40} className="mx-auto text-sky-400 mb-3" />
                            <p className="text-sm text-white font-bold mb-1 truncate px-4">{selectedFileName}</p>
                            <p className="text-[10px] text-emerald-400 uppercase font-bold mb-4">Đã tải file thành công</p>
                            <button onClick={removeSelectedFile} className="flex items-center justify-center gap-2 mx-auto text-xs text-rose-400 hover:text-rose-300 font-bold bg-rose-500/10 px-4 py-2 rounded-lg transition-colors">
                               <Trash2 size={14} /> ĐỔI FILE KHÁC
                            </button>
                        </div>
                    ) : (
                        <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-slate-600 rounded-xl p-8 text-center cursor-pointer bg-[#05070a] hover:border-sky-500 transition-colors">
                           <input type="file" accept=".docx" ref={fileInputRef} onChange={handleFileSelect} className="hidden" />
                           <UploadCloud size={40} className="mx-auto text-slate-500 mb-2" />
                           <p className="text-xs text-slate-400 font-bold uppercase">Click chọn file .docx</p>
                           <p className="text-[10px] text-slate-500 mt-2">Hỗ trợ rà soát văn bản lớn</p>
                        </div>
                    )
                 ) : (
                    <textarea value={pasteText} onChange={e => setPasteText(e.target.value)} placeholder="Dán nội dung vào đây..." className="w-full h-40 bg-[#05070a] border border-slate-600 rounded-xl p-4 text-slate-200 text-sm focus:outline-none custom-scrollbar" />
                 )}
              </div>
              <div className="space-y-4">
                 <h3 className="text-lg font-bold text-emerald-400 flex items-center gap-2 uppercase"><ShieldCheck size={18}/> 2. Thiết lập</h3>
                 <div className="space-y-2">
                    <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer ${docType === 'hanh-chinh' ? 'border-emerald-500 bg-emerald-500/10' : 'border-[#1e293b]'}`}>
                       <input type="radio" checked={docType === 'hanh-chinh'} onChange={() => setDocType('hanh-chinh')} className="hidden" />
                       <span className="text-xs font-bold text-slate-300">Văn bản Hành chính (NĐ 30)</span>
                    </label>
                    <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer ${docType === 'qppl' ? 'border-emerald-500 bg-emerald-500/10' : 'border-[#1e293b]'}`}>
                       <input type="radio" checked={docType === 'qppl'} onChange={() => setDocType('qppl')} className="hidden" />
                       <span className="text-xs font-bold text-slate-300">Dự thảo VB Quy phạm Pháp luật</span>
                    </label>
                 </div>
                 <div className="grid grid-cols-2 gap-2 pt-2">
                    <button onClick={() => startReview('offline')} className="bg-slate-800 p-3 rounded-xl hover:bg-slate-700 transition flex flex-col items-center justify-center gap-1">
                       <Type size={20} className="text-amber-400" />
                       <span className="text-[10px] font-black text-white">RÀ SOÁT NHANH</span>
                    </button>
                    <button onClick={() => startReview('ai')} className="bg-sky-900/30 border border-sky-500/30 p-3 rounded-xl hover:bg-sky-900/50 transition flex flex-col items-center justify-center gap-1">
                       <RefreshCw size={20} className="text-sky-400" />
                       <span className="text-[10px] font-black text-white">RÀ SOÁT KỸ (AI)</span>
                    </button>
                 </div>
              </div>
           </div>
        </div>
      )}

      {step === 'analyzing' && (
        <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh] space-y-4">
           <RefreshCw size={50} className="text-brand animate-spin" />
           <h3 className="text-xl font-bold text-white uppercase tracking-widest">Đang rà soát văn bản...</h3>
           
           {progress.total > 0 && (
               <div className="w-80 text-center space-y-2 mt-4">
                  <p className="text-sm font-bold text-sky-400">Đang phân tích phần {progress.current} / {progress.total}</p>
                  <div className="w-full h-3 bg-[#1e293b] rounded-full overflow-hidden border border-slate-700">
                     <div 
                        className="h-full bg-sky-500 transition-all duration-500 ease-out" 
                        style={{ width: `${(progress.current / progress.total) * 100}%` }}
                     />
                  </div>
                  <p className="text-[10px] text-slate-500">Hệ thống xử lý từng đoạn với khoảng nghỉ 4s để đảm bảo đường truyền API ổn định.</p>
               </div>
           )}
        </div>
      )}

      {step === 'review' && (
        <div className="flex-1 flex flex-col lg:flex-row gap-6 min-h-[70vh]">
           <div className="flex-[3] bg-[#0f172a] border border-[#1e293b] rounded-2xl flex flex-col overflow-hidden shadow-xl">
              <div className="bg-[#1e293b]/50 p-4 border-b border-[#1e293b] flex justify-between items-center">
                 <h4 className="font-bold text-slate-200 flex items-center gap-2 text-xs uppercase tracking-widest"><FileText size={16}/> Nội dung gốc</h4>
                 <button onClick={() => { if(errors.some(e=>e.status==='pending') && !window.confirm("Rời đi sẽ mất dữ liệu chưa lưu?")) return; setStep('upload'); setErrors([]); setSelectedFile(null); setSelectedFileName(''); }} className="text-[10px] font-bold text-slate-400 bg-slate-800 px-3 py-1 rounded-full border border-slate-700 hover:text-white transition-colors">Tải văn bản khác</button>
              </div>
              <div className="p-8 overflow-y-auto flex-1 bg-[#0a0f18] text-slate-200 text-lg leading-loose font-serif custom-scrollbar" id="document-content-pane">
                 {renderDocumentText()}
              </div>
           </div>

           <div className="flex-[2] bg-[#0f172a] border border-[#1e293b] rounded-2xl flex flex-col shadow-xl overflow-hidden h-[70vh] lg:h-auto">
              <div className="bg-[#1e293b]/50 p-5 border-b border-[#1e293b]">
                 <h4 className="font-bold text-slate-200 uppercase tracking-widest text-xs flex items-center justify-between">
                    <span>Danh sách lỗi</span>
                    <span className="bg-rose-500 text-white px-2 py-0.5 rounded-full text-[10px]">{errors.filter(e=>e.status==='pending').length} lỗi</span>
                 </h4>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#05070a] custom-scrollbar">
                 {errors.map(err => err.status === 'pending' && (
                    <motion.div 
                        key={err.id} 
                        className={`bg-[#0f172a] p-4 rounded-xl border cursor-pointer ${activeErrorId === err.id ? 'border-brand' : 'border-[#1e293b]'}`} 
                        onClick={() => {
                            setActiveErrorId(err.id);
                            const errorElement = document.querySelector(`span[data-id="${err.id}"]`);
                            if (errorElement) errorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }}
                    >
                       <div className="flex justify-between mb-2">
                          <span className="text-[10px] font-bold text-rose-400 uppercase">{err.type}</span>
                          <AlertCircle size={14} className="text-rose-400" />
                       </div>
                       <p className="text-sm text-rose-300 line-through mb-1">{err.original}</p>
                       <p className="text-sm text-emerald-400 font-bold mb-2">➔ {err.suggestion}</p>
                       <p className="text-[11px] text-slate-500 italic mb-4">{err.description}</p>
                       <div className="flex gap-2">
                          <button onClick={(e) => { e.stopPropagation(); setErrors(errors.map(e => e.id === err.id ? {...e, status: 'fixed'} : e)); }} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-2 rounded-lg font-bold text-[10px] transition-colors">SỬA LỖI</button>
                          <button onClick={(e) => { e.stopPropagation(); setErrors(errors.map(e => e.id === err.id ? {...e, status: 'ignored'} : e)); }} className="bg-slate-800 hover:bg-slate-700 text-slate-400 px-4 py-2 rounded-lg font-bold text-[10px] transition-colors">BỎ QUA</button>
                       </div>
                    </motion.div>
                 ))}
                 {errors.length > 0 && errors.every(e => e.status !== 'pending') && (
                    <div className="text-center p-10"><Check size={40} className="mx-auto text-emerald-500 mb-2"/><p className="text-emerald-400 font-bold">HOÀN TẤT!</p></div>
                 )}
                 {errors.length === 0 && (
                    <div className="text-center p-10"><Check size={40} className="mx-auto text-emerald-500 mb-2"/><p className="text-emerald-400 font-bold">KHÔNG PHÁT HIỆN LỖI</p></div>
                 )}
              </div>
              <div className="p-4 border-t border-[#1e293b] grid grid-cols-2 gap-2 bg-[#1e293b]/30">
                 <button onClick={copyToClipboard} className="bg-slate-800 hover:bg-slate-700 text-slate-300 py-3 rounded-xl font-bold text-[10px] flex items-center justify-center gap-2 transition-colors"><Copy size={14}/> COPY TẤT CẢ</button>
                 <button onClick={exportToWord} className="bg-brand text-bg-dark py-3 rounded-xl font-bold text-[10px] flex items-center justify-center gap-2 hover:scale-[1.02] transition-transform shadow-[0_0_15px_rgba(56,189,248,0.4)]"><Download size={14}/> TẢI FILE WORD</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}