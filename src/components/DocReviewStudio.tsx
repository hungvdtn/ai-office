import React, { useState, useRef, useEffect } from 'react';
import { UploadCloud, FileText, Check, X, Download, AlertCircle, RefreshCw, FileWarning, Copy, Type, Settings2, ShieldCheck, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as mammoth from 'mammoth';
import { GoogleGenerativeAI } from '@google/generative-ai';

// ============================================================================
// KHAI BÁO BIẾN MÔI TRƯỜNG VÀ TÊN MÔ HÌNH AI
// ============================================================================
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
// BẠN CÓ THỂ THAY ĐỔI TÊN MÔ HÌNH Ở ĐÂY TÙY THEO TÀI KHOẢN AI STUDIO CỦA BẠN
const API_MODEL_NAME = "gemini-3-flash"; 

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
  
  // KHẮC PHỤC LỖI MẤT FILE: Sử dụng state để lưu trữ file cứng
  const [selectedFileName, setSelectedFileName] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const hasUnsavedChanges = step === 'analyzing' || (step === 'review' && errors.some(e => e.status === 'pending'));
    (window as any).isDocReviewing = hasUnsavedChanges;
    return () => { (window as any).isDocReviewing = false; };
  }, [step, errors]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if ((window as any).isDocReviewing) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
       setSelectedFileName(file.name);
       setSelectedFile(file); // Lưu cứng file vào bộ nhớ
    }
  };

  const removeSelectedFile = () => {
    setSelectedFileName('');
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ============================================================================
  // ĐỘNG CƠ RÀ SOÁT NHANH (OFFLINE REGEX ENGINE)
  // ============================================================================
  const runOfflineReview = (text: string) => {
    setStep('analyzing');
    setTimeout(() => {
      let foundErrors: TextError[] = [];
      let errCount = 0;

      const orthographyRules = [
        { regex: /kỷ niệm/g, original: "kỷ niệm", suggestion: "kỉ niệm", desc: "QĐ 1989/QĐ-BGDĐT: Âm 'i' sau phụ âm đầu không có âm đệm viết là 'i'." },
        { regex: /ban nghành/gi, original: "ban nghành", suggestion: "ban ngành", desc: "Lỗi chính tả: 'ngành' không có chữ 'h'." }
      ];

      const administrativeRules = [
        { regex: /CỘNG HOÀ XÃ HỘI CHỦ NGHĨA VIỆT NAM/g, original: "CỘNG HOÀ XÃ HỘI CHỦ NGHĨA VIỆT NAM", suggestion: "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM", desc: "NĐ 30/2020: Chữ 'Hòa' phải đặt dấu thanh ở chữ 'o'." },
        { regex: /Độc lập \- Tự do \- Hạnh Phúc/g, original: "Độc lập - Tự do - Hạnh Phúc", suggestion: "Độc lập - Tự do - Hạnh phúc", desc: "NĐ 30/2020: Chữ 'phúc' trong tiêu ngữ phải viết thường." }
      ];

      const qpplRules = [
        { regex: /Căn cứ luật/gi, original: "Căn cứ luật", suggestion: "Căn cứ Luật", desc: "QPPL: Tên loại văn bản làm căn cứ phải viết hoa chữ cái đầu." }
      ];

      const activeRules = [...orthographyRules, ...(docType === 'hanh-chinh' ? administrativeRules : qpplRules)];

      activeRules.forEach(rule => {
        let match;
        const regex = new RegExp(rule.regex);
        while ((match = regex.exec(text)) !== null) {
          foundErrors.push({
            id: `off_${errCount++}`,
            original: match[0],
            suggestion: rule.suggestion,
            type: 'the-thuc',
            description: rule.desc,
            status: 'pending'
          });
        }
      });

      setErrors(foundErrors);
      setStep('review');
    }, 800);
  };

  // ============================================================================
  // ĐỘNG CƠ RÀ SOÁT KỸ (AI GEMINI) - PROMPT SIÊU CHI TIẾT THEO TIÊU CHÍ CHUYÊN GIA
  // ============================================================================
  const runAIReview = async (text: string) => {
    if (!GEMINI_API_KEY) return alert("Lỗi: Không tìm thấy API Key trên máy chủ!");
    setStep('analyzing');
    try {
      const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ 
          model: API_MODEL_NAME, 
          generationConfig: { responseMimeType: "application/json", maxOutputTokens: 8192 } 
      });

      // PROMPT ĐƯỢC NÂNG CẤP DỰA TRÊN BỘ TIÊU CHÍ KHẮT KHE CỦA NGƯỜI DÙNG
      const prompt = `Bạn là một Chuyên gia Rà soát Văn bản Hành chính và Pháp luật cực kỳ khó tính và tỉ mỉ tại Việt Nam.
      Văn bản đầu vào có độ dài lớn. BẠN PHẢI QUÉT KỸ TỪNG DÒNG, TUYỆT ĐỐI KHÔNG ĐƯỢC LƯỜI BIẾNG HAY BỎ SÓT LỖI.
      
      HÃY TÌM TẤT CẢ CÁC LỖI DỰA TRÊN 3 NHÓM TIÊU CHÍ BẮT BUỘC SAU (Ưu tiên số 1 và 2):

      1. LỖI CHÍNH TẢ (Type: "chinh-ta"):
      - Lỗi phụ âm đầu: Nhầm lẫn ch/tr (chung thực -> trung thực), s/x (sản suất -> sản xuất), l/n, r/d/gi.
      - Lỗi dấu thanh: Nhầm dấu hỏi/ngã (nổi lo -> nỗi lo), thiếu dấu.
      - Lỗi vần: Nhầm ch/t (bách ngát -> bát ngát), n/ng.
      - Sai từ ghép/Hán Việt: cọ sát (sai) -> cọ xát (đúng), chẵng lẻ (sai) -> chẳng lẽ (đúng).
      - Sai quy tắc viết hoa danh từ riêng, viết tắt.

      2. LỖI KỸ THUẬT ĐÁNH MÁY (Type: "the-thuc"):
      - Lỗi đánh máy (Typo): Thiếu/thừa chữ, nhảy chữ, đảo ngược thứ tự (đcươ -> được, nhung -> nhưng), lặp từ; thừa/thiếu ký tự trong một từ (chu đáo -> chuu đá).
      - Lỗi khoảng trắng: Không có khoảng trắng sau dấu câu (. , : ; ! ?), hoặc thừa nhiều khoảng trắng giữa các từ.
      - Lỗi đánh số/liệt kê: Số thứ tự không liên tục, sai định dạng.
      - Lỗi viết tắt không đúng quy định. Lỗi trình bày tham chiếu.

      3. LỖI CAO CẤP (Type: "ngu-phap"):
      - Ngữ pháp: Cấu trúc câu sai, sai trật tự từ, thiếu chủ ngữ/vị ngữ, đặt dấu câu sai vị trí; thiếu dấu câu.
      - Dùng từ: Dùng từ lóng, từ không phù hợp văn phong hành chính trang trọng, câu lủng củng, tối nghĩa.
      - Logic: Nội dung mâu thuẫn.

      YÊU CẦU ĐẦU RA BẮT BUỘC (JSON OBJECT):
      {
        "errors": [
          {
            "original": "chính xác cụm từ bị sai",
            "suggestion": "cụm từ đúng",
            "type": "chinh-ta", // Hoặc "the-thuc", "ngu-phap"
            "description": "Giải thích rõ lỗi thuộc nhóm nào trong 3 nhóm trên."
          }
        ]
      }
      LƯU Ý QUAN TRỌNG: Hãy trích xuất TỐI ĐA 60 lỗi rõ ràng nhất để đảm bảo JSON không bị đứt gãy. Tuyệt đối không để lại dấu phẩy thừa ở cuối mảng JSON.
      
      Văn bản cần rà soát: 
      ${text.substring(0, 60000)}`;

      const result = await model.generateContent(prompt);
      const aiText = result.response.text();
      
      let parsedData;
      let rawJson = aiText.replace(/```json/g, '').replace(/```/g, '').trim();

      try {
        parsedData = JSON.parse(rawJson);
      } catch (err) {
        console.warn("JSON bị cắt cụt, đang khôi phục...", err);
        try {
            let cleanedText = rawJson.replace(/,\s*([\]}])/g, '$1'); 
            if (!cleanedText.endsWith('}') && !cleanedText.endsWith(']')) {
                const lastBraceIndex = cleanedText.lastIndexOf('}');
                if (lastBraceIndex !== -1) cleanedText = cleanedText.substring(0, lastBraceIndex + 1);
            }
            if (!cleanedText.endsWith(']}') && cleanedText.includes('"errors": [')) cleanedText += ']}';
            parsedData = JSON.parse(cleanedText);
        } catch (recoveryErr) {
            throw new Error("Dữ liệu lỗi nặng.");
        }
      }

      const errorList = parsedData.errors || parsedData || [];
      setErrors(errorList.map((err: any, idx: number) => ({ ...err, id: err.id || `ai_${idx}`, status: 'pending' })));
      setStep('review');

    } catch (error) {
      console.error("Lỗi AI:", error);
      alert("Hệ thống quá tải hoặc AI trả về định dạng gãy. Khuyến nghị: Hãy chia nhỏ văn bản thành các đoạn 5-10 trang để rà soát đạt độ chính xác 100%.");
      setStep('upload');
    }
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
        return alert("Lỗi trích xuất chữ từ file Word. Đảm bảo file không bị khóa password.");
      }
    }
    
    if (!content.trim()) return alert("Nội dung văn bản trống!");
    setDocumentText(content);
    mode === 'offline' ? runOfflineReview(content) : runAIReview(content);
  };

  const getFinalText = () => {
    let finalText = documentText;
    errors.forEach(err => { if (err.status === 'fixed') finalText = finalText.split(err.original).join(err.suggestion); });
    return finalText;
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(getFinalText()).then(() => alert("Đã copy toàn bộ văn bản (đã sửa lỗi) vào khay nhớ tạm!"));
  };

  const exportToWord = () => {
    const sourceHTML = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'></head><body>${getFinalText().replace(/\n/g, '<br/>')}</body></html>`;
    const blob = new Blob(['\ufeff', sourceHTML], { type: 'application/msword' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `VanBan_DaSua_${docType}.doc`;
    link.click();
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
           <p className="text-slate-400 text-sm">Quá trình rà soát văn bản dài có thể mất từ 10 - 30 giây.</p>
        </div>
      )}

      {step === 'review' && (
        <div className="flex-1 flex flex-col lg:flex-row gap-6 min-h-[70vh]">
           <div className="flex-[3] bg-[#0f172a] border border-[#1e293b] rounded-2xl flex flex-col overflow-hidden shadow-xl">
              <div className="bg-[#1e293b]/50 p-4 border-b border-[#1e293b] flex justify-between items-center">
                 <h4 className="font-bold text-slate-200 flex items-center gap-2 text-xs uppercase tracking-widest"><FileText size={16}/> Nội dung gốc</h4>
                 <button onClick={() => { if(errors.some(e=>e.status==='pending') && !window.confirm("Rời đi sẽ mất dữ liệu chưa lưu?")) return; setStep('upload'); setErrors([]); setSelectedFile(null); setSelectedFileName(''); }} className="text-[10px] font-bold text-slate-400 bg-slate-800 px-3 py-1 rounded-full border border-slate-700 hover:text-white transition-colors">Tải văn bản khác</button>
              </div>
              <div className="p-8 overflow-y-auto flex-1 bg-[#0a0f18] text-slate-200 text-lg leading-loose font-serif custom-scrollbar">
                 <div dangerouslySetInnerHTML={{ __html: documentText.split('\n').join('<br/>') }} />
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
                    <motion.div key={err.id} className={`bg-[#0f172a] p-4 rounded-xl border ${activeErrorId === err.id ? 'border-brand' : 'border-[#1e293b]'}`} onClick={() => setActiveErrorId(err.id)}>
                       <div className="flex justify-between mb-2">
                          <span className="text-[10px] font-bold text-rose-400 uppercase">{err.type}</span>
                          <AlertCircle size={14} className="text-rose-400" />
                       </div>
                       <p className="text-sm text-rose-300 line-through mb-1">{err.original}</p>
                       <p className="text-sm text-emerald-400 font-bold mb-2">➔ {err.suggestion}</p>
                       <p className="text-[11px] text-slate-500 italic mb-4">{err.description}</p>
                       <div className="flex gap-2">
                          <button onClick={() => setErrors(errors.map(e => e.id === err.id ? {...e, status: 'fixed'} : e))} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-2 rounded-lg font-bold text-[10px] transition-colors">SỬA LỖI</button>
                          <button onClick={() => setErrors(errors.map(e => e.id === err.id ? {...e, status: 'ignored'} : e))} className="bg-slate-800 hover:bg-slate-700 text-slate-400 px-4 py-2 rounded-lg font-bold text-[10px] transition-colors">BỎ QUA</button>
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