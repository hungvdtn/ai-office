import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Bell, Plus, Trash2, Calendar as CalendarIcon, X, MapPin, Clock, Edit3 } from 'lucide-react';

// --- THUẬT TOÁN CAN CHI ---
const CAN = ['Canh', 'Tân', 'Nhâm', 'Quý', 'Giáp', 'Ất', 'Bính', 'Đinh', 'Mậu', 'Kỷ'];
const CHI = ['Thân', 'Dậu', 'Tuất', 'Hợi', 'Tý', 'Sửu', 'Dần', 'Mão', 'Thìn', 'Tỵ', 'Ngọ', 'Mùi'];

const getCanChiYear = (year: number) => {
  return `${CAN[year % 10]} ${CHI[year % 12]}`;
};

// --- FIX LỖI NaN LỊCH ÂM (Dùng Regex Bắt Số Tuyệt Đối) ---
const getLunarDate = (date: Date) => {
  try {
    const lunarStr = new Intl.DateTimeFormat('vi-VN-u-ca-chinese', {
      day: 'numeric', month: 'numeric'
    }).format(date);
    
    // Tìm tất cả các con số trong chuỗi kết quả của trình duyệt
    const numbers = lunarStr.match(/\d+/g); 
    
    if (numbers && numbers.length >= 2) {
      return { day: parseInt(numbers[0], 10), month: parseInt(numbers[1], 10) };
    }
    // Backup an toàn
    return { day: date.getDate(), month: date.getMonth() + 1 }; 
  } catch (e) {
    return { day: date.getDate(), month: date.getMonth() + 1 };
  }
};

// --- DỮ LIỆU SỰ KIỆN LỄ TẾT CHI TIẾT ---
const HOLIDAYS: Record<string, string> = {
  '1/1': 'Tết Dương lịch',
  '9/1': 'Ngày HSSV Việt Nam',
  '3/2': 'Ngày thành lập Đảng',
  '14/2': 'Lễ Tình nhân',
  '27/2': 'Ngày thầy thuốc VN',
  '8/3': 'Quốc tế Phụ nữ',
  '20/3': 'Quốc tế Hạnh phúc',
  '26/3': 'Thành lập Đoàn TNCS HCM',
  '1/4': 'Cá tháng Tư',
  '30/4': 'Giải phóng miền Nam',
  '1/5': 'Quốc tế Lao động',
  '7/5': 'Chiến thắng Điện Biên Phủ',
  '13/5': 'Ngày của Mẹ',
  '19/5': 'Sinh nhật Chủ tịch Hồ Chí Minh',
  '1/6': 'Quốc tế Thiếu nhi',
  '17/6': 'Ngày của Cha',
  '21/6': 'Ngày Báo chí VN',
  '28/6': 'Ngày Gia đình VN',
  '11/7': 'Dân số Thế giới',
  '27/7': 'Thương binh Liệt sĩ',
  '28/7': 'Thành lập Công đoàn VN',
  '19/8': 'Cách mạng Tháng Tám',
  '2/9': 'Quốc khánh',
  '10/9': 'Thành lập MTTQ VN',
  '1/10': 'Quốc tế Người cao tuổi',
  '10/10': 'Giải phóng Thủ đô',
  '13/10': 'Doanh nhân Việt Nam',
  '20/10': 'Phụ nữ Việt Nam',
  '31/10': 'Halloween',
  '9/11': 'Pháp luật Việt Nam',
  '19/11': 'Quốc tế Nam giới',
  '20/11': 'Nhà giáo Việt Nam',
  '22/12': 'Thành lập QĐND VN',
  '23/11': 'Thành lập Hội Chữ thập đỏ VN',
  '1/12': 'Thế giới phòng chống AIDS',
  '19/12': 'Toàn quốc Kháng chiến',
  '24/12': 'Lễ Giáng sinh'
};

const LUNAR_HOLIDAYS: Record<string, string> = {
  '1/1': 'Tết Nguyên đán',
  '15/1': 'Tết Nguyên Tiêu',
  '3/3': 'Tết Hàn thực',
  '10/3': 'Giỗ tổ Hùng Vương',
  '15/4': 'Lễ Phật Đản',
  '5/5': 'Tết Đoan ngọ',
  '7/7': 'Lễ Thất tịch',
  '15/7': 'Lễ Vu Lan',
  '15/8': 'Tết Trung thu',
  '9/9': 'Tết Trùng cửu',
  '10/10': 'Tết Trùng thập',
  '15/10': 'Tết Hạ Nguyên',
  '23/12': 'Ông Táo về trời'
};

interface UserEvent {
  id: string;
  dateStr: string; // YYYY-MM-DD
  title: string;
  time: string; // HH:mm
  location?: string;
  reminderAdvance: number; // Tính bằng phút
}

export default function Calendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  
  // State Sự kiện
  const [events, setEvents] = useState<UserEvent[]>([]);
  const [showEventModal, setShowEventModal] = useState(false);
  
  // Form Sự kiện
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventTime, setNewEventTime] = useState('08:00');
  const [newEventLocation, setNewEventLocation] = useState('');
  const [newReminderAdvance, setNewReminderAdvance] = useState<number>(0);

  // Load dữ liệu
  useEffect(() => {
    if ('Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
      Notification.requestPermission();
    }
    const saved = localStorage.getItem('user_events');
    if (saved) setEvents(JSON.parse(saved));
  }, []);

  // Vòng lặp báo thức
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      
      events.forEach(ev => {
        const [evY, evMo, evD] = ev.dateStr.split('-').map(Number);
        const [evH, evM] = ev.time.split(':').map(Number);
        const eventTime = new Date(evY, evMo - 1, evD, evH, evM);
        
        const remindTime = new Date(eventTime.getTime() - (ev.reminderAdvance * 60000));
        
        if (remindTime.getFullYear() === now.getFullYear() &&
            remindTime.getMonth() === now.getMonth() &&
            remindTime.getDate() === now.getDate() &&
            remindTime.getHours() === now.getHours() &&
            remindTime.getMinutes() === now.getMinutes()) {
            
            const msg = `SỰ KIỆN: ${ev.title} ${ev.location ? `\n📍 Địa điểm: ${ev.location}` : ''}\n⏰ Lúc: ${ev.time}`;
            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification('Lịch Vạn Niên', { body: msg, icon: '/favicon.ico' });
            } else {
              alert(msg);
            }
        }
      });
    }, 60000); 
    return () => clearInterval(interval);
  }, [events]);

  const saveEvents = (newEvents: UserEvent[]) => {
    setEvents(newEvents);
    localStorage.setItem('user_events', JSON.stringify(newEvents));
  };

  const openModalForAdd = () => {
    setEditingId(null);
    setNewEventTitle('');
    setNewEventLocation('');
    setNewEventTime('08:00');
    setNewReminderAdvance(0);
    setShowEventModal(true);
  };

  const openModalForEdit = (ev: UserEvent) => {
    setEditingId(ev.id);
    setNewEventTitle(ev.title);
    setNewEventTime(ev.time);
    setNewEventLocation(ev.location || '');
    setNewReminderAdvance(ev.reminderAdvance || 0);
    setShowEventModal(true);
  };

  const handleSaveEvent = () => {
    if (!newEventTitle) return;
    const dateStr = `${selectedDate.getFullYear()}-${(selectedDate.getMonth()+1).toString().padStart(2,'0')}-${selectedDate.getDate().toString().padStart(2,'0')}`;
    
    if (editingId) {
      const updatedEvents = events.map(e => e.id === editingId ? {
        ...e, title: newEventTitle, time: newEventTime, location: newEventLocation, reminderAdvance: newReminderAdvance
      } : e);
      saveEvents(updatedEvents);
    } else {
      const newEv: UserEvent = { 
        id: Date.now().toString(), 
        dateStr, 
        title: newEventTitle, 
        time: newEventTime, 
        location: newEventLocation,
        reminderAdvance: newReminderAdvance
      };
      saveEvents([...events, newEv]);
    }
    setShowEventModal(false);
  };

  const handleDeleteEvent = (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); 
    saveEvents(events.filter(e => e.id !== id));
  };

  // --- LOGIC XUẤT LƯỚI LỊCH (TRÀN NGÀY THÁNG TRƯỚC/SAU) ---
  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => {
    let day = new Date(year, month, 1).getDay();
    return day === 0 ? 6 : day - 1; 
  };

  const generateMonthGrid = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const daysInPrevMonth = getDaysInMonth(year, month - 1);
    const firstDay = getFirstDayOfMonth(year, month);
    
    const grid = [];
    
    // Ngày tháng trước (Làm mờ)
    for (let i = 0; i < firstDay; i++) {
      const d = daysInPrevMonth - firstDay + i + 1;
      const prevDate = new Date(year, month - 1, d);
      const lunar = getLunarDate(prevDate);
      grid.push(
        <div key={`prev-${i}`} onClick={() => {setCurrentDate(prevDate); setSelectedDate(prevDate);}} className="h-20 sm:h-24 p-1 sm:p-2 border border-[#1e293b] opacity-30 cursor-pointer hover:bg-[#1e293b]">
           <div className="flex justify-between items-start">
            <span className="text-lg sm:text-xl font-bold text-slate-500">{d}</span>
            <span className="text-xs font-medium text-slate-600">{lunar.day}</span>
          </div>
        </div>
      );
    }
    
    // Ngày tháng này
    for (let d = 1; d <= daysInMonth; d++) {
      const dateObj = new Date(year, month, d);
      const isSelected = selectedDate.getDate() === d && selectedDate.getMonth() === month && selectedDate.getFullYear() === year;
      const isToday = new Date().getDate() === d && new Date().getMonth() === month && new Date().getFullYear() === year;
      const isSunday = dateObj.getDay() === 0;
      
      const lunar = getLunarDate(dateObj);
      const dateStr = `${year}-${(month+1).toString().padStart(2,'0')}-${d.toString().padStart(2,'0')}`;
      const dayEvents = events.filter(e => e.dateStr === dateStr);
      
      const solarKey = `${d}/${month+1}`;
      const lunarKey = `${lunar.day}/${lunar.month}`;
      const isHoliday = HOLIDAYS[solarKey] || LUNAR_HOLIDAYS[lunarKey];

      grid.push(
        <div 
          key={`cur-${d}`} 
          onClick={() => setSelectedDate(dateObj)}
          className={`h-20 sm:h-24 border border-[#1e293b] p-1 sm:p-2 cursor-pointer transition-all flex flex-col relative group
            ${isSelected ? 'bg-sky-900/40 border-sky-400 shadow-[0_0_15px_rgba(56,189,248,0.2)] z-10' : 'bg-[#0a0f18] hover:bg-[#1e293b]'}
            ${isToday ? 'ring-1 ring-sky-500/50' : ''}
          `}
        >
          <div className="flex justify-between items-start">
            <span className={`text-lg sm:text-xl font-bold ${isHoliday || isSunday ? 'text-red-400' : 'text-slate-200'}`}>
              {d}
            </span>
            <span className={`text-[11px] sm:text-sm font-medium ${lunar.day === 1 || lunar.day === 15 ? 'text-blue-400 font-bold' : 'text-slate-500'}`}>
              {lunar.day === 1 ? `${lunar.day}/${lunar.month}` : lunar.day}
            </span>
          </div>
          
          <div className="mt-auto overflow-hidden">
            {isHoliday && <div className="text-[9px] sm:text-[10px] text-red-400 leading-tight truncate font-semibold">{HOLIDAYS[solarKey] || LUNAR_HOLIDAYS[lunarKey]}</div>}
            {dayEvents.length > 0 && (
              <div className="flex gap-1 mt-1 items-center">
                <div className="w-1.5 h-1.5 rounded-full bg-sky-400"></div>
                <span className="text-[9px] sm:text-[10px] text-sky-400 truncate hidden sm:block">{dayEvents.length} sự kiện</span>
              </div>
            )}
          </div>
        </div>
      );
    }

    // Ngày tháng sau (Làm mờ)
    const totalCells = firstDay + daysInMonth;
    const remainingCells = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
    for (let i = 0; i < remainingCells; i++) {
      const d = i + 1;
      const nextDate = new Date(year, month + 1, d);
      const lunar = getLunarDate(nextDate);
      grid.push(
        <div key={`next-${i}`} onClick={() => {setCurrentDate(nextDate); setSelectedDate(nextDate);}} className="h-20 sm:h-24 p-1 sm:p-2 border border-[#1e293b] opacity-30 cursor-pointer hover:bg-[#1e293b]">
           <div className="flex justify-between items-start">
            <span className="text-lg sm:text-xl font-bold text-slate-500">{d}</span>
            <span className="text-xs font-medium text-slate-600">{lunar.day}</span>
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
      
      {/* 1. CARD HIỂN THỊ CHI TIẾT */}
      <div className="bg-[#05070a] border border-sky-900/50 rounded-2xl overflow-hidden shadow-2xl">
        <div className="bg-sky-700 px-6 py-4 flex justify-between items-center">
          <h2 className="text-white font-bold text-lg uppercase tracking-widest flex items-center gap-2">
            <CalendarIcon size={20} /> Lịch Vạn Niên
          </h2>
          <button onClick={() => { setSelectedDate(new Date()); setCurrentDate(new Date()); }} className="px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded text-xs text-white font-semibold transition flex items-center gap-2">
            <CalendarIcon size={14}/> Hôm nay
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-800/50 p-6 sm:p-10">
          <div className="flex flex-col items-center justify-center p-4">
            <span className="text-slate-400 font-bold tracking-widest uppercase mb-2">Dương Lịch</span>
            <div className="text-8xl sm:text-9xl font-black text-sky-400 mb-4">{selectedDate.getDate()}</div>
            <span className="text-lg text-slate-300 font-semibold">Tháng {(selectedDate.getMonth() + 1).toString().padStart(2, '0')} Năm {selectedDate.getFullYear()}</span>
            <span className="text-sm text-slate-500 mt-2 tracking-widest uppercase">Thứ {['Chủ nhật', 'Hai', 'Ba', 'Tư', 'Năm', 'Sáu', 'Bảy'][selectedDate.getDay()]}</span>
          </div>

          <div className="flex flex-col items-center justify-center p-4">
            <span className="text-slate-400 font-bold tracking-widest uppercase mb-2">Âm Lịch</span>
            <div className="text-8xl sm:text-9xl font-black text-blue-500 mb-4">{selLunar.day}</div>
            <span className="text-lg text-slate-300 font-semibold">Tháng {selLunar.month} Năm {getCanChiYear(selectedDate.getFullYear())}</span>
            {selHoliday ? (
              <span className="text-sm text-red-400 font-bold mt-2 bg-red-400/10 px-4 py-1.5 rounded-full border border-red-400/20">{selHoliday}</span>
            ) : (
              <span className="text-sm text-slate-500 mt-2 tracking-widest uppercase">Bình thường</span>
            )}
          </div>
        </div>

        <div className="bg-slate-900/40 p-6 border-t border-[#1e293b] text-sm text-slate-300">
           <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="space-y-1">
                <p><strong className="text-sky-400 font-semibold">Năm Can Chi:</strong> {getCanChiYear(selectedDate.getFullYear())}</p>
                <p><strong className="text-sky-400 font-semibold">Giờ Hoàng Đạo:</strong> Tý (23-1h), Dần (3-5h), Mão (5-7h), Ngọ (11-13h), Mùi (13-15h), Dậu (17-19h)</p>
              </div>
              
              <button onClick={openModalForAdd} className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-sm font-bold transition shadow-lg shadow-sky-900/50">
                <Plus size={18} /> Thêm sự kiện
              </button>
           </div>

           {selEvents.length > 0 && (
             <div className="mt-6 pt-4 border-t border-[#1e293b]">
               <strong className="text-sky-400 flex items-center gap-2 mb-3 text-sm uppercase tracking-widest"><Bell size={16}/> Lịch trình ngày {selectedDate.getDate()}:</strong>
               <ul className="space-y-2">
                 {selEvents.map(ev => (
                   <li 
                      key={ev.id} 
                      onClick={() => openModalForEdit(ev)}
                      className="flex flex-col bg-black/60 px-4 py-3 rounded-lg border border-[#1e293b] cursor-pointer hover:border-sky-500/50 transition-colors group"
                   >
                      <div className="flex items-center justify-between">
                        <span className="text-slate-200 font-medium flex items-center gap-2">
                          <Clock size={14} className="text-sky-400" /> <span className="text-sky-400 font-bold">{ev.time}</span> {ev.title}
                        </span>
                        <div className="flex items-center gap-1 opacity-50 group-hover:opacity-100 transition-opacity">
                          <button className="text-slate-400 hover:text-sky-400 p-1"><Edit3 size={16}/></button>
                          <button onClick={(e) => handleDeleteEvent(ev.id, e)} className="text-slate-400 hover:text-red-400 p-1"><Trash2 size={16}/></button>
                        </div>
                      </div>
                      {ev.location && (
                        <div className="flex items-center gap-1.5 mt-2 text-xs text-slate-400 ml-6">
                          <MapPin size={12} /> {ev.location}
                        </div>
                      )}
                      <div className="text-[10px] text-slate-500 ml-6 mt-1 uppercase tracking-wider">
                        Báo trước: {ev.reminderAdvance === 0 ? 'Đúng giờ' : ev.reminderAdvance >= 1440 ? `${ev.reminderAdvance/1440} ngày` : ev.reminderAdvance >= 60 ? `${ev.reminderAdvance/60} giờ` : `${ev.reminderAdvance} phút`}
                      </div>
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
            <button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() - 1)))} className="p-2 bg-sky-900/20 hover:bg-sky-500/20 rounded-lg text-sky-400 transition">
              <ChevronLeft size={20} />
            </button>
            <span className="text-lg font-bold text-sky-400 uppercase tracking-widest w-32 text-center">Tháng {currentDate.getMonth() + 1}</span>
            <button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() + 1)))} className="p-2 bg-sky-900/20 hover:bg-sky-500/20 rounded-lg text-sky-400 transition">
              <ChevronRight size={20} />
            </button>
          </div>
          
          <div className="flex gap-2 w-full sm:w-auto">
            <select 
              value={currentDate.getMonth()} 
              onChange={(e) => setCurrentDate(new Date(currentDate.getFullYear(), parseInt(e.target.value), 1))}
              className="flex-1 sm:w-auto bg-[#1e293b] border border-slate-700 text-slate-200 rounded-lg px-3 py-2 text-sm font-semibold focus:outline-none focus:border-sky-500"
            >
              {Array.from({length: 12}).map((_, i) => <option key={i} value={i}>Tháng {i + 1}</option>)}
            </select>
            <select 
              value={currentDate.getFullYear()} 
              onChange={(e) => setCurrentDate(new Date(parseInt(e.target.value), currentDate.getMonth(), 1))}
              className="flex-1 sm:w-auto bg-[#1e293b] border border-slate-700 text-slate-200 rounded-lg px-3 py-2 text-sm font-semibold focus:outline-none focus:border-sky-500"
            >
              {Array.from({length: 101}).map((_, i) => <option key={i} value={1950 + i}>Năm {1950 + i}</option>)}
            </select>
          </div>
        </div>

        <div className="p-4 sm:p-6 bg-[#05070a]">
          <div className="grid grid-cols-7 gap-px mb-2 text-center text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-widest bg-[#0a0f18] py-3 rounded-lg border border-[#1e293b]">
            <div>Thứ 2</div><div>Thứ 3</div><div>Thứ 4</div><div>Thứ 5</div>
            <div>Thứ 6</div><div>Thứ 7</div><div className="text-red-400">CN</div>
          </div>
          <div className="grid grid-cols-7 gap-px bg-[#1e293b] border border-[#1e293b] rounded-lg overflow-hidden">
            {generateMonthGrid()}
          </div>
        </div>
      </div>

      {/* 3. MODAL THÊM/SỬA SỰ KIỆN */}
      {showEventModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-[#1e293b] rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-sky-400 flex items-center gap-2">
                <Bell size={18} /> {editingId ? 'Sửa Lịch trình' : 'Ghi chú công việc'}
              </h3>
              <button onClick={() => setShowEventModal(false)} className="text-slate-500 hover:text-slate-300 bg-slate-800 p-1.5 rounded-md"><X size={18}/></button>
            </div>
            
            <p className="text-sm font-semibold text-slate-300 mb-4 bg-slate-800/50 p-3 rounded-lg border border-[#1e293b]">
              Ngày: {selectedDate.toLocaleDateString('vi-VN')}
            </p>
            
            <div className="space-y-4">
              <div>
                <label className="text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-widest block">Nội dung <span className="text-red-400">*</span></label>
                <input type="text" value={newEventTitle} onChange={e => setNewEventTitle(e.target.value)} placeholder="VD: Báo cáo công tác tuần..." className="w-full bg-[#05070a] border border-[#1e293b] rounded-lg p-3 text-slate-200 text-sm focus:outline-none focus:border-sky-500 transition-colors" />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-widest block">Thời gian</label>
                  <input type="time" value={newEventTime} onChange={e => setNewEventTime(e.target.value)} className="w-full bg-[#05070a] border border-[#1e293b] rounded-lg p-3 text-slate-200 text-sm focus:outline-none focus:border-sky-500 transition-colors" />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-widest block">Báo trước</label>
                  <select value={newReminderAdvance} onChange={e => setNewReminderAdvance(Number(e.target.value))} className="w-full bg-[#05070a] border border-[#1e293b] rounded-lg p-3 text-slate-200 text-sm focus:outline-none focus:border-sky-500 transition-colors">
                    <option value={0}>Đúng giờ</option>
                    <option value={15}>15 phút</option>
                    <option value={60}>1 tiếng</option>
                    <option value={1440}>1 ngày (24h)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-widest block flex items-center gap-1">
                  <MapPin size={12}/> Địa điểm (Không bắt buộc)
                </label>
                <input type="text" value={newEventLocation} onChange={e => setNewEventLocation(e.target.value)} placeholder="VD: Phòng họp số 1..." className="w-full bg-[#05070a] border border-[#1e293b] rounded-lg p-3 text-slate-200 text-sm focus:outline-none focus:border-sky-500 transition-colors" />
              </div>

              <button onClick={handleSaveEvent} className="w-full bg-sky-600 hover:bg-sky-500 text-white text-sm font-bold py-3.5 rounded-lg mt-6 transition shadow-lg shadow-sky-900/50">
                {editingId ? 'CẬP NHẬT SỰ KIỆN' : 'LƯU SỰ KIỆN'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}