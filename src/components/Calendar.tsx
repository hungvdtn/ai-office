import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Bell, Plus, Trash2, Calendar as CalendarIcon, X, MapPin, Clock, Edit3, Star, StarHalf, Sun, Moon, ArrowRightLeft, Info, CheckCircle, AlertTriangle, GraduationCap } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Solar } from 'lunar-javascript';

// --- IMPORT TỪ FIREBASE ---
import { auth, db, googleProvider } from '../firebase';
import { signInWithPopup } from 'firebase/auth';
import { collection, query, where, getDocs, setDoc, doc, deleteDoc } from 'firebase/firestore';

const CAN_CHU = ['Giáp', 'Ất', 'Bính', 'Đinh', 'Mậu', 'Kỷ', 'Canh', 'Tân', 'Nhâm', 'Quý'];
const CHI_CHU = ['Tý', 'Sửu', 'Dần', 'Mão', 'Thìn', 'Tỵ', 'Ngọ', 'Mùi', 'Thân', 'Dậu', 'Tuất', 'Hợi'];
const TRUC_12 = ['Kiến', 'Trừ', 'Mãn', 'Bình', 'Định', 'Chấp', 'Phá', 'Nguy', 'Thành', 'Thâu', 'Khai', 'Bế'];
const NHI_THAP_BAT_TU = ['Giác', 'Cang', 'Đê', 'Phòng', 'Tâm', 'Vĩ', 'Cơ', 'Đẩu', 'Ngưu', 'Nữ', 'Hư', 'Nguy', 'Thất', 'Bích', 'Khuê', 'Lâu', 'Vị', 'Mão', 'Tất', 'Chủy', 'Sâm', 'Tỉnh', 'Quỷ', 'Liễu', 'Tinh', 'Trương', 'Dực', 'Chẩn'];

const getCanChiYear = (year: number) => {
  const can = ['Canh', 'Tân', 'Nhâm', 'Quý', 'Giáp', 'Ất', 'Bính', 'Đinh', 'Mậu', 'Kỷ'][year % 10];
  const chi = ['Thân', 'Dậu', 'Tuất', 'Hợi', 'Tý', 'Sửu', 'Dần', 'Mão', 'Thìn', 'Tỵ', 'Ngọ', 'Mùi'][year % 12];
  return `${can} ${chi}`;
};

const getCanChiDay = (date: Date) => {
  const anchor = Date.UTC(2024, 0, 1);
  const target = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.floor((target - anchor) / 86400000);
  const canIdx = (diffDays % 10 + 10) % 10;
  const chiIdx = (diffDays % 12 + 12) % 12;
  return { text: `${CAN_CHU[canIdx]} ${CHI_CHU[chiIdx]}`, chiIdx, canIdx };
};

const getLunarDate = (date: Date) => {
  try {
    const lunar = Solar.fromYmd(date.getFullYear(), date.getMonth() + 1, date.getDate()).getLunar();
    return { day: lunar.getDay(), month: lunar.getMonth() > 0 ? lunar.getMonth().toString() : `Nhuận ${Math.abs(lunar.getMonth())}` };
  } catch (e) {
    return { day: date.getDate(), month: (date.getMonth() + 1).toString() }; 
  }
};

const getDayEvaluation = (date: Date) => {
  const dayInfo = getCanChiDay(date);
  let mChi = 0;
  let lunarDay = date.getDate();
  
  try {
    const solar = Solar.fromYmd(date.getFullYear(), date.getMonth() + 1, date.getDate());
    const lunar = solar.getLunar();
    lunarDay = lunar.getDay();
    const CH_ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
    mChi = CH_ZHI.indexOf(lunar.getMonthZhiExact());
  } catch (e) {
    mChi = date.getMonth();
  }

  const dChi = dayInfo.chiIdx;   
  const hoangDaoMap: Record<number, number[]> = {
    2: [0, 1, 4, 5, 7, 10], 8: [0, 1, 4, 5, 7, 10],
    3: [2, 3, 6, 7, 9, 0],  9: [2, 3, 6, 7, 9, 0],
    4: [4, 5, 8, 9, 11, 2], 10: [4, 5, 8, 9, 11, 2],
    5: [6, 7, 10, 11, 1, 4], 11: [6, 7, 10, 11, 1, 4],
    0: [8, 9, 0, 1, 3, 6],   6: [8, 9, 0, 1, 3, 6],
    1: [10, 11, 2, 3, 5, 8], 7: [10, 11, 2, 3, 5, 8]
  };

  const isHoangDao = hoangDaoMap[mChi]?.includes(dChi);
  const isNguyetKy = [5, 14, 23].includes(lunarDay);
  const isTamNuong = [3, 7, 13, 18, 22, 27].includes(lunarDay);

  let score = 3.0; 
  let notes = [];
  let text = "Ngày Trung bình";

  if (isHoangDao) { score += 1.5; notes.push("Ngày Hoàng đạo"); text = "Ngày Tốt"; } 
  else { score -= 0.5; notes.push("Ngày Hắc đạo"); text = "Ngày Hắc đạo"; }
  if (isNguyetKy) { score -= 1.5; notes.push("Phạm Nguyệt Kỵ"); text = "Ngày Xấu (Bách Kỵ)"; }
  if (isTamNuong) { score -= 1.5; notes.push("Phạm Tam Nương"); text = "Ngày Xấu (Bách Kỵ)"; }

  score = Math.max(1.0, Math.min(5.0, score));
  if (score >= 4.5 && !isNguyetKy && !isTamNuong) text = "Ngày Rất Tốt";

  return { score: score.toFixed(1), description: notes.join(' - '), text, isHoangDao };
};

const getDayDetails = (date: Date) => {
  const dayInfo = getCanChiDay(date);
  let tietKhi = "Đang cập nhật...";
  let trucIdx = 0;

  try {
    const solar = Solar.fromYmd(date.getFullYear(), date.getMonth() + 1, date.getDate());
    const lunar = solar.getLunar();
    
    const currentJieQi = lunar.getJieQi() || lunar.getPrevJieQi().getName();
    const JIE_QI_MAP: any = {
      '立春': 'Lập Xuân', '雨水': 'Vũ Thủy', '惊蛰': 'Kinh Trập', '春分': 'Xuân Phân',
      '清明': 'Thanh Minh', '谷雨': 'Cốc Vũ', '立夏': 'Lập Hạ', '小满': 'Tiểu Mãn',
      '芒种': 'Mang Chủng', '夏至': 'Hạ Chí', '小暑': 'Tiểu Thử', '大暑': 'Đại Thử',
      '立秋': 'Lập Thu', '处暑': 'Xử Thử', '白露': 'Bạch Lộ', '秋分': 'Thu Phân',
      '寒露': 'Hàn Lộ', '霜降': 'Sương Giáng', '立冬': 'Lập Đông', '小雪': 'Tiểu Tuyết',
      '大雪': 'Đại Tuyết', '冬至': 'Đông Chí', '小寒': 'Tiểu Hàn', '大寒': 'Đại Hàn'
    };
    tietKhi = JIE_QI_MAP[currentJieQi] || currentJieQi;

    const CH_ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
    const exactMonthChiIdx = CH_ZHI.indexOf(lunar.getMonthZhiExact());
    trucIdx = (dayInfo.chiIdx - exactMonthChiIdx + 12) % 12;
  } catch(e) {
    trucIdx = dayInfo.chiIdx % 12;
  }

  const trucName = TRUC_12[trucIdx];

  const anchorDate = Date.UTC(2024, 0, 1);
  const targetDate = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const diff = Math.floor((targetDate - anchorDate) / 86400000);
  const saoIdx = (diff + 10) % 28;
  const saoName = NHI_THAP_BAT_TU[saoIdx];

  const nguHanhMap: any = { 0: 'Kim', 1: 'Thủy', 2: 'Hỏa', 3: 'Thổ', 4: 'Mộc' };
  const nguHanhName = nguHanhMap[dayInfo.canIdx % 5];

  const catTinh = [];
  const hungTinh = [];
  if (trucIdx === 0) { catTinh.push("Thiên Ân", "Thiên Hỷ"); hungTinh.push("Thổ Phủ"); }
  if (trucIdx === 1) { catTinh.push("Nguyệt Đức", "Thiên Quan"); hungTinh.push("Thiên Cương"); }
  if (trucIdx === 2) { catTinh.push("Thiên Phúc", "Phúc Sinh"); hungTinh.push("Tử Khí"); }
  if (trucIdx === 3) { catTinh.push("Nguyệt Ân", "Thiên Mã"); hungTinh.push("Cô Thần"); }
  if (trucIdx === 4) { catTinh.push("Tam Hợp", "Mẫu Thương"); hungTinh.push("Quả Tú"); }
  if (trucIdx === 5) { catTinh.push("Lục Hợp", "Ngũ Phú"); hungTinh.push("Kiếp Sát"); }
  if (trucIdx === 6) { catTinh.push("Giải Thần"); hungTinh.push("Đại Hao", "Nguyệt Phá"); }
  if (trucIdx === 7) { catTinh.push("Ích Hậu"); hungTinh.push("Bạch Hổ"); }
  if (trucIdx === 8) { catTinh.push("Thiên Y", "Thiên Tài"); hungTinh.push("Địa Tặc"); }
  if (trucIdx === 9) { catTinh.push("Sinh Khí", "Phúc Hậu"); hungTinh.push("Thiên Cẩu"); }
  if (trucIdx === 10) { catTinh.push("Thiên Đức", "Nguyệt Không"); hungTinh.push("Thiên Lại"); }
  if (trucIdx === 11) { catTinh.push("Thánh Tâm"); hungTinh.push("Chu Tước", "Câu Trận"); }

  if (['Khuê', 'Bích', 'Giác'].includes(saoName)) catTinh.push("Văn Xương");

  const eduAdvice = { should: [] as string[], avoid: [] as string[] };
  if (['Kiến', 'Thành', 'Khai'].includes(trucName)) {
    eduAdvice.should.push("Tổ chức lễ khai giảng, khai mạc năm học.", "Triển khai dự án giáo dục mới, ký kết hợp tác.");
  }
  if (['Khuê', 'Bích', 'Giác', 'Đẩu', 'Tỉnh'].includes(saoName)) {
    eduAdvice.should.push("Rất tốt để xuất bản bài báo khoa học, bảo vệ luận án.", "Nộp hồ sơ xin học bổng, vinh danh học sinh giỏi.");
  }
  if (eduAdvice.should.length === 0) {
    eduAdvice.should.push("Lên kế hoạch giảng dạy, nghiên cứu tài liệu.", "Thực hiện các công việc hành chính trường học bình thường.");
  }

  if (['Phá', 'Bế', 'Chấp'].includes(trucName)) {
    eduAdvice.avoid.push("Tránh tổ chức sự kiện giáo dục quy mô lớn.", "Tránh ký kết các hợp đồng đào tạo dài hạn.");
  }
  if (['Tâm', 'Vĩ', 'Cơ', 'Nguy'].includes(saoName)) {
    eduAdvice.avoid.push("Không nên khai giảng khóa học quan trọng.", "Tránh tổ chức thi cử hoặc đánh giá năng lực lớn.");
  }

  let hop = "Bình thường, làm các công việc hàng ngày.";
  let ky = "Không có kiêng kỵ lớn.";
  if (trucIdx === 0) { hop = "Khai trương, xuất hành, nhậm chức."; ky = "Động thổ, an táng."; }
  else if (trucIdx === 1) { hop = "Sửa chữa, quét dọn, giải oan."; ky = "Khai trương, ký hợp đồng."; }
  else if (trucIdx === 2) { hop = "Cầu tài, nhậm chức, tế tự."; ky = "Chữa bệnh, kiện cáo."; }
  else if (trucIdx === 3) { hop = "Họp mặt, di dời, san lấp."; ky = "Động thổ, gieo trồng."; }
  else if (trucIdx === 4) { hop = "Giao dịch, nạp tài, đính hôn."; ky = "Tố tụng, thưa kiện."; }
  else if (trucIdx === 5) { hop = "Lập khế ước, thu tiền, chăn nuôi."; ky = "Xuất hành, dời nhà."; }
  else if (trucIdx === 6) { hop = "Chữa bệnh, tháo dỡ."; ky = "Khai trương, xuất hành, an táng."; }
  else if (trucIdx === 7) { hop = "An sàng, tế tự."; ky = "Leo núi, mạo hiểm, đi thuyền."; }
  else if (trucIdx === 8) { hop = "Khai trương, nhập học, kết hôn."; ky = "Kiện tụng, phá dỡ."; }
  else if (trucIdx === 9) { hop = "Thu hoạch, mua sắm, nhập kho."; ky = "An táng, mai táng."; }
  else if (trucIdx === 10) { hop = "Khởi công, xuất hành, mở cửa hàng."; ky = "Động thổ, dọn rác."; }
  else if (trucIdx === 11) { hop = "Lấp hang lỗ, xây tường, vá vách."; ky = "Mở cửa hàng, chữa mắt."; }

  return { truc: trucName, sao: saoName, nguHanh: nguHanhName, tietKhi, hop, ky, catTinh, hungTinh, eduAdvice };
};

const renderStars = (scoreStr: string) => {
  const score = parseFloat(scoreStr);
  const fullStars = Math.floor(score);
  const hasHalf = score - fullStars >= 0.5;
  
  return (
      <div className="flex items-center gap-0.5 ml-2">
          {[1, 2, 3, 4, 5].map(i => {
              if (i <= fullStars) return <Star key={i} size={16} className="text-amber-400 fill-amber-400 drop-shadow-[0_0_5px_rgba(251,191,36,0.8)]" />;
              if (i === fullStars + 1 && hasHalf) return <StarHalf key={i} size={16} className="text-amber-400 fill-amber-400 drop-shadow-[0_0_5px_rgba(251,191,36,0.8)]" />;
              return <Star key={i} size={16} className="text-slate-600" />;
          })}
      </div>
  )
}

interface HolidayInfo { name: string; isDayOff: boolean; startYear: number; dayOffStartYear?: number; }

const HOLIDAYS: Record<string, HolidayInfo> = {
  '1/1': { name: 'Tết Dương lịch', isDayOff: true, startYear: 1946 },
  '9/1': { name: 'Ngày truyền thống HSSV', isDayOff: false, startYear: 1950 },
  '3/2': { name: 'Ngày thành lập Đảng', isDayOff: false, startYear: 1930 },
  '14/2': { name: 'Lễ Tình nhân', isDayOff: false, startYear: 0 },
  '27/2': { name: 'Ngày thầy thuốc VN', isDayOff: false, startYear: 1985 },
  '8/3': { name: 'Quốc tế Phụ nữ', isDayOff: false, startYear: 1910 },
  '20/3': { name: 'Quốc tế Hạnh phúc', isDayOff: false, startYear: 2014 },
  '26/3': { name: 'Thành lập Đoàn TNCS HCM', isDayOff: false, startYear: 1931 },
  '1/4': { name: 'Cá tháng Tư', isDayOff: false, startYear: 0 },
  '30/4': { name: 'Giải phóng miền Nam', isDayOff: true, startYear: 1975, dayOffStartYear: 1994 },
  '1/5': { name: 'Quốc tế Lao động', isDayOff: true, startYear: 1946 },
  '7/5': { name: 'Chiến thắng Điện Biên Phủ', isDayOff: false, startYear: 1954 },
  '13/5': { name: 'Ngày của Mẹ', isDayOff: false, startYear: 0 },
  '19/5': { name: 'Sinh nhật Bác Hồ', isDayOff: false, startYear: 1890 },
  '1/6': { name: 'Quốc tế Thiếu nhi', isDayOff: false, startYear: 1949 },
  '17/6': { name: 'Ngày của Cha', isDayOff: false, startYear: 0 },
  '21/6': { name: 'Ngày Báo chí VN', isDayOff: false, startYear: 1985 },
  '28/6': { name: 'Ngày Gia đình VN', isDayOff: false, startYear: 2001 },
  '11/7': { name: 'Dân số Thế giới', isDayOff: false, startYear: 1989 },
  '27/7': { name: 'Thương binh Liệt sĩ', isDayOff: false, startYear: 1947 },
  '28/7': { name: 'Thành lập Công đoàn VN', isDayOff: false, startYear: 1929 },
  '19/8': { name: 'Cách mạng Tháng Tám', isDayOff: false, startYear: 1945 },
  '28/8': { name: 'Truyền thống Tổ chức Nhà nước', isDayOff: false, startYear: 1945 },
  '2/9': { name: 'Quốc khánh', isDayOff: true, startYear: 1945 },
  '10/9': { name: 'Thành lập MTTQ VN', isDayOff: false, startYear: 1955 },
  '1/10': { name: 'Quốc tế Người cao tuổi', isDayOff: false, startYear: 1990 },
  '4/10': { name: 'Kỹ năng nghề Việt Nam', isDayOff: false, startYear: 2020 },
  '10/10': { name: 'Giải phóng Thủ đô', isDayOff: false, startYear: 1954 },
  '13/10': { name: 'Doanh nhân Việt Nam', isDayOff: false, startYear: 2004 },
  '20/10': { name: 'Phụ nữ Việt Nam', isDayOff: false, startYear: 1930 },
  '31/10': { name: 'Halloween', isDayOff: false, startYear: 0 },
  '9/11': { name: 'Pháp luật Việt Nam', isDayOff: false, startYear: 2012 },
  '19/11': { name: 'Quốc tế Nam giới', isDayOff: false, startYear: 1999 },
  '20/11': { name: 'Nhà giáo Việt Nam', isDayOff: false, startYear: 1982 },
  '23/11': { name: 'Thành lập Hội Chữ thập đỏ VN', isDayOff: false, startYear: 1946 },
  '24/11': { name: 'Ngày Văn hóa Việt Nam', isDayOff: true, startYear: 1946, dayOffStartYear: 2026 },
  '1/12': { name: 'Thế giới phòng chống AIDS', isDayOff: false, startYear: 1988 },
  '19/12': { name: 'Toàn quốc Kháng chiến', isDayOff: false, startYear: 1946 },
  '24/12': { name: 'Lễ Giáng sinh', isDayOff: false, startYear: 0 },
  '22/12': { name: 'Thành lập QĐND VN', isDayOff: false, startYear: 1944 }
};

const LUNAR_HOLIDAYS: Record<string, HolidayInfo> = {
  '1/1': { name: 'Tết Nguyên đán', isDayOff: true, startYear: 0 },
  '2/1': { name: 'Tết Nguyên đán', isDayOff: true, startYear: 0 },
  '3/1': { name: 'Tết Nguyên đán', isDayOff: true, startYear: 0 },
  '15/1': { name: 'Tết Nguyên Tiêu', isDayOff: false, startYear: 0 },
  '3/3': { name: 'Tết Hàn thực', isDayOff: false, startYear: 0 },
  '10/3': { name: 'Giỗ tổ Hùng Vương', isDayOff: true, startYear: 0, dayOffStartYear: 2007 },
  '15/4': { name: 'Lễ Phật Đản', isDayOff: false, startYear: 0 },
  '5/5': { name: 'Tết Đoan ngọ', isDayOff: false, startYear: 0 },
  '7/7': { name: 'Lễ Thất tịch', isDayOff: false, startYear: 0 },
  '15/7': { name: 'Lễ Vu Lan', isDayOff: false, startYear: 0 },
  '15/8': { name: 'Tết Trung thu', isDayOff: false, startYear: 0 },
  '9/9': { name: 'Tết Trùng cửu', isDayOff: false, startYear: 0 },
  '10/10': { name: 'Tết Trùng thập', isDayOff: false, startYear: 0 },
  '15/10': { name: 'Tết Hạ Nguyên', isDayOff: false, startYear: 0 },
  '23/12': { name: 'Ông Táo về trời', isDayOff: false, startYear: 0 },
  '29/12': { name: 'Tết Nguyên đán', isDayOff: true, startYear: 0 },
  '30/12': { name: 'Tết Nguyên đán', isDayOff: true, startYear: 0 }
};

interface UserEvent { id: string; dateStr: string; title: string; time: string; location?: string; reminderAdvance: number; userId?: string; }

export default function Calendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [events, setEvents] = useState<UserEvent[]>([]);
  
  // MODAL STATES
  const [showEventModal, setShowEventModal] = useState(false);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false); 
  const [showDayDetail, setShowDayDetail] = useState(false); 

  const [editingId, setEditingId] = useState<string | null>(null);
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventTime, setNewEventTime] = useState('08:00');
  const [newEventLocation, setNewEventLocation] = useState('');
  const [newReminderAdvance, setNewReminderAdvance] = useState<number>(0);

  const [convType, setConvType] = useState<'S2L' | 'L2S'>('S2L');
  const [cDay, setCDay] = useState('');
  const [cMonth, setCMonth] = useState('');
  const [cYear, setCYear] = useState(new Date().getFullYear().toString());
  const [cResult, setCResult] = useState('');
  const [cResultDate, setCResultDate] = useState<Date | null>(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        try {
          const q = query(collection(db, "events"), where("userId", "==", user.uid));
          const snapshot = await getDocs(q);
          const cloudEvents: UserEvent[] = [];
          snapshot.forEach(doc => cloudEvents.push(doc.data() as UserEvent));
          setEvents(cloudEvents);
          localStorage.setItem('user_events', JSON.stringify(cloudEvents));
          setShowLoginPrompt(false); 
        } catch (error) {
          console.error("Lỗi đồng bộ Firebase:", error);
        }
      } else {
        const saved = localStorage.getItem('user_events');
        if (saved) setEvents(JSON.parse(saved));
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if ('Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') { Notification.requestPermission(); }
    
    const interval = setInterval(() => {
      const now = new Date();
      events.forEach(ev => {
        const [evY, evMo, evD] = ev.dateStr.split('-').map(Number); const [evH, evM] = ev.time.split(':').map(Number);
        const eventTime = new Date(evY, evMo - 1, evD, evH, evM);
        const remindTime = new Date(eventTime.getTime() - (ev.reminderAdvance * 60000));
        
        if (remindTime.getFullYear() === now.getFullYear() && remindTime.getMonth() === now.getMonth() && remindTime.getDate() === now.getDate() && remindTime.getHours() === now.getHours() && remindTime.getMinutes() === now.getMinutes()) {
            const msg = `SỰ KIỆN: ${ev.title} ${ev.location ? `\n📍 Địa điểm: ${ev.location}` : ''}\n⏰ Lúc: ${ev.time}`;
            if ('Notification' in window && Notification.permission === 'granted') { new Notification('Lịch Vạn Niên', { body: msg, icon: '/favicon.ico' }); } 
            else { alert(msg); }
        }
      });
    }, 60000); 
    return () => clearInterval(interval);
  }, [events]);

  const openModalForAdd = () => { 
    if (!auth.currentUser) {
       setShowLoginPrompt(true);
       return;
    }
    setEditingId(null); setNewEventTitle(''); setNewEventLocation(''); setNewEventTime('08:00'); setNewReminderAdvance(0); setShowEventModal(true); 
  };
  
  const openModalForEdit = (ev: UserEvent) => { 
    if (!auth.currentUser) {
       setShowLoginPrompt(true);
       return;
    }
    setEditingId(ev.id); setNewEventTitle(ev.title); setNewEventTime(ev.time); setNewEventLocation(ev.location || ''); setNewReminderAdvance(ev.reminderAdvance || 0); setShowEventModal(true); 
  };

  const handleGoogleLogin = async () => {
    try { await signInWithPopup(auth, googleProvider); } 
    catch (error) { console.error("Đăng nhập thất bại", error); }
  };

  const handleSaveEvent = async () => {
    if (!newEventTitle || !auth.currentUser) return;
    const dateStr = `${selectedDate.getFullYear()}-${(selectedDate.getMonth()+1).toString().padStart(2,'0')}-${selectedDate.getDate().toString().padStart(2,'0')}`;
    
    let updatedEvents: UserEvent[] = [];
    
    if (editingId) { 
      const ev = { id: editingId, dateStr, title: newEventTitle, time: newEventTime, location: newEventLocation, reminderAdvance: newReminderAdvance, userId: auth.currentUser.uid };
      updatedEvents = events.map(e => e.id === editingId ? ev : e); 
      setEvents(updatedEvents);
      localStorage.setItem('user_events', JSON.stringify(updatedEvents));
      try { await setDoc(doc(db, "events", ev.id), ev); } catch (e) { console.error(e); }
    } 
    else { 
      const newEv = { id: Date.now().toString(), dateStr, title: newEventTitle, time: newEventTime, location: newEventLocation, reminderAdvance: newReminderAdvance, userId: auth.currentUser.uid };
      updatedEvents = [...events, newEv];
      setEvents(updatedEvents);
      localStorage.setItem('user_events', JSON.stringify(updatedEvents));
      try { await setDoc(doc(db, "events", newEv.id), newEv); } catch (e) { console.error(e); }
    }
    setShowEventModal(false);
  };

  const handleDeleteEvent = async (id: string, e: React.MouseEvent) => { 
    e.stopPropagation(); 
    if (!auth.currentUser) return;
    
    const updatedEvents = events.filter(e => e.id !== id);
    setEvents(updatedEvents);
    localStorage.setItem('user_events', JSON.stringify(updatedEvents));
    try { await deleteDoc(doc(db, "events", id)); } catch (e) { console.error(e); }
  };

  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => { let day = new Date(year, month, 1).getDay(); return day === 0 ? 6 : day - 1; };

  const goToPrevDay = () => { const prevDate = new Date(selectedDate); prevDate.setDate(prevDate.getDate() - 1); setSelectedDate(prevDate); if (prevDate.getMonth() !== currentDate.getMonth() || prevDate.getFullYear() !== currentDate.getFullYear()) { setCurrentDate(new Date(prevDate.getFullYear(), prevDate.getMonth(), 1)); } };
  const goToNextDay = () => { const nextDate = new Date(selectedDate); nextDate.setDate(nextDate.getDate() + 1); setSelectedDate(nextDate); if (nextDate.getMonth() !== currentDate.getMonth() || nextDate.getFullYear() !== currentDate.getFullYear()) { setCurrentDate(new Date(nextDate.getFullYear(), nextDate.getMonth(), 1)); } };

  const doConvert = () => {
    const d = parseInt(cDay), m = parseInt(cMonth), y = parseInt(cYear);
    if (!d || !m || !y) { setCResult("Vui lòng nhập đầy đủ Ngày, Tháng, Năm!"); return; }
    if (convType === 'S2L') {
        const sDate = new Date(y, m - 1, d); const lunar = getLunarDate(sDate);
        setCResult(`Ngày Âm: ${lunar.day}/${lunar.month}/${getCanChiYear(y)}`); setCResultDate(sDate);
    } else {
        let found = null; const start = new Date(y, 0, 1);
        for(let i=0; i<380; i++) {
            const td = new Date(start.getTime() + i*86400000); const ln = getLunarDate(td);
            if (ln.day === d && parseInt(ln.month as string) === m) { found = td; break; }
        }
        if (found) {
            setCResult(`Ngày Dương: ${found.getDate()}/${found.getMonth()+1}/${found.getFullYear()}`); setCResultDate(found);
        } else {
            setCResult("Không tìm thấy ngày Âm lịch hợp lệ trong năm này!"); setCResultDate(null);
        }
    }
  };
  
  const goToDate = () => {
    if(cResultDate) {
        setSelectedDate(cResultDate); setCurrentDate(cResultDate);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const generateMonthGrid = () => {
    const year = currentDate.getFullYear(); const month = currentDate.getMonth();
    const daysInMonth = getDaysInMonth(year, month); const daysInPrevMonth = getDaysInMonth(year, month - 1); const firstDay = getFirstDayOfMonth(year, month);
    const grid = [];
    
    for (let i = 0; i < firstDay; i++) {
      const d = daysInPrevMonth - firstDay + i + 1; const prevDate = new Date(year, month - 1, d); const lunar = getLunarDate(prevDate);
      grid.push(<div key={`prev-${i}`} onClick={() => {setCurrentDate(prevDate); setSelectedDate(prevDate);}} className="h-20 sm:h-28 lg:h-32 p-1 sm:p-2 border border-[#1e293b] opacity-30 cursor-pointer hover:bg-[#1e293b]"><div className="flex justify-between items-start font-sans"><span className="text-lg sm:text-xl font-bold text-slate-500">{d}</span><span className="text-xs font-medium text-slate-600">{lunar.day}</span></div></div>);
    }
    
    for (let d = 1; d <= daysInMonth; d++) {
      const dateObj = new Date(year, month, d);
      const isSelected = selectedDate.getDate() === d && selectedDate.getMonth() === month && selectedDate.getFullYear() === year;
      const isToday = new Date().getDate() === d && new Date().getMonth() === month && new Date().getFullYear() === year;
      const isSunday = dateObj.getDay() === 0;
      
      const lunar = getLunarDate(dateObj);
      const dateStr = `${year}-${(month+1).toString().padStart(2,'0')}-${d.toString().padStart(2,'0')}`;
      const dayEvents = events.filter(e => e.dateStr === dateStr);
      
      const solarKey = `${d}/${month+1}`; const lunarKey = `${lunar.day}/${lunar.month}`;
      const rawSolarHoliday = HOLIDAYS[solarKey]; const rawLunarHoliday = LUNAR_HOLIDAYS[lunarKey];
      const solarHoliday = (rawSolarHoliday && year >= rawSolarHoliday.startYear) ? rawSolarHoliday : undefined;
      const lunarHoliday = (rawLunarHoliday && year >= rawLunarHoliday.startYear) ? rawLunarHoliday : undefined;

      const isSolarDayOff = solarHoliday?.isDayOff && (!solarHoliday.dayOffStartYear || year >= solarHoliday.dayOffStartYear);
      const isLunarDayOff = lunarHoliday?.isDayOff && (!lunarHoliday.dayOffStartYear || year >= lunarHoliday.dayOffStartYear);
      const isDayOff = isSolarDayOff || isLunarDayOff;
      
      let solarColor = 'text-white';
      if (isSunday || isDayOff) { solarColor = 'text-red-500'; } else if (solarHoliday || lunarHoliday) { solarColor = 'text-amber-500'; }

      grid.push(
        <div key={`cur-${d}`} onClick={() => setSelectedDate(dateObj)} className={`h-20 sm:h-28 lg:h-32 border border-[#1e293b] p-1 sm:p-2 lg:p-3 cursor-pointer transition-all flex flex-col relative group ${isSelected ? 'bg-sky-900/30 border-sky-400 shadow-[0_0_15px_rgba(56,189,248,0.2)] z-10' : 'bg-[#0a0f18] hover:bg-[#1e293b]'} ${isToday ? 'ring-1 ring-sky-500/50' : ''}`}>
          <div className="flex justify-between items-start font-sans">
            <span className={`text-lg sm:text-2xl font-bold ${solarColor}`}>{d}</span>
            <span className={`text-[11px] sm:text-sm font-medium ${lunar.day === 1 || lunar.day === 15 ? 'text-blue-400 font-bold' : 'text-slate-500'}`}>{lunar.day === 1 ? `${lunar.day}/${lunar.month}` : lunar.day}</span>
          </div>
          <div className="mt-auto overflow-hidden font-sans">
            {solarHoliday && <div className={`text-[9px] sm:text-xs ${isSolarDayOff ? 'text-red-500' : 'text-amber-500'} leading-tight truncate font-semibold`}>{solarHoliday.name}</div>}
            {lunarHoliday && <div className={`text-[9px] sm:text-xs ${isLunarDayOff ? 'text-red-500' : 'text-amber-500'} leading-tight truncate font-semibold mt-0.5`}>{lunarHoliday.name}</div>}
            {dayEvents.length > 0 && <div className="flex gap-1 mt-1 items-center"><div className="w-1.5 h-1.5 rounded-full bg-sky-400"></div><span className="text-[9px] sm:text-xs text-sky-400 truncate hidden sm:block">{dayEvents.length} sự kiện</span></div>}
          </div>
        </div>
      );
    }

    const totalCells = firstDay + daysInMonth; const remainingCells = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
    for (let i = 0; i < remainingCells; i++) {
      const d = i + 1; const nextDate = new Date(year, month + 1, d); const lunar = getLunarDate(nextDate);
      grid.push(<div key={`next-${i}`} onClick={() => {setCurrentDate(nextDate); setSelectedDate(nextDate);}} className="h-20 sm:h-28 lg:h-32 p-1 sm:p-2 border border-[#1e293b] opacity-30 cursor-pointer hover:bg-[#1e293b]"><div className="flex justify-between items-start font-sans"><span className="text-lg sm:text-xl font-bold text-slate-500">{d}</span><span className="text-xs font-medium text-slate-600">{lunar.day}</span></div></div>);
    }
    return grid;
  };

  const currentYear = selectedDate.getFullYear();
  const selLunar = getLunarDate(selectedDate);
  const selSolarKey = `${selectedDate.getDate()}/${selectedDate.getMonth()+1}`;
  const selLunarKey = `${selLunar.day}/${selLunar.month}`;
  
  const rawSelSolarHoliday = HOLIDAYS[selSolarKey];
  const rawSelLunarHoliday = LUNAR_HOLIDAYS[selLunarKey];

  const selSolarHoliday = (rawSelSolarHoliday && currentYear >= rawSelSolarHoliday.startYear) ? rawSelSolarHoliday : undefined;
  const selLunarHoliday = (rawSelLunarHoliday && currentYear >= rawSelLunarHoliday.startYear) ? rawSelLunarHoliday : undefined;

  const isSelSolarDayOff = selSolarHoliday?.isDayOff && (!selSolarHoliday.dayOffStartYear || currentYear >= selSolarHoliday.dayOffStartYear);
  const isSelLunarDayOff = selLunarHoliday?.isDayOff && (!selLunarHoliday.dayOffStartYear || currentYear >= selLunarHoliday.dayOffStartYear);

  let topSolarColor = 'text-white';
  if (selectedDate.getDay() === 0 || isSelSolarDayOff || isSelLunarDayOff) { topSolarColor = 'text-red-500'; } 
  else if (selSolarHoliday || selLunarHoliday) { topSolarColor = 'text-amber-500'; }

  const selDateStr = `${selectedDate.getFullYear()}-${(selectedDate.getMonth()+1).toString().padStart(2,'0')}-${selectedDate.getDate().toString().padStart(2,'0')}`;
  const selEvents = events.filter(e => e.dateStr === selDateStr);
  
  const dayEval = getDayEvaluation(selectedDate);
  const dayDet = getDayDetails(selectedDate);

  return (
    <div className="space-y-6 animate-in fade-in duration-700 w-full pb-10 font-sans relative">
      
      <div className="bg-[#05070a] border border-sky-900/50 rounded-2xl overflow-hidden shadow-2xl">
        <div className="bg-sky-700 px-6 py-4 flex justify-between items-center">
          <h2 className="text-white font-bold text-lg uppercase tracking-widest flex items-center gap-2 font-sans">
            <CalendarIcon size={20} /> Lịch Vạn Niên
          </h2>
          <button onClick={() => { setSelectedDate(new Date()); setCurrentDate(new Date()); }} className="px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded text-xs text-white font-semibold transition flex items-center gap-2 font-sans">
            <CalendarIcon size={14}/> Hôm nay
          </button>
        </div>

        <div className="relative flex items-center group">
          <button onClick={goToPrevDay} className="absolute left-2 sm:left-4 lg:left-6 z-10 w-10 h-10 sm:w-12 sm:h-12 rounded-full border border-[#1e293b] bg-[#0f172a]/80 text-slate-400 hover:text-sky-400 hover:border-sky-500 hover:bg-sky-500/10 flex items-center justify-center transition-all shadow-lg backdrop-blur-sm">
            <ChevronLeft size={24} className="-ml-0.5" />
          </button>

          <div className="w-full grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-800/50 p-6 sm:p-10 lg:p-14">
            <div className="flex flex-col items-center justify-center p-4">
              <span className="text-slate-400 font-bold tracking-widest uppercase mb-2 font-sans flex items-center gap-2">
                <Sun size={24} className="text-amber-400" /> Dương Lịch
              </span>
              <div className={`text-8xl sm:text-9xl lg:text-[10rem] font-black mb-4 font-sans ${topSolarColor}`}>
                {selectedDate.getDate()}
              </div>
              <span className="text-lg lg:text-xl text-slate-300 font-semibold font-sans">Tháng {(selectedDate.getMonth() + 1).toString().padStart(2, '0')} năm {selectedDate.getFullYear()}</span>
              <span className="text-sm lg:text-base text-slate-500 mt-2 tracking-widest uppercase font-medium font-sans">
                {['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'][selectedDate.getDay()]}
              </span>
              
              {selSolarHoliday && (
                <span className={`text-sm lg:text-base font-bold mt-4 px-5 py-2 rounded-full border font-sans ${isSelSolarDayOff ? 'text-red-500 bg-red-500/10 border-red-500/20' : 'text-amber-500 bg-amber-500/10 border-amber-500/20'}`}>
                  {selSolarHoliday.name}
                </span>
              )}
            </div>

            <div className="flex flex-col items-center justify-center p-4">
              <span className="text-slate-400 font-bold tracking-widest uppercase mb-2 font-sans flex items-center gap-2">
                <Moon size={24} className="text-slate-200 fill-slate-300" /> Âm Lịch
              </span>
              <div className="text-8xl sm:text-9xl lg:text-[10rem] font-black text-blue-500 mb-4 font-sans">{selLunar.day}</div>
              <span className="text-lg lg:text-xl text-slate-300 font-semibold font-sans">Tháng {selLunar.month} năm {getCanChiYear(selectedDate.getFullYear())}</span>
              
              {selLunarHoliday ? (
                <span className={`text-sm lg:text-base font-bold mt-4 px-5 py-2 rounded-full border font-sans ${isSelLunarDayOff ? 'text-red-500 bg-red-500/10 border-red-500/20' : 'text-amber-500 bg-amber-500/10 border-amber-500/20'}`}>
                  {selLunarHoliday.name}
                </span>
              ) : (
                <span className="text-sm lg:text-base text-slate-500 mt-4 tracking-widest uppercase font-medium font-sans">Bình thường</span>
              )}

              {/* NÚT XEM NGÀY CHI TIẾT */}
              <button onClick={() => setShowDayDetail(true)} className="mt-4 px-6 py-2 bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white border border-blue-600/30 rounded-full text-xs font-bold transition-all flex items-center gap-2">
                 <Info size={14} /> XEM NGÀY CHI TIẾT
              </button>
            </div>
          </div>

          <button onClick={goToNextDay} className="absolute right-2 sm:right-4 lg:right-6 z-10 w-10 h-10 sm:w-12 sm:h-12 rounded-full border border-[#1e293b] bg-[#0f172a]/80 text-slate-400 hover:text-sky-400 hover:border-sky-500 hover:bg-sky-500/10 flex items-center justify-center transition-all shadow-lg backdrop-blur-sm">
            <ChevronRight size={24} className="ml-0.5" />
          </button>
        </div>

        <div className="bg-slate-900/40 p-6 lg:p-8 border-t border-[#1e293b] text-sm lg:text-base text-slate-300 font-sans">
           <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="space-y-2">
                <p className="text-base text-slate-200">
                  Ngày: <strong className="text-sky-400">{getCanChiDay(selectedDate).text}</strong>, 
                  tháng: <strong className="text-sky-400">{getCanChiMonth(parseInt(selLunar.month as string), selectedDate.getFullYear()).text}</strong>, 
                  năm: <strong className="text-sky-400">{getCanChiYear(selectedDate.getFullYear())}</strong>
                </p>
                <div className="flex items-center gap-2 mt-2 mb-2">
                  <span className="text-slate-300 font-semibold">Đánh giá chung:</span>
                  <strong className="text-amber-400 font-black">[{dayEval.score}]</strong>
                  {renderStars(dayEval.score)}
                  <span className="ml-2 text-xs font-semibold text-slate-400 bg-slate-800 px-2 py-1 rounded">
                    {dayEval.description}
                  </span>
                </div>
                <p><span className="text-slate-400 font-semibold">Giờ Hoàng Đạo:</span> Tý (23-1h), Dần (3-5h), Mão (5-7h), Ngọ (11-13h), Mùi (13-15h), Dậu (17-19h)</p>
              </div>
              
              <button onClick={openModalForAdd} className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-sm lg:text-base font-bold transition shadow-lg shadow-sky-900/50 flex-shrink-0">
                <Plus size={18} /> Thêm sự kiện
              </button>
           </div>

           {selEvents.length > 0 && (
             <div className="mt-6 pt-4 border-t border-[#1e293b]">
               <strong className="text-sky-400 flex items-center gap-2 mb-3 text-sm lg:text-base uppercase tracking-widest"><Bell size={16}/> Lịch trình ngày {selectedDate.getDate()}:</strong>
               <ul className="space-y-3">
                 {selEvents.map(ev => (
                   <li key={ev.id} onClick={() => openModalForEdit(ev)} className="flex flex-col bg-black/60 px-5 py-4 rounded-lg border border-[#1e293b] cursor-pointer hover:border-sky-500/50 transition-colors group">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-200 font-medium flex items-center gap-2 text-base">
                          <Clock size={16} className="text-sky-400" /> <span className="text-sky-400 font-bold">{ev.time}</span> {ev.title}
                        </span>
                        <div className="flex items-center gap-2 opacity-50 group-hover:opacity-100 transition-opacity">
                          <button className="text-slate-400 hover:text-sky-400 p-2"><Edit3 size={18}/></button>
                          <button onClick={(e) => handleDeleteEvent(ev.id, e)} className="text-slate-400 hover:text-red-400 p-2"><Trash2 size={18}/></button>
                        </div>
                      </div>
                      {ev.location && <div className="flex items-center gap-1.5 mt-2 text-sm text-slate-400 ml-7"><MapPin size={14} /> {ev.location}</div>}
                      <div className="text-xs text-slate-500 ml-7 mt-1 uppercase tracking-wider font-semibold">Báo trước: {ev.reminderAdvance === 0 ? 'Đúng giờ' : ev.reminderAdvance >= 1440 ? `${ev.reminderAdvance/1440} ngày` : ev.reminderAdvance >= 60 ? `${ev.reminderAdvance/60} giờ` : `${ev.reminderAdvance} phút`}</div>
                   </li>
                 ))}
               </ul>
             </div>
           )}
        </div>
      </div>

      <div className="bg-[#05070a] border border-[#1e293b] rounded-2xl overflow-hidden shadow-xl font-sans">
        <div className="bg-[#0a0f18] px-6 py-5 flex flex-col sm:flex-row items-center justify-between border-b border-[#1e293b] gap-4">
          <div className="flex items-center gap-4">
            <button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() - 1)))} className="p-2 bg-sky-900/20 hover:bg-sky-500/20 rounded-lg text-sky-400 transition"><ChevronLeft size={20} /></button>
            <span className="text-lg lg:text-xl font-bold text-sky-400 uppercase tracking-widest w-32 lg:w-40 text-center">Tháng {currentDate.getMonth() + 1}</span>
            <button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() + 1)))} className="p-2 bg-sky-900/20 hover:bg-sky-500/20 rounded-lg text-sky-400 transition"><ChevronRight size={20} /></button>
          </div>
          
          <div className="flex gap-2 w-full sm:w-auto">
            <select value={currentDate.getMonth()} onChange={(e) => setCurrentDate(new Date(currentDate.getFullYear(), parseInt(e.target.value), 1))} className="flex-1 sm:w-auto bg-[#1e293b] border border-slate-700 text-slate-200 rounded-lg px-4 py-2.5 text-sm lg:text-base font-semibold focus:outline-none focus:border-sky-500">
              {Array.from({length: 12}).map((_, i) => <option key={i} value={i}>Tháng {i + 1}</option>)}
            </select>
            <select value={currentDate.getFullYear()} onChange={(e) => setCurrentDate(new Date(parseInt(e.target.value), currentDate.getMonth(), 1))} className="flex-1 sm:w-auto bg-[#1e293b] border border-slate-700 text-slate-200 rounded-lg px-4 py-2.5 text-sm lg:text-base font-semibold focus:outline-none focus:border-sky-500">
              {Array.from({length: 201}).map((_, i) => <option key={i} value={1900 + i}>năm {1900 + i}</option>)}
            </select>
          </div>
        </div>

        <div className="p-4 sm:p-6 lg:p-8 bg-[#05070a]">
          <div className="grid grid-cols-7 gap-px mb-2 text-center text-xs lg:text-sm font-bold text-slate-500 uppercase tracking-widest bg-[#0a0f18] py-4 rounded-lg border border-[#1e293b]">
            <div>Thứ 2</div><div>Thứ 3</div><div>Thứ 4</div><div>Thứ 5</div><div>Thứ 6</div><div>Thứ 7</div><div className="text-red-500">Chủ nhật</div>
          </div>
          <div className="grid grid-cols-7 gap-px bg-[#1e293b] border border-[#1e293b] rounded-lg overflow-hidden">
            {generateMonthGrid()}
          </div>
        </div>
      </div>

      {/* --- CÔNG CỤ CHUYỂN ĐỔI ÂM DƯƠNG --- */}
      <div className="bg-[#0f172a] border border-[#1e293b] rounded-2xl p-6 lg:p-8 shadow-xl mt-8">
         <h3 className="text-lg font-bold text-brand flex items-center gap-2 mb-6"><ArrowRightLeft size={20} /> Cỗ máy thời gian (Đổi lịch Âm - Dương)</h3>
         <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            <div className="md:col-span-3">
              <select value={convType} onChange={e => {setConvType(e.target.value as 'S2L' | 'L2S'); setCResult(''); setCResultDate(null);}} className="w-full bg-[#05070a] border border-[#1e293b] rounded-lg p-3 text-slate-200 text-sm font-semibold focus:outline-none focus:border-brand h-full">
                 <option value="S2L">Dương ➔ Âm</option>
                 <option value="L2S">Âm ➔ Dương</option>
              </select>
            </div>
            <div className="md:col-span-6 flex gap-2">
               <input type="number" placeholder="Ngày" value={cDay} onChange={e=>setCDay(e.target.value)} className="w-1/3 bg-[#05070a] border border-[#1e293b] rounded-lg p-3 text-center text-slate-200 focus:outline-none focus:border-brand" />
               <input type="number" placeholder="Tháng" value={cMonth} onChange={e=>setCMonth(e.target.value)} className="w-1/3 bg-[#05070a] border border-[#1e293b] rounded-lg p-3 text-center text-slate-200 focus:outline-none focus:border-brand" />
               <input type="number" placeholder="Năm" value={cYear} onChange={e=>setCYear(e.target.value)} className="w-1/3 bg-[#05070a] border border-[#1e293b] rounded-lg p-3 text-center text-slate-200 focus:outline-none focus:border-brand" />
            </div>
            <div className="md:col-span-3">
               <button onClick={doConvert} className="w-full h-full bg-brand text-bg-dark font-bold rounded-lg hover:bg-brand/90 transition shadow-lg py-3">XEM KẾT QUẢ</button>
            </div>
         </div>
         {cResult && (
            <div className="mt-6 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex items-center justify-between">
               <span className="text-emerald-400 font-bold text-lg">{cResult}</span>
               {cResultDate && (
                 <button onClick={goToDate} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-bold transition">
                   <CalendarIcon size={16}/> Lịch ngày
                 </button>
               )}
            </div>
         )}
      </div>

      {/* MODAL CHI TIẾT NGÀY PHONG THỦY */}
      <AnimatePresence>
        {showDayDetail && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/90 backdrop-blur-md z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className="bg-[#0f172a] border border-brand/30 rounded-3xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col shadow-[0_0_100px_rgba(56,189,248,0.1)]">
              
              <div className="p-6 bg-brand/10 border-b border-brand/20 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 bg-brand text-bg-dark rounded-2xl flex items-center justify-center font-black text-3xl">{selectedDate.getDate()}</div>
                  <div>
                    <h3 className="text-white font-bold text-lg">Chi tiết ngày {selectedDate.toLocaleDateString('vi-VN')}</h3>
                    <p className="text-xs text-brand uppercase font-black tracking-widest">{dayEval.text}</p>
                  </div>
                </div>
                <button onClick={() => setShowDayDetail(false)} className="p-2 hover:bg-rose-500 rounded-xl text-slate-400 hover:text-white transition-colors"><X size={24}/></button>
              </div>

              <div className="p-8 overflow-y-auto custom-scrollbar space-y-8">
                {/* PHẦN 1: THÔNG TIN CHUNG */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="bg-[#05070a] p-4 rounded-xl border border-[#1e293b] text-center">
                    <p className="text-[10px] text-slate-500 uppercase mb-1">Đánh giá</p>
                    <div className="flex justify-center mb-1">{Array.from({length: 5}).map((_, i) => <Star key={i} size={12} className={i < Math.floor(parseFloat(dayEval.score)) ? "text-amber-400 fill-amber-400" : "text-slate-800"} />)}</div>
                    <p className="text-sm font-bold text-white">[{dayEval.score}]</p>
                  </div>
                  <div className="bg-[#05070a] p-4 rounded-xl border border-[#1e293b] text-center">
                    <p className="text-[10px] text-slate-500 uppercase mb-1">Ngũ hành</p>
                    <p className="text-sm font-bold text-sky-400">{dayDet.nguHanh}</p>
                  </div>
                  <div className="bg-[#05070a] p-4 rounded-xl border border-[#1e293b] text-center">
                    <p className="text-[10px] text-slate-500 uppercase mb-1">Trực / Tiết khí</p>
                    <p className="text-sm font-bold text-amber-400">{dayDet.truc} / {dayDet.tietKhi}</p>
                  </div>
                  <div className="bg-[#05070a] p-4 rounded-xl border border-[#1e293b] text-center">
                    <p className="text-[10px] text-slate-500 uppercase mb-1">28 Chòm Sao</p>
                    <p className="text-sm font-bold text-emerald-400">Sao {dayDet.sao}</p>
                  </div>
                </div>

                {/* PHẦN 2: HỆ THỐNG SAO CÁT HUNG */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                     <h4 className="text-emerald-400 text-xs font-black uppercase tracking-widest flex items-center gap-2"><CheckCircle size={14}/> Các Sao Tốt (Cát tinh)</h4>
                     <div className="flex flex-wrap gap-2">
                        {dayDet.catTinh.length > 0 ? dayDet.catTinh.map((s: string) => <span key={s} className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] rounded-full font-bold">{s}</span>) : <span className="text-xs text-slate-500 italic">Không có Cát tinh đáng kể</span>}
                     </div>
                  </div>
                  <div className="space-y-3">
                     <h4 className="text-rose-400 text-xs font-black uppercase tracking-widest flex items-center gap-2"><AlertTriangle size={14}/> Các Sao Xấu (Hung tinh)</h4>
                     <div className="flex flex-wrap gap-2">
                        {dayDet.hungTinh.length > 0 ? dayDet.hungTinh.map((s: string) => <span key={s} className="px-3 py-1 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] rounded-full font-bold">{s}</span>) : <span className="text-xs text-slate-500 italic">Không có Hung tinh đáng kể</span>}
                     </div>
                  </div>
                </div>

                {/* PHẦN 3: LỜI KHUYÊN GIÁO DỤC */}
                <div className="bg-blue-500/5 border border-blue-500/20 p-6 rounded-2xl">
                   <h4 className="text-blue-400 text-xs font-black uppercase tracking-widest mb-4 flex items-center gap-2"><GraduationCap size={18}/> Dành riêng cho Quản lý & Giáo dục</h4>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <p className="text-[10px] font-bold text-blue-300 mb-2 uppercase">Nên ưu tiên thực hiện:</p>
                        <ul className="list-disc pl-5 text-sm text-slate-300 space-y-1">
                          {dayDet.eduAdvice.should.map((item: string) => <li key={item}>{item}</li>)}
                        </ul>
                      </div>
                      {dayDet.eduAdvice.avoid.length > 0 && (
                        <div>
                          <p className="text-[10px] font-bold text-rose-300 mb-2 uppercase">Cần thận trọng / Tránh:</p>
                          <ul className="list-disc pl-5 text-sm text-slate-300 space-y-1">
                            {dayDet.eduAdvice.avoid.map((item: string) => <li key={item}>{item}</li>)}
                          </ul>
                        </div>
                      )}
                   </div>
                </div>

                {/* PHẦN 4: VIỆC CHUNG */}
                <div className="space-y-3">
                   <h4 className="text-slate-400 text-xs font-black uppercase tracking-widest mb-2">Đánh giá Trạch cát Dân gian</h4>
                   <div className="flex gap-4 p-4 bg-slate-800/30 rounded-xl border border-slate-700/50">
                      <span className="text-xs font-black text-emerald-400 w-20 shrink-0 uppercase">Nên làm:</span>
                      <p className="text-sm text-slate-300 leading-relaxed">{dayDet.hop}</p>
                   </div>
                   <div className="flex gap-4 p-4 bg-slate-800/30 rounded-xl border border-slate-700/50">
                      <span className="text-xs font-black text-rose-400 w-20 shrink-0 uppercase">Kiêng kỵ:</span>
                      <p className="text-sm text-slate-300 leading-relaxed">{dayDet.ky}</p>
                   </div>
                </div>
              </div>
              
              <div className="p-6 bg-[#05070a] border-t border-[#1e293b]">
                 <button onClick={() => setShowDayDetail(false)} className="w-full py-4 bg-brand text-bg-dark font-black rounded-2xl shadow-lg hover:scale-[1.01] transition-transform">ĐÃ HIỂU VÀ ĐÓNG</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MODAL CẢNH BÁO BẮT BUỘC ĐĂNG NHẬP */}
      <AnimatePresence>
        {showLoginPrompt && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
             <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className="bg-[#0f172a] border border-brand/50 rounded-2xl p-8 max-w-sm w-full shadow-[0_0_50px_rgba(56,189,248,0.2)] text-center relative overflow-hidden">
                <div className="w-16 h-16 bg-brand/10 rounded-full flex items-center justify-center mx-auto mb-4">
                   <Bell className="text-brand" size={32} />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Đăng nhập để lưu sự kiện</h3>
                <p className="text-slate-400 text-sm mb-8">Dữ liệu Lịch trình của Bạn sẽ được lưu trữ bảo mật trên Đám mây để đồng bộ giữa các thiết bị.</p>
                <div className="flex flex-col gap-3">
                  <button onClick={handleGoogleLogin} className="w-full py-3 bg-brand text-bg-dark font-bold rounded-lg hover:scale-105 transition-transform flex justify-center items-center gap-2 shadow-lg shadow-brand/20">
                    <img src="https://www.google.com/favicon.ico" alt="G" className="w-4 h-4" /> Đăng nhập bằng Google
                  </button>
                  <button onClick={() => setShowLoginPrompt(false)} className="w-full py-3 bg-[#1e293b] text-slate-300 font-bold rounded-lg hover:bg-slate-800 transition-colors">
                    Hủy bỏ
                  </button>
                </div>
             </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {showEventModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4 font-sans">
          <div className="bg-[#0f172a] border border-[#1e293b] rounded-2xl p-6 lg:p-8 w-full max-w-md lg:max-w-lg shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg lg:text-xl font-bold text-sky-400 flex items-center gap-2">
                <Bell size={20} /> {editingId ? 'Sửa Lịch trình' : 'Ghi chú công việc'}
              </h3>
              <button onClick={() => setShowEventModal(false)} className="text-slate-500 hover:text-slate-300 bg-slate-800 p-2 rounded-md"><X size={20}/></button>
            </div>
            
            <p className="text-sm lg:text-base font-semibold text-slate-300 mb-6 bg-slate-800/50 p-3 lg:p-4 rounded-lg border border-[#1e293b]">
              Ngày: {selectedDate.toLocaleDateString('vi-VN')}
            </p>
            
            <div className="space-y-5">
              <div>
                <label className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-widest block">Nội dung <span className="text-red-400">*</span></label>
                <input type="text" value={newEventTitle} onChange={e => setNewEventTitle(e.target.value)} placeholder="VD: Báo cáo công tác tuần..." className="w-full bg-[#05070a] border border-[#1e293b] rounded-lg p-3 lg:p-4 text-slate-200 text-sm lg:text-base focus:outline-none focus:border-sky-500 transition-colors" />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-widest block">Thời gian</label>
                  <input type="time" value={newEventTime} onChange={e => setNewEventTime(e.target.value)} className="w-full bg-[#05070a] border border-[#1e293b] rounded-lg p-3 lg:p-4 text-slate-200 text-sm lg:text-base focus:outline-none focus:border-sky-500 transition-colors" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-widest block">Báo trước</label>
                  <select value={newReminderAdvance} onChange={e => setNewReminderAdvance(Number(e.target.value))} className="w-full bg-[#05070a] border border-[#1e293b] rounded-lg p-3 lg:p-4 text-slate-200 text-sm lg:text-base focus:outline-none focus:border-sky-500 transition-colors">
                    <option value={0}>Đúng giờ</option>
                    <option value={15}>15 phút</option>
                    <option value={60}>1 tiếng</option>
                    <option value={1440}>1 ngày (24h)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-widest block flex items-center gap-1">
                  <MapPin size={14}/> Địa điểm (Không bắt buộc)
                </label>
                <input type="text" value={newEventLocation} onChange={e => setNewEventLocation(e.target.value)} placeholder="VD: Phòng họp số 1..." className="w-full bg-[#05070a] border border-[#1e293b] rounded-lg p-3 lg:p-4 text-slate-200 text-sm lg:text-base focus:outline-none focus:border-sky-500 transition-colors" />
              </div>

              <button onClick={handleSaveEvent} className="w-full bg-sky-600 hover:bg-sky-500 text-white text-sm lg:text-base font-bold py-4 rounded-lg mt-8 transition shadow-lg shadow-sky-900/50">
                {editingId ? 'CẬP NHẬT SỰ KIỆN' : 'LƯU SỰ KIỆN'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}