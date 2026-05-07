import React, { useState, useRef } from 'react';
import { 
  Languages, 
  Upload, 
  Image as ImageIcon, 
  FileText, 
  Copy, 
  Download, 
  Loader2, 
  CheckCircle2, 
  Trash2
} from 'lucide-react';
import Tesseract from 'tesseract.js';
import { saveAs } from 'file-saver';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import { motion, AnimatePresence } from 'motion/react';

export default function OCRStudio() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  
  const [extractedText, setExtractedText] = useState<string>('');
  const [isCopied, setIsCopied] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Vui lòng chọn tệp hình ảnh (JPG, PNG, TIFF).');
      return;
    }
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setExtractedText('');
    setProgress(0);
  };

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0]);
    }
  };

  const preventDefaults = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); };
  const handleDragEnter = (e: React.DragEvent) => { preventDefaults(e); setIsDraggingOver(true); };
  const handleDragLeave = (e: React.DragEvent) => { preventDefaults(e); setIsDraggingOver(false); };
  const handleDrop = (e: React.DragEvent) => {
    preventDefaults(e); 
    setIsDraggingOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const clearSelection = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setExtractedText('');
    setProgress(0);
    setStatus('');
  };

  const performOCR = async () => {
    if (!previewUrl) return;
    setIsProcessing(true);
    setExtractedText('');
    setStatus('Đang khởi tạo lõi AI cục bộ...');
    setProgress(0);

    try {
      const result = await Tesseract.recognize(
        previewUrl,
        'vie',
        {
          logger: m => {
            if (m.status === 'recognizing text') {
              setStatus('Đang phân tích hình ảnh...');
              setProgress(Math.round(m.progress * 100));
            }
          }
        }
      );
      setExtractedText(result.data.text.replace(/\n{3,}/g, '\n\n'));
      setStatus('Hoàn tất');
    } catch (error) {
      alert('Đã xảy ra lỗi trong quá trình quét ảnh.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(extractedText);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const downloadWord = async () => {
    try {
      const paragraphs = extractedText.split('\n').map(line => 
        new Paragraph({ 
          children: [new TextRun({ text: line, font: "Times New Roman", size: 28 })],
          spacing: { after: 200 }
        })
      );
      const doc = new Document({
        styles: { default: { document: { run: { font: "Times New Roman" } } } },
        sections: [{ children: paragraphs }]
      });
      const blob = await Packer.toBlob(doc);
      saveAs(blob, 'Trich_Xuat_OCR.docx');
    } catch (error) { alert("Lỗi tạo file Word."); }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 w-full">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl serif font-light text-slate-100 flex items-center gap-3">
            <Languages className="text-brand" size={32} /> Studio Trích xuất OCR
          </h1>
          <p className="text-slate-500 text-sm mt-1">Số hóa tài liệu Offline - Đảm bảo bảo mật tuyệt đối cho hồ sơ công vụ.</p>
        </div>
        <div className="bg-emerald-500/10 border border-emerald-500/20 px-4 py-2 rounded-lg flex items-center gap-3">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Bảo mật Offline</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* CỘT TRÁI: Hình ảnh (Đã sửa lỗi hiển thị ảnh dọc) */}
        <div className="office-card bg-panel/50 border-[#1e293b] flex flex-col h-[650px]">
          <div className="p-4 border-b border-[#1e293b] flex justify-between items-center bg-[#0f172a]/80">
            <h2 className="text-xs font-bold text-slate-300 uppercase tracking-widest flex items-center gap-2">
              <ImageIcon size={16} className="text-brand" /> Tài liệu Nguồn
            </h2>
            {previewUrl && (
              <button onClick={clearSelection} className="text-[10px] text-rose-500 font-bold uppercase hover:underline">Xóa ảnh</button>
            )}
          </div>

          <div className="flex-1 p-6 flex flex-col min-h-0 bg-black/10">
            {!previewUrl ? (
              <div 
                onDragOver={preventDefaults} onDragEnter={handleDragEnter} onDragLeave={handleDragLeave} onDrop={handleDrop}
                className={`flex-1 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center transition-all ${
                  isDraggingOver ? 'border-brand bg-brand/5' : 'border-[#1e293b] hover:border-brand/40'
                }`}
              >
                <input type="file" accept="image/*" onChange={onFileInputChange} ref={fileInputRef} className="hidden" />
                <div onClick={() => fileInputRef.current?.click()} className="cursor-pointer flex flex-col items-center text-center p-8">
                  <Upload size={32} className="text-slate-500 mb-4" />
                  <h3 className="text-slate-200 font-bold mb-1">Tải ảnh hoặc Kéo thả</h3>
                  <p className="text-slate-500 text-[10px]">Hỗ trợ ảnh dọc 9:16 và ảnh ngang.</p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col h-full min-h-0">
                {/* Khung chứa ảnh: Sử dụng flex-1 và min-h-0 để ảnh co giãn đúng trong Card */}
                <div className="flex-1 relative border border-[#1e293b] rounded-xl overflow-hidden bg-[#05070a] mb-4 min-h-0 flex items-center justify-center">
                  <img src={previewUrl} alt="Preview" className="max-w-full max-h-full object-contain" />
                  
                  {isProcessing && (
                     <div className="absolute inset-0 bg-[#0f172a]/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-10">
                        <Loader2 size={40} className="text-brand animate-spin mb-4" />
                        <div className="text-xs text-slate-400 font-mono">{status} ({progress}%)</div>
                     </div>
                  )}
                </div>

                {/* Nút bấm: flex-shrink-0 để luôn xuất hiện ở đáy thẻ */}
                {!isProcessing && (
                  <button 
                    onClick={performOCR}
                    className="flex-shrink-0 office-button-primary w-full justify-center py-4 bg-brand text-bg-dark hover:bg-brand/90 shadow-lg shadow-brand/20 transition-all active:scale-95"
                  >
                    <Languages size={18} /> BẮT ĐẦU TRÍCH XUẤT VĂN BẢN
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* CỘT PHẢI: Kết quả Văn bản */}
        <div className="office-card bg-panel/50 border-[#1e293b] flex flex-col h-[650px]">
          <div className="p-4 border-b border-[#1e293b] flex justify-between items-center bg-[#0f172a]/80">
            <h2 className="text-xs font-bold text-slate-300 uppercase tracking-widest flex items-center gap-2">
              <FileText size={16} className="text-blue-500" /> Kết quả Trích xuất
            </h2>
            {extractedText && (
              <div className="flex items-center gap-2">
                <button onClick={handleCopy} className="p-2 hover:bg-[#1e293b] rounded-lg text-slate-400" title="Sao chép">
                  {isCopied ? <CheckCircle2 size={16} className="text-emerald-500" /> : <Copy size={16} />}
                </button>
                <button onClick={downloadWord} className="p-2 hover:bg-[#1e293b] rounded-lg text-slate-400 text-[10px] font-bold">DOCX</button>
              </div>
            )}
          </div>

          <div className="flex-1 min-h-0">
            {!extractedText && !isProcessing ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-600">
                <FileText size={48} className="mb-4 opacity-10" />
                <p className="text-xs italic">Văn bản trích xuất sẽ hiển thị tại đây</p>
              </div>
            ) : (
              <textarea
                value={extractedText}
                onChange={(e) => setExtractedText(e.target.value)}
                className="w-full h-full bg-transparent text-slate-200 p-6 resize-none outline-none leading-relaxed text-sm font-sans"
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}