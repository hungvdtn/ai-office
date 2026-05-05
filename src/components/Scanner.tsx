import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, X, Check, Scan, Save, Loader2, Maximize } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { AnimatePresence, motion } from 'motion/react';

export default function Scanner() {
  const [isScanning, setIsScanning] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  
  const [scannedPages, setScannedPages] = useState<string[]>([]);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [showSaveModal, setShowSaveModal] = useState(false);
  
  // CHẾ ĐỘ QUÉT
  const [autoMode, setAutoMode] = useState(true);
  const [scanState, setScanState] = useState<'idle' | 'detecting' | 'locked'>('idle');
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // --- HÀM BẬT CAMERA ---
  const startCamera = async () => {
    if (isInitializing) return;
    setIsInitializing(true);

    try {
      let mediaStream;
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' }, 
          audio: false
        });
      } catch (e: any) {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: true, 
          audio: false
        });
      }
      
      streamRef.current = mediaStream;
      setIsScanning(true);
      setScannedPages([]);
      setAutoMode(true); // Mặc định bật Tự động bắt khung

      setTimeout(() => {
        if (videoRef.current && streamRef.current) {
          videoRef.current.srcObject = streamRef.current;
          videoRef.current.setAttribute('playsinline', 'true');
          videoRef.current.muted = true;
          videoRef.current.play().catch(err => console.error("Lỗi phát video:", err));
        }
      }, 100);

    } catch (err: any) {
      alert(`Thiết bị từ chối truy cập: ${err.message}`);
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
    setScanState('idle');
  };

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // --- LOGIC CHỤP ẢNH VÀ KHỬ BÓNG SÁNG ---
  const capturePage = useCallback(() => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      
      if (ctx) {
        // Tối ưu hóa: Khử bóng, tăng cường độ tương phản cao, ép về trắng đen chuẩn mực
        ctx.filter = 'grayscale(100%) contrast(1.6) brightness(1.2)';
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        const imageUrl = canvas.toDataURL('image/jpeg', 0.9);
        setPreviewImage(imageUrl);
        setScanState('idle'); // Reset trạng thái khung
        
        // Hiện preview 1.5 giây rồi tự động cất vào mảng, tiếp tục vòng lặp
        setTimeout(() => {
          setScannedPages(prev => [...prev, imageUrl]);
          setPreviewImage(null);
        }, 1500);
      }
    }
  }, []);

  // --- VÒNG LẶP TỰ ĐỘNG BẮT KHUNG (AUTO-SCAN LOOP) ---
  useEffect(() => {
    if (!isScanning || !autoMode || previewImage || showSaveModal) {
      setScanState('idle');
      return;
    }

    let timer1: NodeJS.Timeout, timer2: NodeJS.Timeout, timer3: NodeJS.Timeout;

    // Chu kỳ 1: Chờ ổn định (1s)
    timer1 = setTimeout(() => {
      setScanState('detecting'); // Chuyển màu Vàng (Đang phân tích)
      
      // Chu kỳ 2: Khóa mục tiêu (1.5s)
      timer2 = setTimeout(() => {
        setScanState('locked'); // Chuyển màu Xanh (Đã bắt được)
        
        // Chu kỳ 3: Chụp tự động (0.5s sau khi khóa)
        timer3 = setTimeout(() => {
          capturePage();
        }, 500);
        
      }, 1500);
    }, 1000);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, [isScanning, autoMode, previewImage, showSaveModal, scannedPages.length, capturePage]);


  // --- XUẤT FILE PDF ---
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

  // --- RENDER GIAO DIỆN KHUNG NHẬN DIỆN MÀU SẮC ---
  const getBoxStyles = () => {
    if (!autoMode) return 'border-white bg-transparent';
    if (scanState === 'detecting') return 'border-yellow-400 bg-yellow-400/10 scale-95 transition-all duration-1000';
    if (scanState === 'locked') return 'border-emerald-500 bg-emerald-500/20 scale-100 transition-all duration-300';
    return 'border-white/50 bg-transparent scale-100 transition-all duration-500';
  };

  const getBorderColor = () => {
    if (!autoMode) return 'border-white';
    if (scanState === 'detecting') return 'border-yellow-400';
    if (scanState === 'locked') return 'border-emerald-500';
    return 'border-white/50';
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 h-[calc(100vh-120px)] flex flex-col relative">
      
      {!isScanning && (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 flex-shrink-0 z-10">
          <div>
            <h1 className="text-3xl serif font-light text-slate-100 flex items-center gap-3">
              <Scan className="text-brand" size={32} /> Máy Scan Tài liệu
            </h1>
            <p className="text-slate-500 text-sm mt-1">Quét thông minh, tự động khử bóng nền và gộp PDF liên tục.</p>
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
               {isInitializing ? 'ĐANG KHỞI ĐỘNG...' : 'MỞ MÁY QUÉT'}
             </button>
             <p className="text-xs text-slate-500 mt-6 max-w-xs">
               Lưu ý: Giữ camera song song với mặt giấy để đạt chất lượng chuẩn xác nhất.
             </p>
          </div>
        ) : (
          <div className="absolute inset-0 z-20 flex flex-col bg-black pointer-events-none">
            <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                muted 
                className="absolute inset-0 w-full h-full object-cover z-0"
            />
            
            {/* THANH TRẠNG THÁI CHẾ ĐỘ QUÉT */}
            <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/80 to-transparent flex justify-center z-10 pointer-events-auto">
                <button 
                  onClick={() => setAutoMode(!autoMode)}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest border transition-colors flex items-center gap-2 ${autoMode ? 'bg-brand/20 text-brand border-brand' : 'bg-black/50 text-slate-400 border-slate-600'}`}
                >
                  <Maximize size={14} /> {autoMode ? 'TỰ ĐỘNG BẮT KHUNG: BẬT' : 'CHỤP THỦ CÔNG'}
                </button>
            </div>
            
            {/* KHUNG NHẬN DIỆN THÔNG MINH */}
            <div className="absolute inset-0 p-6 pb-32 flex items-center justify-center z-10">
               <div className={`w-full h-full max-w-lg relative border-2 ${getBoxStyles()}`}>
                  <div className={`absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 ${getBorderColor()} rounded-tl-xl transition-colors duration-300`} />
                  <div className={`absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 ${getBorderColor()} rounded-tr-xl transition-colors duration-300`} />
                  <div className={`absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 ${getBorderColor()} rounded-bl-xl transition-colors duration-300`} />
                  <div className={`absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 ${getBorderColor()} rounded-br-xl transition-colors duration-300`} />
                  
                  {/* Chữ báo hiệu trạng thái nằm giữa khung */}
                  {autoMode && scanState !== 'idle' && !previewImage && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className={`px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest backdrop-blur-md transition-all duration-300 ${scanState === 'locked' ? 'bg-emerald-500/80 text-white scale-110' : 'bg-yellow-400/80 text-black'}`}>
                        {scanState === 'detecting' ? 'Đang phân tích...' : 'GIỮ YÊN! ĐANG CHỤP...'}
                      </span>
                    </div>
                  )}
               </div>
            </div>

            {/* MÀN HÌNH XEM TRƯỚC (HIỆN 1.5 GIÂY) */}
            <AnimatePresence>
              {previewImage && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.1 }}
                  className="absolute inset-0 z-30 bg-[#05070a] flex flex-col items-center justify-center p-6 pointer-events-auto"
                >
                  <img src={previewImage} alt="Preview" className="max-w-full max-h-full object-contain rounded-xl shadow-2xl border border-[#1e293b]" />
                  <div className="absolute bottom-32 bg-emerald-500 text-bg-dark px-6 py-3 rounded-full font-black tracking-widest shadow-[0_0_20px_rgba(16,185,129,0.5)]">
                    ĐÃ LƯU TRANG {scannedPages.length + 1}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* THANH ĐIỀU KHIỂN DƯỚI CÙNG */}
            <div className="absolute bottom-0 left-0 right-0 h-28 bg-black/80 backdrop-blur-md z-40 flex items-center justify-between px-6 pb-4 pointer-events-auto">
               <button onClick={stopCamera} className="w-16 h-12 flex flex-col items-center justify-center text-slate-400 hover:text-rose-400 transition-colors">
                  <X size={24} />
                  <span className="text-[10px] mt-1 font-bold">HỦY</span>
               </button>

               <button 
                  onClick={capturePage}
                  disabled={!!previewImage}
                  className="w-20 h-20 rounded-full border-4 border-slate-300 flex items-center justify-center p-1 active:scale-95 transition-transform disabled:opacity-50"
               >
                  <div className={`w-full h-full rounded-full transition-colors ${autoMode ? 'bg-brand' : 'bg-white'}`} />
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