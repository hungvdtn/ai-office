import React, { useState, useRef, useEffect } from 'react';
import { UploadCloud, FileText, Check, X, Download, AlertCircle, RefreshCw, FileWarning, Copy, Type, Settings2, ShieldCheck, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as mammoth from 'mammoth';
import { GoogleGenerativeAI } from '@google/generative-ai';

// GỌI 2 FILE TỪ ĐIỂN TỪ BÊN NGOÀI
import hoaTuDien from '../data/hoa_tu_dien.json';
import chinhTaTuDien from '../data/chinh_ta_tu_dien.json';

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const API_MODEL_NAME = "gemini-2.5-flash"; 

interface TextError { id: string; original: string; suggestion: string; type: 'chinh-ta' | 'the-thuc' | 'ngu-phap'; description: string; status: 'pending' | 'fixed' | 'ignored'; }

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

  useEffect(() => { (window as any).isDocReviewing = step === 'analyzing' || (step === 'review' && errors.some(e => e.status === 'pending')); return () => { (window as any).isDocReviewing = false; }; }, [step, errors]);
  useEffect(() => { const handleBeforeUnload = (e: BeforeUnloadEvent) => { if ((window as any).isDocReviewing) { e.preventDefault(); e.returnValue = ''; } }; window.addEventListener('beforeunload', handleBeforeUnload); return () => window.removeEventListener('beforeunload', handleBeforeUnload); }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (file) { setSelectedFileName(file.name); setSelectedFile(file); } };
  const removeSelectedFile = () => { setSelectedFileName(''); setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; };

  // ============================================================================
  // ĐỘNG CƠ RÀ SOÁT AI TOÀN DIỆN (ĐÃ BỔ SUNG LỆNH BẮT DẤU CHẤM CÂU)
  // ============================================================================
  const runAIReview = async (fullText: string) => {
    if (!GEMINI_API_KEY) return alert("Lỗi: Không tìm thấy API Key!");
    setStep('analyzing');
    
    const CHUNK_SIZE = 15000; const chunks: string[] = []; let currentIndex = 0;
    while (currentIndex < fullText.length) {
        let nextIndex = currentIndex + CHUNK_SIZE;
        if (nextIndex < fullText.length) {
            let bestBreak = Math.max(fullText.lastIndexOf(' ', nextIndex), fullText.lastIndexOf('\n', nextIndex));
            if (bestBreak > currentIndex + (CHUNK_SIZE / 2)) nextIndex = bestBreak;
        }
        chunks.push(fullText.substring(currentIndex, nextIndex)); currentIndex = nextIndex;
    }
    
    setProgress({ current: 0, total: chunks.length });
    let allErrors: TextError[] = []; let isQuotaExceeded = false;

    try {
      const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: API_MODEL_NAME, generationConfig: { responseMimeType: "application/json" } });

      for (let i = 0; i < chunks.length; i++) {
          setProgress({ current: i + 1, total: chunks.length });
          
          // ĐÃ CẬP NHẬT CÂU LỆNH ĐỂ AI BẮT LỖI DẤU CHẤM CÂU
          const prompt = `Bạn là Chuyên gia Rà soát Văn bản Hành chính.
          TUYỆT ĐỐI BỎ QUA CÁC LỖI SAU:
          1. Lỗi thừa/thiếu khoảng trắng giữa các từ.
          2. Từ viết hoa toàn bộ (như GDNN, TTg) hoặc tiếng Anh.
          3. KHÔNG BÁO LỖI nếu từ đúng sẵn.

          CHỈ BẮT 3 LOẠI LỖI SAU:
          1. "chinh-ta": Sai chính tả nặng, thiếu dấu thanh làm từ vô nghĩa.
          2. "the-thuc": Viết hoa sai (Lưu ý: không viết hoa 'khoản', 'điểm' giữa câu) VÀ LỖI THIẾU DẤU CHẤM KẾT THÚC CÂU HOẶC ĐOẠN VĂN.
          3. "ngu-phap": Lủng củng, dùng từ không chuẩn mực.

          YÊU CẦU: Trả về MẢNG JSON hợp lệ. [ { "original": "từ/đoạn sai", "suggestion": "từ/đoạn đúng", "type": "the-thuc", "description": "Lý do" } ]
          ĐOẠN VĂN BẢN:
          ${chunks[i]}`;

          try {
              const result = await model.generateContent(prompt);
              let rawJson = result.response.text().replace(/```json/gi, '').replace(/```/g, '').trim();
              rawJson = rawJson.replace(/,\s*([\]}])/g, '$1'); if (!rawJson.endsWith(']')) rawJson += ']';

              const parsedData = JSON.parse(rawJson);
              let chunkErrors = Array.isArray(parsedData) ? parsedData : (parsedData.errors || []);
              
              // BỘ LỌC CHỐNG ẢO GIÁC
              chunkErrors = chunkErrors.filter((err: any) => {
                  const orig = (err.original || "").toString().trim();
                  const sugg = (err.suggestion || "").toString().trim();
                  if (!orig || orig.length < 2) return false;
                  if (orig === sugg) return false; 
                  
                  // Cho phép báo lỗi nếu sự khác biệt chỉ là dấu chấm câu ở cuối
                  const origNorm = orig.normalize('NFC').toLowerCase();
                  const suggNorm = sugg.normalize('NFC').toLowerCase();
                  if (origNorm === suggNorm) return false; 
                  if (origNorm + "." === suggNorm) return true; // Hợp lệ nếu AI đề xuất thêm dấu chấm

                  return true;
              });

              allErrors = [...allErrors, ...chunkErrors];
              if (i < chunks.length - 1) await new Promise(resolve => setTimeout(resolve, 4000));
          } catch (chunkErr: any) {
              if (chunkErr?.toString().includes("429") || chunkErr?.toString().includes("Quota")) { isQuotaExceeded = true; break; }
          }
      }

      if (isQuotaExceeded) alert("Giới hạn API. Đã lưu các lỗi ở những phần trước.");
      const uniqueErrors = Array.from(new Set(allErrors.map(e => e.original))).map(original => allErrors.find(e => e.original === original)).filter(e => e && e.original.length > 0);
      setErrors(uniqueErrors.map((err: any, idx: number) => ({ ...err, id: `ai_${idx}`, status: 'pending' }))); setStep('review');
    } catch (error) { alert(`Lỗi mạng. Hãy thử lại.`); setStep('upload'); }
  };

  // ============================================================================
  // ĐỘNG CƠ RÀ SOÁT OFFLINE - ĐÃ TÍCH HỢP CHUẨN UNICODE MỚI NHẤT
  // ============================================================================
  // ============================================================================
  // ĐỘNG CƠ RÀ SOÁT OFFLINE - ĐÃ FIX LỖI SẬP VÒNG LẶP TỪ ĐIỂN
  // ============================================================================
  const runOfflineReview = (text: string) => {
    setStep('analyzing'); setProgress({ current: 1, total: 1 });
    
    setTimeout(() => {
      let foundErrors: TextError[] = [];
      let errCount = 0;

      // ------------------------------------------------------------------------
      // LỚP 1: QUY TẮC CỨNG (REGEX) - Bắt dấu câu, lặp từ, kẹt phím
      // ------------------------------------------------------------------------
      const regexRules = [
        // 1. THIẾU DẤU KẾT THÚC CÂU / ĐOẠN VĂN
        { 
            regex: /([\p{L}\p{M}0-9]+[)\]"']?)([ \t]*)(\n+|$)/gu, 
            suggestion: (m: any, p1: string, p2: string, p3: string) => p1 + "." + p2 + p3, 
            desc: "Lỗi dấu câu: Cuối đoạn hoặc câu hoàn chỉnh cần có dấu kết thúc." 
        },
        // 2. LỖI VIẾT HOA SAU DẤU CÂU
        {
            regex: /;([ \t]+)([\p{Lu}][\p{Ll}\p{M}]*)/gu,
            suggestion: (m: any, p1: string, p2: string) => ";" + p1 + p2.toLowerCase(),
            desc: "Quy tắc: Không viết hoa sau dấu chấm phẩy (;) trừ danh từ riêng."
        },
        {
            regex: /:([ \t]+)([\p{Lu}][\p{Ll}\p{M}]*)/gu,
            suggestion: (m: any, p1: string, p2: string) => ":" + p1 + p2.toLowerCase(),
            desc: "ĐỀ NGHỊ XEM LẠI: Thường không viết hoa sau dấu hai chấm (:), trừ danh từ riêng hoặc liệt kê độc lập."
        },
        // 3. LỖI LẶP TỪ (hiệu hiệu)
        {
            regex: /(^|[^\p{L}\p{M}])([\p{Ll}\p{M}]+)\s+\2(?=[^\p{L}\p{M}]|$)/gui,
            suggestion: (m: any, p1: string, p2: string) => p1 + p2,
            exclude: ["luôn luôn", "nhè nhẹ", "ào ào", "rào rào", "song song", "dần dần", "từ từ", "mãi mãi", "đùng đùng", "rành rành", "mặt mặt"], 
            desc: "Lỗi lặp từ: Hai từ giống hệt nhau đứng liền kề."
        },
        // 4. KHOẢNG TRẮNG CƠ BẢN
        { regex: /[ \t]+([.,;:!?])/g, suggestion: "$1", desc: "Dấu câu phải sát từ phía trước." },
        { regex: /([.,;:!?])(?=[\p{L}\p{M}])/gu, suggestion: "$1 ", desc: "Phải có khoảng trắng sau dấu câu." },
        { regex: /([(\["'])[ \t]+/g, suggestion: "$1", desc: "Dấu mở ngoặc/nháy phải sát vào từ bên phải." },
        { regex: /[ \t]+([)\]"'])/g, suggestion: "$1", desc: "Dấu đóng ngoặc/nháy phải sát vào từ bên trái." },
        { regex: /(?<=[a-zA-Z0-9.,;:!?\)\]"']) {2,}(?=[a-zA-Z0-9\(\["'])/g, suggestion: " ", desc: "Chỉ dùng một khoảng trắng giữa các từ." },
        // 5. THỪA PHỤ ÂM
        {
          regex: /(^|[^\p{L}\p{M}])([\p{Ll}\p{M}]+)(b{2,}|c{2,}|đ{2,}|d{2,}|g{2,}|h{2,}|k{2,}|l{2,}|m{2,}|n{2,}|p{2,}|q{2,}|r{2,}|s{2,}|t{2,}|v{2,}|x{2,})([\p{Ll}\p{M}]*)(?=[^\p{L}\p{M}]|$)/gu,
          suggestion: (m: any, p1: string, p2: string, p3: string, p4: string) => p1 + p2 + p3[0] + p4,
          desc: "Lỗi đánh máy: Thừa ký tự phụ âm liền kề."
        },
        // 6. THỂ THỨC ĐẶC BIỆT
        { regex: / Khoản /g, suggestion: " khoản ", desc: "Không viết hoa chữ 'khoản' giữa câu." },
        { regex: / Điểm /g, suggestion: " điểm ", desc: "Không viết hoa chữ 'điểm' giữa câu." }
      ];

      regexRules.forEach(rule => {
        let match; const loopRegex = new RegExp(rule.regex.source, rule.regex.flags);
        while ((match = loopRegex.exec(text)) !== null) {
          const originalText = match[0];
          if (rule.exclude && rule.exclude.includes(originalText.toLowerCase().trim())) continue;

          let suggestedText = "";
          if (typeof rule.suggestion === 'function') suggestedText = rule.suggestion(match, match[1], match[2], match[3], match[4]);
          else if (typeof rule.suggestion === 'string' && rule.suggestion.includes('$')) {
              suggestedText = originalText.replace(new RegExp(rule.regex.source, rule.regex.flags.replace('g', '')), rule.suggestion);
          } else suggestedText = rule.suggestion;

          if (originalText === suggestedText) continue;
          foundErrors.push({ id: `off_${errCount++}`, original: originalText, suggestion: suggestedText, type: 'the-thuc', description: rule.desc, status: 'pending' });
        }
      });

      // ------------------------------------------------------------------------
      // LỚP 2: TỪ ĐIỂN CỨNG (ĐÃ TÁCH RỜI HAI FILE JSON ĐỂ TRÁNH LỖI)
      // ------------------------------------------------------------------------
      const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      // 2.1 Xử lý Từ điển Viết Hoa
      hoaTuDien.forEach((item: any) => {
          const searchRegex = new RegExp(`(^|[^\\p{L}\\p{M}])(${escapeRegExp(item.original)})(?=[^\\p{L}\\p{M}]|$)`, 'gui');
          let match;
          while ((match = searchRegex.exec(text)) !== null) {
              const originalText = match[2]; 
              if (originalText === item.suggestion) continue; // Bỏ qua nếu người dùng đã viết đúng chính xác hoa/thường
              
              foundErrors.push({ id: `off_${errCount++}`, original: originalText, suggestion: item.suggestion, type: 'the-thuc', description: item.desc || "Lỗi viết hoa danh từ riêng.", status: 'pending' });
          }
      });

      // 2.2 Xử lý Từ điển Chính tả (ch/tr, l/n, dấu thanh...)
      chinhTaTuDien.forEach((rule: any) => {
          if (!rule.wrong || !Array.isArray(rule.wrong)) return; // Bảo vệ an toàn chống lỗi sập web
          rule.wrong.forEach((wrongWord: string) => {
              const searchRegex = new RegExp(`(^|[^\\p{L}\\p{M}])(${escapeRegExp(wrongWord)})(?=[^\\p{L}\\p{M}]|$)`, 'gui');
              let match;
              while ((match = searchRegex.exec(text)) !== null) {
                  const originalText = match[2]; 
                  if (originalText.toLowerCase() === rule.right.toLowerCase()) continue;
                  
                  let suggestedText = rule.right;
                  // Tự động điều chỉnh chữ hoa chữ thường theo từ gốc
                  if (originalText[0] === originalText[0].toUpperCase()) {
                      suggestedText = suggestedText.charAt(0).toUpperCase() + suggestedText.slice(1);
                  }

                  foundErrors.push({ id: `off_${errCount++}`, original: originalText, suggestion: suggestedText, type: rule.type || 'chinh-ta', description: rule.desc || "Sai chính tả.", status: 'pending' });
              }
          });
      });

      // Lọc bỏ các lỗi bị bắt trùng lặp
      const uniqueErrors = Array.from(new Set(foundErrors.map(e => e.original))).map(original => foundErrors.find(e => e.original === original)).filter(e => e && e.original.length > 0) as TextError[];
      setErrors(uniqueErrors); setStep('review');
    }, 500); 
  };

  const startReview = async (mode: 'offline' | 'ai') => {
    let content = inputType === 'paste' ? pasteText : "";
    if (inputType === 'upload') {
      if (!selectedFile) return alert("Vui lòng tải file!");
      const result = await mammoth.extractRawText({ arrayBuffer: await selectedFile.arrayBuffer() });
      content = result.value;
    }
    if (!content.trim()) return alert("Nội dung trống!");
    setDocumentText(content);
    mode === 'offline' ? runOfflineReview(content) : runAIReview(content);
  };

  // ============================================================================
  // GIAO DIỆN HIỂN THỊ ĐỒNG BỘ 100%
  // ============================================================================
  const escapeRegExpUI = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const renderDocumentText = () => {
    let highlightedText = documentText;
    const sortedErrors = [...errors].sort((a, b) => (b.original || "").length - (a.original || "").length);

    sortedErrors.forEach(err => {
      if (!err.original) return;
      const regex = new RegExp(escapeRegExpUI(err.original), 'g'); 
      
      if (err.status === 'pending') {
        const span = `<span id="text-error-${err.id}" class="bg-rose-500/20 rounded-sm transition-all ${activeErrorId === err.id ? 'ring-1 ring-rose-500 bg-rose-500/40' : 'hover:bg-rose-500/40 cursor-pointer'}" data-id="${err.id}">$&</span>`;
        highlightedText = highlightedText.replace(regex, span);
      } else if (err.status === 'fixed') {
        const span = `<span class="bg-emerald-500/20 text-emerald-400 rounded-sm">${err.suggestion}</span>`;
        highlightedText = highlightedText.replace(regex, span);
      }
    });

    return <div dangerouslySetInnerHTML={{ __html: highlightedText.split('\n').join('<br/>') }} 
                onClick={(e) => {
                  const target = e.target as HTMLElement;
                  if (target.tagName === 'SPAN' && target.dataset.id) {
                    const errId = target.dataset.id;
                    setActiveErrorId(errId);
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
            finalText = finalText.replace(new RegExp(escapeRegExpUI(err.original), 'g'), err.suggestion);
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
                        </div>
                    )
                 ) : (
                    <textarea value={pasteText} onChange={e => setPasteText(e.target.value)} placeholder="Dán nội dung vào đây..." className="w-full h-40 bg-[#05070a] border border-slate-600 rounded-xl p-4 text-slate-200 text-sm focus:outline-none custom-scrollbar" />
                 )}
              </div>
              <div className="space-y-4">
                 <h3 className="text-lg font-bold text-emerald-400 flex items-center gap-2 uppercase"><ShieldCheck size={18}/> 2. Bắt đầu</h3>
                 <p className="text-xs text-slate-400 mb-4">Hệ thống áp dụng chuẩn NĐ 30/2020 và kiểm tra chính tả bằng Từ điển (JSON).</p>
                 <div className="grid grid-cols-2 gap-3 pt-2">
                    <button onClick={() => startReview('offline')} className="bg-slate-800 p-4 rounded-xl hover:bg-slate-700 transition flex flex-col items-center justify-center gap-2 border border-[#1e293b]">
                       <Type size={24} className="text-amber-400" />
                       <span className="text-xs font-black text-white">RÀ SOÁT CHÍNH TẢ</span>
                    </button>
                    <button onClick={() => startReview('ai')} className="bg-sky-900/30 border border-sky-500/30 p-4 rounded-xl hover:bg-sky-900/50 transition flex flex-col items-center justify-center gap-2 shadow-[0_0_15px_rgba(2,132,199,0.2)]">
                       <RefreshCw size={24} className="text-sky-400" />
                       <span className="text-xs font-black text-white text-center">RÀ SOÁT TOÀN DIỆN<br/>(Dùng AI)</span>
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
                     <div className="h-full bg-sky-500 transition-all duration-500 ease-out" style={{ width: `${(progress.current / progress.total) * 100}%` }} />
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
                        key={err.id} id={`error-card-${err.id}`}
                        className={`bg-[#0f172a] p-5 rounded-xl border cursor-pointer ${activeErrorId === err.id ? 'border-brand shadow-[0_0_15px_rgba(56,189,248,0.2)]' : 'border-[#1e293b]'}`} 
                        onClick={() => { setActiveErrorId(err.id); document.getElementById(`text-error-${err.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }}
                    >
                       <div className="flex justify-between mb-3">
                          <span className="text-xs font-bold text-rose-400 uppercase tracking-wider">{err.type}</span>
                          <AlertCircle size={16} className="text-rose-400" />
                       </div>
                       <p className="text-base text-rose-300 line-through mb-1 font-normal">{err.original}</p>
                       <p className="text-base text-emerald-400 mb-3 font-normal">➔ {err.suggestion}</p>
                       <p className="text-sm text-slate-400 italic mb-5 font-normal border-l-2 border-[#1e293b] pl-3 py-1">{err.description}</p>
                       <div className="flex gap-2">
                          <button onClick={(e) => { e.stopPropagation(); setErrors(errors.map(e => e.id === err.id ? {...e, status: 'fixed'} : e)); }} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-2 rounded-lg font-bold text-xs transition-colors">SỬA LỖI</button>
                          <button onClick={(e) => { e.stopPropagation(); setErrors(errors.map(e => e.id === err.id ? {...e, status: 'ignored'} : e)); }} className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-lg font-bold text-xs transition-colors">BỎ QUA</button>
                       </div>
                    </motion.div>
                 ))}
                 {errors.length > 0 && errors.every(e => e.status !== 'pending') && <div className="text-center p-10"><Check size={40} className="mx-auto text-emerald-500 mb-2"/><p className="text-emerald-400 font-bold">HOÀN TẤT!</p></div>}
                 {errors.length === 0 && <div className="text-center p-10"><Check size={40} className="mx-auto text-emerald-500 mb-2"/><p className="text-emerald-400 font-bold">KHÔNG PHÁT HIỆN LỖI</p></div>}
              </div>
              <div className="p-4 border-t border-[#1e293b] grid grid-cols-2 gap-2 bg-[#1e293b]/30">
                 <button onClick={copyToClipboard} className="bg-slate-800 hover:bg-slate-700 text-slate-300 py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-colors"><Copy size={16}/> COPY TẤT CẢ</button>
                 <button onClick={exportToWord} className="bg-brand text-bg-dark py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 hover:scale-[1.02] transition-transform shadow-[0_0_15px_rgba(56,189,248,0.4)]"><Download size={16}/> TẢI FILE WORD</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}