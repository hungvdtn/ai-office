import React, { useState, useRef, useEffect } from 'react';
import { UploadCloud, FileText, Check, X, Download, AlertCircle, RefreshCw, FileWarning, Copy, Type, Settings2, ShieldCheck, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as mammoth from 'mammoth';
import { GoogleGenerativeAI } from '@google/generative-ai';

// GIỮ NGUYÊN KIẾN TRÚC TỪ ĐIỂN JSON BÊN NGOÀI
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
  // 1. RÀ SOÁT AI - TẬP TRUNG BẮT LỖI DẤU CHẤM CÂU CHO TỪ CUỐI CÙNG
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
          const prompt = `Bạn là Chuyên gia Rà soát Văn bản. Chỉ báo lỗi khi CHẮC CHẮN sai.
          QUY TẮC:
          1. Bắt lỗi thiếu dấu chấm kết thúc đoạn/câu (Chỉ báo lỗi ở từ cuối cùng của câu đó). Bỏ qua các tiêu đề mục (I, II, 1, a), các dòng ALL CAPS.
          2. Bắt lỗi chính tả nặng, lặp từ, viết hoa sai quy định.
          3. BỎ QUA khoảng trắng. Không sửa "hóa" thành "hoá".
          YÊU CẦU: JSON mảng. [ { "original": "từ sai", "suggestion": "từ đúng", "type": "chinh-ta", "description": "Ngắn gọn" } ]
          ĐOẠN VĂN: ${chunks[i]}`;
          try {
              const result = await model.generateContent(prompt);
              let rawJson = result.response.text().replace(/```json/gi, '').replace(/```/g, '').trim();
              rawJson = rawJson.replace(/,\s*([\]}])/g, '$1'); if (!rawJson.endsWith(']')) rawJson += ']';
              const parsedData = JSON.parse(rawJson);
              let chunkErrors = (Array.isArray(parsedData) ? parsedData : (parsedData.errors || [])).filter((err: any) => {
                  const o = (err.original || "").trim(); const s = (err.suggestion || "").trim();
                  return o.length > 1 && o !== s && o.normalize('NFC').toLowerCase() !== s.normalize('NFC').toLowerCase() && o + "." !== s.normalize('NFC');
              });
              allErrors = [...allErrors, ...chunkErrors];
              if (i < chunks.length - 1) await new Promise(res => setTimeout(resolve, 4000));
          } catch (e) { if (e?.toString().includes("429")) { isQuotaExceeded = true; break; } }
      }
      const unique = Array.from(new Set(allErrors.map(e => e.original))).map(orig => allErrors.find(e => e.original === orig)).filter(e => e && e.original.length > 0);
      setErrors(unique.map((err: any, idx: number) => ({ ...err, id: `ai_${idx}`, status: 'pending' }))); setStep('review');
    } catch (e) { alert("Lỗi mạng."); setStep('upload'); }
  };

  // ============================================================================
  // 2. RÀ SOÁT OFFLINE - ĐÃ FIX LỖI "NGÀNH", TIÊU ĐỀ VÀ HIGHLIGHT DẤU CÂU
  // ============================================================================
  const runOfflineReview = (text: string) => {
    setStep('analyzing'); setProgress({ current: 1, total: 1 });
    setTimeout(() => {
      let foundErrors: TextError[] = []; let errCount = 0;
      
      // A. KIỂM TRA DẤU CHẤM CÂU (CHỈ BẮT TỪ CUỐI CÂU)
      const lines = text.split('\n');
      lines.forEach((line) => {
          const trimmed = line.trim();
          // Bỏ qua dòng: ngắn, ALL CAPS, hoặc bắt đầu bằng số/mục lục
          if (trimmed.length < 15 || trimmed === trimmed.toUpperCase()) return;
          if (/^([IVXLCDM]+|[0-9]+|[a-zđA-ZĐ])\s*[.)]|[-+]/.test(trimmed)) return;
          
          // Kiểm tra xem có kết thúc bằng dấu câu không
          const lastChar = trimmed.slice(-1);
          if (!/[.?!:;]/.test(lastChar)) {
              const words = trimmed.split(/\s+/);
              const lastWord = words[words.length - 1];
              foundErrors.push({ id: `off_p_${errCount++}`, original: lastWord, suggestion: lastWord + ".", type: 'the-thuc', description: "Thiếu dấu chấm kết thúc câu.", status: 'pending' });
          }
      });

      // B. CÁC QUY TẮC KỸ THUẬT (Dấu cách, lặp từ, kẹt phím)
      const regexRules = [
        { regex: /;([ \t]+)([\p{Lu}][\p{Ll}\p{M}]*)/gu, suggestion: (m: any, p1: string, p2: string) => ";" + p1 + p2.toLowerCase(), desc: "Không viết hoa sau dấu chấm phẩy." },
        { regex: /:([ \t]+)([\p{Lu}][\p{Ll}\p{M}]*)/gu, suggestion: (m: any, p1: string, p2: string) => ":" + p1 + p2.toLowerCase(), desc: "Đề nghị xem lại viết hoa sau dấu hai chấm." },
        { regex: /(^|[^\p{L}\p{M}])([\p{Ll}\p{M}]+)\s+\2(?=[^\p{L}\p{M}]|$)/gui, suggestion: (m: any, p1: string, p2: string) => p1 + p2, desc: "Lặp từ." },
        { regex: /[ \t]+([.,;:!?])/g, suggestion: "$1", desc: "Dấu câu sát chữ trước." },
        { regex: /([.,;:!?])(?=[\p{L}\p{M}])/gu, suggestion: "$1 ", desc: "Khoảng trắng sau dấu câu." },
        { regex: /([(\["'])[ \t]+/g, suggestion: "$1", desc: "Mở ngoặc sát chữ sau." },
        { regex: /[ \t]+([)\]"'])/g, suggestion: "$1", desc: "Đóng ngoặc sát chữ trước." },
        { regex: /(?<=[\p{L}\p{M}0-9.,;:!?\)\]"']) {2,}(?=[\p{L}\p{M}0-9\(\["'])/gu, suggestion: " ", desc: "Thừa khoảng trắng." },
        { regex: /(^|[^\p{L}\p{M}])([\p{Ll}\p{M}]+)(b{2,}|c{2,}|đ{2,}|d{2,}|g{2,}|h{2,}|k{2,}|l{2,}|m{2,}|n{2,}|p{2,}|q{2,}|r{2,}|s{2,}|t{2,}|v{2,}|x{2,})([\p{Ll}\p{M}]*)(?=[^\p{L}\p{M}]|$)/gu, suggestion: (m: any, p1: string, p2: string, p3: string, p4: string) => p1 + p2 + p3[0] + p4, desc: "Thừa ký tự phụ âm." }
      ];

      regexRules.forEach(rule => {
        let m; const r = new RegExp(rule.regex.source, rule.regex.flags);
        while ((m = r.exec(text)) !== null) {
          let s = typeof rule.suggestion === 'function' ? rule.suggestion(m, m[1], m[2], m[3], m[4]) : m[0].replace(new RegExp(rule.regex.source, rule.regex.flags.replace('g','')), rule.suggestion);
          if (m[0] !== s) foundErrors.push({ id: `off_${errCount++}`, original: m[0], suggestion: s, type: 'the-thuc', description: rule.desc, status: 'pending' });
        }
      });

      // C. TỪ ĐIỂN (ĐÃ FIX LỖI CHỮ "NGÀNH")
      const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      [...hoaTuDien, ...chinhTaTuDien].forEach(item => {
        if (!item.wrong) return;
        item.wrong.forEach((w: string) => {
          // KỸ THUẬT LOOKBEHIND/LOOKAHEAD: Chỉ bắt đúng từ đứng ĐỘC LẬP, không bắt thành phần của từ khác
          const r = new RegExp(`(?<![\\p{L}\\p{M}])(${escape(w)})(?![\\p{L}\\p{M}])`, 'gui');
          let m;
          while ((m = r.exec(text)) !== null) {
            if (m[0].toLowerCase() === item.right.toLowerCase()) continue;
            let s = item.right; if (m[0][0] === m[0][0].toUpperCase()) s = s[0].toUpperCase() + s.slice(1);
            foundErrors.push({ id: `off_d_${errCount++}`, original: m[0], suggestion: s, type: 'chinh-ta', description: "Sai quy chuẩn/chính tả.", status: 'pending' });
          }
        });
      });

      const unique = Array.from(new Set(foundErrors.map(e => e.original))).map(orig => foundErrors.find(e => e.original === orig)).filter(e => e && e.original.length > 0) as TextError[];
      setErrors(unique); setStep('review');
    }, 500); 
  };

  const startReview = async (mode: 'offline' | 'ai') => {
    let content = inputType === 'paste' ? pasteText : "";
    if (inputType === 'upload' && selectedFile) content = (await mammoth.extractRawText({ arrayBuffer: await selectedFile.arrayBuffer() })).value;
    if (!content.trim()) return alert("Trống!"); setDocumentText(content);
    mode === 'offline' ? runOfflineReview(content) : runAIReview(content);
  };

  // ============================================================================
  // 3. HIỂN THỊ VĂN BẢN (KHÔNG LẪN MÃ HTML - KHÔNG NHẢY CHỮ)
  // ============================================================================
  const escapeUI = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const renderDocumentText = () => {
    let html = documentText;
    const sorted = [...errors].sort((a, b) => (b.original || "").length - (a.original || "").length);
    sorted.forEach(err => {
      if (!err.original) return;
      // (?![^<]*>) : CHỈ THAY THẾ CHỮ BÊN NGOÀI CÁC THẺ HTML (Fix lỗi nát code)
      const r = new RegExp(escapeUI(err.original) + '(?![^<]*>)', 'g');
      if (err.status === 'pending') {
        const span = `<span id="text-error-${err.id}" class="bg-rose-500/20 rounded-sm transition-all ${activeErrorId === err.id ? 'ring-1 ring-rose-500 bg-rose-500/40' : 'hover:bg-rose-500/40 cursor-pointer'}" data-id="${err.id}">$&</span>`;
        html = html.replace(r, span);
      } else if (err.status === 'fixed') {
        html = html.replace(r, `<span class="bg-emerald-500/20 text-emerald-400 rounded-sm">${err.suggestion}</span>`);
      }
    });
    return <div dangerouslySetInnerHTML={{ __html: html.split('\n').join('<br/>') }} onClick={(e) => { const t = e.target as HTMLElement; if (t.tagName === 'SPAN' && t.dataset.id) { setActiveErrorId(t.dataset.id); document.getElementById(`error-card-${t.dataset.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }); } }} />;
  };

  const getFinalText = () => { let f = documentText; errors.forEach(err => { if (err.status === 'fixed' && err.original) f = f.replace(new RegExp(escapeUI(err.original), 'g'), err.suggestion); }); return f; };
  const copyToClipboard = () => navigator.clipboard.writeText(getFinalText()).then(() => alert("Đã copy!"));
  const exportToWord = () => {
    const blob = new Blob(['\ufeff', `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'></head><body>${getFinalText().replace(/\n/g, '<br/>')}</body></html>`], { type: 'application/msword' });
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `DaSua.doc`; link.click();
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
                            <p className="text-[10px] text-emerald-400 uppercase font-bold mb-4">Sẵn sàng</p>
                            <button onClick={removeSelectedFile} className="flex items-center justify-center gap-2 mx-auto text-xs text-rose-400 font-bold bg-rose-500/10 px-4 py-2 rounded-lg"><Trash2 size={14} /> ĐỔI FILE</button>
                        </div>
                    ) : (
                        <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-slate-600 rounded-xl p-8 text-center cursor-pointer bg-[#05070a] hover:border-sky-500 transition-colors">
                           <input type="file" accept=".docx" ref={fileInputRef} onChange={handleFileSelect} className="hidden" />
                           <UploadCloud size={40} className="mx-auto text-slate-500 mb-2" />
                           <p className="text-xs text-slate-400 font-bold uppercase">Click chọn file .docx</p>
                        </div>
                    )
                 ) : ( <textarea value={pasteText} onChange={e => setPasteText(e.target.value)} placeholder="Dán nội dung..." className="w-full h-40 bg-[#05070a] border border-slate-600 rounded-xl p-4 text-slate-200 text-sm focus:outline-none custom-scrollbar" /> )}
              </div>
              <div className="space-y-4">
                 <h3 className="text-lg font-bold text-emerald-400 flex items-center gap-2 uppercase"><ShieldCheck size={18}/> 2. Bắt đầu</h3>
                 <p className="text-xs text-slate-400 mb-4">Đã cập nhật bộ lọc tiêu đề mục lục và ranh giới từ vựng.</p>
                 <div className="grid grid-cols-2 gap-3 pt-2">
                    <button onClick={() => startReview('offline')} className="bg-slate-800 p-4 rounded-xl hover:bg-slate-700 transition flex flex-col items-center justify-center gap-2 border border-[#1e293b]">
                       <Type size={24} className="text-amber-400" />
                       <span className="text-xs font-black text-white uppercase">RÀ SOÁT CHÍNH TẢ</span>
                    </button>
                    <button onClick={() => startReview('ai')} className="bg-sky-900/30 border border-sky-500/30 p-4 rounded-xl hover:bg-sky-900/50 transition flex flex-col items-center justify-center gap-2 shadow-[0_0_15px_rgba(2,132,199,0.2)]">
                       <RefreshCw size={24} className="text-sky-400" />
                       <span className="text-xs font-black text-white uppercase text-center">RÀ SOÁT KỸ<br/>(AI)</span>
                    </button>
                 </div>
              </div>
           </div>
        </div>
      )}
      {step === 'analyzing' && (
        <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh] space-y-4">
           <RefreshCw size={50} className="text-brand animate-spin" />
           <h3 className="text-xl font-bold text-white uppercase tracking-widest">Đang rà soát...</h3>
           {progress.total > 0 && (
               <div className="w-80 text-center space-y-2 mt-4">
                  <p className="text-sm font-bold text-sky-400">Đoạn {progress.current} / {progress.total}</p>
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
                 <button onClick={() => { if(errors.some(e=>e.status==='pending') && !window.confirm("Rời đi?")) return; setStep('upload'); setErrors([]); setSelectedFile(null); setSelectedFileName(''); }} className="text-[10px] font-bold text-slate-400 bg-slate-800 px-3 py-1 rounded-full border border-slate-700 hover:text-white transition-colors">Tải văn bản khác</button>
              </div>
              <div className="p-8 overflow-y-auto flex-1 bg-[#0a0f18] text-slate-200 text-lg leading-loose font-serif custom-scrollbar relative">{renderDocumentText()}</div>
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
                       <div className="flex justify-between mb-3"><span className="text-xs font-bold text-rose-400 uppercase tracking-wider">{err.type}</span><AlertCircle size={16} className="text-rose-400" /></div>
                       <p className="text-base text-rose-300 line-through mb-1 font-normal">{err.original}</p>
                       <p className="text-base text-emerald-400 mb-3 font-normal">➔ {err.suggestion}</p>
                       <p className="text-sm text-slate-400 italic mb-5 font-normal border-l-2 border-[#1e293b] pl-3 py-1">{err.description}</p>
                       <div className="flex gap-2">
                          <button onClick={(e) => { e.stopPropagation(); setErrors(errors.map(e => e.id === err.id ? {...e, status: 'fixed'} : e)); }} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-2 rounded-lg font-bold text-xs transition-colors">SỬA LỖI</button>
                          <button onClick={(e) => { e.stopPropagation(); setErrors(errors.map(e => e.id === err.id ? {...e, status: 'ignored'} : e)); }} className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-lg font-bold text-xs transition-colors">BỎ QUA</button>
                       </div>
                    </motion.div>
                 ))}
                 {errors.length > 0 && errors.every(e => e.status !== 'pending') && <div className="text-center p-10"><Check size={40} className="mx-auto text-emerald-500 mb-2"/><p className="text-emerald-400 font-bold uppercase tracking-widest">Hoàn tất!</p></div>}
                 {errors.length === 0 && <div className="text-center p-10"><Check size={40} className="mx-auto text-emerald-500 mb-2"/><p className="text-emerald-400 font-bold uppercase tracking-widest">Không phát hiện lỗi</p></div>}
              </div>
              <div className="p-4 border-t border-[#1e293b] grid grid-cols-2 gap-2 bg-[#1e293b]/30">
                 <button onClick={copyToClipboard} className="bg-slate-800 hover:bg-slate-700 text-slate-300 py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2"><Copy size={16}/> COPY</button>
                 <button onClick={exportToWord} className="bg-brand text-bg-dark py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 hover:scale-[1.02] shadow-[0_0_15px_rgba(56,189,248,0.4)]"><Download size={16}/> TẢI WORD</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}