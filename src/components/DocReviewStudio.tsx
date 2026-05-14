import React, { useState, useRef, useEffect } from 'react';
import { UploadCloud, FileText, Check, X, Download, AlertCircle, RefreshCw, FileWarning, Copy, Type, Settings2, ShieldCheck, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as mammoth from 'mammoth';
import { GoogleGenerativeAI } from '@google/generative-ai';

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
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
  // ĐỘNG CƠ RÀ SOÁT AI TOÀN DIỆN - PROMPT ĐƯỢC TỐI ƯU HÓA LUẬT LỆ
  // ============================================================================
  const runAIReview = async (fullText: string) => {
    if (!GEMINI_API_KEY) return alert("Lỗi: Không tìm thấy API Key!");
    setStep('analyzing');
    
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
          
          // PROMPT ĐÃ ĐƯỢC CẤY LUẬT NĐ 30 VÀ BỘ LỌC CHỐNG ẢO GIÁC
          const prompt = `Bạn là Chuyên gia Rà soát Văn bản Hành chính Việt Nam. Nhiệm vụ của bạn là bắt lỗi khắt khe, nhưng tuyệt đối không được báo lỗi sai sự thật.

          QUY TẮC BẮT LỖI BẮT BUỘC (PHẢI TUÂN THỦ NGHIÊM NGẶT):
          1. LỖI VÔ NGHĨA (CẤM BÁO): TUYỆT ĐỐI KHÔNG đưa vào kết quả nếu từ đề xuất (suggestion) giống hệt từ gốc (original).
          2. LỖI ĐỊNH DẠNG (BỎ QUA): BỎ QUA các lỗi về thừa/thiếu khoảng trắng (dấu cách), gạch đầu dòng (-), số thứ tự bị đứt quãng.
          3. DẤU THANH (CẨN THẬN): Đọc kỹ xem từ đã có dấu thanh chưa trước khi báo lỗi thiếu dấu. Không báo lỗi nếu do bảng mã Unicode tách chữ.
          4. QUY TẮC NGHỊ ĐỊNH 30/2020: 
             - KHÔNG viết hoa các chữ "khoản", "điểm" (trừ khi đứng đầu câu). Nếu văn bản viết hoa "Khoản 1", hãy sửa thành "khoản 1".
             - CÓ viết hoa các chữ: "Luật", "Nghị định", "Nghị quyết", chữ "Số" (Ví dụ: Số: 12/NĐ-CP).

          PHÂN LOẠI LỖI (CHỈ BẮT 3 LOẠI NÀY):
          1. "chinh-ta": Sai phụ âm (ch/tr, s/x), sai vần, thiếu chữ, dính chữ (vd: Xác địnhh).
          2. "the-thuc": Sai quy tắc viết hoa NĐ 30 như mục 4 ở trên.
          3. "ngu-phap": Dùng từ lóng, câu tối nghĩa.

          YÊU CẦU: Trả về MẢNG JSON hợp lệ.
          [ { "original": "từ bị sai", "suggestion": "từ đúng", "type": "chinh-ta", "description": "Lý do" } ]
          
          ĐOẠN VĂN BẢN:
          ${chunks[i]}`;

          try {
              const result = await model.generateContent(prompt);
              let rawJson = result.response.text().replace(/```json/gi, '').replace(/```/g, '').trim();
              rawJson = rawJson.replace(/,\s*([\]}])/g, '$1'); 
              if (!rawJson.endsWith(']')) rawJson += ']';

              const parsedData = JSON.parse(rawJson);
              let chunkErrors = Array.isArray(parsedData) ? parsedData : (parsedData.errors || []);
              
              // BỘ LỌC CỨNG Ở CODE: Xóa bỏ các lỗi mà AI vẫn cố tình trả về giống hệt từ gốc
              chunkErrors = chunkErrors.filter((err: any) => {
                  const orig = (err.original || "").toString().trim().toLowerCase();
                  const sugg = (err.suggestion || "").toString().trim().toLowerCase();
                  return orig !== sugg && orig.length > 0;
              });

              allErrors = [...allErrors, ...chunkErrors];
              
              if (i < chunks.length - 1) {
                  await new Promise(resolve => setTimeout(resolve, 4000));
              }
          } catch (chunkErr: any) {
              const errMsg = chunkErr?.message || chunkErr?.toString() || "";
              if (errMsg.includes("429") || errMsg.includes("Quota")) {
                  isQuotaExceeded = true;
                  break; 
              }
          }
      }

      if (isQuotaExceeded) {
          alert("CẢNH BÁO: Giới hạn API (Lỗi 429). Hệ thống đã lưu lại các lỗi ở những phần đầu tiên.");
      }

      const uniqueErrors = Array.from(new Set(allErrors.map(e => e.original)))
          .map(original => allErrors.find(e => e.original === original))
          .filter(e => e && e.original.length > 0);

      setErrors(uniqueErrors.map((err: any, idx: number) => ({ ...err, id: `ai_${idx}`, status: 'pending' })));
      setStep('review');

    } catch (error) {
      alert(`Lỗi kết nối mạng. Hãy thử lại.`);
      setStep('upload');
    }
  };

  // ============================================================================
  // ĐỘNG CƠ RÀ SOÁT CHÍNH TẢ (OFFLINE REGEX) - NHANH, CƠ BẢN
  // ============================================================================
  const runOfflineReview = (text: string) => {
    setStep('analyzing'); setProgress({ current: 1, total: 1 });
    setTimeout(() => {
      let foundErrors: TextError[] = [];
      let errCount = 0;
      const rules = [
        { regex: /kỷ niệm/g, original: "kỷ niệm", suggestion: "kỉ niệm", desc: "Âm 'i' sau phụ âm đầu không có âm đệm viết là 'i'." },
        { regex: /ban nghành/gi, original: "ban nghành", suggestion: "ban ngành", desc: "Lỗi chính tả: 'ngành' không có chữ 'h'." },
        { regex: /CỘNG HOÀ/g, original: "CỘNG HOÀ", suggestion: "CỘNG HÒA", desc: "Chữ 'Hòa' đặt dấu thanh ở chữ 'o'." },
        { regex: /Hạnh Phúc/g, original: "Hạnh Phúc", suggestion: "Hạnh phúc", desc: "Chữ 'phúc' trong tiêu ngữ phải viết thường." },
        { regex: /Căn cứ luật/g, original: "Căn cứ luật", suggestion: "Căn cứ Luật", desc: "Tên loại văn bản làm căn cứ phải viết hoa chữ cái đầu." },
        { regex: / Khoản /g, original: " Khoản ", suggestion: " khoản ", desc: "Từ 'khoản' giữa câu không viết hoa theo NĐ 30." }
      ];
      rules.forEach(rule => {
        let match; const regex = new RegExp(rule.regex);
        while ((match = regex.exec(text)) !== null) {
          foundErrors.push({ id: `off_${errCount++}`, original: match[0].trim(), suggestion: rule.suggestion.trim(), type: 'chinh-ta', description: rule.desc, status: 'pending' });
        }
      });
      setErrors(foundErrors); setStep('review');
    }, 1000);
  };

  const startReview = async (mode: 'offline' | 'ai') => {
    let content = inputType === 'paste' ? pasteText : "";
    if (inputType === 'upload') {
      if (!selectedFile) return alert("Vui lòng tải file Word (.docx) lên trước!");
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
  // GIAO DIỆN VĂN BẢN (XỬ LÝ BÔI MÀU, CUỘN ĐỒNG BỘ)
  // ============================================================================
  const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const renderDocumentText = () => {
    let highlightedText = documentText;
    const sortedErrors = [...errors].sort((a, b) => (b.original || "").length - (a.original || "").length);

    sortedErrors.forEach(err => {
      if (!err.original) return;
      const regex = new RegExp(escapeRegExp(err.original), 'gi'); 
      
      if (err.status === 'pending') {
        // Đã xóa border-b-2 (gạch chân), chỉ giữ màu nền. Thêm id để cuộn đồng bộ.
        const span = `<span id="text-error-${err.id}" class="bg-rose-500/30 text-rose-300 px-1 rounded cursor-pointer transition-all ${activeErrorId === err.id ? 'ring-2 ring-rose-500 shadow-[0_0_15px_rgba(225,29,72,0.6)]' : 'hover:bg-rose-500/50'}" data-id="${err.id}">$&</span>`;
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
                    const errId = target.dataset.id;
                    setActiveErrorId(errId);
                    // CUỘN ĐỒNG BỘ: Bấm bên trái -> Cuộn bên phải
                    const errorCard = document.getElementById(`error-card-${errId}`);
                    if (errorCard) errorCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
    link.download = `VanBan_DaSua.doc`; link.click();
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
                 <h3 className="text-lg font-bold text-emerald-400 flex items-center gap-2 uppercase"><ShieldCheck size={18}/> 2. Bắt đầu rà soát</h3>
                 <p className="text-xs text-slate-400 mb-4">Hệ thống áp dụng chuẩn NĐ 30/2020/NĐ-CP cho văn bản hành chính.</p>
                 <div className="grid grid-cols-2 gap-3 pt-2">
                    <button onClick={() => startReview('offline')} className="bg-slate-800 p-4 rounded-xl hover:bg-slate-700 transition flex flex-col items-center justify-center gap-2">
                       <Type size={24} className="text-amber-400" />
                       <span className="text-xs font-black text-white">RÀ SOÁT CHÍNH TẢ</span>
                    </button>
                    <button onClick={() => startReview('ai')} className="bg-sky-900/30 border border-sky-500/30 p-4 rounded-xl hover:bg-sky-900/50 transition flex flex-col items-center justify-center gap-2">
                       <RefreshCw size={24} className="text-sky-400" />
                       <span className="text-xs font-black text-white">RÀ SOÁT TOÀN DIỆN (AI)</span>
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
                  <p className="text-sm font-bold text-sky-400">Đang phân tích đoạn {progress.current} / {progress.total}</p>
                  <div className="w-full h-3 bg-[#1e293b] rounded-full overflow-hidden border border-slate-700">
                     <div 
                        className="h-full bg-sky-500 transition-all duration-500 ease-out" 
                        style={{ width: `${(progress.current / progress.total) * 100}%` }}
                     />
                  </div>
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
              <div className="p-8 overflow-y-auto flex-1 bg-[#0a0f18] text-slate-200 text-lg leading-loose font-serif custom-scrollbar relative">
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
                        id={`error-card-${err.id}`} // Bổ sung ID để cuộn đồng bộ từ văn bản
                        className={`bg-[#0f172a] p-4 rounded-xl border cursor-pointer ${activeErrorId === err.id ? 'border-brand shadow-[0_0_15px_rgba(56,189,248,0.2)]' : 'border-[#1e293b]'}`} 
                        onClick={() => {
                            setActiveErrorId(err.id);
                            // CUỘN ĐỒNG BỘ: Bấm bên phải -> Cuộn bên trái
                            const errorElement = document.getElementById(`text-error-${err.id}`);
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