import React, { useState, useEffect, useRef } from 'react';
import { Volume2, Play, Square, Pause, Download, Upload, FileText, Settings2, FileUp, AlertCircle } from 'lucide-react';

export default function TextToSpeech() {
  const [text, setText] = useState('Chào Tiến sĩ, đây là hệ thống đọc văn bản tự động. Nếu bạn nghe thấy giọng lơ lớ, vui lòng vào cài đặt điện thoại tải giọng Tiếng Việt nâng cao.');
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string>('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [rate, setRate] = useState(1);
  const [hasVietnameseVoice, setHasVietnameseVoice] = useState(true);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- TỐI ƯU HÓA: BẮT BUỘC TÌM GIỌNG TIẾNG VIỆT CHUẨN ---
  useEffect(() => {
    const loadVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices();
      
      // Lọc riêng các giọng Tiếng Việt
      const viVoices = availableVoices.filter(v => v.lang.includes('vi') || v.lang.includes('VN'));
      
      // Nếu không có giọng Tiếng Việt nào được cài đặt trên trình duyệt/máy
      if (viVoices.length === 0 && availableVoices.length > 0) {
        setHasVietnameseVoice(false);
        setVoices(availableVoices); // Tạm dùng giọng ngoại quốc
        setSelectedVoice(availableVoices[0]?.name);
        return;
      }

      setHasVietnameseVoice(true);

      // Sắp xếp ưu tiên: Giọng "Premium" hoặc "Enhanced" (Nâng cao) lên đầu tiên
      const sortedVoices = [...availableVoices].sort((a, b) => {
        const aIsVi = a.lang.includes('vi');
        const bIsVi = b.lang.includes('vi');
        
        if (aIsVi && !bIsVi) return -1;
        if (!aIsVi && bIsVi) return 1;
        
        if (aIsVi && bIsVi) {
           const aIsPremium = a.name.includes('Premium') || a.name.includes('Enhanced');
           const bIsPremium = b.name.includes('Premium') || b.name.includes('Enhanced');
           if (aIsPremium && !bIsPremium) return -1;
           if (!aIsPremium && bIsPremium) return 1;
        }
        return 0;
      });
      
      setVoices(sortedVoices);
      
      const bestVoice = sortedVoices.find(v => v.lang.includes('vi'));
      if (bestVoice) {
        setSelectedVoice(bestVoice.name);
      }
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }, []);

  const handlePlay = () => {
    if (!text.trim()) return;

    if (isPaused) {
      window.speechSynthesis.resume();
      setIsPaused(false);
      setIsSpeaking(true);
      return;
    }

    window.speechSynthesis.cancel(); 
    const utterance = new SpeechSynthesisUtterance(text);
    
    // Ép ngôn ngữ Tiếng Việt để tránh trình duyệt tự đổi sang tiếng Anh
    utterance.lang = 'vi-VN'; 
    
    const voice = voices.find(v => v.name === selectedVoice);
    if (voice) utterance.voice = voice;
    
    utterance.rate = rate;
    
    utterance.onend = () => {
      setIsSpeaking(false);
      setIsPaused(false);
    };
    
    window.speechSynthesis.speak(utterance);
    setIsSpeaking(true);
    setIsPaused(false);
  };

  const handlePause = () => {
    window.speechSynthesis.pause();
    setIsPaused(true);
    setIsSpeaking(false);
  };

  const handleStop = () => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    setIsPaused(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type === "text/plain") {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setText(event.target.result as string);
        }
      };
      reader.readAsText(file);
    } else {
      alert("Hệ thống Web Offline hiện tại chỉ hỗ trợ trích xuất chữ trực tiếp từ file văn bản (.txt).\n\nĐối với file Word (.docx) và PDF, vui lòng Copy nội dung từ file và Paste vào ô soạn thảo.");
    }
    
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDownloadAudio = () => {
    alert("Giới hạn Kiến trúc Web:\n\nGiọng đọc offline không sinh ra file MP3. Tính năng tải xuống sẽ khả dụng khi hệ thống nâng cấp tích hợp API Google Cloud AI.");
  };

  useEffect(() => {
    return () => {
      window.speechSynthesis.cancel();
    };
  }, []);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl serif font-light text-slate-100 flex items-center gap-3">
            <Volume2 className="text-brand" size={32} /> Văn bản - Giọng nói
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Chuyển đổi văn bản thành giọng đọc tự nhiên (Hỗ trợ Tiếng Việt).
          </p>
        </div>
        
        <div className="flex gap-3">
          <input 
            type="file" 
            accept=".txt" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            className="hidden" 
          />
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-sm font-bold text-slate-200 transition-colors shadow-lg"
          >
            <FileUp size={16} /> Nhập File (.txt)
          </button>
          
          <button 
            onClick={handleDownloadAudio}
            className="flex items-center gap-2 px-4 py-2 bg-brand/10 hover:bg-brand/20 border border-brand/30 rounded-lg text-sm font-bold text-brand transition-colors shadow-lg"
          >
            <Download size={16} /> Tải MP3
          </button>
        </div>
      </div>

      {!hasVietnameseVoice && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 p-4 rounded-xl flex items-start gap-3">
          <AlertCircle className="text-yellow-500 flex-shrink-0 mt-0.5" size={20} />
          <p className="text-sm text-yellow-500/90">
            <strong>Cảnh báo:</strong> Trình duyệt hoặc thiết bị của bạn chưa cài đặt dữ liệu Giọng đọc Tiếng Việt. 
            Hệ thống sẽ dùng tạm giọng Tiếng Anh để đọc (gây ra hiện tượng lơ lớ). Hãy vào <strong>Cài đặt thiết bị &gt; Trợ năng &gt; Giọng nói</strong> để tải gói Tiếng Việt.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        <div className="lg:col-span-2 space-y-4">
          <div className="office-card bg-[#05070a] border border-[#1e293b] p-1 h-[500px] flex flex-col rounded-2xl overflow-hidden shadow-2xl">
            <div className="px-4 py-3 border-b border-[#1e293b] bg-black flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <FileText size={14} /> Nội dung văn bản
              </span>
              <span className="text-xs font-mono text-slate-500">
                {text.length} ký tự
              </span>
            </div>
            
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Nhập hoặc dán văn bản của bạn vào đây..."
              className="flex-1 w-full bg-transparent text-slate-100 p-6 resize-none focus:outline-none text-lg leading-relaxed font-sans placeholder:text-slate-700"
            />
          </div>
        </div>

        <div className="space-y-6">
          <div className="office-card p-6 bg-black border border-[#1e293b] rounded-2xl shadow-xl">
            <h3 className="text-sm font-bold text-slate-300 mb-6 flex items-center gap-2 uppercase tracking-widest">
              <Settings2 size={16} className="text-brand" /> Cài đặt giọng đọc
            </h3>

            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Chọn Giọng Đọc
                </label>
                <div className="relative">
                  <select
                    value={selectedVoice}
                    onChange={(e) => setSelectedVoice(e.target.value)}
                    className="w-full bg-[#05070a] border border-[#1e293b] text-slate-200 text-sm rounded-lg p-3 appearance-none focus:outline-none focus:border-brand transition-colors"
                  >
                    {voices.length === 0 && <option>Đang tải danh sách giọng...</option>}
                    {voices.map((voice) => (
                      <option key={voice.name} value={voice.name}>
                        {voice.name} {voice.lang.includes('vi') ? '(Tiếng Việt)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Tốc độ đọc
                  </label>
                  <span className="text-xs font-mono text-brand font-bold">{rate.toFixed(1)}x</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="2"
                  step="0.1"
                  value={rate}
                  onChange={(e) => setRate(parseFloat(e.target.value))}
                  className="w-full accent-brand bg-slate-800 h-1.5 rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-600 font-bold uppercase">
                  <span>Chậm</span>
                  <span>Nhanh</span>
                </div>
              </div>
            </div>
            
            <hr className="border-[#1e293b] my-6" />

            <div className="grid grid-cols-2 gap-3">
              {!isSpeaking && !isPaused ? (
                <button
                  onClick={handlePlay}
                  className="col-span-2 office-button-primary bg-brand text-bg-dark py-4 text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-brand/20"
                >
                  <Play fill="currentColor" size={18} /> ĐỌC VĂN BẢN
                </button>
              ) : (
                <>
                  <button
                    onClick={isSpeaking ? handlePause : handlePlay}
                    className="col-span-1 bg-yellow-500 hover:bg-yellow-400 text-black py-4 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-colors shadow-lg"
                  >
                    {isSpeaking ? (
                      <><Pause fill="currentColor" size={18} /> TẠM DỪNG</>
                    ) : (
                      <><Play fill="currentColor" size={18} /> TIẾP TỤC</>
                    )}
                  </button>
                  <button
                    onClick={handleStop}
                    className="col-span-1 bg-rose-500 hover:bg-rose-400 text-white py-4 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-colors shadow-lg"
                  >
                    <Square fill="currentColor" size={18} /> DỪNG HẲN
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}