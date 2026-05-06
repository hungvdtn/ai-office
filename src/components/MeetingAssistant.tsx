import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { 
  Mic, Upload, Loader2, FileText, Download, Share2, 
  Play, Pause, ListRestart, MicOff, Type, FileAudio
} from 'lucide-react';
import { generateMeetingMinutes } from '../services/geminiService';
import confetti from 'canvas-confetti';

export default function MeetingAssistant() {
  const [activeTab, setActiveTab] = useState<'mic' | 'file'>('mic');
  
  // States cho File
  const [file, setFile] = useState<File | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  
  // States cho Xử lý
  const [isLoadingTranscript, setIsLoadingTranscript] = useState(false);
  const [isLoadingMinutes, setIsLoadingMinutes] = useState(false);
  
  // States cho Nội dung (Có thể xem và sửa)
  const [transcript, setTranscript] = useState<string>('');
  const [minutes, setMinutes] = useState<string>('');
  
  // State cho Ghi âm trực tiếp
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<any>(null);

  // --- THIẾT LẬP NHẬN DIỆN GIỌNG NÓI TRỰC TIẾP (WEB SPEECH API) ---
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'vi-VN';

      recognitionRef.current.onresult = (event: any) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript + ' ';
          }
        }
        if (finalTranscript) {
          setTranscript((prev) => prev + finalTranscript);
        }
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error("Lỗi nhận diện giọng nói:", event.error);
        setIsRecording(false);
      };
    }
    
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  const toggleRecording = () => {
    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
    } else {
      setTranscript(''); // Xóa nội dung cũ khi bắt đầu ghi âm mới
      recognitionRef.current?.start();
      setIsRecording(true);
    }
  };

  // --- XỬ LÝ KÉO THẢ FILE ---
  const onDrop = useCallback((acceptedFiles: File[]) => {
    const selectedFile = acceptedFiles[0];
    if (selectedFile) {
      setFile(selectedFile);
      setTranscript('');
      setMinutes('');
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'audio/*': ['.mp3', '.wav', '.m4a'] },
    multiple: false
  } as any);

  // --- XỬ LÝ BÓC BĂNG TỪ FILE ÂM THANH (TRANSCRIPTION) ---
  const handleTranscribeFile = async () => {
    if (!file) return;
    setIsLoadingTranscript(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Data = (reader.result as string).split(',')[1];
        
        // TIẾN SĨ LƯU Ý: Chỗ này cần gọi API (Ví dụ Gemini 1.5) để bóc băng file âm thanh thành text.
        // Tạm thời hiển thị mô phỏng kết nối. Tiến sĩ có thể tùy biến hàm generateMeetingMinutes trong dịch vụ.
        const result = await generateMeetingMinutes({ 
          type: 'audio', 
          data: base64Data, 
          mimeType: file.type,
          action: 'transcribe_only' // Gửi thêm cờ báo hiệu chỉ bóc băng
        });
        
        setTranscript(result || "Đã bóc băng thành công. Nội dung hiển thị tại đây...");
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Lỗi bóc băng:', error);
      alert('Đã xảy ra lỗi khi bóc băng âm thanh.');
    } finally {
      setIsLoadingTranscript(false);
    }
  };

  // --- XỬ LÝ TẠO BIÊN BẢN CUỘC HỌP (SUMMARIZATION) ---
  const handleGenerateMinutes = async () => {
    if (!transcript.trim()) {
      alert('Vui lòng ghi âm hoặc bóc băng file trước khi tạo biên bản.');
      return;
    }
    
    setIsLoadingMinutes(true);
    try {
      // Gửi đoạn Text (Transcript) lên Gemini để tóm tắt thành Biên bản chuẩn hành chính
      const result = await generateMeetingMinutes({ 
        type: 'text', 
        data: transcript,
        action: 'generate_minutes'
      });
      
      setMinutes(result);
      confetti({ particleCount: 150, spread: 100, origin: { x: 1, y: 0.5 } });
    } catch (error) {
      console.error('Lỗi tạo biên bản:', error);
      alert('Đã xảy ra lỗi khi tạo biên bản.');
    } finally {
      setIsLoadingMinutes(false);
    }
  };

  // --- CÁC HÀM XUẤT FILE (DOWNLOAD & SHARE) ---
  const downloadTextFile = () => {
    if (!transcript) return;
    const blob = new Blob([transcript], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `VanBan_BocBang_${new Date().getTime()}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const downloadDocx = () => {
    if (!minutes) return;
    const header = "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Biên bản Cuộc họp</title></head><body>";
    const footer = "</body></html>";
    // Đổi xuống dòng thành thẻ <br> của HTML để Word hiểu định dạng
    const html = header + minutes.replace(/\n/g, '<br>') + footer;
    
    const blob = new Blob([html], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `BienBan_CuocHop_${new Date().getTime()}.doc`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const shareZalo = (textToShare: string) => {
    if (!textToShare) return;
    const zaloUrl = `https://zalo.me/?text=${encodeURIComponent(textToShare)}`;
    window.open(zaloUrl, '_blank');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Mic className="text-indigo-600" />
            Trợ lý Cuộc họp AI
          </h1>
          <p className="text-slate-500 mt-1">Ghi âm trực tiếp hoặc tải file để bóc băng và tạo Biên bản chuẩn hành chính.</p>
        </div>
      </div>

      {/* CHUYỂN ĐỔI CHẾ ĐỘ: GHI ÂM HOẶC TẢI FILE */}
      <div className="flex bg-slate-100 p-1 rounded-lg w-fit">
        <button 
          onClick={() => setActiveTab('mic')}
          className={`flex items-center gap-2 px-6 py-2 rounded-md text-sm font-semibold transition-colors ${activeTab === 'mic' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <Mic size={16} /> Ghi âm Trực tiếp
        </button>
        <button 
          onClick={() => setActiveTab('file')}
          className={`flex items-center gap-2 px-6 py-2 rounded-md text-sm font-semibold transition-colors ${activeTab === 'file' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <FileAudio size={16} /> Tải file Âm thanh
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* CỘT TRÁI: ĐẦU VÀO & BÓC BĂNG VĂN BẢN */}
        <div className="space-y-4 flex flex-col h-[700px]">
          
          {/* KHU VỰC NHẬP LIỆU */}
          {activeTab === 'mic' ? (
            <div className="office-card p-8 bg-indigo-50/50 border-indigo-100 flex flex-col items-center justify-center text-center">
              <button 
                onClick={toggleRecording}
                className={`w-20 h-20 rounded-full flex items-center justify-center mb-4 transition-all shadow-lg ${isRecording ? 'bg-rose-500 animate-pulse' : 'bg-indigo-600 hover:bg-indigo-700'}`}
              >
                {isRecording ? <Pause size={32} className="text-white" /> : <Mic size={32} className="text-white" />}
              </button>
              <h3 className="font-bold text-slate-800 text-lg">
                {isRecording ? 'Đang ghi âm...' : 'Nhấn để bắt đầu Ghi âm'}
              </h3>
              <p className="text-sm text-slate-500 mt-2">Hệ thống sẽ tự động chuyển giọng nói thành văn bản bên dưới.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div 
                {...getRootProps()} 
                className={`office-card p-8 border-dashed border-2 flex flex-col items-center justify-center cursor-pointer transition-all ${
                  isDragActive ? 'border-indigo-400 bg-indigo-50' : 'border-slate-300 bg-slate-50 hover:bg-slate-100'
                }`}
              >
                <input {...getInputProps()} />
                <div className="w-12 h-12 bg-white shadow-sm border border-slate-200 rounded-full flex items-center justify-center mb-3">
                  <Upload className="text-indigo-500" size={20} />
                </div>
                <p className="text-center text-sm font-medium text-slate-700">
                  {file ? file.name : "Kéo thả hoặc Nhấn để chọn file"}
                </p>
                <p className="text-xs text-slate-400 mt-1">Hỗ trợ: MP3, WAV, M4A</p>
              </div>

              {file && (
                <button
                  onClick={handleTranscribeFile}
                  disabled={isLoadingTranscript}
                  className="w-full bg-slate-800 hover:bg-slate-700 text-white py-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors shadow-md"
                >
                  {isLoadingTranscript ? (
                    <><Loader2 className="animate-spin" size={18} /> Đang bóc băng âm thanh...</>
                  ) : (
                    <><Type size={18} /> Bóc băng thành Văn bản</>
                  )}
                </button>
              )}
            </div>
          )}

          {/* KHU VỰC CHỈNH SỬA VĂN BẢN (TRANSCRIPT) */}
          <div className="office-card flex-1 flex flex-col bg-white border-slate-200 shadow-sm overflow-hidden mt-2">
            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <FileText size={16} className="text-indigo-500" /> Bản dịch âm thanh (Có thể sửa)
              </span>
              <button 
                onClick={downloadTextFile}
                disabled={!transcript}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 disabled:text-slate-400 flex items-center gap-1"
              >
                <Download size={14} /> Tải .TXT
              </button>
            </div>
            <textarea
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder="Nội dung bóc băng sẽ hiển thị tại đây. Tiến sĩ có thể tự do chỉnh sửa trước khi xuất Biên bản..."
              className="flex-1 w-full p-4 resize-none focus:outline-none text-slate-800 text-[15px] leading-relaxed placeholder:text-slate-400"
            />
            
            {/* NÚT CHUYỂN SANG BIÊN BẢN */}
            <div className="p-4 border-t border-slate-100 bg-slate-50">
              <button
                onClick={handleGenerateMinutes}
                disabled={!transcript || isLoadingMinutes}
                className="office-button-primary w-full justify-center py-3 shadow-md"
              >
                {isLoadingMinutes ? (
                  <><Loader2 className="animate-spin" /> Đang tổng hợp Biên bản...</>
                ) : (
                  <><ListRestart /> Trích xuất thành Biên bản Cuộc họp 👉</>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* CỘT PHẢI: KẾT QUẢ BIÊN BẢN */}
        <div className="office-card flex flex-col h-[700px] bg-white border-slate-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 bg-indigo-50 flex items-center justify-between">
            <h3 className="font-semibold text-indigo-900 flex items-center gap-2">
              <FileText size={18} className="text-indigo-600" />
              Biên bản Cuộc họp (Chuẩn hành chính)
            </h3>
            <div className="flex gap-2">
              <button 
                onClick={downloadDocx}
                disabled={!minutes}
                className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 rounded text-xs font-semibold hover:bg-slate-50 disabled:opacity-50 flex items-center gap-1 shadow-sm"
              >
                <Download size={14} /> Tải .DOCX
              </button>
              <button 
                onClick={() => shareZalo(minutes)}
                disabled={!minutes}
                className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-semibold hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1 shadow-sm"
              >
                <Share2 size={14} /> Gửi Zalo
              </button>
            </div>
          </div>
          
          {/* Ô CHỈNH SỬA BIÊN BẢN */}
          <textarea
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            placeholder="Nội dung Biên bản sau khi tổng hợp sẽ hiển thị tại đây. Tiến sĩ có thể chỉnh sửa lại các đề mục trước khi tải về file Word..."
            className="flex-1 w-full p-6 resize-none focus:outline-none text-slate-800 text-[15px] leading-relaxed placeholder:text-slate-400"
          />
        </div>
      </div>
    </div>
  );
}
