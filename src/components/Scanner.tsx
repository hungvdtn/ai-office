import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, X, Check, Scan, Save, Loader2, Image as ImageIcon, Wand2, FileText, Layers } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { AnimatePresence, motion } from 'motion/react';

type FilterMode = 'original' | 'color' | 'bw' | 'magic';

export default function Scanner() {
  const [isScanning, setIsScanning] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  
  const [scannedPages, setScannedPages] = useState<string[]>([]);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [showSaveModal, setShowSaveModal] = useState(false);
  
  // Nâng cấp: 4 Chế độ chất lượng
  const [filterMode, setFilterMode] = useState<FilterMode>('magic'); 
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  // Ref để lấy tọa độ khung Vàng cắt ảnh
  const scanBoxRef = useRef<HTMLDivElement>(null);

  // --- ÉP ĐỘ PHÂN GIẢI 4K CHO CAMERA ---
  const startCamera = async () => {
    if (isInitializing) return;
    setIsInitializing(true);

    try {
      let mediaStream;
      try {
        // Cố gắng ép lên 4K để lấy nét chữ tối đa
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { 
            facingMode: 'environment',
            width: { ideal: 3840 }, 
            height: { ideal: 2160 } 
          }, 
          audio: false
        });
      } catch (e: any) {
        mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      }
      
      streamRef.current = mediaStream;
      setIsScanning(true);
      setScannedPages([]);

      setTimeout(() => {
        if (videoRef.current && streamRef.current) {
          videoRef.current.srcObject = streamRef.current;
          videoRef.current.setAttribute('playsinline', 'true');
          videoRef.current.muted = true;
          videoRef.current.play().catch(err => console.error("Lỗi phát video:", err));
        }
      }, 100);

    } catch (err: any) {
      alert(`Lỗi Camera: ${err.message}. Vui lòng kiểm tra quyền trên Safari.`);
    } finally {
      setIsInitializing(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsScanning(false);
  };

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // --- THUẬT TOÁN CẮT QUANG HỌC (OPTICAL CROP) CHÍNH XÁC 100% ---
  const capturePage = useCallback(() => {
    if (videoRef.current && canvasRef.current && scanBoxRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const scanBox = scanBoxRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Lấy tỷ lệ kích thước thực tế của Video so với kích thước hiển thị trên màn hình
      const videoRect = video.getBoundingClientRect();
      const boxRect = scanBox.getBoundingClientRect();

      const scaleX = video.videoWidth / videoRect.width;
      const scaleY = video.videoHeight / videoRect.height;

      // Tính tọa độ điểm cắt chính xác bám theo khung Vàng
      const cropX = (boxRect.left - videoRect.left) * scaleX;
      const cropY = (boxRect.top - videoRect.top) * scaleY;
      const cropW = boxRect.width * scaleX;
      const cropH = boxRect.height * scaleY;

      // Đặt kích thước Canvas đúng bằng kích thước khung đã cắt
      canvas.width = cropW;
      canvas.height = cropH;

      // --- BỘ LỌC CHẤT LƯỢNG CAO ---
      if (filterMode === 'color') {
        ctx.filter = 'contrast(1.3) brightness(1.1) saturate(1.4)'; // Giữ màu, tăng nét
      } else if (filterMode === 'bw') {
        ctx.filter = 'grayscale(100%) contrast(1.5) brightness(1.2)'; // Đen trắng cơ bản
      } else if (filterMode === 'magic') {
        ctx.filter = 'grayscale(100%) contrast(2.0) brightness(1.3)'; // Khử bóng cực mạnh, nền trắng tinh
      } else {
        ctx.filter = 'none'; // Ảnh gốc
      }

      // Vẽ phần video lọt trong khung Vàng lên Canvas
      ctx.drawImage(video, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
      
      // Xuất ảnh chất lượng cao 95%
      const imageUrl = canvas.toDataURL('image/jpeg', 0.95);
      setPreviewImage(imageUrl);
      
      // Tự động chuyển trang sau 1.5 giây
      setTimeout(() => {
        setScannedPages(prev => [...prev, imageUrl]);
        setPreviewImage(null);
      }, 1500);
    }
  }, [filterMode]);

  const handleDone = () => {
    if (scannedPages.length === 0) {
      stopCamera();
      return;
    }
    const today = new Date();
    const dateStr = `${today.getDate().toString().padStart(2, '0')}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getFullYear()}`;
    setFileName(`VanBan_Scan_${dateStr}`);
    setShowSaveModal(true);
  };

  const confirmSavePDF = () => {
    if (scannedPages.length === 0) return;
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();

    scannedPages.forEach((pageImg, index) => {
      if (index > 0) pdf.addPage();
      const imgProps = pdf.getImageProperties(pageImg);
      const ratio = Math.min(pdfWidth / imgProps.width, pdfHeight / imgProps.height);
      const finalWidth = imgProps.width * ratio;
      const finalHeight = imgProps.height * ratio;
      const x = (pdfWidth - finalWidth) / 2;
      const y = (pdfHeight - finalHeight) / 2;
      pdf.addImage(pageImg, 'JPEG', x, y, finalWidth, finalHeight);
    });

    pdf.save(`${fileName}.pdf`);
    setShowSaveModal(false);
    setScannedPages([]);
    stopCamera();
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 h-[calc(100vh-120px)] flex flex-col relative">
      
      {!isScanning && (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 flex-shrink-0 z-10">
          <div>
            <h1 className="text-3xl serif font-light text-slate-100 flex items-center gap-3">
              <Scan className="text-brand" size={32} /> Máy Scan Tài liệu
            </h1>
            <p className="text-slate-500 text-sm mt-1">Lấy nét tự động, cắt viền quang học và khử bóng thông minh.</p>
          </div>
        </div>
      )}

      <div className={`office-card flex-1 bg-black overflow-hidden border-[#1e293b] flex flex-col relative ${isScanning ? 'rounded-none md:rounded-2xl absolute inset-0 md:relative z-50' : 'rounded-2xl'}`}>
        
        {!isScanning ? (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-6 text-center bg-[#05070a]">
             <button 
                onClick={startCamera} 
                disabled={isInitializing}
                className="office-button-primary bg-brand text-bg-dark py-4 px-8 text-lg w-full max-w-md justify-center shadow-lg shadow-brand/20 disabled:opacity-70"
             >
               {isInitializing ? <Loader2 className="animate-spin" size={20} /> : <Camera size={20} />}
               {isInitializing ? 'ĐANG KHỞI ĐỘNG CẢM BIẾN...' : 'MỞ MÁY QUÉT'}
             </button>
             <div className="mt-8 bg-yellow-500/10 border border-yellow-500/20 p-4 rounded-lg max-w-sm text-left">
                <h3 className="text-sm font-bold text-yellow-500 mb-2 flex items-center gap-2"><Scan size={16}/> Hướng dẫn mới:</h3>
                <ul className="text-xs text-yellow-500/80 space-y-2 list-disc pl-4">
                  <li>Canh mặt giấy nằm lọt lòng trong <b>khung Vàng</b> trên màn hình.</li>
                  <li>Hệ thống sẽ <b>chỉ cắt và giữ lại</b> phần nằm trong khung Vàng. Không dính nền.</li>
                  <li>Bấm chụp thủ công khi bạn đã căn chỉnh xong.</li>
                </ul>
             </div>
          </div>
        ) : (
          <div className="absolute inset-0 z-20 flex flex-col bg-black">
            
            {/* LỚP VIDEO NỀN - HIỂN THỊ ĐẦY ĐỦ ĐỂ ĐO TỌA ĐỘ CHÍNH XÁC */}
            <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                muted 
                className="absolute inset-0 w-full h-full object-cover z-0"
            />
            
            {/* THANH TRẠNG THÁI & CHỌN CHẤT LƯỢNG */}
            <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/90 to-transparent flex flex-col items-center gap-3 z-10 pointer-events-auto">
                <div className="px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest border bg-yellow-500 text-black border-yellow-500 shadow-[0_0_15px_rgba(234,179,8,0.5)]">
                  CANH VĂN BẢN VÀO KHUNG VÀNG
                </div>
                
                {/* TÙY CHỌN 4 BỘ LỌC */}
                <div className="flex bg-slate-900/90 backdrop-blur-md rounded-lg p-1 border border-slate-700 overflow-x-auto w-full max-w-md justify-center">
                  <button onClick={() => setFilterMode('original')} className={`flex items-center gap-1 px-3 py-2 rounded-md text-[10px] font-bold uppercase transition-colors whitespace-nowrap ${filterMode === 'original' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'}`}>
                    <ImageIcon size={12}/> Ảnh gốc
                  </button>
                  <button onClick={() => setFilterMode('color')} className={`flex items-center gap-1 px-3 py-2 rounded-md text-[10px] font-bold uppercase transition-colors whitespace-nowrap ${filterMode === 'color' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}>
                    <Layers size={12}/> Màu nét
                  </button>
                  <button onClick={() => setFilterMode('bw')} className={`flex items-center gap-1 px-3 py-2 rounded-md text-[10px] font-bold uppercase transition-colors whitespace-nowrap ${filterMode === 'bw' ? 'bg-slate-300 text-black' : 'text-slate-500 hover:text-slate-300'}`}>
                    <FileText size={12}/> Đen trắng
                  </button>
                  <button onClick={() => setFilterMode('magic')} className={`flex items-center gap-1 px-3 py-2 rounded-md text-[10px] font-bold uppercase transition-colors whitespace-nowrap ${filterMode === 'magic' ? 'bg-yellow-500 text-black' : 'text-slate-500 hover:text-slate-300'}`}>
                    <Wand2 size={12}/> Magic (Sạch nền)
                  </button>
                </div>
            </div>
            
            {/* KHUNG NGẮM CẮT VIỀN (OPTICAL CROP BOX) */}
            <div className="absolute inset-0 p-6 pb-32 flex items-center justify-center z-10 pointer-events-none">
               {/* Vùng tối che mờ bên ngoài - Giúp tập trung vào văn bản */}
               <div className="absolute inset-0 shadow-[0_0_0_9999px_rgba(0,0,0,0.7)]" />
               
               {/* KHUNG VÀNG: Mọi thứ nằm trong ID này sẽ được cắt chính xác ra PDF */}
               <div 
                  ref={scanBoxRef}
                  className="w-[85%] aspect-[1/1.414] max-h-full relative border border-yellow-500/50 bg-yellow-500/10 shadow-[0_0_20px_rgba(234,179,8,0.2)_inset]"
               >
                  <div className="absolute -top-1 -left-1 w-10 h-10 border-t-4 border-l-4 border-yellow-400 rounded-tl-xl" />
                  <div className="absolute -top-1 -right-1 w-10 h-10 border-t-4 border-r-4 border-yellow-400 rounded-tr-xl" />
                  <div className="absolute -bottom-1 -left-1 w-10 h-10 border-b-4 border-l-4 border-yellow-400 rounded-bl-xl" />
                  <div className="absolute -bottom-1 -right-1 w-10 h-10 border-b-4 border-r-4 border-yellow-400 rounded-br-xl" />
               </div>
            </div>

            {/* MÀN HÌNH XEM TRƯỚC (REVIEW) */}
            <AnimatePresence>
              {previewImage && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.1 }}
                  className="absolute inset-0 z-30 bg-[#05070a] flex flex-col items-center justify-center p-6 pointer-events-auto"
                >
                  {/* Hiển thị chính xác hình ảnh đã bị cắt */}
                  <img src={previewImage} alt="Preview" className="max-w-full max-h-full object-contain shadow-2xl border border-slate-700" />
                  <div className="absolute bottom-32 bg-emerald-500 text-bg-dark px-6 py-3 rounded-full font-black tracking-widest shadow-[0_0_20px_rgba(16,185,129,0.5)]">
                    ĐÃ CẮT VÀ LƯU TRANG {scannedPages.length + 1}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* THANH ĐIỀU KHIỂN DƯỚI CÙNG */}
            <div className="absolute bottom-0 left-0 right-0 h-28 bg-black/90 backdrop-blur-md z-40 flex items-center justify-between px-6 pb-4 pointer-events-auto border-t border-slate-800">
               <button onClick={stopCamera} className="w-16 h-12 flex flex-col items-center justify-center text-slate-400 hover:text-rose-400 transition-colors">
                  <X size={24} />
                  <span className="text-[10px] mt-1 font-bold">HỦY</span>
               </button>

               <button 
                  onClick={capturePage}
                  disabled={!!previewImage}
                  className="w-20 h-20 rounded-full border-4 border-yellow-400 flex items-center justify-center p-1 active:scale-95 transition-transform disabled:opacity-50"
               >
                  <div className="w-full h-full rounded-full bg-white transition-colors" />
               </button>

               <button 
                  onClick={handleDone}
                  disabled={scannedPages.length === 0 && !previewImage}
                  className="w-16 h-12 flex flex-col items-center justify-center text-yellow-400 disabled:text-slate-600 transition-colors"
               >
                  <div className="relative">
                    <Check size={24} />
                    {scannedPages.length > 0 && (
                      <span className="absolute -top-2 -right-3 bg-rose-500 text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full font-black">
                        {scannedPages.length}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] mt-1 font-bold">XONG ({scannedPages.length})</span>
               </button>
            </div>
          </div>
        )}

        <AnimatePresence>
          {showSaveModal && (
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 pointer-events-auto"
            >
               <motion.div 
                  initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }}
                  className="bg-[#0f172a] border border-[#1e293b] rounded-2xl p-6 w-full max-w-sm shadow-2xl"
               >
                  <h3 className="text-lg font-bold text-slate-100 mb-6 flex items-center gap-2">
                    <Save className="text-brand" /> Lưu Hồ sơ ({scannedPages.length} trang)
                  </h3>
                  <input 
                    type="text" 
                    value={fileName}
                    onChange={(e) => setFileName(e.target.value)}
                    className="w-full bg-[#05070a] border border-[#1e293b] rounded-lg px-4 py-3 text-slate-200 focus:outline-none focus:border-brand mb-6"
                  />
                  <div className="flex gap-3">
                     <button onClick={() => setShowSaveModal(false)} className="flex-1 py-3 rounded-lg font-bold text-xs bg-[#1e293b] text-slate-300">Hủy</button>
                     <button onClick={confirmSavePDF} className="flex-1 py-3 rounded-lg font-bold text-xs bg-brand text-bg-dark">XUẤT PDF</button>
                  </div>
               </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <canvas ref={canvasRef} className="hidden" />
      </div>
    </div>
  );
}