import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Bell, Plus, Trash2, Calendar as CalendarIcon, X, MapPin, Clock, Edit3, Star, StarHalf, Sun, Moon, ArrowRightLeft, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Solar } from 'lunar-javascript';

// --- IMPORT TỪ FIREBASE ---
import { auth, db, googleProvider } from '../firebase';
import { signInWithPopup } from 'firebase/auth';
import { collection, query, where, getDocs, setDoc, doc, deleteDoc } from 'firebase/firestore';

const CAN_CHU = ['Giáp', 'Ất', 'Bính', 'Đinh', 'Mậu', 'Kỷ', 'Canh', 'Tân', 'Nhâm', 'Quý'];
const CHI_CHU = ['Tý', 'Sửu', 'Dần', 'Mão', 'Thìn', 'Tỵ', 'Ngọ', 'Mùi', 'Thân', 'Dậu', 'Tuất', 'Hợi'];

const getCanChiYear = (year: number) => {
  const can = ['Canh', 'Tân', 'Nhâm', 'Quý', 'Giáp', 'Ất', 'Bính', 'Đinh', 'Mậu', 'Kỷ'][year % 10];
  const chi = ['Thân', 'Dậu', 'Tuất', 'Hợi', 'Tý', 'Sửu', 'Dần', 'Mão', 'Thìn', 'Tỵ', 'Ngọ', 'Mùi'][year % 12];
  return `${can} ${chi}`;
};

const getCanChiMonth = (lMonth: number, year: number) => {
  const stdYearCan = ((year % 10) + 6) % 10; 
  const month1Can = ((stdYearCan % 5) * 2 + 2) % 10;
  const targetMonthCan = (month1Can + lMonth - 1) % 10;
  const targetMonthChi = (2 + lMonth - 1) % 12;
  return { text: `${CAN_CHU[targetMonthCan]} ${CHI_CHU[targetMonthChi]}`, chiIdx: targetMonthChi };
};

const getCanChiDay = (date: Date) => {
  const anchor = Date.UTC(2024, 0, 1);
  const target = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.floor((target - anchor) / 86400000);
  const canIdx = ((diffDays % 10) + 10) % 10;
  const chiIdx = ((diffDays % 12) + 12) % 12;
  return { text: `${CAN_CHU[canIdx]} ${CHI_CHU[chiIdx]}`, chiIdx, canIdx };
};

const getLunarDate = (date: Date) => {
  try {
    const lunar = Solar.fromYmd(date.getFullYear(), date.getMonth() + 1, date.getDate()).getLunar();
    return { 
      day: lunar.getDay(), 
      monthStr: lunar.getMonth() > 0 ? lunar.getMonth().toString() : `Nhuận ${Math.abs(lunar.getMonth())}`,
      monthNum: Math.abs(lunar.getMonth()) 
    };
  } catch (e) {
    return { day: date.getDate(), monthStr: (date.getMonth() + 1).toString(), monthNum: date.getMonth() + 1 }; 
  }
};

// --- BỘ LỌC KỴ DÂN GIAN VIỆT NAM ---
const getFolkTaboos = (lunarMonth: number, lunarDay: number, dayChi: string) => {
  const taboos: string[] = [];
  if ([3, 7, 13, 18, 22, 27].includes(lunarDay)) taboos.push("Tam nương sát");
  if ([5, 14, 23].includes(lunarDay)) taboos.push("Nguyệt kỵ");
  const satChuMap: Record<number, string> = { 1:'Tỵ', 2:'Tý', 3:'Mùi', 4:'Mão', 5:'Thân', 6:'Tuất', 7:'Hợi', 8:'Sửu', 9:'Ngọ', 10:'Dậu', 11:'Dần', 12:'Thìn' };
  if (satChuMap[lunarMonth] === dayChi) taboos.push("Sát chủ");
  const vangVongMap: Record<number, string> = { 1:'Dần', 2:'Tỵ', 3:'Thân', 4:'Hợi', 5:'Mão', 6:'Ngọ', 7:'Dậu', 8:'Tý', 9:'Thìn', 10:'Mùi', 11:'Tuất', 12:'Sửu' };
  if (vangVongMap[lunarMonth] === dayChi) taboos.push("Vãng vong");
  return taboos;
};

// --- BỘ TỪ ĐIỂN DỊCH THUẬT NGỌC HẠP THÔNG THƯ ---
const SHEN_SHA_MAP: Record<string, string> = {
  '天恩': 'Thiên ân', '天喜': 'Thiên hỷ', '月德': 'Nguyệt đức', '天官': 'Thiên quan', '天福': 'Thiên phúc', '福生': 'Phúc sinh', '月恩': 'Nguyệt ân', '天马': 'Thiên mã', '三合': 'Tam hợp', '母仓': 'Mẫu thương', '六合': 'Lục hợp', '五富': 'Ngũ phú', '解神': 'Giải thần', '益后': 'Ích hậu', '天医': 'Thiên y', '天财': 'Thiên tài', '生气': 'Sinh khí', '福厚': 'Phúc hậu', '天德': 'Thiên đức', '月空': 'Nguyệt không', '圣心': 'Thánh tâm', '阳德': 'Dương đức', '王日': 'Vương nhật', '驿马': 'Dịch mã', '天后': 'Thiên hậu', '鸣吠': 'Minh phệ', '敬心': 'Kính tâm', '普护': 'Phổ hộ', '守日': 'Thủ nhật', '天巫': 'Thiên vu', '福德': 'Phúc đức', '岁德': 'Tuế đức', '阴德': 'Âm đức', '官日': 'Quan nhật', '吉期': 'Cát kỳ', '玉宇': 'Ngọc vũ', '金堂': 'Kim đường', '敬安': 'Kính an', '时德': 'Thời đức', '民日': 'Dân nhật', '天赦': 'Thiên xá', '时阳': 'Thời dương', '要安': 'Yếu an', '相日': 'Tương nhật', '宝光': 'Bảo quang', '天仓': 'Thiên thương', '五合': 'Ngũ hợp', '鸣吠对': 'Minh phệ đối', '临日': 'Lâm nhật', '天愿': 'Thiên nguyện', '六仪': 'Lục nghi', '玉堂': 'Ngọc đường', '明堂': 'Minh đường', '司命': 'Tư mệnh', '青龙': 'Thanh long', '黄道': 'Hoàng đạo', '直星': 'Trực tinh', '天贵': 'Thiên quý', '吉神': 'Cát thần', '地财': 'Địa tài', '月解': 'Nguyệt giải', '直性': 'Trực tính',
  '土府': 'Thổ phủ', '天罡': 'Thiên cương', '死神': 'Tử thần', '月刑': 'Nguyệt hình', '大耗': 'Đại hao', '小耗': 'Tiểu hao', '孤辰': 'Cô thần', '寡宿': 'Quả tú', '劫煞': 'Kiếp sát', '灾煞': 'Tai sát', '岁破': 'Tuế phá', '岁煞': 'Tuế sát', '白虎': 'Bạch hổ', '朱雀': 'Chu tước', '玄武': 'Huyền vũ', '勾陈': 'Câu trận', '腾蛇': 'Đằng xà', '归忌': 'Quy kỵ', '厌对': 'Yếm đối', '招摇': 'Chiêu dao', '血支': 'Huyết chi', '九空': 'Cửu không', '九坎': 'Cửu khảm', '重日': 'Trùng nhật', '复日': 'Phục nhật', '天狗': 'Thiên cẩu', '游祸': 'Du họa', '咸池': 'Hàm trì', '往亡': 'Vãng vong', '月煞': 'Nguyệt sát', '月虚': 'Nguyệt hư', '月客': 'Nguyệt khách', '阴错': 'Âm thác', '阳错': 'Dương thác', '四击': 'Tứ kích', '耗客': 'Hao khách', '触水龙': 'Xúc thủy long', '四废': 'Tứ phế', '五虚': 'Ngũ hư', '土符': 'Thổ phù', '大煞': 'Đại sát', '死气': 'Tử khí', '八龙': 'Bát long', '地囊': 'Địa nang', '天贼': 'Thiên tặc', '八风': 'Bát phong', '九焦': 'Cửu tiêu', '五墓': 'Ngũ mộ', '七乌': 'Thất ô', '天吏': 'Thiên lại', '致死': 'Trí tử', '月建': 'Nguyệt kiến', '土瘟': 'Thổ ôn', '天牢': 'Thiên lao', '孤阳': 'Cô dương', '绝阴': 'Tuyệt âm', '飞廉': 'Phi liêm', '大部': 'Đại bộ', '黑道': 'Hắc đạo', '月破': 'Nguyệt phá', '天火': 'Thiên hỏa', '月厌': 'Nguyệt yếm', '地火': 'Địa hỏa', '冰消瓦陷': 'Băng tiêu ngõa hãm', '荒芜': 'Hoang vu', '神隔': 'Thần cách', '月害': 'Nguyệt hại', '小空亡': 'Tiểu không vong', '大空亡': 'Đại không vong', '天狱': 'Thiên ngục', '天平': 'Thiên bình', '死符': 'Tử phù', '地贼': 'Địa tặc', '四穷': 'Tứ cùng', '五离': 'Ngũ ly', '八专': 'Bát chuyên', '横天': 'Hoành thiên', '受死': 'Thụ tử', '离巢': 'Ly sàng', '赤口': 'Xích khẩu'
};

const YI_JI_MAP: Record<string, string> = {
  '嫁娶': 'Cưới hỏi', '出行': 'Xuất hành', '动土': 'Động thổ', '祈福': 'Cầu phúc', '祭祀': 'Tế tự', '交易': 'Giao dịch', '纳财': 'Nạp tài', '开市': 'Khai trương', '安床': 'An sàng', '安葬': 'An táng', '入殓': 'Nhập liệm', '修造': 'Sửa chữa', '拆卸': 'Tháo dỡ', '起基': 'Khởi công', '移徙': 'Di dời', '入宅': 'Nhập trạch', '纳采': 'Đính hôn', '订盟': 'Đính ước', '裁衣': 'May áo', '冠笄': 'Cắt tóc', '开仓': 'Mở kho', '纳畜': 'Chăn nuôi', '破土': 'Phá thổ', '启钻': 'Khởi cữu', '伐木': 'Đốn gỗ', '理发': 'Cắt tóc', '沐浴': 'Tắm gội', '治病': 'Chữa bệnh', '破屋': 'Phá nhà', '坏垣': 'Phá tường', '扫舍': 'Quét dọn', '开池': 'Mở ao', '开厕': 'Mở nhà vệ sinh', '造庙': 'Xây đền', '塞穴': 'Lấp hang', '余事勿取': 'Các việc khác không nên làm', '诸事不宜': 'Mọi việc đều kỵ', '造桥': 'Xây cầu', '塑绘': 'Tạc tượng', '开渠': 'Đào mương', '穿井': 'Đào giếng', '栽种': 'Gieo trồng', '结网': 'Giăng lưới', '畋猎': 'Săn bắn', '捕捉': 'Bắt thú', '教牛马': 'Huấn luyện thú', '造畜稠': 'Làm chuồng', '立券': 'Ký hợp đồng', '开光': 'Khai quang', '竖柱': 'Dựng cột', '上梁': 'Cất nóc', '造门': 'Làm cửa', '安香': 'Đặt bát hương', '解除': 'Giải oan', '求医': 'Cầu y', '会亲友': 'Họp mặt', '进人口': 'Nhận con nuôi', '纳奴妾': 'Nhận người giúp việc', '修墓': 'Sửa mộ', '造葬': 'Xây mộ', '探病': 'Thăm bệnh', '赴任': 'Nhậm chức', '割蜜': 'Thu hoạch mật', '酝酿': 'Ủ rượu', '合帐': 'Làm màn', '放水': 'Tháo nước', '造车器': 'Đóng xe', '造船': 'Đóng thuyền', '修水门': 'Sửa cống', '补垣': 'Vá tường', '平治道涂': 'Làm đường', '修表章': 'Dâng sớ'
};

const translateArray = (arr: string[], map: Record<string, string>) => {
  if (!arr || arr.length === 0) return [];
  return arr.map(item => map[item] || item);
};

const getDayEvaluation = (date: Date) => {
  const dayInfo = getCanChiDay(date);
  const lunar = getLunarDate(date);
  let mChi = 0;
  
  try {
    const solar = Solar.fromYmd(date.getFullYear(), date.getMonth() + 1, date.getDate());
    mChi = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'].indexOf(solar.getLunar().getMonthZhiExact()); 
    if(mChi === -1) mChi = date.getMonth();
  } catch (e) { mChi = date.getMonth(); }

  const hoangDaoMap: Record<number, number[]> = {
    2: [0, 1, 4, 5, 7, 10], 8: [0, 1, 4, 5, 7, 10],
    3: [2, 3, 6, 7, 9, 0],  9: [2, 3, 6, 7, 9, 0],
    4: [4, 5, 8, 9, 11, 2], 10: [4, 5, 8, 9, 11, 2],
    5: [6, 7, 10, 11, 1, 4], 11: [6, 7, 10, 11, 1, 4],
    0: [8, 9, 0, 1, 3, 6],   6: [8, 9, 0, 1, 3, 6],
    1: [10, 11, 2, 3, 5, 8], 7: [10, 11, 2, 3, 5, 8]
  };

  const isHoangDao = hoangDaoMap[mChi]?.includes(dayInfo.chiIdx);
  const folkTaboos = getFolkTaboos(lunar.monthNum, lunar.day, CHI_CHU[dayInfo.chiIdx]);

  let score = 3.0; 
  let text = "Ngày trung bình";

  if (isHoangDao) { score += 1.5; text = "Ngày tốt"; } 
  else { score -= 0.5; text = "Ngày xấu"; }

  if (folkTaboos.length > 0) { 
    score = score >= 3.0 ? 2.5 : 1.0; 
    text = "Ngày xấu"; 
  }

  score = Math.max(1.0, Math.min(5.0, score));
  if (score >= 4.5) text = "Ngày rất tốt";
  if (score >= 3.0 && score < 4.0 && folkTaboos.length === 0) text = "Ngày trung bình";

  // SỬA LỖI LOGIC: Cập nhật nhận xét chính xác theo tính chất ngày
  let generalDesc = "";
  if (score >= 4.5) {
    generalDesc = "Vạn sự hanh thông, rất thích hợp để tiến hành các việc trọng đại.";
  } else if (score >= 3.0 && score < 4.5) {
    if (folkTaboos.length > 0) {
       generalDesc = `Cần cẩn trọng vì phạm kỵ (${folkTaboos.join(', ')}).`;
    } else {
       generalDesc = isHoangDao ? "Ngày tốt, có nhiều cát tinh phù trợ." : "Ngày bình thường, thích hợp làm các công việc nhỏ.";
    }
  } else {
    generalDesc = folkTaboos.length > 0 ? `Ngày xấu, phạm đại kỵ (${folkTaboos.join(', ')}), nên tránh khởi sự việc lớn.` : "Ngày xấu, nhiều hung tinh, nên thận trọng trong mọi việc.";
  }

  return { score: score.toFixed(1), text, isHoangDao, folkTaboos, generalDesc };
};

const getDayDetails = (date: Date) => {
  const dayInfo = getCanChiDay(date);
  const lunarObj = getLunarDate(date);
  
  // Các giá trị mặc định
  let trucName = "Không xác định", saoName = "Không xác định", saoDesc = "Chưa xác định.";
  let catTinh: string[] = [], hungTinh: string[] = [], hopText = "Bình thường.", kyText = "Không có kiêng kỵ lớn.";
  let tietKhi = "Đang cập nhật...";

  try {
    const solar = Solar.fromYmd(date.getFullYear(), date.getMonth() + 1, date.getDate());
    const lunar = solar.getLunar();

    // 1. Tiết khí (Dịch sang tiếng Việt)
    const JIE_QI_MAP: Record<string, string> = {
      '立春': 'Lập Xuân', '雨水': 'Vũ Thủy', '惊蛰': 'Kinh Trập', '春分': 'Xuân Phân',
      '清明': 'Thanh Minh', '谷雨': 'Cốc Vũ', '立夏': 'Lập Hạ', '小满': 'Tiểu Mãn',
      '芒种': 'Mang Chủng', '夏至': 'Hạ Chí', '小暑': 'Tiểu Thử', '大暑': 'Đại Thử',
      '立秋': 'Lập Thu', '处暑': 'Xử Thử', '白露': 'Bạch Lộ', '秋分': 'Thu Phân',
      '寒露': 'Hàn Lộ', '霜降': 'Sương Giáng', '立冬': 'Lập Đông', '小雪': 'Tiểu Tuyết',
      '大雪': 'Đại Tuyết', '冬至': 'Đông Chí', '小寒': 'Tiểu Hàn', '大寒': 'Đại Hàn'
    };
    const rawTietKhi = lunar.getJieQi() || lunar.getPrevJieQi().getName();
    tietKhi = JIE_QI_MAP[rawTietKhi] || rawTietKhi;

    // 2. Trực (Sử dụng hàm của thư viện)
    trucName = lunar.getDuty();

    // 3. Nhị thập bát tú (Sử dụng hàm của thư viện)
    saoName = lunar.getXiu();
    saoDesc = lunar.getXiuLuck() === '吉' ? 
              `Ngày có sao ${saoName} chiếu mệnh, là sao Cát, làm việc gì cũng hanh thông.` : 
              `Ngày có sao ${saoName} chiếu mệnh, là sao Hung, vạn sự cần cẩn trọng.`;

    // 4. Các việc Nên/Kiêng và Sao Tốt/Xấu
    // Lấy mảng từ thư viện sau đó map sang tiếng Việt qua các object bạn đã định nghĩa
    catTinh = lunar.getDayJiShen().map(s => SHEN_SHA_MAP[s] || s);
    hungTinh = lunar.getDayXiongShen().map(s => SHEN_SHA_MAP[s] || s);
    
    const yiList = lunar.getDayYi();
    const jiList = lunar.getDayJi();
    hopText = yiList.length > 0 ? yiList.map(s => YI_JI_MAP[s] || s).join(', ') : "Bình thường, làm các công việc hàng ngày.";
    kyText = jiList.length > 0 ? jiList.map(s => YI_JI_MAP[s] || s).join(', ') : "Không có kiêng kỵ lớn.";

  } catch(e) { 
    console.error("Lỗi lấy dữ liệu lịch:", e); 
  }

  // Giữ nguyên logic cũ của bạn về giờ hoàng đạo và tuổi xung
  const GIO_HOANG_DAO: any = { 'Tý': 'Tý (23-1), Sửu (1-3), Mão (5-7), Ngọ (11-13), Thân (15-17), Dậu (17-19)', 'Sửu': 'Dần (3-5), Mão (5-7), Tỵ (9-11), Thân (15-17), Tuất (19-21), Hợi (21-23)', 'Dần': 'Tý (23-1), Sửu (1-3), Thìn (7-9), Tỵ (9-11), Mùi (13-15), Tuất (19-21)', 'Mão': 'Tý (23-1), Dần (3-5), Mão (5-7), Ngọ (11-13), Mùi (13-15), Dậu (17-19)', 'Thìn': 'Dần (3-5), Thìn (7-9), Tỵ (9-11), Thân (15-17), Dậu (17-19), Hợi (21-23)', 'Tỵ': 'Sửu (1-3), Thìn (7-9), Ngọ (11-13), Mùi (13-15), Tuất (19-21), Hợi (21-23)', 'Ngọ': 'Tý (23-1), Sửu (1-3), Mão (5-7), Ngọ (11-13), Thân (15-17), Dậu (17-19)', 'Mùi': 'Dần (3-5), Mão (5-7), Tỵ (9-11), Thân (15-17), Tuất (19-21), Hợi (21-23)', 'Thân': 'Tý (23-1), Sửu (1-3), Thìn (7-9), Tỵ (9-11), Mùi (13-15), Tuất (19-21)', 'Dậu': 'Tý (23-1), Dần (3-5), Mão (5-7), Ngọ (11-13), Mùi (13-15), Dậu (17-19)', 'Tuất': 'Dần (3-5), Thìn (7-9), Tỵ (9-11), Thân (15-17), Dậu (17-19), Hợi (21-23)', 'Hợi': 'Sửu (1-3), Thìn (7-9), Ngọ (11-13), Mùi (13-15), Tuất (19-21), Hợi (21-23)' };
  const xungChiIdx = (dayInfo.chiIdx + 6) % 12;
  const tuoiXung = `Tuổi xung khắc: ${CHI_CHU[xungChiIdx]} và các tuổi xung Can.`;

  return { truc: trucName, sao: saoName, saoDesc, tietKhi, hop: hopText, ky: kyText, catTinh, hungTinh, gioHoangDao: GIO_HOANG_DAO[CHI_CHU[dayInfo.chiIdx]] || "...", tuoiXung };
};

const renderStars = (scoreStr: string) => {
  const score = parseFloat(scoreStr);
  const fullStars = Math.floor(score);
  const hasHalf = score - fullStars >= 0.5;
  return (
      <div className="flex items-center gap-0.5 ml-2 font-sans">
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
        } catch (error) { console.error(error); }
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
    if (!auth.currentUser) { setShowLoginPrompt(true); return; }
    setEditingId(null); setNewEventTitle(''); setNewEventLocation(''); setNewEventTime('08:00'); setNewReminderAdvance(0); setShowEventModal(true); 
  };
  
  const openModalForEdit = (ev: UserEvent) => { 
    if (!auth.currentUser) { setShowLoginPrompt(true); return; }
    setEditingId(ev.id); setNewEventTitle(ev.title); setNewEventTime(ev.time); setNewEventLocation(ev.location || ''); setNewReminderAdvance(ev.reminderAdvance || 0); setShowEventModal(true); 
  };

  const handleGoogleLogin = async () => {
    try { await signInWithPopup(auth, googleProvider); } catch (error) { console.error(error); }
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
      try { await setDoc(doc(db, "events", ev.id), ev); } catch (e) {}
    } else { 
      const newEv = { id: Date.now().toString(), dateStr, title: newEventTitle, time: newEventTime, location: newEventLocation, reminderAdvance: newReminderAdvance, userId: auth.currentUser.uid };
      updatedEvents = [...events, newEv];
      setEvents(updatedEvents);
      localStorage.setItem('user_events', JSON.stringify(updatedEvents));
      try { await setDoc(doc(db, "events", newEv.id), newEv); } catch (e) {}
    }
    setShowEventModal(false);
  };

  const handleDeleteEvent = async (id: string, e: React.MouseEvent) => { 
    e.stopPropagation(); 
    if (!auth.currentUser) return;
    const updatedEvents = events.filter(e => e.id !== id);
    setEvents(updatedEvents);
    localStorage.setItem('user_events', JSON.stringify(updatedEvents));
    try { await deleteDoc(doc(db, "events", id)); } catch (e) {}
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
        setCResult(`Ngày Âm: ${lunar.day}/${lunar.monthStr}/${getCanChiYear(y)}`); setCResultDate(sDate);
    } else {
        let found = null; const start = new Date(y, 0, 1);
        for(let i=0; i<380; i++) {
            const td = new Date(start.getTime() + i*86400000); const ln = getLunarDate(td);
            if (ln.day === d && ln.monthNum === m) { found = td; break; }
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
      
      const solarKey = `${d}/${month+1}`; const lunarKey = `${lunar.day}/${lunar.monthNum}`;
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
            <span className={`text-[11px] sm:text-sm font-medium ${lunar.day === 1 || lunar.day === 15 ? 'text-blue-400 font-bold' : 'text-slate-500'}`}>{lunar.day === 1 ? `${lunar.day}/${lunar.monthStr}` : lunar.day}</span>
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
  const selLunarKey = `${selLunar.day}/${selLunar.monthNum}`;
  
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
              <span className="text-lg lg:text-xl text-slate-300 font-semibold font-sans">Tháng {selLunar.monthStr} năm {getCanChiYear(selectedDate.getFullYear())}</span>
              
              {selLunarHoliday ? (
                <span className={`text-sm lg:text-base font-bold mt-4 px-5 py-2 rounded-full border font-sans ${isSelLunarDayOff ? 'text-red-500 bg-red-500/10 border-red-500/20' : 'text-amber-500 bg-amber-500/10 border-amber-500/20'}`}>
                  {selLunarHoliday.name}
                </span>
              ) : (
                <span className="text-sm lg:text-base text-slate-500 mt-4 tracking-widest uppercase font-medium font-sans">Bình thường</span>
              )}

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
                  tháng: <strong className="text-sky-400">{getCanChiMonth(selLunar.monthNum, selectedDate.getFullYear()).text}</strong>, 
                  năm: <strong className="text-sky-400">{getCanChiYear(selectedDate.getFullYear())}</strong>
                </p>
                <div className="flex items-center gap-2 mt-2 mb-2">
                  <span className="text-slate-300 font-semibold">Đánh giá chung:</span>
                  <strong className="text-amber-400 font-black">[{dayEval.score}]</strong>
                  {renderStars(dayEval.score)}
                  <span className="ml-2 text-xs font-semibold text-slate-400 bg-slate-800 px-2 py-1 rounded font-sans">
                    {dayEval.text}
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

      {/* MODAL CHI TIẾT NGÀY PHONG THỦY - ĐỒNG BỘ FONT VÀ NỘI DUNG */}
      <AnimatePresence>
        {showDayDetail && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/90 backdrop-blur-md z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className="bg-[#0f172a] border border-[#1e293b] rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-[0_0_100px_rgba(56,189,248,0.1)]">
              
              {/* KHÔI PHỤC HEADER UI SIÊU ĐẸP, ĐỒNG BỘ FONT-SANS */}
              <div className="p-6 bg-[#1e293b]/30 border-b border-[#1e293b] flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-amber-500 text-[#05070a] rounded-2xl flex items-center justify-center font-black text-3xl font-sans shadow-lg">{selectedDate.getDate()}</div>
                  <div>
                    <h3 className="text-white font-bold text-lg font-sans">Chi tiết ngày {selectedDate.toLocaleDateString('vi-VN')}</h3>
                    <p className="text-xs text-amber-500 uppercase font-black tracking-widest font-sans mt-0.5">{dayEval.text}</p>
                  </div>
                </div>
                <button onClick={() => setShowDayDetail(false)} className="p-2 bg-slate-800/50 hover:bg-rose-500 rounded-xl text-slate-400 hover:text-white transition-colors"><X size={20}/></button>
              </div>

              <div className="p-6 overflow-y-auto custom-scrollbar text-slate-300 space-y-6 text-sm font-sans leading-relaxed bg-[#05070a]">
                
                {/* 1. THÔNG TIN CHUNG */}
                <div>
                  <h4 className="text-brand font-bold text-base mb-2 font-sans uppercase tracking-widest">1. Thông tin chung về ngày</h4>
                  <p className="font-sans">
                    Ngày âm lịch <span className="text-white font-bold">{selLunar.day}/{selLunar.monthStr}</span>, 
                    là ngày: <span className="text-sky-400 font-bold">{getCanChiDay(selectedDate).text}</span>, 
                    tháng: <span className="text-sky-400 font-bold">{getCanChiMonth(selLunar.monthNum, selectedDate.getFullYear()).text}</span>, 
                    năm: <span className="text-sky-400 font-bold">{getCanChiYear(selectedDate.getFullYear())}</span>, 
                    là <span className="text-amber-400 font-bold">{dayEval.text.toLowerCase()}</span> theo lịch âm. {dayEval.generalDesc}
                  </p>
                  <div className="flex items-center gap-2 mt-2 font-sans">
                     <span>Đánh giá:</span>
                     <span className="text-white font-bold">[{dayEval.score}]</span>
                     {renderStars(dayEval.score)}
                  </div>
                  <p className="mt-2 font-sans">Kiểu ngày: <span className={`font-bold ${dayEval.isHoangDao ? 'text-emerald-400' : 'text-rose-400'}`}>{dayEval.isHoangDao ? 'Hoàng Đạo' : 'Hắc Đạo'}</span></p>
                  <p className="font-sans">Trực: <span className="text-amber-400 font-bold">{dayDet.truc}</span></p>
                  
                  <h5 className="font-bold text-white mt-4 mb-1 font-sans">Ngũ hành & Tiết khí</h5>
                  <p className="font-sans">Nạp âm: <span className="text-sky-400 font-bold">{dayDet.nguHanh}</span></p>
                  <p className="font-sans">Tiết khí: <span className="text-emerald-400 font-bold">{dayDet.tietKhi}</span></p>
                  
                  <h5 className="font-bold text-white mt-4 mb-1 font-sans">Nhị thập bát tú</h5>
                  <p className="font-sans">Sao chiếu mệnh: <span className="text-amber-400 font-bold">{dayDet.sao}</span></p>
                  <p className="italic font-sans">"{dayDet.saoDesc}"</p>
                </div>

                {/* 2. MỨC ĐỘ PHÙ HỢP CÔNG VIỆC */}
                <div>
                  <h4 className="text-brand font-bold text-base mb-2 font-sans uppercase tracking-widest">2. Mức độ phù hợp công việc</h4>
                  <p className="font-sans"><span className="text-emerald-400 font-bold">Nên làm (Cát):</span> {dayDet.hop}</p>
                  <p className="mt-2 font-sans"><span className="text-rose-400 font-bold">Kiêng kỵ (Hung):</span> {dayDet.ky}</p>
                </div>

                {/* 3. GIỜ HOÀNG ĐẠO VÀ XUNG KHẮC */}
                <div>
                  <h4 className="text-brand font-bold text-base mb-2 font-sans uppercase tracking-widest">3. Giờ Hoàng đạo & Xung khắc</h4>
                  <p className="font-sans"><span className="text-amber-400 font-bold">Giờ lành:</span> {dayDet.gioHoangDao}.</p>
                  <p className="text-white font-bold mt-3 font-sans">Tuổi xung khắc với ngày:</p>
                  <p className="font-sans">Các tuổi <span className="text-rose-400 font-bold">{dayDet.tuoiXung}</span>, bị xung với ngày này, làm việc gì cũng cần tránh khởi sự vào giờ chính xung.</p>
                </div>

                {/* 4. CÁC SAO TỐT XẤU THEO NGỌC HẠP THÔNG THƯ */}
                <div>
                  <h4 className="text-brand font-bold text-base mb-2 font-sans uppercase tracking-widest">4. Các sao tốt xấu (theo Ngọc hạp thông thư)</h4>
                  <p className="font-sans"><span className="text-emerald-400 font-bold">Các sao tốt:</span> {dayDet.catTinh.length > 0 ? dayDet.catTinh.join(', ') : 'Không có'}</p>
                  <p className="mt-2 font-sans"><span className="text-rose-400 font-bold">Các sao xấu:</span> {dayDet.hungTinh.length > 0 ? dayDet.hungTinh.join(', ') : 'Không có'}</p>
                </div>

              </div>
              
              {/* ĐÃ LOẠI BỎ KHỐI BUTTON "ĐÓNG LẠI" Ở BÊN DƯỚI */}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showLoginPrompt && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
             <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className="bg-[#0f172a] border border-brand/50 rounded-2xl p-8 max-w-sm w-full shadow-[0_0_50px_rgba(56,189,248,0.2)] text-center relative overflow-hidden">
                <div className="w-16 h-16 bg-brand/10 rounded-full flex items-center justify-center mx-auto mb-4">
                   <Bell className="text-brand" size={32} />
                </div>
                <h3 className="text-xl font-bold text-white mb-2 font-sans">Đăng nhập để lưu sự kiện</h3>
                <p className="text-slate-400 text-sm mb-8 font-sans">Dữ liệu Lịch trình của Bạn sẽ được lưu trữ bảo mật trên Đám mây để đồng bộ giữa các thiết bị.</p>
                <div className="flex flex-col gap-3 font-sans">
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