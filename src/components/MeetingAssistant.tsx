import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { 
  Mic, 
  Upload, 
  Loader2, 
  FileText, 
  Download, 
  Share2, 
  Play, 
  Pause,
  ListRestart
} from 'lucide-react';
import { generateMeetingMinutes } from '../services/geminiService';
import confetti from 'canvas-confetti';

export default function MeetingAssistant() {
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [minutes, setMinutes] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const selectedFile = acceptedFiles[0];
    if (selectedFile) {
      setFile(selectedFile);
      setMinutes(null);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'audio/*': ['.mp3', '.wav', '.m4a'] },
    multiple: false
  } as any);

  const handleProcess = async () => {
    if (!file) return;
    setIsLoading(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Data = (reader.result as string).split(',')[1];
        const result = await generateMeetingMinutes({ 
          type: 'audio', 
          data: base64Data, 
          mimeType: file.type 
        });
        setMinutes(result);
        confetti({ particleCount: 150, spread: 100, origin: { x: 1 } });
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Processing Error:', error);
      alert('Đã xảy ra lỗi khi tạo biên bản.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Mic className="text-indigo-600" />
            Trợ lý Cuộc họp AI
          </h1>
          <p className="text-slate-500">Tự động chuyển âm thanh thành biên bản cuộc họp theo chuẩn hành chính.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upload & Audio Control */}
        <div className="lg:col-span-1 space-y-4">
          <div 
            {...getRootProps()} 
            className={`office-card p-8 border-dashed border-2 flex flex-col items-center justify-center cursor-pointer transition-all ${
              isDragActive ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200'
            }`}
          >
            <input {...getInputProps()} />
            <div className="w-12 h-12 bg-indigo-50 rounded-full flex items-center justify-center mb-3">
              <Upload className="text-indigo-500" size={20} />
            </div>
            <p className="text-center text-sm font-medium text-slate-700">
              {file ? file.name : "Tải lên tệp ghi âm cuộc họp"}
            </p>
            <p className="text-xs text-slate-400 mt-1">MP3, WAV, M4A</p>
          </div>

          {file && (
            <div className="office-card p-4 bg-[#1e293b]/60 border-brand/20">
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="w-10 h-10 bg-brand rounded-full flex items-center justify-center text-bg-dark hover:brightness-110 transition shadow-lg shadow-brand/20"
                >
                  {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="translate-x-0.5" />}
                </button>
                <div className="flex-1">
                  <div className="h-1 bg-[#05070a] rounded-full overflow-hidden">
                    <div className="h-full bg-brand w-1/3" />
                  </div>
                  <div className="flex justify-between mt-1 text-[10px] text-slate-500 font-mono">
                    <span>01:12</span>
                    <span>{file.size > 1024*1024 ? (file.size/1024/1024).toFixed(2) + 'MB' : (file.size/1024).toFixed(2) + 'KB'}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <button
            onClick={handleProcess}
            disabled={!file || isLoading}
            className="office-button-primary w-full justify-center py-3"
          >
            {isLoading ? (
              <>
                <Loader2 className="animate-spin" />
                Đang xử lý âm thanh...
              </>
            ) : (
              <>
                <ListRestart />
                Tạo Biên bản AI
              </>
            )}
          </button>
        </div>

        {/* Minutes Result */}
        <div className="lg:col-span-2 office-card flex flex-col h-[600px]">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
            <h3 className="font-semibold text-slate-700 flex items-center gap-2">
              <FileText size={18} className="text-indigo-500" />
              Biên bản cuộc họp (Bản thảo AI)
            </h3>
            <div className="flex gap-2">
              <button 
                disabled={!minutes}
                className="office-button-secondary py-1.5 text-sm"
              >
                <Download size={14} />
                Tải DOCX
              </button>
              <button 
                disabled={!minutes}
                className="office-button-primary py-1.5 text-sm"
              >
                <Share2 size={14} />
                Chia sẻ Zalo
              </button>
            </div>
          </div>
          <div className="flex-1 p-8 overflow-y-auto bg-white font-sans text-slate-800 leading-relaxed markdown-body">
            {minutes ? (
              <div dangerouslySetInnerHTML={{ __html: minutes.replace(/\n/g, '<br/>') }} />
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-50 italic">
                <Mic size={48} className="mb-4" />
                <p className="max-w-xs text-center">Tải lên file ghi âm và nhấn "Tạo Biên bản AI" để bắt đầu xử lý</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
