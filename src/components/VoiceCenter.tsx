import React, { useState, useEffect } from 'react';
import { 
  Volume2, 
  Play, 
  Pause, 
  RotateCcw, 
  Settings2,
  FileText,
  Speech
} from 'lucide-react';

export default function VoiceCenter() {
  const [text, setText] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [rate, setRate] = useState(1);
  const [pitch, setPitch] = useState(1);
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    const loadVoices = () => {
      const v = window.speechSynthesis.getVoices();
      setVoices(v.filter(voice => voice.lang.includes('vi') || voice.lang.includes('en')));
      const preferred = v.find(voice => voice.lang === 'vi-VN') || v[0];
      setVoice(preferred);
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => { window.speechSynthesis.cancel(); };
  }, []);

  const toggleSpeak = () => {
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    } else {
      if (!text) return alert("Vui lòng nhập văn bản cần đọc");
      const utterance = new SpeechSynthesisUtterance(text);
      if (voice) utterance.voice = voice;
      utterance.rate = rate;
      utterance.pitch = pitch;
      utterance.onend = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
      setIsSpeaking(true);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Volume2 className="text-indigo-600" />
            Chuyển đổi Văn bản - Giọng nói
          </h1>
          <p className="text-slate-500">Tạo giọng đọc chuyên nghiệp, mạch lạc cho môi trường sư phạm.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 office-card flex flex-col h-[500px]">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
            <h3 className="font-semibold text-slate-700 flex items-center gap-2">
              <FileText size={18} className="text-indigo-500" />
              Nội dung soạn thảo
            </h3>
            <button 
              onClick={() => setText('')}
              className="p-2 hover:bg-slate-200 rounded-lg text-slate-500 transition-colors"
            >
              <RotateCcw size={18} />
            </button>
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Nhập hoặc dán văn bản quy phạm, thông báo sư phạm cần chuyển đổi sang giọng nói tại đây..."
            className="flex-1 p-6 resize-none focus:outline-none text-slate-800 leading-relaxed text-lg"
          />
        </div>

        <div className="space-y-4">
          <div className="office-card p-6 space-y-6">
            <h3 className="font-semibold text-slate-800 flex items-center gap-2 mb-4">
              <Settings2 size={18} className="text-indigo-500" />
              Cấu hình Giọng đọc
            </h3>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-600 block">Chọn Giọng nói</label>
              <select 
                className="w-full p-2 border border-slate-200 rounded-lg bg-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                value={voice?.name}
                onChange={(e) => setVoice(voices.find(v => v.name === e.target.value) || null)}
              >
                {voices.map((v, i) => (
                  <option key={i} value={v.name}>{v.name} ({v.lang})</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <label className="text-sm font-medium text-slate-600">Tốc độ ({rate}x)</label>
              </div>
              <input 
                type="range" min="0.5" max="2" step="0.1" value={rate}
                onChange={(e) => setRate(parseFloat(e.target.value))}
                className="w-full accent-indigo-600"
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <label className="text-sm font-medium text-slate-600">Cao độ ({pitch})</label>
              </div>
              <input 
                type="range" min="0.5" max="2" step="0.1" value={pitch}
                onChange={(e) => setPitch(parseFloat(e.target.value))}
                className="w-full accent-indigo-600"
              />
            </div>

            <button
              onClick={toggleSpeak}
              className={`w-full py-4 rounded-xl flex items-center justify-center gap-3 font-bold transition-all shadow-lg ${
                isSpeaking 
                ? 'bg-rose-500 text-white hover:bg-rose-600' 
                : 'bg-indigo-600 text-white hover:bg-indigo-700'
              }`}
            >
              {isSpeaking ? (
                <>
                  <Pause size={24} fill="currentColor" />
                  Dừng đọc nội dung
                </>
              ) : (
                <>
                  <Play size={24} fill="currentColor" />
                  Bắt đầu đọc AI
                </>
              )}
            </button>
          </div>

          <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-lg flex items-start gap-3">
            <Speech className="text-indigo-500 shrink-0" size={20} />
            <p className="text-xs text-indigo-800 leading-relaxed">
              Mẹo: Chia nhỏ văn bản thành các đoạn ngắn để AI đọc mạch lạc hơn và phù hợp với môi trường công sở.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
