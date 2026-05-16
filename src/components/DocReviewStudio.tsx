import React, { useState, useRef, useEffect } from 'react';
import { UploadCloud, FileText, Check, X, Download, AlertCircle, RefreshCw, FileWarning, Copy, Type, Settings2, ShieldCheck, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { auth, googleProvider } from '../firebase';
import { signInWithPopup } from 'firebase/auth';
import * as mammoth from 'mammoth';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Document, Packer, Paragraph, TextRun } from 'docx';

// GỌI 2 FILE TỪ ĐIỂN TỪ BÊN NGOÀI (Bạn cứ thêm 5000+ từ thoải mái vào 2 file này)
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
  // Trạng thái điều khiển Modal Đăng nhập
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);

  // Tự động đóng Modal nếu người dùng đăng nhập thành công
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) setShowLoginPrompt(false);
    });
    return () => unsubscribe();
  }, []);

  // Xử lý Popup đăng nhập Google
  const handleGoogleLogin = async () => {
    try { 
      await signInWithPopup(auth, googleProvider); 
    } catch (error: any) { 
      console.error("Lỗi đăng nhập:", error); 
      if (error.code === 'auth/popup-blocked') {
         alert("Trình duyệt đang chặn cửa sổ đăng nhập. Vui lòng cấp quyền để tiếp tục.");
      } else if (error.code !== 'auth/popup-closed-by-user' && error.code !== 'auth/cancelled-popup-request') {
         alert("LỖI BẢO MẬT TRÌNH DUYỆT: Vui lòng mở bằng trình duyệt (Chrome/Safari) để đăng nhập Google!");
      }
    } 
  };

  // Hàm bảo vệ: Thay thế alert bằng Modal UI
  const requireLogin = (action: () => void) => {
    if (!auth.currentUser) {
        setShowLoginPrompt(true); // Hiển thị Modal Giao diện đẹp
        return;
    }
    action();
  };

  useEffect(() => { (window as any).isDocReviewing = step === 'analyzing' || (step === 'review' && errors.some(e => e.status === 'pending')); return () => { (window as any).isDocReviewing = false; }; }, [step, errors]);
  useEffect(() => { const handleBeforeUnload = (e: BeforeUnloadEvent) => { if ((window as any).isDocReviewing) { e.preventDefault(); e.returnValue = ''; } }; window.addEventListener('beforeunload', handleBeforeUnload); return () => window.removeEventListener('beforeunload', handleBeforeUnload); }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (file) { setSelectedFileName(file.name); setSelectedFile(file); } };
  const removeSelectedFile = () => { setSelectedFileName(''); setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; };

  // ============================================================================
  // 1. RÀ SOÁT AI - ĐÃ CẤM ẢO GIÁC DẤU CHẤM CÂU
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
          const prompt = `Bạn là Chuyên gia ngôn ngữ và Thể thức văn bản hành chính Việt Nam. Hãy rà soát văn bản và trả về JSON mảng các lỗi.
          QUY TẮC BẮT LỖI NGHIÊM NGẶT:
          1. DẤU CÂU & KHOẢNG TRẮNG: Phát hiện lỗi thừa khoảng trắng giữa các từ; thiếu dấu chấm ở cuối câu/đoạn; dấu phẩy/chấm không đặt sát từ liền trước. Để bắt lỗi khoảng trắng, trường 'original' phải trích xuất chính xác các từ và khoảng trắng bị thừa.
          2. VIẾT HOA DANH TỪ RIÊNG: Bắt buộc sửa lỗi không viết hoa tên cơ quan, tổ chức, chức danh (Ví dụ: "quốc hội" -> "Quốc hội", "thủ tướng Chính phủ" -> "Thủ tướng Chính phủ", "nhà nước" -> "Nhà nước").
          3. VIẾT HOA THEO PHÉP ĐẶT CÂU: Bắt lỗi không viết hoa chữ cái đầu tiên của câu (sau dấu chấm, chấm hỏi, chấm than hoặc đầu dòng).
          4. CHÍNH TẢ NGỮ CẢNH: Phân tích ngữ cảnh để bắt lỗi phát âm vùng miền (ch/tr, s/x, l/n, r/d/gi). BẮT BUỘC phát hiện các từ sai ngữ nghĩa như "tròn chĩnh" -> "tròn trĩnh", "chập chùng" -> "chập trùng", "suất sắc" -> "xuất sắc".
          5. NGOẠI LỆ: KHÔNG báo lỗi với các từ có cách đặt dấu thanh khác nhau (ví dụ: "hóa" và "hoá" đều đúng). KHÔNG báo lỗi nếu từ đề xuất giống hệt từ gốc.

          YÊU CẦU ĐẦU RA (Đúng chuẩn JSON Mảng):
          [ { "original": "cụm từ sai", "suggestion": "cụm từ đúng", "type": "chinh-ta", "description": "Nêu rõ lỗi theo quy tắc" } ]
          
          ĐOẠN VĂN: ${chunks[i]}`;
          try {
              const result = await model.generateContent(prompt);
              let rawJson = result.response.text().replace(/```json/gi, '').replace(/```/g, '').trim();
              rawJson = rawJson.replace(/,\s*([\]}])/g, '$1'); if (!rawJson.endsWith(']')) rawJson += ']';
              const parsedData = JSON.parse(rawJson);
              let chunkErrors = (Array.isArray(parsedData) ? parsedData : (parsedData.errors || [])).filter((err: any) => {
                  const o = (err.original || "").trim(); const s = (err.suggestion || "").trim();
                  return o.length > 1 && o !== s && o.normalize('NFC').toLowerCase() !== s.normalize('NFC').toLowerCase();
              });
              allErrors = [...allErrors, ...chunkErrors];
              if (i < chunks.length - 1) await new Promise(res => setTimeout(res, 4000));
          } catch (e) { if (e?.toString().includes("429")) { isQuotaExceeded = true; break; } }
      }
      const unique = Array.from(new Set(allErrors.map(e => e.original))).map(orig => allErrors.find(e => e.original === orig)).filter(e => e && e.original.length > 0);
      setErrors(unique.map((err: any, idx: number) => ({ ...err, id: `ai_${idx}`, status: 'pending' }))); setStep('review');
    } catch (e) { alert("Lỗi mạng."); setStep('upload'); }
  };

  // ============================================================================
  // 2. RÀ SOÁT OFFLINE - ĐÃ FIX DẤU CHẤM CÂU VÀ LOẠI BỎ TIÊU ĐỀ
  // ============================================================================
  const runOfflineReview = (text: string) => {
    setStep('analyzing'); setProgress({ current: 1, total: 1 });
    setTimeout(() => {
      let foundErrors: TextError[] = []; let errCount = 0;

      // A. KIỂM TRA THIẾU DẤU KẾT THÚC CÂU (Đã bổ sung loại trừ cụm từ tiêu đề đặc thù)
      const lines = text.split(/\r?\n/);
      lines.forEach((line) => {
          const trimmed = line.trim();
          if (trimmed.length < 5) return;

          const isUpperCase = trimmed === trimmed.toUpperCase();
          const isListMarker = /^([IVXLCDM]+|[0-9]+(\.[0-9]+)*|[a-zđA-ZĐ])\s*[.)]|[-+]/.test(trimmed);
          const isLegalHeading = /^(Điều|Khoản|Điểm|Phần|Chương|Mục)\s+([0-9IVX]+|thứ\s+(nhất|hai|ba|tư|năm|sáu|bảy|tám|chín|mười))/i.test(trimmed);
          
          // Bộ lọc nhận diện các từ khóa tiêu đề (Không phân biệt chữ hoa, chữ thường)
          const isCustomHeading = /^(Mở đầu|Tóm tắt|Kết luận|Khuyến nghị|Kiến nghị)/i.test(trimmed);

          // Nếu dòng chứa các từ khóa tiêu đề trên và độ dài ngắn (dưới 150 ký tự) -> Bỏ qua, không bắt lỗi thiếu dấu chấm
          if ((isUpperCase || isListMarker || isLegalHeading || isCustomHeading) && trimmed.length < 150) {
              return;
          }

          const lastChar = trimmed.slice(-1);
          if (!/[.?!:;]/.test(lastChar)) {
              const words = trimmed.split(/\s+/);
              const anchor = words[words.length - 1];
              if (anchor) {
                  foundErrors.push({ id: `off_p_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`, original: anchor, suggestion: anchor + ".", type: 'the-thuc', description: "Thiếu dấu chấm kết thúc đoạn/câu.", status: 'pending' });
              }
          }
      });

      // B. CÁC QUY TẮC KỸ THUẬT VÀ CHÍNH TẢ CỨNG (Tổng hợp đầy đủ)
      const regexRules = [
        // 1. QUY TẮC ĐẶT CÂU: Bắt lỗi không viết hoa chữ cái đầu tiên sau dấu chấm, chấm hỏi, chấm than hoặc đầu dòng
        { 
          regex: /(^|[.?!]\s+)([\p{Ll}])([\p{L}\p{M}]*)/gum, 
          suggestion: (m: any, p1: string, p2: string, p3: string) => p1 + p2.toUpperCase() + p3, 
          desc: "Chưa viết hoa chữ cái đầu câu." 
        },

        // 2. QUY TẮC CHÍNH TẢ CỨNG (Lưới lọc siêu cường cho 100% nguyên âm tiếng Việt)
        { regex: /(?<![\p{L}\p{M}])([kK])([aáàảãạăắằẳẵặâấầẩẫậoóòỏõọôốồổỗộơớờởỡợuúùủũụưứừửữự][\p{L}\p{M}]*)/gui, suggestion: (m: any, p1: string, p2: string) => (p1 === p1.toUpperCase() ? 'C' : 'c') + p2, desc: "Sai luật: 'k' không ghép với a, o, u..." },
        { regex: /(?<![\p{L}\p{M}])([cC])([iíìỉĩịeéèẻẽẹêếềểễệyýỳỷỹỵ][\p{L}\p{M}]*)/gui, suggestion: (m: any, p1: string, p2: string) => (p1 === p1.toUpperCase() ? 'K' : 'k') + p2, desc: "Sai luật: 'c' không ghép với i, e, ê, y." },
        { regex: /(?<![\p{L}\p{M}])(Ngh|ngh|NGH)([aáàảãạăắằẳẵặâấầẩẫậoóòỏõọôốồổỗộơớờởỡợuúùủũụưứừửữự][\p{L}\p{M}]*)/gui, suggestion: (m: any, p1: string, p2: string) => (p1 === p1.toUpperCase() ? 'NG' : (p1.charAt(0) === p1.charAt(0).toUpperCase() ? 'Ng' : 'ng')) + p2, desc: "Sai luật: 'ngh' không ghép với a, o, u..." },
        { regex: /(?<![\p{L}\p{M}])(Gh|gh|GH)([aáàảãạăắằẳẵặâấầẩẫậoóòỏõọôốồổỗộơớờởỡợuúùủũụưứừửữự][\p{L}\p{M}]*)/gui, suggestion: (m: any, p1: string, p2: string) => (p1.charAt(0) === p1.charAt(0).toUpperCase() ? 'G' : 'g') + p2, desc: "Sai luật: 'gh' không ghép với a, o, u..." },
        { regex: /(?<![\p{L}\p{M}])(Tr|tr|TR)(o[aáàảãạăắằẳẵặeéèẻẽẹ][\p{L}\p{M}]*|u[êếềểễệ][\p{L}\p{M}]*)/gui, suggestion: (m: any, p1: string, p2: string) => (p1 === p1.toUpperCase() ? 'CH' : (p1.charAt(0) === p1.charAt(0).toUpperCase() ? 'Ch' : 'ch')) + p2, desc: "Sai luật: 'tr' không ghép với oa, oă, oe, uê." },
        { regex: /(?<![\p{L}\p{M}])([sS])(o[aáàảãạăắằẳẵặeéèẻẽẹ][\p{L}\p{M}]*|u[êếềểễệâấầẩẫậ][\p{L}\p{M}]*)/gui, exclude: ["soát", "soạt", "soạng", "soạn", "suất"], suggestion: (m: any, p1: string, p2: string) => (p1 === p1.toUpperCase() ? 'X' : 'x') + p2, desc: "Sai luật: 's' không ghép với oa, oă, oe, uê, uâ." },
        { regex: /(?<![\p{L}\p{M}])([nN])(o[aáàảãạeéèẻẽẹ][\p{L}\p{M}]*|u[âấầẩẫậyýỳỷỹỵ][\p{L}\p{M}]*)/gui, exclude: ["noãn", "noa"], suggestion: (m: any, p1: string, p2: string) => (p1 === p1.toUpperCase() ? 'L' : 'l') + p2, desc: "Sai luật: 'n' không ghép với oa, oe, uâ, uy." },
        { regex: /(?<![\p{L}\p{M}])(Gi|gi|GI|R|r)(o[aáàảãạeéèẻẽẹ][\p{L}\p{M}]*|u[êếềểễệyýỳỷỹỵ][\p{L}\p{M}]*)/gui, suggestion: (m: any, p1: string, p2: string) => (p1.charAt(0) === p1.charAt(0).toUpperCase() ? 'D' : 'd') + p2, desc: "Sai luật: 'r' hoặc 'gi' không ghép với oa, oe, uê, uy." },

        // 3. CÁC QUY TẮC KỸ THUẬT VÀ THỂ THỨC (Giữ nguyên các tính năng cũ đã chuẩn hóa)
        { regex: /;([ \t]+)([\p{Lu}][\p{Ll}\p{M}]*)/gu, suggestion: (m: any, p1: string, p2: string) => ";" + p1 + p2.toLowerCase(), desc: "Không viết hoa sau dấu chấm phẩy." },
        { regex: /:([ \t]+)([\p{Lu}][\p{Ll}\p{M}]*)/gu, suggestion: (m: any, p1: string, p2: string) => ":" + p1 + p2.toLowerCase(), desc: "Đề nghị xem lại viết hoa sau dấu hai chấm." },
        { regex: /(^|[^\p{L}\p{M}])([\p{L}\p{M}]+)\s+\2(?=[^\p{L}\p{M}]|$)/gui, suggestion: (m: any, p1: string, p2: string) => p1 + p2, exclude: ["luôn luôn", "nhè nhẹ", "ào ào", "rào rào", "song song", "dần dần", "từ từ", "mãi mãi", "đùng đùng", "rành rành", "mặt mặt", "ngành ngành"], desc: "Lỗi lặp từ." },
        { regex: /[ \t]+([.,;:!?])/g, suggestion: "$1", desc: "Dấu câu sát chữ trước." },
        { regex: /([.,;:!?])(?=[\p{L}\p{M}])/gu, suggestion: "$1 ", desc: "Khoảng trắng sau dấu câu." },
        { regex: /([(\["'])[ \t]+/g, suggestion: "$1", desc: "Mở ngoặc sát chữ sau." },
        { regex: /[ \t]+([)\]"'])/g, suggestion: "$1", desc: "Đóng ngoặc sát chữ trước." },
        { regex: /([^\s]+)[ \t]{2,}([^\s]+)/g, suggestion: "$1 $2", desc: "Thừa khoảng trắng giữa các từ." },
        { regex: /(?<![\p{L}\p{M}])([\p{L}\p{M}]*?)([bcdđghklmnpqrstvx])\2+([\p{L}\p{M}]*)(?![\p{L}\p{M}])/gui, suggestion: (m: any, p1: string, p2: string, p3: string) => p1 + p2 + p3, desc: "Thừa ký tự phụ âm (kẹt phím)." },
        { regex: / Khoản /g, suggestion: " khoản ", desc: "Không viết hoa chữ 'khoản'." },
        { regex: / Điểm /g, suggestion: " điểm ", desc: "Không viết hoa chữ 'điểm'." }
      ];

      regexRules.forEach(rule => {
        let m; const r = new RegExp(rule.regex.source, rule.regex.flags);
        while ((m = r.exec(text)) !== null) {
          if (rule.exclude && rule.exclude.includes(m[0].toLowerCase().trim())) continue;
          
          if (rule.desc.includes("kẹt phím")) {
              const w = m[0].trim();
              if (w === w.toUpperCase()) continue; 
              if (["ttr", "ttg", "skill", "skills", "bill", "will"].includes(w.toLowerCase())) continue; 
          }

          let s = typeof rule.suggestion === 'function' ? rule.suggestion(m, m[1], m[2], m[3], m[4]) : m[0].replace(new RegExp(rule.regex.source, rule.regex.flags.replace('g','')), rule.suggestion);
          if (m[0] !== s) foundErrors.push({ id: `off_${errCount++}`, original: m[0], suggestion: s, type: 'the-thuc', description: rule.desc, status: 'pending' });
        }
      });

      // C. QUÉT TỪ ĐIỂN JSON (Đã tích hợp hỗ trợ đa cấu trúc JSON và chuẩn hóa Unicode)
      const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      [...hoaTuDien, ...chinhTaTuDien].forEach(item => {
        // Hỗ trợ tự động nhận diện cả 2 định dạng file JSON:
        // Dạng 1 (hoa_tu_dien.json): { original: "...", suggestion: "..." }
        // Dạng 2 (chinh_ta_tu_dien.json): { wrong: ["...", "..."], right: "..." }
        let wrongWords: string[] = [];
        let rightWord = "";

        if (item.original && item.suggestion) {
            wrongWords = [item.original];
            rightWord = item.suggestion;
        } else if (item.wrong && Array.isArray(item.wrong) && item.right) {
            wrongWords = item.wrong;
            rightWord = item.right;
        } else {
            return; // Bỏ qua nếu item không khớp định dạng nào
        }

        wrongWords.forEach((w: string) => {
          const r = new RegExp(`(?<![\\p{L}\\p{M}])(${escape(w)})(?![\\p{L}\\p{M}])`, 'gui');
          let m;
          while ((m = r.exec(text)) !== null) {
            const textWord = m[0].normalize('NFC');
            const dictWord = rightWord.normalize('NFC');

            // Nếu từ trong văn bản đã khớp hoàn toàn (cả chữ hoa/thường) với từ đúng thì bỏ qua
            if (textWord === dictWord) continue; 
            
            foundErrors.push({ id: `off_d_${errCount++}`, original: m[0], suggestion: rightWord, type: 'chinh-ta', description: item.desc || "Sai quy chuẩn/chính tả.", status: 'pending' });
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
  // 3. HIỂN THỊ VĂN BẢN (KHÓA CHẶT HIGHLIGHT CHỐNG LẪN LỘN NGÀNH/NGÀN)
  // ============================================================================
  const escapeUI = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  
  const renderDocumentText = () => {
    let html = documentText;
    const sorted = [...errors].sort((a, b) => (b.original || "").length - (a.original || "").length);
    
    sorted.forEach(err => {
      if (!err.original) return;
      
      // THUẬT TOÁN THÔNG MINH: Kiểm tra xem từ bị lỗi có bắt đầu/kết thúc bằng chữ không
      // Nếu là khoảng trắng (  ) hoặc dấu câu (; Miễn), hệ thống sẽ gỡ bỏ rào chắn \p{L} để bôi màu chính xác
      const startsWithLetter = /^[\p{L}\p{M}]/u.test(err.original);
      const endsWithLetter = /[\p{L}\p{M}]$/u.test(err.original);

      const prefix = startsWithLetter ? `(?<!\\p{L}|\\p{M})` : ``;
      const suffix = endsWithLetter ? `(?!\\p{L}|\\p{M})` : ``;

      let regexStr = `${prefix}${escapeUI(err.original)}${suffix}(?![^<]*>)`;

      if (err.description === "Thiếu dấu chấm kết thúc đoạn/câu.") {
         regexStr = `${prefix}${escapeUI(err.original)}(?=\\s*(?:\\r?\\n|$))`;
      }

      const r = new RegExp(regexStr, 'gu');
      
      if (err.status === 'pending') {
        const span = `<span id="text-error-${err.id}" class="bg-rose-500/20 rounded-sm transition-all ${activeErrorId === err.id ? 'ring-1 ring-rose-500 bg-rose-500/40' : 'hover:bg-rose-500/40 cursor-pointer'}" data-id="${err.id}">$&</span>`;
        html = html.replace(r, span);
      } else if (err.status === 'fixed') {
        html = html.replace(r, `<span class="bg-emerald-500/20 text-emerald-400 rounded-sm">${err.suggestion}</span>`);
      }
    });

    return <div dangerouslySetInnerHTML={{ __html: html.split('\n').join('<br/>') }} onClick={(e) => { const t = e.target as HTMLElement; if (t.tagName === 'SPAN' && t.dataset.id) { setActiveErrorId(t.dataset.id); setTimeout(() => { document.getElementById(`error-card-${t.dataset.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 300); } }} />;
  };

  const getFinalText = () => {
    let f = documentText;
    // Sắp xếp ưu tiên sửa các lỗi có chuỗi dài trước để chống đè chéo cấu trúc văn bản
    const sorted = [...errors].sort((a, b) => (b.original || "").length - (a.original || "").length);
    
    sorted.forEach(err => {
      if (err.status === 'fixed' && err.original) {
        // Thuật toán thông minh tự động nhận diện rào chắn chữ cái
        const startsWithLetter = /^[\p{L}\p{M}]/u.test(err.original);
        const endsWithLetter = /[\p{L}\p{M}]$/u.test(err.original);

        const prefix = startsWithLetter ? `(?<!\\p{L}|\\p{M})` : ``;
        const suffix = endsWithLetter ? `(?!\\p{L}|\\p{M})` : ``;

        let regexStr = `${prefix}${escapeUI(err.original)}${suffix}`;

        // BẢO VỆ NGHIÊM NGẶT: Nếu là lỗi thiếu dấu chấm, CHỈ ĐƯỢC PHÉP thay thế từ đó ở cuối câu/đoạn
        if (err.description === "Thiếu dấu chấm kết thúc đoạn/câu.") {
           regexStr = `${prefix}${escapeUI(err.original)}(?=\\s*(?:\\r?\\n|$))`;
        }

        // Thực hiện thay thế an toàn theo ngữ cảnh vị trí lỗi
        f = f.replace(new RegExp(regexStr, 'gu'), err.suggestion);
      }
    });
    return f;
  };

  const copyToClipboard = () => navigator.clipboard.writeText(getFinalText()).then(() => alert("Đã copy!"));

  const exportToWord = () => {
    const text = getFinalText();
    // Tách văn bản thành mảng các dòng dựa trên dấu xuống dòng để bảo toàn cấu trúc đoạn
    const lines = text.split(/\r?\n/);
    
    // Chuyển đổi từng dòng văn bản thành một thực thể Paragraph trong cấu trúc Word
    const paragraphs = lines.map(line => {
      return new Paragraph({
        children: [
          new TextRun({
            text: line,
            font: "Times New Roman", // Thiết lập font chữ chuẩn hành chính công vụ
            size: 28, // Tương đương cỡ chữ 14pt tiêu chuẩn trong Microsoft Word
          }),
        ],
      });
    });

    // Khởi tạo cấu trúc tài liệu Word nén chuẩn OpenXML
    const doc = new Document({
      sections: [
        {
          properties: {},
          children: paragraphs,
        },
      ],
    });

    // Đóng gói cấu trúc dữ liệu thành file định dạng mã nhị phân Blob và thực hiện tải xuống
    Packer.toBlob(doc).then((blob) => {
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `Vanban_da_sua.docx`; // Định dạng xuất ra chuẩn đuôi mở rộng .docx
      link.click();
    }).catch(err => {
      console.error("Lỗi xuất file docx:", err);
      alert("Có lỗi xảy ra trong quá trình đóng gói cấu trúc tệp .docx");
    });
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
                    <button onClick={() => requireLogin(() => setInputType('paste'))} className={`flex-1 py-2 text-xs font-bold rounded ${inputType === 'paste' ? 'bg-sky-600 text-white' : 'text-slate-400'}`}>Dán văn bản</button>
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
                        <div onClick={() => requireLogin(() => fileInputRef.current?.click())} className="border-2 border-dashed border-slate-600 rounded-xl p-8 text-center cursor-pointer bg-[#05070a] hover:border-sky-500 transition-colors">
                           <input type="file" accept=".docx" ref={fileInputRef} onChange={handleFileSelect} className="hidden" />
                           <UploadCloud size={40} className="mx-auto text-slate-500 mb-2" />
                           <p className="text-xs text-slate-400 font-bold uppercase">Click chọn file .docx</p>
                        </div>
                    )
                 ) : ( <textarea value={pasteText} onChange={e => setPasteText(e.target.value)} placeholder="Dán nội dung..." className="w-full h-40 bg-[#05070a] border border-slate-600 rounded-xl p-4 text-slate-200 text-sm focus:outline-none custom-scrollbar" /> )}
              </div>
              <div className="space-y-4">
                 <h3 className="text-lg font-bold text-emerald-400 flex items-center gap-2 uppercase"><ShieldCheck size={18}/> 2. Rà soát</h3>
                 <p className="text-xs text-slate-400 mb-4">Đã nâng cấp thuật toán Highlight chống xô lệch cụm từ.</p>
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
                        onClick={() => { setActiveErrorId(err.id); setTimeout(() => { document.getElementById(`text-error-${err.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 300); }}
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

      {/* HIỂN THỊ MODAL ĐĂNG NHẬP (UI giống Lịch Vạn Niên) */}
      <AnimatePresence>
        {showLoginPrompt && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
             <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className="bg-[#0f172a] border border-sky-500/50 rounded-2xl p-8 max-w-sm w-full shadow-[0_0_50px_rgba(56,189,248,0.2)] text-center relative overflow-hidden">
                <div className="w-16 h-16 bg-sky-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                   <ShieldCheck className="text-sky-400" size={32} />
                </div>
                <h3 className="text-xl font-bold text-white mb-2 font-sans">Đăng nhập để rà soát kỹ</h3>
                <p className="text-slate-400 text-sm mb-8 font-sans">Bạn đăng nhập bằng tài khoản Google để sử dụng miễn phí tính năng AI nâng cao này.</p>
                <div className="flex flex-col gap-3 font-sans">
                  <button onClick={handleGoogleLogin} className="w-full py-3 bg-sky-600 text-white font-bold rounded-lg hover:scale-105 transition-transform flex justify-center items-center gap-2 shadow-lg shadow-sky-900/20">
                    <img src="https://www.google.com/favicon.ico" alt="G" className="w-4 h-4" /> Đăng nhập bằng Google
                  </button>
                  <button onClick={() => setShowLoginPrompt(false)} className="w-full py-3 bg-[#1e293b] text-slate-300 font-bold rounded-lg hover:bg-slate-800 transition-colors">
                    Hủy bỏ
                  </button>
                </div>
             </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
