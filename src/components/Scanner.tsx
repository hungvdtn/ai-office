import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, X, Check, Scan, Save, Loader2 } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { AnimatePresence, motion } from 'motion/react';

export default function Scanner() {
  const [isScanning, setIsScanning] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  
  const [scannedPages, setScannedPages] = useState<string[]>([]);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  
  const [fileName, setFileName] = useState('');
  const [showSaveModal, setShowSaveModal] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // 1. Chỉ lấy luồng dữ liệu (Không đụng chạm giao diện ở bước này)
  const startCamera = async () => {
    if (isInitializing) return;
    setIsInitializing(true);

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }, 
        audio: false
      });
      
      setStream(mediaStream);
      setIsScanning(true); // Kích hoạt vẽ giao diện
      setScannedPages([]);
    } catch (err: any) {
      alert(`Thiết bị từ chối: ${err.message}. Vui lòng đảm bảo bạn đang mở bằng Safari gốc, không mở trong Zalo/Messenger.`);
    } finally {
      setIsInitializing(false);
    }
  };

  // 2. Chờ giao diện vẽ xong mới gắn Video (Tuyệt chiêu chống màn hình đen Safari)
  useEffect(() => {
    let isMounted = true;
    if (isScanning && stream && videoRef.current) {
      const video = videoRef.current;
      video.srcObject = stream;
      video.setAttribute('playsinline', 'true');
      video.muted = true;
      
      // Độ trễ siêu nhỏ để Safari kịp nhận diện khung hình HTML
      setTimeout(() => {
        if (isMounted) {
          video.play().catch(e => console.log("Lỗi phát nền:", e));
        }
      }, 100);
    }
    return () => { isMounted = false; };
  }, [isScanning, stream]);

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setIsScanning(false);
  }, [stream]);

  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  const capturePage = useCallback(() => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        ctx.filter = 'grayscale(100%) contrast(1.2) brightness(1.1)';
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        const imageUrl = canvas.toDataURL('image/jpeg', 0.9);
        setPreviewImage(imageUrl);
        
        setTimeout(() => {
          setScannedPages(prev => [...prev, imageUrl]);
          setPreviewImage(null);
        }, 1000);
      }
    }
  }, []);

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
            <p className="text-slate-500 text-sm mt-1">Hỗ trợ quét đa trang và xuất trực tiếp thành file PDF.</p>
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
               {isInitializing ? 'ĐANG KẾT NỐI CAMERA...' : 'MỞ MÁY QUÉT'}
             </button>
          </div>
        ) : (
          <div className="absolute inset-0 z-20 flex flex-col bg-black pointer-events-none">
            
            {/* THẺ VIDEO LUÔN NẰM Ở LỚP DƯỚI CÙNG KHI ĐANG SCAN */}
            <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                muted 
                className="absolute inset-0 w-full h-full object-cover z-0"
            />
            
            <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/80 to-transparent flex justify-center z-10">
                <div className="px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest border bg-black/50 text-slate-400 border-slate-600">
                  CHỤP THỦ CÔNG
                </div>
            </div>
            
            <div className="absolute inset-0 p-6 pb-32 flex items-center justify-center z-10">
               <div className="w-full h-full max-w-lg relative border border-slate-500/30">
                  <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-white rounded-tl-xl" />
                  <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-white rounded-tr-xl" />
                  <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-white rounded-bl-xl" />
                  <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-white rounded-br-xl" />
               </div>
            </div>

            <AnimatePresence>
              {previewImage && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.1 }}
                  className="absolute inset-0 z-30 bg-black flex items-center justify-center p-6 pointer-events-auto"
                >
                  <img src={previewImage} alt="Preview" className="max-w-full max-h-full object-contain rounded-xl shadow-2xl" />
                </motion.div>
              )}
            </AnimatePresence>

            <div className="absolute bottom-0 left-0 right-0 h-28 bg-black/80 backdrop-blur-md z-40 flex items-center justify-between px-6 pb-4 pointer-events-auto">
               <button onClick={stopCamera} className="w-16 h-12 flex flex-col items-center justify-center text-slate-400 hover:text-white transition-colors">
                  <X size={24} />
                  <span className="text-[10px] mt-1 font-bold">HỦY</span>
               </button>

               <button 
                  onClick={capturePage}
                  disabled={!!previewImage}
                  className="w-20 h-20 rounded-full border-4 border-slate-300 flex items-center justify-center p-1 active:scale-95 transition-transform disabled:opacity-50"
               >
                  <div className="w-full h-full rounded-full bg-white transition-colors" />
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