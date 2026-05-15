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
  // ĐỘNG CƠ RÀ SOÁT AI TOÀN DIỆN - THUẬT TOÁN CẮT TỪ THÔNG MINH & BỘ LỌC UNICODE
  // ============================================================================
  const runAIReview = async (fullText: string) => {
    if (!GEMINI_API_KEY) return alert("Lỗi: Không tìm thấy API Key!");
    setStep('analyzing');
    
    // THUẬT TOÁN CẮT ĐOẠN THÔNG MINH (Không chém đứt ngang từ)
    const CHUNK_SIZE = 15000; 
    const chunks: string[] = [];
    let currentIndex = 0;

    while (currentIndex < fullText.length) {
        let nextIndex = currentIndex + CHUNK_SIZE;
        if (nextIndex < fullText.length) {
            let lastSpace = fullText.lastIndexOf(' ', nextIndex);
            let lastNewline = fullText.lastIndexOf('\n', nextIndex);
            let bestBreak = Math.max(lastSpace, lastNewline);
            if (bestBreak > currentIndex + (CHUNK_SIZE / 2)) {
                nextIndex = bestBreak;
            }
        }
        chunks.push(fullText.substring(currentIndex, nextIndex));
        currentIndex = nextIndex;
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
          
          const prompt = `Bạn là Chuyên gia Rà soát Văn bản Hành chính Việt Nam.

          QUY TẮC BẮT LỖI NGHIÊM NGẶT (KHÔNG ĐƯỢC VI PHẠM):
          1. DẤU THANH (QUAN TRỌNG NHẤT): Tiếng Việt có nhiều bảng mã gõ chữ. TUYỆT ĐỐI BỎ QUA nếu từ gốc đọc lên vẫn đúng nghĩa và không sai dấu rành rành. Không tự ý báo thiếu dấu khi từ đã có dấu.
          2. CỤM TỪ ĐÚNG: Các cụm từ như "chức năng", "nhiệm vụ", "tập trung", "hệ thống", "tổ chức", "theo quy định", "theo chỉ đạo", "theo đề nghị",v.v... tuyệt đối không được báo lỗi thiếu từ hay tự ý đề xuất cụm từ khác nếu nó đang hợp lý.
          3. KHOẢNG TRẮNG: KHÔNG BỎ QUA các lỗi về khoảng trắng giữa các từ.
          4. BỎ QUA: Lỗi gạch đầu dòng
          5. TUÂN THỦ NGHIÊM NGẶT NGHỊ ĐỊNH 30/2020, ví dụ như: 
             - KHÔNG viết hoa các chữ "khoản", "điểm" giữa câu.
             - VIẾT HOA các chữ: "Luật", "Nghị định", "Nghị quyết", "Điều".

          YÊU CẦU ĐẦU RA: Trả về MẢNG JSON hợp lệ. Chỉ báo lỗi khi CHẮC CHẮN sai chính tả (sai ch/tr, s/x, l/n, thiếu/thừa ký tự làm vô nghĩa).
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
              
              // BỘ LỌC CỨNG: ÉP CHUẨN UNICODE NFC ĐỂ LOẠI BỎ LỖI DẤU THANH ẢO GIÁC
              chunkErrors = chunkErrors.filter((err: any) => {
                  const orig = (err.original || "").toString().trim();
                  const sugg = (err.suggestion || "").toString().trim();
                  
                  if (!orig || orig.length < 2) return false; // Bỏ qua nếu lỗi chỉ là 1 dấu câu/chữ cái
                  
                  // Chuyển về cùng 1 hệ mã Unicode NFC để so sánh
                  const origNorm = orig.normalize('NFC').toLowerCase();
                  const suggNorm = sugg.normalize('NFC').toLowerCase();
                  
                  // Bỏ qua nếu sau khi chuẩn hóa, từ gốc và từ đề xuất giống hệt nhau
                  if (origNorm === suggNorm) return false;
                  
                  return true;
              });

              allErrors = [...allErrors, ...chunkErrors];
              
              if (i < chunks.length - 1) {
                  await new Promise(resolve => setTimeout(resolve, 4000)); // Nghỉ 4s tránh quá tải API
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
          alert("CẢNH BÁO: Giới hạn API (Lỗi 429). Hệ thống đã lưu lại các lỗi ở những phần đầu tiên. Vui lòng rà soát phần còn lại sau.");
      }

      const uniqueErrors = Array.from(new Set(allErrors.map(e => e.original)))
          .map(original => allErrors.find(e => e.original === original))
          .filter(e => e && e.original.length > 0);

      setErrors(uniqueErrors.map((err: any, idx: number) => ({ ...err, id: `ai_${idx}`, status: 'pending' })));
      setStep('review');

    } catch (error) {
      alert(`Lỗi kết nối mạng hoặc phân tích. Hãy thử lại.`);
      setStep('upload');
    }
  };

  // ============================================================================
  // ĐỘNG CƠ RÀ SOÁT CHÍNH TẢ (OFFLINE REGEX ENGINE) - CHUẨN HÓA TOÀN DIỆN
  // ============================================================================
  const runOfflineReview = (text: string) => {
    setStep('analyzing'); setProgress({ current: 1, total: 1 });
    
    setTimeout(() => {
      let foundErrors: TextError[] = [];
      let errCount = 0;
      
      // Tập hợp các kí tự tiếng Việt
      const vn = "a-zàáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ";
      const vnUpper = "A-ZÀÁẢÃẠĂẰẮẲẴẶÂẦẤẨẪẬÈÉẺẼẸÊỀẾỂỄỆÌÍỈĨỊÒÓỎÕỌÔỒỐỔỖỘƠỜỚỞỠỢÙÚỦŨỤƯỪỨỬỮỰỲÝỶỸỴĐ";

      const rules = [
        // ==========================================
        // I. QUY TẮC VIẾT HOA
        // ==========================================
        {
            // Viết hoa chữ cái đầu âm tiết thứ nhất của câu (Sau . ? ! và xuống dòng)
            regex: new RegExp(`(?:^|[.?!]\\s+)([${vn}])`, 'g'),
            suggestion: (match: any) => match[0].replace(match[1], match[1].toUpperCase()),
            desc: "Quy tắc viết hoa (I.1): Viết hoa chữ cái đầu âm tiết thứ nhất của một câu hoàn chỉnh (sau dấu chấm, hỏi, chấm than, xuống dòng)."
        },
        { regex: /\b(thủ đô hà nội)\b/gi, suggestion: "Thủ đô Hà Nội", desc: "Quy tắc viết hoa (I.3.1.c): Trường hợp viết hoa đặc biệt." },
        { regex: /\b(thành phố hồ chí minh)\b/gi, suggestion: "Thành phố Hồ Chí Minh", desc: "Quy tắc viết hoa (I.3.1.c): Trường hợp viết hoa đặc biệt." },
        { regex: /\b(ban chấp hành trung ương đảng cộng sản việt nam)\b/gi, suggestion: "Ban Chấp hành Trung ương Đảng Cộng sản Việt Nam", desc: "Quy tắc viết hoa (I.4.1.b): Viết hoa tên cơ quan đặc biệt." },
        { regex: /\b(văn phòng trung ương đảng)\b/gi, suggestion: "Văn phòng Trung ương Đảng", desc: "Quy tắc viết hoa (I.4.1.b): Viết hoa tên cơ quan đặc biệt." },
        { regex: /\b(đảng cộng sản việt nam)\b/gi, suggestion: "Đảng Cộng sản Việt Nam", desc: "Quy tắc viết hoa (I.4.1): Tên cơ quan, tổ chức." },
        { regex: /\b(ngày quốc khánh 2-9|ngày quốc khánh 2\/9)\b/gi, suggestion: "ngày Quốc khánh 2-9", desc: "Quy tắc viết hoa (I.5.5): Viết hoa tên các ngày lễ, kỷ niệm." },
        { regex: /\b(ngày quốc tế lao động 1-5|ngày quốc tế lao động 1\/5)\b/gi, suggestion: "ngày Quốc tế Lao động 1-5", desc: "Quy tắc viết hoa (I.5.5): Viết hoa tên các ngày lễ, kỷ niệm." },
        { regex: /\b(ngày phụ nữ việt nam 20-10|ngày phụ nữ việt nam 20\/10)\b/gi, suggestion: "ngày Phụ nữ Việt Nam 20-10", desc: "Quy tắc viết hoa (I.5.5): Viết hoa tên các ngày lễ, kỷ niệm." },
        { regex: /\b(tết nguyên đán)\b/gi, suggestion: "tết Nguyên đán", desc: "Quy tắc viết hoa (I.5.8.b): Tên các ngày tết." },
        { regex: /\b(tết đoan ngọ)\b/gi, suggestion: "tết Đoan ngọ", desc: "Quy tắc viết hoa (I.5.8.b): Tên các ngày tết." },
        { regex: /\b(tết trung thu)\b/gi, suggestion: "tết Trung thu", desc: "Quy tắc viết hoa (I.5.8.b): Tên các ngày tết." },
        
        // ==========================================
        // II. QUY TẮC CHÍNH TẢ DO MỘT ÂM NHIỀU CÁCH VIẾT
        // ==========================================
        {
            // 2.2. l / n
            regex: new RegExp(`\\bn(oà|oá|oả|oã|oạ|oa|oè|oé|oẻ|oẽ|oẹ|oe|uầ|uấ|uẩ|uẫ|uậ|uâ|uỳ|uý|uỷ|uỹ|uỵ|uy)([${vn}]*)\\b`, 'gi'),
            exclude: ["noãn", "noa"],
            suggestion: "l$1$2",
            desc: "Quy tắc chính tả (II.2.2): Chữ 'n' không đứng đầu các tiếng có vần có âm đệm (oa, oe, uâ, uy) trừ 'noãn', 'noa'."
        },
        {
            // 2.3. ch / tr
            regex: new RegExp(`\\btr(oà|oá|oả|oã|oạ|oa|oằ|oắ|oẳ|oẵ|oặ|oă|oè|oé|oẻ|oẽ|oẹ|oe|uề|uế|uể|uễ|uệ|uê)([${vn}]*)\\b`, 'gi'),
            suggestion: "ch$1$2",
            desc: "Quy tắc chính tả (II.2.3): Chữ 'tr' không đứng đầu các tiếng có vần âm đệm (oa, oă, oe, uê)."
        },
        {
            // 2.4. s / x
            regex: new RegExp(`\\bs(oà|oá|oả|oã|oạ|oa|oằ|oắ|oẳ|oẵ|oặ|oă|oè|oé|oẻ|oẽ|oẹ|oe|uề|uế|uể|uễ|uệ|uê|uầ|uấ|uẩ|uẫ|uậ|uâ)([${vn}]*)\\b`, 'gi'),
            exclude: ["soát", "soạt", "soạng", "soạn", "suất"],
            suggestion: "x$1$2",
            desc: "Quy tắc chính tả (II.2.4): Chữ 's' không đứng đầu tiếng có âm đệm (oa, oă, oe, uê, uâ) trừ 'soát', 'soạt', 'soạng', 'soạn', 'suất'."
        },
        {
            // 2.5. r / d / gi
            regex: new RegExp(`\\b(r|gi)(oà|oá|oả|oã|oạ|oa|oè|oé|oẻ|oẽ|oẹ|oe|uề|uế|uể|uễ|uệ|uê|uỳ|uý|uỷ|uỹ|uỵ|uy)([${vn}]*)\\b`, 'gi'),
            suggestion: "d$2$3",
            desc: "Quy tắc chính tả (II.2.5): Chữ 'r' và 'gi' không đứng đầu các tiếng có vần có âm đệm (oa, oe, uê, uy)."
        },
        {
            // 2.6. c / k / q (k đứng trước a, o, u -> đổi thành c)
            regex: new RegExp(`\\bk(a|á|à|ả|ã|ạ|ă|ắ|ằ|ẳ|ẵ|ặ|â|ấ|ầ|ẩ|ẫ|ậ|o|ó|ò|ỏ|õ|ọ|ô|ố|ồ|ổ|ỗ|ộ|ơ|ớ|ờ|ở|ỡ|ợ|u|ú|ù|ủ|ũ|ụ|ư|ứ|ừ|ử|ữ|ự)([${vn}]*)\\b`, 'gi'),
            suggestion: "c$1$2",
            desc: "Quy tắc chính tả (II.2.6): Chữ 'k' chỉ đứng trước i, e, ê. Trước a, o, u... phải viết là 'c'."
        },
        {
            // 2.6. c / k / q (c đứng trước i, e, ê -> đổi thành k)
            regex: new RegExp(`\\bc(i|í|ì|ỉ|ĩ|ị|e|é|è|ẻ|ẽ|ẹ|ê|ế|ề|ể|ễ|ệ)([${vn}]*)\\b`, 'gi'),
            suggestion: "k$1$2",
            desc: "Quy tắc chính tả (II.2.6): Chữ 'c' không đứng trước i, e, ê. Phải viết là 'k'."
        },
        {
            // 2.6. c / k / q (q bắt buộc đi với u)
            regex: new RegExp(`\\bq(?!u)([${vn}]*)\\b`, 'gi'),
            suggestion: "qu$1",
            desc: "Quy tắc chính tả (II.2.6): Chữ 'q' bao giờ cũng đi với âm đệm 'u' thành 'qu'."
        },
        {
            // 2.7.1. ngh / gh (ng đứng trước i, e, ê -> đổi thành ngh)
            regex: new RegExp(`\\bng(i|í|ì|ỉ|ĩ|ị|e|é|è|ẻ|ẽ|ẹ|ê|ế|ề|ể|ễ|ệ)([${vn}]*)\\b`, 'gi'),
            suggestion: "ngh$1$2",
            desc: "Quy tắc chính tả (II.2.7.1): Phải dùng 'ngh' thay vì 'ng' khi đứng trước i, e, ê."
        },
        {
            // 2.7.1. ngh / gh (g đứng trước e, ê -> đổi thành gh)
            regex: new RegExp(`\\bg(e|é|è|ẻ|ẽ|ẹ|ê|ế|ề|ể|ễ|ệ)([${vn}]*)\\b`, 'gi'),
            suggestion: "gh$1$2",
            desc: "Quy tắc chính tả (II.2.7.1): Phải dùng 'gh' thay vì 'g' khi đứng trước e, ê."
        },
        {
            // 2.7.1. ngh / gh (ngh, gh đứng trước a, o, u -> đổi thành ng, g)
            regex: new RegExp(`\\b(ngh|gh)(a|á|à|ả|ã|ạ|ă|ắ|ằ|ẳ|ẵ|ặ|â|ấ|ầ|ẩ|ẫ|ậ|o|ó|ò|ỏ|õ|ọ|ô|ố|ồ|ổ|ỗ|ộ|ơ|ớ|ờ|ở|ỡ|ợ|u|ú|ù|ủ|ũ|ụ|ư|ứ|ừ|ử|ữ|ự)([${vn}]*)\\b`, 'gi'),
            suggestion: (match: any) => {
                const prefix = match[1].toLowerCase() === 'ngh' ? 'ng' : 'g';
                const isUpper = match[1] === match[1].toUpperCase();
                const isTitle = match[1][0] === match[1][0].toUpperCase();
                let newPrefix = prefix;
                if (isUpper) newPrefix = prefix.toUpperCase();
                else if (isTitle) newPrefix = prefix.charAt(0).toUpperCase() + prefix.slice(1);
                return match[0].replace(match[1], newPrefix);
            },
            desc: "Quy tắc chính tả (II.2.7.1): 'ngh', 'gh' không đứng trước a, o, u... Phải viết là 'ng', 'g'."
        },
        {
            // 2.7.2. gi + i
            regex: new RegExp(`\\bgii([${vn}]*)\\b`, 'gi'),
            suggestion: "gi$1",
            desc: "Quy tắc chính tả (II.2.7.2): Chữ cái 'gi' ghép với các vần có chữ 'i' đứng đầu thì bỏ một chữ 'i'."
        },

        // ==========================================
        // III. QUY TẮC ĐÁNH DẤU THANH (oa, oe, uê, uy)
        // ==========================================
        { regex: /óa/g, suggestion: "oá", desc: "Quy tắc dấu thanh (II.2.7.3): Vần 'oa' có 'o' là âm đệm, đánh dấu ở âm chính 'a'." },
        { regex: /òa/g, suggestion: "oà", desc: "Quy tắc dấu thanh (II.2.7.3): Vần 'oa' có 'o' là âm đệm, đánh dấu ở âm chính 'a'." },
        { regex: /ỏa/g, suggestion: "oả", desc: "Quy tắc dấu thanh (II.2.7.3): Vần 'oa' có 'o' là âm đệm, đánh dấu ở âm chính 'a'." },
        { regex: /õa/g, suggestion: "oã", desc: "Quy tắc dấu thanh (II.2.7.3): Vần 'oa' có 'o' là âm đệm, đánh dấu ở âm chính 'a'." },
        { regex: /ọa/g, suggestion: "oạ", desc: "Quy tắc dấu thanh (II.2.7.3): Vần 'oa' có 'o' là âm đệm, đánh dấu ở âm chính 'a'." },
        
        { regex: /óe/g, suggestion: "oé", desc: "Quy tắc dấu thanh (II.2.7.3): Vần 'oe' có 'o' là âm đệm, đánh dấu ở âm chính 'e'." },
        { regex: /òe/g, suggestion: "oè", desc: "Quy tắc dấu thanh (II.2.7.3): Vần 'oe' có 'o' là âm đệm, đánh dấu ở âm chính 'e'." },
        { regex: /ỏe/g, suggestion: "oẻ", desc: "Quy tắc dấu thanh (II.2.7.3): Vần 'oe' có 'o' là âm đệm, đánh dấu ở âm chính 'e'." },
        { regex: /õe/g, suggestion: "oẽ", desc: "Quy tắc dấu thanh (II.2.7.3): Vần 'oe' có 'o' là âm đệm, đánh dấu ở âm chính 'e'." },
        { regex: /ọe/g, suggestion: "oẹ", desc: "Quy tắc dấu thanh (II.2.7.3): Vần 'oe' có 'o' là âm đệm, đánh dấu ở âm chính 'e'." },

        { regex: /úy/g, suggestion: "uý", desc: "Quy tắc dấu thanh (II.2.7.3): Vần 'uy' có 'u' là âm đệm, đánh dấu ở âm chính 'y'." },
        { regex: /ùy/g, suggestion: "uỳ", desc: "Quy tắc dấu thanh (II.2.7.3): Vần 'uy' có 'u' là âm đệm, đánh dấu ở âm chính 'y'." },
        { regex: /ủy/g, suggestion: "uỷ", desc: "Quy tắc dấu thanh (II.2.7.3): Vần 'uy' có 'u' là âm đệm, đánh dấu ở âm chính 'y'." },
        { regex: /ũy/g, suggestion: "uỹ", desc: "Quy tắc dấu thanh (II.2.7.3): Vần 'uy' có 'u' là âm đệm, đánh dấu ở âm chính 'y'." },
        { regex: /ụy/g, suggestion: "uỵ", desc: "Quy tắc dấu thanh (II.2.7.3): Vần 'uy' có 'u' là âm đệm, đánh dấu ở âm chính 'y'." },
        
        { regex: /úê/g, suggestion: "uế", desc: "Quy tắc dấu thanh (II.2.7.3): Vần 'uê' có 'u' là âm đệm, đánh dấu ở âm chính 'ê'." },
        { regex: /ùê/g, suggestion: "uề", desc: "Quy tắc dấu thanh (II.2.7.3): Vần 'uê' có 'u' là âm đệm, đánh dấu ở âm chính 'ê'." },
        { regex: /ủê/g, suggestion: "uể", desc: "Quy tắc dấu thanh (II.2.7.3): Vần 'uê' có 'u' là âm đệm, đánh dấu ở âm chính 'ê'." },
        { regex: /ũê/g, suggestion: "uễ", desc: "Quy tắc dấu thanh (II.2.7.3): Vần 'uê' có 'u' là âm đệm, đánh dấu ở âm chính 'ê'." },
        { regex: /ụê/g, suggestion: "uệ", desc: "Quy tắc dấu thanh (II.2.7.3): Vần 'uê' có 'u' là âm đệm, đánh dấu ở âm chính 'ê'." }
      ];

      // ==========================================
        // IV. THUẬT TOÁN BẮT LỖI KỸ THUẬT GÕ PHÍM (TYPO)
        // ==========================================
        {
            // 1. Thuật toán bắt lỗi thừa phụ âm liền kề (Ví dụ: kinhh -> kinh, đđánh -> đánh)
            // Tiếng Việt không có từ nào chứa 2 phụ âm giống hệt nhau đi liền nhau trong 1 chữ.
            regex: /\b([a-zà-ỹ]*)(b{2,}|c{2,}|đ{2,}|d{2,}|g{2,}|h{2,}|k{2,}|l{2,}|m{2,}|n{2,}|p{2,}|q{2,}|r{2,}|s{2,}|t{2,}|v{2,}|x{2,})([a-zà-ỹ]*)\b/gi,
            suggestion: (match: any) => match[0].replace(/([bcdđghklmnpqrstvx])\1+/gi, '$1'),
            desc: "Lỗi đánh máy (Typo): Thừa ký tự phụ âm liền kề do kẹt phím hoặc gõ nhanh."
        },
        {
            // 2. Thuật toán bắt lỗi thừa nguyên âm vô lý (Ví dụ: giáa -> giá, tiềnn -> tiền)
            // Ngoại trừ các từ đặc biệt (xoong, boong, quần soóc, moóc), tiếng Việt không lặp nguyên âm ở cuối.
            regex: /\b([a-zà-ỹ]+)(a{2,}|ă{2,}|â{2,}|e{2,}|ê{2,}|i{2,}|ô{2,}|ơ{2,}|u{2,}|ư{2,}|y{2,})\b/gi,
            suggestion: (match: any) => match[0].replace(/([aăâeêioôơuưy])\1+$/gi, '$1'),
            desc: "Lỗi đánh máy (Typo): Thừa ký tự nguyên âm ở cuối từ."
        },

        // ==========================================
        // V. TỪ ĐIỂN CỤM TỪ HÀNH CHÍNH (N-GRAM DICTIONARY)
        // ==========================================
        // Bắt lỗi sai dấu thanh dựa trên cụm từ cố định (Context-based)
        { regex: /\b(đanh giá|đánh gia|đanh gia)\b/gi, suggestion: "đánh giá", desc: "Lỗi đánh máy: Sai/thiếu dấu thanh trong cụm từ 'đánh giá'." },
        { regex: /\b(phat triển|phát triên|phat trien)\b/gi, suggestion: "phát triển", desc: "Lỗi đánh máy: Sai/thiếu dấu thanh trong cụm từ 'phát triển'." },
        { regex: /\b(kinh tê|kính tế)\b/gi, suggestion: "kinh tế", desc: "Lỗi đánh máy: Sai/thiếu dấu thanh trong cụm từ 'kinh tế'." },
        { regex: /\b(ngiên cứu|nghiên cưu)\b/gi, suggestion: "nghiên cứu", desc: "Lỗi đánh máy: Sai chính tả/thiếu dấu thanh trong cụm từ 'nghiên cứu'." },
        { regex: /\b(quyêt định|quết định|quyet định)\b/gi, suggestion: "quyết định", desc: "Lỗi đánh máy: Sai/thiếu dấu thanh trong cụm từ 'quyết định'." },
        { regex: /\b(chuc năng|chức năngg)\b/gi, suggestion: "chức năng", desc: "Lỗi đánh máy: Sai dấu thanh hoặc thừa ký tự." },
        { regex: /\b(nhiêm vụ|nhiệm vu)\b/gi, suggestion: "nhiệm vụ", desc: "Lỗi đánh máy: Sai/thiếu dấu thanh trong cụm từ 'nhiệm vụ'." },
      
        // ==========================================
        // VI. QUY TẮC DẤU CÂU VÀ KHOẢNG TRẮNG
        // ==========================================
        {
            // Bắt lỗi: Có khoảng trắng TRƯỚC dấu câu (Ví dụ: "Hôm nay , tôi đi học .")
            regex: / +([.,;:!?])/g,
            suggestion: "$1",
            desc: "Kỹ thuật: Dấu câu phải đặt sát vào từ đứng trước nó, không được để khoảng trắng."
        },
        {
            // Bắt lỗi: Thiếu khoảng trắng SAU dấu câu (Chỉ áp dụng khi sau nó là chữ cái, để bảo vệ số thập phân như 3,14)
            regex: new RegExp(`([.,;:!?])([${vn}${vnUpper}])`, 'g'),
            suggestion: "$1 $2",
            desc: "Kỹ thuật: Phải có 1 khoảng trắng (space) sau các dấu câu (.,;:!?)."
        },
        {
            // Bắt lỗi: Thiếu khoảng trắng SAU dấu ba chấm (nếu sau nó là chữ cái)
            regex: new RegExp(`(…|\\.{3})([${vn}${vnUpper}])`, 'g'),
            suggestion: "$1 $2",
            desc: "Kỹ thuật: Phải có khoảng trắng sau dấu ba chấm (...)."
        },
        {
            // Bắt lỗi: Có khoảng trắng NGAY SAU dấu mở ngoặc hoặc mở nháy kép (Ví dụ: "( chữ" -> "(chữ")
            regex: /([(\["']) +/g,
            suggestion: "$1",
            desc: "Kỹ thuật: Dấu mở ngoặc/ngoặc kép phải đặt sát vào từ bên phải của nó."
        },
        {
            // Bắt lỗi: Có khoảng trắng NGAY TRƯỚC dấu đóng ngoặc hoặc đóng nháy kép (Ví dụ: "chữ )" -> "chữ)")
            regex: / +([)\]"'])/g,
            suggestion: "$1",
            desc: "Kỹ thuật: Dấu đóng ngoặc/ngoặc kép phải đặt sát vào từ bên trái của nó."
        },
        {
            // Bắt lỗi: Thừa nhiều khoảng trắng (>=2) giữa các từ (Lọc thông minh tránh hỏng định dạng lùi lề)
            regex: new RegExp(`([${vn}${vnUpper}0-9.,;:!?)\\]"']) {2,}([${vn}${vnUpper}0-9(\\["'])`, 'g'),
            suggestion: "$1 $2",
            desc: "Kỹ thuật: Chỉ sử dụng 1 khoảng trắng duy nhất giữa các từ."
        }
      
        // ĐỘNG CƠ DUYỆT VÀ THAY THẾ ĐỘNG (NÂNG CẤP)
      rules.forEach(rule => {
        let match; 
        // Phải tạo bản sao regex để tránh lỗi lastIndex khi dùng cờ /g
        const loopRegex = new RegExp(rule.regex.source, rule.regex.flags);
        
        while ((match = loopRegex.exec(text)) !== null) {
          const originalText = match[0];
          
          // Kiểm tra danh sách ngoại lệ (ví dụ: noãn, soát...)
          if (rule.exclude && rule.exclude.includes(originalText.toLowerCase().trim())) {
              continue;
          }

          let suggestedText = "";
          if (typeof rule.suggestion === 'function') {
              // Gọi hàm thay thế động (dành cho Viết hoa, ngh/gh)
              suggestedText = rule.suggestion(match);
          } else if (typeof rule.suggestion === 'string' && rule.suggestion.includes('$')) {
              // Thay thế dùng biến nhóm $1, $2 của Regex
              const replaceRegex = new RegExp(rule.regex.source, rule.regex.flags.replace('g', ''));
              suggestedText = originalText.replace(replaceRegex, rule.suggestion);
          } else {
              suggestedText = rule.suggestion;
          }

          foundErrors.push({ 
              id: `off_${errCount++}`, 
              original: originalText.trim(), 
              suggestion: suggestedText.trim(), 
              type: 'chinh-ta', 
              description: rule.desc, 
              status: 'pending' 
          });
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

  const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // HIỂN THỊ GIAO DIỆN VĂN BẢN TRỰC QUAN
  const renderDocumentText = () => {
    let highlightedText = documentText;
    const sortedErrors = [...errors].sort((a, b) => (b.original || "").length - (a.original || "").length);

    sortedErrors.forEach(err => {
      if (!err.original) return;
      const regex = new RegExp(escapeRegExp(err.original), 'gi'); 
      
      if (err.status === 'pending') {
        // Đã sửa giao diện: Màu nền nhẹ, bỏ gạch chân. Thêm ring sáng khi được click.
        const span = `<span id="text-error-${err.id}" class="bg-rose-500/20 text-rose-300 px-1 rounded transition-all ${activeErrorId === err.id ? 'ring-2 ring-rose-500 shadow-[0_0_15px_rgba(225,29,72,0.6)] bg-rose-500/40' : 'hover:bg-rose-500/40 cursor-pointer'}" data-id="${err.id}">$&</span>`;
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
                 <h3 className="text-lg font-bold text-emerald-400 flex items-center gap-2 uppercase"><ShieldCheck size={18}/> 2. Bắt đầu</h3>
                 <p className="text-xs text-slate-400 mb-4">Hệ thống áp dụng chuẩn NĐ 30/2020 và kiểm tra chính tả nâng cao.</p>
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
                        id={`error-card-${err.id}`}
                        className={`bg-[#0f172a] p-5 rounded-xl border cursor-pointer ${activeErrorId === err.id ? 'border-brand shadow-[0_0_15px_rgba(56,189,248,0.2)]' : 'border-[#1e293b]'}`} 
                        onClick={() => {
                            setActiveErrorId(err.id);
                            const errorElement = document.getElementById(`text-error-${err.id}`);
                            if (errorElement) errorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }}
                    >
                       <div className="flex justify-between mb-3">
                          <span className="text-xs font-bold text-rose-400 uppercase tracking-wider">{err.type}</span>
                          <AlertCircle size={16} className="text-rose-400" />
                       </div>
                       {/* Đã sửa font chữ: text-base (to hơn), font-normal (không in đậm) */}
                       <p className="text-base text-rose-300 line-through mb-1 font-normal">{err.original}</p>
                       <p className="text-base text-emerald-400 mb-3 font-normal">➔ {err.suggestion}</p>
                       <p className="text-sm text-slate-400 italic mb-5 font-normal border-l-2 border-[#1e293b] pl-3 py-1">{err.description}</p>
                       <div className="flex gap-2">
                          <button onClick={(e) => { e.stopPropagation(); setErrors(errors.map(e => e.id === err.id ? {...e, status: 'fixed'} : e)); }} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-2 rounded-lg font-bold text-xs transition-colors">SỬA LỖI</button>
                          <button onClick={(e) => { e.stopPropagation(); setErrors(errors.map(e => e.id === err.id ? {...e, status: 'ignored'} : e)); }} className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-lg font-bold text-xs transition-colors">BỎ QUA</button>
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
                 <button onClick={copyToClipboard} className="bg-slate-800 hover:bg-slate-700 text-slate-300 py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-colors"><Copy size={16}/> COPY TẤT CẢ</button>
                 <button onClick={exportToWord} className="bg-brand text-bg-dark py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 hover:scale-[1.02] transition-transform shadow-[0_0_15px_rgba(56,189,248,0.4)]"><Download size={16}/> TẢI FILE WORD</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}