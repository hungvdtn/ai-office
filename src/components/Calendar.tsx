import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Bell, Plus, Trash2, Calendar as CalendarIcon, X } from 'lucide-react';

// --- THUẬT TOÁN CAN CHI VÀ LỊCH ÂM CƠ BẢN ---
const CAN = ['Canh', 'Tân', 'Nhâm', 'Quý', 'Giáp', 'Ất', 'Bính', 'Đinh', 'Mậu', 'Kỷ'];
const CHI = ['Thân', 'Dậu', 'Tuất', 'Hợi', 'Tý', 'Sửu', 'Dần', 'Mão', 'Thìn', 'Tỵ', 'Ngọ', 'Mùi'];

const getCanChiYear = (year: number) => {
  return `${CAN[year % 10]} ${CHI[year % 12]}`;
};

// Sử dụng API Lịch Quốc tế nội bộ của trình duyệt Web để tính Lịch Âm siêu nhẹ
const getLunarDate = (date: Date) => {
  try {
    const lunarStr = new Intl.DateTimeFormat('vi-VN-u-ca-chinese', {
      day: 'numeric', month: 'numeric', year: 'numeric'
    }).format(date);
    const [lDay, lMonth] = lunarStr.split('/');
    return { day: parseInt(lDay), month: parseInt(lMonth) };
  } catch (e) {
    return { day: date.getDate(), month: date.getMonth() + 1 };
  }
};

// --- DỮ LIỆU SỰ KIỆN LỄ TẾT VIỆT NAM ---
const HOLIDAYS: Record<string, string> = {
  '1/1': 'Tết Dương Lịch',
  '14/2': 'Lễ Tình nhân',
  '8/3': 'Quốc tế Phụ nữ',
  '30/4': 'Giải phóng miền Nam',
  '1/5': 'Quốc tế Lao động',
  '7/5': 'Chiến thắng Điện Biên Phủ',
  '19/5': 'Sinh nhật Bác Hồ',
  '2/9': 'Quốc khánh',
  '20/10': 'Phụ nữ Việt Nam',
  '20/11': 'Nhà giáo Việt Nam',
  '22/12': 'QĐND Việt Nam'
};

const LUNAR_HOLIDAYS: Record<string, string> = {
  '1/1': 'Tết Nguyên Đán',
  '15/1': 'Tết Nguyên Tiêu',
  '10/3': 'Giỗ tổ Hùng Vương',
  '15/4': 'Lễ Phật Đản',
  '5/5': 'Tết Đoan Ngọ',
  '15/7': 'Lễ Vu Lan',
  '15/8': 'Tết Trung Thu',
  '23/12': 'Ông Công Ông Táo'
};

interface UserEvent {
  id: string;
  dateStr: string; // YYYY-MM-DD
  title: string;
  time: string;
}

export default function Calendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [events, setEvents] = useState<UserEvent[]>([]);
  const [showEventModal, setShowEventModal] = useState(false);
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventTime, setNewEventTime] = useState('08:00');

  // --- QUẢN LÝ SỰ KIỆN VÀ THÔNG BÁO ---
  useEffect(() => {
    // Xin quyền bật thông báo (Notification) trên điện thoại/máy tính
    if ('Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
      Notification.requestPermission();
    }
    const saved = localStorage.getItem('user_events');
    if (saved) setEvents(JSON.parse(saved));
  }, []);

  // Vòng lặp kiểm tra giờ để báo thức sự kiện
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      
      events.forEach(ev => {
        if (ev.dateStr === dateStr && ev.time === timeStr) {
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('Sự kiện Lịch Vạn Niên', { body: ev.title, icon: '/favicon.ico' });
          } else {
            alert(`SỰ KIỆN ĐẾN HẠN: ${ev.title}`);
          }
        }
      });
    }, 60000); // Quét mỗi 1 phút
    return () => clearInterval(interval);
  }, [events]);

  const saveEvents = (newEvents: UserEvent[]) => {
    setEvents(newEvents);
    localStorage.setItem('user_events', JSON.stringify(newEvents));
  };

  const handleAddEvent = () => {
    if (!newEventTitle) return;
    const dateStr = `${selectedDate.getFullYear()}-${(selectedDate.getMonth()+1).toString().padStart(2,'0')}-${selectedDate.getDate().toString().padStart(2,'0')}`;
    const newEv: UserEvent = { id: Date.now().toString(), dateStr, title: newEventTitle, time: newEventTime };
    saveEvents([...events, newEv]);
    setNewEventTitle('');
    setShowEventModal(false);
  };

  const handleDeleteEvent = (id: string) => {
    saveEvents(events.filter(e => e.id !== id));
  };

  // --- LOGIC XUẤT LƯỚI LỊCH (GRID) ---
  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => {
    let day = new Date(year, month, 1).getDay();
    return day === 0 ? 6 : day - 1; // Quy đổi: Thứ 2 là cột đầu tiên
  };

  const generateMonthGrid = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    
    const grid = [];
    
    // Tạo ô trống cho những ngày đầu tháng
    for (let i = 0; i < firstDay; i++) {
      grid.push(<div key={`empty-${i}`} className="h-20 sm:h-24 border border-[#1e293b] opacity-20 bg-black/20"></div>);
    }
    
    // Đổ dữ liệu ngày
    for (let d = 1; d <= daysInMonth; d++) {
      const dateObj = new Date(year, month, d);
      const isSelected = selectedDate.getDate() === d && selectedDate.getMonth() === month && selectedDate.getFullYear() === year;
      const isToday = new Date().getDate() === d && new Date().getMonth() === month && new Date().getFullYear() === year;
      
      const lunar = getLunarDate(dateObj);
      const dateStr = `${year}-${(month+1).toString().padStart(2,'0')}-${d.toString().padStart(2,'0')}`;
      const dayEvents = events.filter(e => e.dateStr === dateStr);
      
      const solarKey = `${d}/${month+1}`;
      const lunarKey = `${lunar.day}/${lunar.month}`;
      const isHoliday = HOLIDAYS[solarKey] || LUNAR_HOLIDAYS[lunarKey];

      grid.push(
        <div 
          key={d} 
          onClick={() => setSelectedDate(dateObj)}
          className={`h-20 sm:h-24 border border-[#1e293b] p-1 sm:p-2 cursor-pointer transition-all flex flex-col relative group
            ${isSelected ? 'bg-emerald-900/40 border-emerald-500' : 'bg-[#0a0f18] hover:bg-[#1e293b]'}
            ${isToday ? 'bg-blue-900/20 ring-1 ring-blue-500/50' : ''}
          `}
        >
          <div className="flex justify-between items-start">
            <span className={`text-lg sm:text-xl font-bold ${isHoliday || new Date(year, month, d).getDay() === 0 ? 'text-rose-500' : 'text-slate-200'}`}>
              {d}
            </span>
            <span className={`text-[10px] sm:text-xs font-medium ${lunar.day === 1 || lunar.day === 15 ? 'text-emerald-400 font-bold' : 'text-slate-500'}`}>
              {lunar.day === 1 ? `${lunar.day}/${lunar.month}` : lunar.day}
            </span>
          </div>
          
          <div className="mt-auto overflow-hidden">
            {isHoliday && <div className="text-[8px] sm:text-[9px] text-rose-500 leading-tight truncate font-semibold">{HOLIDAYS[solarKey] || LUNAR_HOLIDAYS[lunarKey]}</div>}
            {dayEvents.length > 0 && (
              <div className="flex gap-1 mt-1 items-center">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                <span className="text-[8px] sm:text-[10px] text-blue-400 truncate hidden sm:block">{dayEvents.length} sự kiện</span>
              </div>
            )}
          </div>
        </div>
      );
    }
    return grid;
  };

  const selLunar = getLunarDate(selectedDate);
  const selSolarKey = `${selectedDate.getDate()}/${selectedDate.getMonth()+1}`;
  const selLunarKey = `${selLunar.day}/${selLunar.month}`;
  const selHoliday = HOLIDAYS[selSolarKey] || LUNAR_HOLIDAYS[selLunarKey];
  const selDateStr = `${selectedDate.getFullYear()}-${(selectedDate.getMonth()+1).toString().padStart(2,'0')}-${selectedDate.getDate().toString().padStart(2,'0')}`;
  const selEvents = events.filter(e => e.dateStr === selDateStr);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-5xl mx-auto pb-10">
      
      {/* 1. KHU VỰC HIỂN THỊ CHI TIẾT NGÀY */}
      <div className="bg-[#05070a] border border-emerald-900/50 rounded-2xl overflow-hidden shadow-2xl">
        <div className="bg-emerald-700 px-6 py-4 flex justify-between items-center">
          <h2 className="text-white font-bold text-lg uppercase tracking-widest flex items-center gap-2">
            <CalendarIcon size={20} /> Lịch Vạn Niên
          </h2>
          <button onClick={() => { setSelectedDate(new Date()); setCurrentDate(new Date()); }} className="px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded text-xs text-white font-semibold transition flex items-center gap-2">
            <CalendarIcon size={14}/> Hôm nay
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-800/50 p-6 sm:p-10">
          {/* Dương Lịch */}
          <div className="flex flex-col items-center justify-center p-4">
            <span className="text-slate-400 font-bold tracking-widest uppercase mb-2">Dương Lịch</span>
            <div className="text-8xl sm:text-9xl font-black text-emerald-500 mb-4">{selectedDate.getDate()}</div>
            <span className="text-lg text-slate-300 font-semibold">Tháng {(selectedDate.getMonth() + 1).toString().padStart(2, '0')} Năm {selectedDate.getFullYear()}</span>
            <span className="text-sm text-slate-500 mt-2 tracking-widest uppercase">Thứ {['Chủ nhật', 'Hai', 'Ba', 'Tư', 'Năm', 'Sáu', 'Bảy'][selectedDate.getDay()]}</span>
          </div>

          {/* Âm Lịch */}
          <div className="flex flex-col items-center justify-center p-4">
            <span className="text-slate-400 font-bold tracking-widest uppercase mb-2">Âm Lịch</span>
            <div className="text-8xl sm:text-9xl font-black text-rose-500 mb-4">{selLunar.day}</div>
            <span className="text-lg text-slate-300 font-semibold">Tháng {selLunar.month} Năm {getCanChiYear(selectedDate.getFullYear())}</span>
            {selHoliday ? (
              <span className="text-sm text-rose-500 font-bold mt-2 bg-rose-500/10 px-4 py-1.5 rounded-full">{selHoliday}</span>
            ) : (
              <span className="text-sm text-slate-500 mt-2 tracking-widest uppercase">Bình thường</span>
            )}
          </div>
        </div>

        {/* Thông tin sự kiện và phong thủy */}
        <div className="bg-slate-900/40 p-6 border-t border-[#1e293b] text-sm text-slate-300">
           <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="space-y-1">
                <p><strong className="text-emerald-400 font-semibold">Năm Can Chi:</strong> {getCanChiYear(selectedDate.getFullYear())}</p>
                <p><strong className="text-emerald-400 font-semibold">Giờ Hoàng Đạo:</strong> Tý (23-1h), Dần (3-5h), Mão (5-7h), Ngọ (11-13h), Mùi (13-15h), Dậu (17-19h)</p>
              </div>
              
              <button onClick={() => setShowEventModal(true)} className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-bold transition shadow-lg shadow-emerald-900/50">
                <Plus size={18} /> Thêm sự kiện
              </button>
           </div>

           {selEvents.length > 0 && (
             <div className="mt-6 pt-4 border-t border-[#1e293b]">
               <strong className="text-blue-400 flex items-center gap-2 mb-3 text-sm uppercase tracking-widest"><Bell size={16}/> Lịch trình ngày {selectedDate.getDate()}:</strong>
               <ul className="space-y-2">
                 {selEvents.map(ev => (
                   <li key={ev.id} className="flex items-center justify-between bg-black/60 px-4 py-3 rounded-lg border border-[#1e293b]">
                      <span className="text-slate-200 font-medium"><span className="text-emerald-400 mr-2">{ev.time}</span> {ev.title}</span>
                      <button onClick={() => handleDeleteEvent(ev.id)} className="text-rose-500 hover:text-rose-400 p-2 rounded hover:bg-rose-500/10 transition"><Trash2 size={16}/></button>
                   </li>
                 ))}
               </ul>
             </div>
           )}
        </div>
      </div>

      {/* 2. KHU VỰC LƯỚI LỊCH */}
      <div className="bg-[#05070a] border border-[#1e293b] rounded-2xl overflow-hidden shadow-xl">
        <div className="bg-[#0a0f18] px-6 py-4 flex flex-col sm:flex-row items-center justify-between border-b border-[#1e293b] gap-4">
          <div className="flex items-center gap-4">
            <button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() - 1)))} className="p-2 bg-emerald-900/20 hover:bg-emerald-500/20 rounded-lg text-emerald-500 transition">
              <ChevronLeft size={20} />
            </button>
            <span className="text-lg font-bold text-emerald-500 uppercase tracking-widest w-32 text-center">Tháng {currentDate.getMonth() + 1}</span>
            <button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() + 1)))} className="p-2 bg-emerald-900/20 hover:bg-emerald-500/20 rounded-lg text-emerald-500 transition">
              <ChevronRight size={20} />
            </button>
          </div>
          
          <div className="flex gap-2 w-full sm:w-auto">
            <select 
              value={currentDate.getMonth()} 
              onChange={(e) => setCurrentDate(new Date(currentDate.getFullYear(), parseInt(e.target.value), 1))}
              className="flex-1 sm:w-auto bg-[#1e293b] border border-slate-700 text-slate-200 rounded-lg px-3 py-2 text-sm font-semibold focus:outline-none focus:border-emerald-500"
            >
              {Array.from({length: 12}).map((_, i) => <option key={i} value={i}>Tháng {i + 1}</option>)}
            </select>
            <select 
              value={currentDate.getFullYear()} 
              onChange={(e) => setCurrentDate(new Date(parseInt(e.target.value), currentDate.getMonth(), 1))}
              className="flex-1 sm:w-auto bg-[#1e293b] border border-slate-700 text-slate-200 rounded-lg px-3 py-2 text-sm font-semibold focus:outline-none focus:border-emerald-500"
            >
              {Array.from({length: 101}).map((_, i) => <option key={i} value={1950 + i}>Năm {1950 + i}</option>)}
            </select>
          </div>
        </div>

        <div className="p-4 sm:p-6 bg-[#05070a]">
          <div className="grid grid-cols-7 gap-px mb-2 text-center text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-widest bg-[#0a0f18] py-3 rounded-lg border border-[#1e293b]">
            <div>Thứ 2</div><div>Thứ 3</div><div>Thứ 4</div><div>Thứ 5</div>
            <div>Thứ 6</div><div>Thứ 7</div><div className="text-rose-500">CN</div>
          </div>
          <div className="grid grid-cols-7 gap-px bg-[#1e293b] border border-[#1e293b] rounded-lg overflow-hidden">
            {generateMonthGrid()}
          </div>
        </div>
      </div>

      {/* 3. MODAL THÊM SỰ KIỆN */}
      {showEventModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-[#1e293b] rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-emerald-400 flex items-center gap-2">
                <Bell size={18} /> Ghi chú công việc
              </h3>
              <button onClick={() => setShowEventModal(false)} className="text-slate-500 hover:text-slate-300 bg-slate-800 p-1.5 rounded-md"><X size={18}/></button>
            </div>
            
            <p className="text-sm font-semibold text-slate-300 mb-4 bg-slate-800/50 p-3 rounded-lg">Ngày: {selectedDate.toLocaleDateString('vi-VN')}</p>
            
            <div className="space-y-4">
              <div>
                <label className="text-[11px] font-bold text-slate-500 mb-2 uppercase tracking-widest block">Nội dung</label>
                <input type="text" value={newEventTitle} onChange={e => setNewEventTitle(e.target.value)} placeholder="VD: Báo cáo công tác tuần..." className="w-full bg-[#05070a] border border-[#1e293b] rounded-lg p-3 text-slate-200 text-sm focus:outline-none focus:border-emerald-500 transition-colors" />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-500 mb-2 uppercase tracking-widest block">Thời gian (Giờ:Phút)</label>
                <input type="time" value={newEventTime} onChange={e => setNewEventTime(e.target.value)} className="w-full bg-[#05070a] border border-[#1e293b] rounded-lg p-3 text-slate-200 text-sm focus:outline-none focus:border-emerald-500 transition-colors" />
              </div>
              <button onClick={handleAddEvent} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold py-3.5 rounded-lg mt-6 transition shadow-lg shadow-emerald-900/50">
                LƯU SỰ KIỆN
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}