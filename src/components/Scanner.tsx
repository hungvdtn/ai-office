import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, X, Check, Scan, Save, Loader2, FileText, Layers } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { AnimatePresence, motion } from 'motion/react';

type FilterMode = 'color' | 'bw';

export default function Scanner() {
  const [isScanning, setIsScanning] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  
  const [scannedPages, setScannedPages] = useState<string[]>([]);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [showSaveModal, setShowSaveModal] = useState(false);
  
  const [filterMode, setFilterMode] = useState<FilterMode>('bw'); 
  const [isDocumentAligned, setIsDocumentAligned] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const analyzeCanvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanBoxRef = useRef<HTMLDivElement>(null);

  const startCamera = async () => {
    if (isInitializing) return;
    setIsInitializing(true);

    try {
      let mediaStream;
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 3840 }, height: { ideal: 2160 } }, 
          audio: false
        });
      } catch (e: any) {
        mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      }
      
      streamRef.current = mediaStream;
      setIsScanning(true);
      setScannedPages([]);
      setIsDocumentAligned(false);

      setTimeout(() => {
        if (videoRef.current && streamRef.current) {
          videoRef.current.srcObject = streamRef.current;
          videoRef.current.setAttribute('playsinline', 'true');
          videoRef.current.muted = true;
          videoRef.current.play().catch(err => console.error("Lỗi phát video:", err));
        }
      }, 100);

    } catch (err: any) {
      alert(`Lỗi Camera: ${err.message}`);
    } finally {
      setIsInitializing(false);
    }
  };

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsScanning(false);
    setIsDocumentAligned(false);
  }, []);

  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  // --- THUẬT TOÁN NHẬN DIỆN VĂN BẢN (SMART FRAME DETECTOR) ---
  useEffect(() => {
    if (!isScanning || previewImage || showSaveModal) return;

    const analyzeInterval = setInterval(() => {
      const video = videoRef.current;
      const canvas = analyzeCanvasRef.current;
      if (!video || !canvas || video.readyState !== 4) return;

      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;

      canvas.width = 64;
      canvas.height = 64;
      ctx.drawImage(video, 0, 0, 64, 64);

      const imageData = ctx.getImageData(0, 0, 64, 64);
      const data = imageData.data;

      let centerBrightness = 0;
      let edgeBrightness = 0;
      let centerPixels = 0;
      let edgePixels = 0;

      for (let y = 0; y < 64; y += 2) {
        for (let x = 0; x < 64; x += 2) {
          const i = (y * 64 + x) * 4;
          const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;

          const isCenter = x > 16 && x < 48 && y > 16 && y < 48;
          if (isCenter) {
            centerBrightness += brightness;
            centerPixels++;
          } else {
            edgeBrightness += brightness;
            edgePixels++;
          }
        }
      }

      const avgCenter = centerBrightness / centerPixels;
      const avgEdge = edgeBrightness / edgePixels;

      // Kích hoạt khung Vàng khi vùng giữa sáng hơn viền (tức là đã đặt đúng giấy lên nền tối)
      if (avgCenter > avgEdge + 25) {
        setIsDocumentAligned(true);
      } else {
        setIsDocumentAligned(false);
      }
    }, 300);

    return () => clearInterval(analyzeInterval);
  }, [isScanning, previewImage, showSaveModal]);

  // --- CHỤP VÀ THUẬT TOÁN NHỊ PHÂN HÓA (BINARIZATION) ---
  const capturePage = useCallback(() => {
    if (videoRef.current && canvasRef.current && scanBoxRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const scanBox = scanBoxRef.current;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;

      const videoRect = video.getBoundingClientRect();
      const boxRect = scanBox.getBoundingClientRect();

      const scaleX = video.videoWidth / videoRect.width;
      const scaleY = video.videoHeight / videoRect.height;

      const cropX = (boxRect.left - videoRect.left) * scaleX;
      const cropY = (boxRect.top - videoRect.top) * scaleY;
      const cropW = boxRect.width * scaleX;
      const cropH = boxRect.height * scaleY;

      canvas.width = cropW;
      canvas.height = cropH;

      if (filterMode === 'color') {
        // CHẾ ĐỘ MÀU: Giữ màu gốc, tăng độ nét và tương phản
        ctx.filter = 'contrast(1.3) brightness(1.1) saturate(1.2)'; 
        ctx.drawImage(video, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
      } else {
        // CHẾ ĐỘ ĐEN TRẮNG ĐỘT PHÁ: Tẩy trắng nền, xóa bóng máy chụp
        
        // B1: Đưa ảnh về dạng xám đen cơ bản
        ctx.filter = 'grayscale(100%) brightness(1.2)';
        ctx.drawImage(video, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
        
        // B2: Nội soi và can thiệp sâu vào điểm ảnh (Pixel Manipulation)
        const imageData = ctx.getImageData(0, 0, cropW, cropH);
        const data = imageData.data;
        
        for (let i = 0; i < data.length; i += 4) {
          const gray = data[i]; // Ảnh đã grayscale nên giá trị R, G, B bằng nhau
          
          if (gray > 115) {
            // Mức xám > 115 (bao gồm phần nền giấy tối màu do bóng râm) -> Ép lên Trắng tinh khiết
            data[i] = data[i+1] = data[i+2] = 255;
          } else if (gray < 75) {
            // Mức xám < 75 (nét mực đậm) -> Ép về Đen tuyền
            data[i] = data[i+1] = data[i+2] = 0;
          } else {
            // Khoảng chuyển tiếp (khử răng cưa cho viền chữ)
            const val = (gray - 75) * (255 / 40);
            data[i] = data[i+1] = data[i+2] = val;
          }
        }
        
        // Ghi đè bức ảnh đã được tẩy trắng lên Canvas
        ctx.putImageData(imageData, 0, 0);
      }
      
      const imageUrl = canvas.toDataURL('image/jpeg', 0.95);
      setPreviewImage(imageUrl);
      
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
            <p className="text-slate-500 text-sm mt-1">Lấy nét tự động, cắt viền quang học và tẩy trắng nền.</p>
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
               {isInitializing ? 'ĐANG KẾT NỐI ỐNG KÍNH...' : 'MỞ MÁY QUÉT'}
             </button>
             <p className="text-xs text-slate-500 mt-6">Hệ thống sẽ tự động hiển thị khung Vàng khi nhận diện đúng mặt giấy.</p>
          </div>
        ) : (
          <div className="absolute inset-0 z-20 flex flex-col bg-black">
            
            <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                muted 
                className="absolute inset-0 w-full h-full object-cover z-0 pointer-events-none"
            />
            
            {/* KHUNG NGẮM THÔNG MINH (CHỈ HIỆN KHI ĐẶT ĐÚNG VĂN BẢN VÀO CAMERA) */}
            <div className="absolute inset-0 p-6 pb-40 flex items-center justify-center z-10 pointer-events-none">
               <div className="absolute inset-0 shadow-[0_0_0_9999px_rgba(0,0,0,0.7)]" />
               
               <div 
                  ref={scanBoxRef}
                  className={`w-[85%] aspect-[1/1.414] max-h-full relative transition-all duration-500 ${isDocumentAligned ? 'border-2 border-yellow-400 bg-yellow-400/10 shadow-[0_0_30px_rgba(250,204,21,0.3)_inset]' : 'border border-transparent'}`}
               >
                  {/* Chỉ hiển thị góc Vàng khi thuật toán xác nhận có giấy trắng bên trong */}
                  {isDocumentAligned && (
                    <>
                      <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-yellow-400" />
                      <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-yellow-400" />
                      <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-yellow-400" />
                      <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-yellow-400" />
                    </>
                  )}
               </div>
            </div>

            {/* MÀN HÌNH XEM TRƯỚC (REVIEW) */}
            <AnimatePresence>
              {previewImage && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.1 }}
                  className="absolute inset-0 z-30 bg-[#05070a] flex flex-col items-center justify-center p-6 pointer-events-auto"
                >
                  <img src={previewImage} alt="Preview" className="max-w-full max-h-full object-contain shadow-2xl border border-slate-700 bg-white" />
                  <div className="absolute bottom-32 bg-emerald-500 text-bg-dark px-6 py-3 rounded-full font-black tracking-widest shadow-[0_0_20px_rgba(16,185,129,0.5)]">
                    ĐÃ LƯU TRANG {scannedPages.length + 1}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* THANH ĐIỀU KHIỂN & LỰA CHỌN MÀU SẮC DƯỚI CÙNG (GỌN GÀNG, KHÔNG BỊ CHE KHUẤT) */}
            <div className="absolute bottom-0 left-0 right-0 h-36 bg-black/90 backdrop-blur-md z-40 flex flex-col justify-end px-6 pb-6 pointer-events-auto border-t border-slate-800">
               
               {/* 2 LỰA CHỌN CHẤT LƯỢNG */}
               <div className="flex justify-center mb-4">
                  <div className="flex bg-slate-800 rounded-full p-1 border border-slate-700 shadow-xl">
                    <button onClick={() => setFilterMode('color')} className={`flex items-center gap-2 px-6 py-2 rounded-full text-[10px] font-bold uppercase transition-colors ${filterMode === 'color' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}>
                      <Layers size={14}/> Màu Sắc
                    </button>
                    <button onClick={() => setFilterMode('bw')} className={`flex items-center gap-2 px-6 py-2 rounded-full text-[10px] font-bold uppercase transition-colors ${filterMode === 'bw' ? 'bg-white text-black' : 'text-slate-400 hover:text-slate-200'}`}>
                      <FileText size={14}/> Trắng Đen Nét
                    </button>
                  </div>
               </div>

               <div className="flex items-center justify-between w-full">
                 <button onClick={stopCamera} className="w-16 h-12 flex flex-col items-center justify-center text-slate-400 hover:text-rose-400 transition-colors">
                    <X size={24} />
                    <span className="text-[10px] mt-1 font-bold">HỦY</span>
                 </button>

                 <button 
                    onClick={capturePage}
                    disabled={!!previewImage || !isDocumentAligned}
                    className={`w-16 h-16 rounded-full border-4 flex items-center justify-center p-1 active:scale-95 transition-transform ${isDocumentAligned && !previewImage ? 'border-yellow-400 opacity-100' : 'border-slate-500 opacity-50'}`}
                 >
                    <div className={`w-full h-full rounded-full transition-colors ${isDocumentAligned ? 'bg-white' : 'bg-slate-500'}`} />
                 </button>

                 <button 
                    onClick={handleDone}
                    disabled={scannedPages.length === 0 && !previewImage}
                    className="w-16 h-12 flex flex-col items-center justify-center text-brand disabled:text-slate-600 transition-colors"
                 >
                    <div className="relative">
                      <Check size={24} />
                      {scannedPages.length > 0 && (
                        <span className="absolute -top-2 -right-3 bg-rose-500 text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full font-black">
                          {scannedPages.length}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] mt-1 font-bold">XONG</span>
                 </button>
               </div>
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
        <canvas ref={analyzeCanvasRef} className="hidden" />
      </div>
    </div>
  );
}