import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Bell, Plus, Trash2, Calendar as CalendarIcon, X, MapPin, Clock, Edit3, Star, StarHalf, Sun, Moon, ArrowRightLeft, Info, Search, AlertTriangle, CheckCircle } from 'lucide-react';
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

const getManualStars = (trucIdx: number) => {
  const cat = [];
  const hung = [];
  if (trucIdx === 0) { cat.push('Thiên ân', 'Thiên hỷ', 'Ích hậu', 'Cát khánh'); hung.push('Thổ phủ', 'Đại hao'); }
  else if (trucIdx === 1) { cat.push('Nguyệt đức', 'Thiên quan', 'Giải thần'); hung.push('Thiên cương', 'Tiểu không vong', 'Nguyệt phá'); }
  else if (trucIdx === 2) { cat.push('Thiên phúc', 'Phúc sinh', 'Hoàng ân'); hung.push('Tử khí', 'Thiên tặc'); }
  else if (trucIdx === 3) { cat.push('Nguyệt ân', 'Thiên mã', 'Phổ hộ'); hung.push('Cô thần', 'Bạch hổ'); }
  else if (trucIdx === 4) { cat.push('Tam hợp', 'Mẫu thương', 'Thiên quý', 'Kim đường', 'Lục hợp', 'Kính tâm', 'Địa tài', 'Trực tính'); hung.push('Quả tú', 'Hoang vu', 'Xích khẩu', 'Ly sàng'); }
  else if (trucIdx === 5) { cat.push('Lục hợp', 'Ngũ phú', 'Địa tài', 'Nguyệt giải'); hung.push('Kiếp sát', 'Vãng vong', 'Thiên cẩu'); }
  else if (trucIdx === 6) { cat.push('Giải thần', 'Thiên y'); hung.push('Đại hao', 'Nguyệt phá', 'Âm thác', 'Dương thác'); }
  else if (trucIdx === 7) { cat.push('Ích hậu', 'Thiên đức'); hung.push('Bạch hổ', 'Chu tước'); }
  else if (trucIdx === 8) { cat.push('Thiên y', 'Thiên tài', 'Tam hợp', 'Sinh khí'); hung.push('Địa tặc', 'Thụ tử'); }
  else if (trucIdx === 9) { cat.push('Sinh khí', 'Phúc hậu', 'Tục thế'); hung.push('Thiên cẩu', 'Huyết chi'); }
  else if (trucIdx === 10) { cat.push('Thiên đức', 'Nguyệt không', 'Thánh tâm'); hung.push('Thiên lại', 'Câu trận'); }
  else if (trucIdx === 11) { cat.push('Thánh tâm', 'Ngọc đường', 'Thiên ân'); hung.push('Chu tước', 'Câu trận', 'Tử thần'); }
  return { cat, hung };
};

const getManualYiJi = (trucIdx: number) => {
  if (trucIdx === 0) return { hop: "Khai trương, xuất hành, nhậm chức, giao dịch.", ky: "Động thổ, an táng, sửa chữa." };
  else if (trucIdx === 1) return { hop: "Sửa chữa, quét dọn, giải oan, tế tự.", ky: "Khai trương, ký hợp đồng, xuất hành." };
  else if (trucIdx === 2) return { hop: "Cầu tài, nhậm chức, tế tự, giao dịch.", ky: "Chữa bệnh, kiện cáo, tranh chấp." };
  else if (trucIdx === 3) return { hop: "Họp mặt, di dời, san lấp, sửa nhà.", ky: "Động thổ, gieo trồng, khai trương." };
  else if (trucIdx === 4) return { hop: "Giao dịch, nạp tài, đính hôn, động thổ, cầu sức khỏe.", ky: "Tố tụng, thưa kiện, tranh chấp pháp lý." };
  else if (trucIdx === 5) return { hop: "Lập khế ước, thu tiền, chăn nuôi, mua sắm.", ky: "Xuất hành, dời nhà, an táng." };
  else if (trucIdx === 6) return { hop: "Chữa bệnh, tháo dỡ, dọn dẹp.", ky: "Khai trương, xuất hành, an táng, cưới hỏi." };
  else if (trucIdx === 7) return { hop: "An sàng, tế tự, cầu phúc.", ky: "Leo núi, mạo hiểm, đi thuyền, xuất hành." };
  else if (trucIdx === 8) return { hop: "Khai trương, nhập học, kết hôn, động thổ.", ky: "Kiện tụng, phá dỡ, sửa nhà." };
  else if (trucIdx === 9) return { hop: "Thu hoạch, mua sắm, nhập kho, giao dịch.", ky: "An táng, mai táng, di dời." };
  else if (trucIdx === 10) return { hop: "Khởi công, xuất hành, mở cửa hàng, kết hôn.", ky: "Động thổ, dọn rác, tháo dỡ." };
  else if (trucIdx === 11) return { hop: "Lấp hang lỗ, xây tường, vá vách, thu tiền.", ky: "Mở cửa hàng, chữa mắt, xuất hành." };
  return { hop: "Bình thường, làm các công việc hàng ngày.", ky: "Không có kiêng kỵ lớn." };
};

const SHEN_SHA_MAP: Record<string, string> = {
  '天恩': 'Thiên ân', '天喜': 'Thiên hỷ', '月德': 'Nguyệt đức', '天官': 'Thiên quan', '天福': 'Thiên phúc', '福生': 'Phúc sinh', '月恩': 'Nguyệt ân', '天马': 'Thiên mã', '三合': 'Tam hợp', '母仓': 'Mẫu thương', '六合': 'Lục hợp', '五富': 'Ngũ phú', '解神': 'Giải thần', '益后': 'Ích hậu', '天医': 'Thiên y', '天财': 'Thiên tài', '生气': 'Sinh khí', '福厚': 'Phúc hậu', '天德': 'Thiên đức', '月空': 'Nguyệt không', '圣心': 'Thánh tâm', '阳德': 'Dương đức', '王日': 'Vương nhật', '驿马': 'Dịch mã', '天后': 'Thiên hậu', '鸣吠': 'Minh phệ', '敬心': 'Kính tâm', '普护': 'Phổ hộ', '守日': 'Thủ nhật', '天巫': 'Thiên vu', '福德': 'Phúc đức', '岁德': 'Tuế đức', '阴德': 'Âm đức', '官日': 'Quan nhật', '吉期': 'Cát kỳ', '玉宇': 'Ngọc vũ', '金堂': 'Kim đường', '敬安': 'Kính an', '时德': 'Thời đức', '民日': 'Dân nhật', '天赦': 'Thiên xá', '时阳': 'Thời dương', '要安': 'Yếu an', '相日': 'Tương nhật', '宝光': 'Bảo quang', '天仓': 'Thiên thương', '五合': 'Ngũ hợp', '鸣吠对': 'Minh phệ đối', '临日': 'Lâm nhật', '天愿': 'Thiên nguyện', '六仪': 'Lục nghi', '六儀': 'Lục nghi', '玉堂': 'Ngọc đường', '明堂': 'Minh đường', '司命': 'Tư mệnh', '青龙': 'Thanh long', '黄道': 'Hoàng đạo', '直星': 'Trực tinh', '天贵': 'Thiên quý', '吉神': 'Cát thần', '地财': 'Địa tài', '月解': 'Nguyệt giải', '直性': 'Trực tính', '月德合': 'Nguyệt đức hợp', '天德合': 'Thiên đức hợp', '月空合': 'Nguyệt không hợp', '人专': 'Nhân chuyên', '杀贡': 'Sát cống', '四相': 'Tứ tướng', '不将': 'Bất tương', '岁合': 'Tuế hợp', '大明': 'Đại minh', '神在': 'Thần tại', '金匮': 'Kim quỹ', '阴将': 'Âm tướng', '阳将': 'Dương tướng', '天刑': 'Thiên hình', '岁禄': 'Tuế lộc', '大红砂': 'Đại hồng sa', '续世': 'Tục thế', '續世': 'Tục thế',
  '时阴': 'Thời âm', '除神': 'Trừ thần', '四耗': 'Tứ hao', '五辰': 'Ngũ thần', '破败': 'Phá bại', '雷公': 'Lôi công', '八座': 'Bát tọa', '天瘟': 'Thiên ôn', '四击': 'Tứ kích', '九空': 'Cửu không', '血忌': 'Huyết kỵ', '九焦': 'Cửu tiêu', '五虚': 'Ngũ hư', '复日': 'Phục nhật', '重日': 'Trùng nhật',
  '土府': 'Thổ phủ', '天罡': 'Thiên cương', '死神': 'Tử thần', '月刑': 'Nguyệt hình', '大耗': 'Đại hao', '小耗': 'Tiểu hao', '孤辰': 'Cô thần', '寡宿': 'Quả tú', '劫煞': 'Kiếp sát', '灾煞': 'Tai sát', '岁破': 'Tuế phá', '岁煞': 'Tuế sát', '白虎': 'Bạch hổ', '朱雀': 'Chu tước', '玄武': 'Huyền vũ', '勾陈': 'Câu trận', '腾蛇': 'Đằng xà', '归忌': 'Quy kỵ', '厌对': 'Yếm đối', '招摇': 'Chiêu dao', '血支': 'Huyết chi', '九坎': 'Cửu khảm', '天狗': 'Thiên cẩu', '游祸': 'Du họa', '咸池': 'Hàm trì', '往亡': 'Vãng vong', '月煞': 'Nguyệt sát', '月虚': 'Nguyệt hư', '月客': 'Nguyệt khách', '阴错': 'Âm thác', '阳错': 'Dương thác', '耗客': 'Hao khách', '触水龙': 'Xúc thủy long', '四废': 'Tứ phế', '土符': 'Thổ phù', '大煞': 'Đại sát', '死气': 'Tử khí', '八龙': 'Bát long', '地囊': 'Địa nang', '天贼': 'Thiên tặc', '八风': 'Bát phong', '五墓': 'Ngũ mộ', '七乌': 'Thất ô', '天吏': 'Thiên lại', '致死': 'Trí tử', '月建': 'Nguyệt kiến', '土瘟': 'Thổ ôn', '天牢': 'Thiên lao', '孤阳': 'Cô dương', '绝阴': 'Tuyệt âm', '飞廉': 'Phi liêm', '大部': 'Đại bộ', '黑道': 'Hắc đạo', '月破': 'Nguyệt phá', '天火': 'Thiên hỏa', '月厌': 'Nguyệt yếm', '地火': 'Địa hỏa', '冰消瓦陷': 'Băng tiêu ngõa hãm', '荒芜': 'Hoang vu', '神隔': 'Thần cách', '月害': 'Nguyệt hại', '小空亡': 'Tiểu không vong', '大空亡': 'Đại không vong', '天狱': 'Thiên ngục', '天平': 'Thiên bình', '死符': 'Tử phù', '地贼': 'Địa tặc', '四穷': 'Tứ cùng', '五离': 'Ngũ ly', '八专': 'Bát chuyên', '横天': 'Hoành thiên', '受死': 'Thọ tử', '离巢': 'Ly sàng', '赤口': 'Xích khẩu', '绝烟': 'Tuyệt yên', '厌': 'Yếm'
};

// --- THƯ VIỆN Ý NGHĨA CÁC SAO CHI TIẾT (HOVER TOOLTIP) ---
const STAR_MEANINGS: Record<string, string> = {
  // --- CÁT TINH (SAO TỐT) ---
  'Thiên ân': 'Nên làm: Mọi việc, ban ân huệ, thi cử, nhậm chức, cầu tài.',
  'Thiên hỷ': 'Nên làm: Các việc vui mừng, đặc biệt đại cát cho cưới hỏi, sinh đẻ.',
  'Nguyệt đức': 'Nên làm: Mọi việc, hóa giải được nhiều hung tinh, mang lại sự ôn hòa.',
  'Thiên quan': 'Nên làm: Cầu tài lộc, thi cử, nhậm chức, gặp gỡ quý nhân.',
  'Thiên phúc': 'Nên làm: Mọi việc, mang lại phúc lộc, bình an.',
  'Phúc sinh': 'Nên làm: Sinh đẻ, nuôi dưỡng, tế tự, cầu phúc.',
  'Nguyệt ân': 'Nên làm: Cầu ân, xin xỏ, nhờ vả, làm việc thiện.',
  'Thiên mã': 'Nên làm: Xuất hành, di chuyển, giao dịch, ký hợp đồng, cầu tài lộc.',
  'Tam hợp': 'Nên làm: Đính hôn, cưới hỏi, giao dịch, hợp tác kinh doanh.',
  'Mẫu thương': 'Nên làm: Khai trương, cầu tài, gieo trồng, nạp tài.',
  'Lục hợp': 'Nên làm: Mọi việc, dễ thành công trong giao kết, cưới hỏi, hợp tác.',
  'Ngũ phú': 'Nên làm: Cầu tài, khai trương, mở kho, nhập trạch.',
  'Giải thần': 'Nên làm: Tế tự, giải oan, tố tụng, dọn dẹp, chữa bệnh.',
  'Ích hậu': 'Nên làm: Giá thú, sinh đẻ, cầu tự, làm phước.',
  'Thiên y': 'Nên làm: Chữa bệnh, cầu sức khỏe, mua thuốc, thẩm mỹ.',
  'Thiên tài': 'Nên làm: Cầu tài, khai trương, mở hàng, giao dịch.',
  'Sinh khí': 'Nên làm: Mọi việc, nhất là làm nhà, động thổ, gieo trồng, nhập trạch.',
  'Phúc hậu': 'Nên làm: Giá thú, cầu tự, nhận con nuôi.',
  'Thiên đức': 'Nên làm: Đại cát tinh, mọi việc đều tốt, giải trừ mọi hung họa.',
  'Nguyệt không': 'Nên làm: Sửa nhà, dọn dẹp, phá dỡ, giải oan.',
  'Thánh tâm': 'Nên làm: Cầu phúc, tế tự, làm việc thiện.',
  'Dương đức': 'Nên làm: Mọi việc đều hanh thông, cát lợi.',
  'Vương nhật': 'Nên làm: Nhậm chức, xuất hành, gặp quý nhân.',
  'Dịch mã': 'Nên làm: Xuất hành, đi xa, chuyển nhà, giao dịch.',
  'Thiên hậu': 'Nên làm: Rất tốt cho phụ nữ, giá thú, cầu tự.',
  'Minh phệ': 'Nên làm: Tốt cho việc tế tự, giải oan.',
  'Kính tâm': 'Nên làm: Cầu phúc, tế tự.',
  'Phổ hộ': 'Nên làm: Xuất hành, giá thú, làm phúc.',
  'Thủ nhật': 'Nên làm: Giữ gìn, cất giữ tài sản, nhập kho.',
  'Thiên vu': 'Nên làm: Tế tự, giải oan, làm phước.',
  'Phúc đức': 'Nên làm: Mọi việc đều thuận lợi, bình an.',
  'Tuế đức': 'Nên làm: Đại cát tinh, vạn sự hanh thông.',
  'Âm đức': 'Nên làm: Làm việc thiện, tế tự, cầu phúc.',
  'Quan nhật': 'Nên làm: Nhậm chức, thi cử, ký kết.',
  'Cát kỳ': 'Nên làm: Mọi việc khởi sự đều thuận lợi.',
  'Ngọc vũ': 'Nên làm: Xây dựng, sửa nhà, nhập trạch.',
  'Kim đường': 'Nên làm: Xây dựng, cầu tài, mở cửa hàng.',
  'Kính an': 'Nên làm: Xây dựng, tế tự, cầu bình an.',
  'Thời đức': 'Nên làm: Mọi việc khởi sự đều thuận.',
  'Dân nhật': 'Nên làm: Xây dựng, làm các việc có đông người.',
  'Thiên xá': 'Nên làm: Đại cát tinh, giải trừ mọi tai họa, tốt mọi việc.',
  'Thời dương': 'Nên làm: Các việc dương, khởi sự việc mới.',
  'Yếu an': 'Nên làm: Mọi việc, mang lại sự bình an, yên ổn.',
  'Tương nhật': 'Nên làm: Giao dịch, ký hợp đồng, hợp tác.',
  'Bảo quang': 'Nên làm: Sao Hoàng đạo (Cát), tốt mọi việc.',
  'Thiên thương': 'Nên làm: Nhập kho, thu tiền, cầu tài.',
  'Ngũ hợp': 'Nên làm: Cưới hỏi, giao dịch, hợp tác.',
  'Minh phệ đối': 'Nên làm: Tốt cho việc tang tế.',
  'Lâm nhật': 'Nên làm: Khởi sự, nhậm chức.',
  'Thiên nguyện': 'Nên làm: Cầu tự, tế tự, giao dịch, thỉnh nguyện.',
  'Lục nghi': 'Nên làm: Mọi việc đều hanh thông.',
  'Ngọc đường': 'Nên làm: Sao Hoàng đạo (Cát), tốt mọi việc.',
  'Minh đường': 'Nên làm: Sao Hoàng đạo (Cát), tốt mọi việc.',
  'Tư mệnh': 'Nên làm: Sao Hoàng đạo (Cát), tốt mọi việc.',
  'Thanh long': 'Nên làm: Sao Hoàng đạo, Đại cát tinh, vạn sự tốt lành.',
  'Hoàng đạo': 'Nên làm: Ngày có sao tốt chiếu, thích hợp việc lớn.',
  'Trực tinh': 'Nên làm: Đại cát tinh, hóa giải hung tinh, tốt mọi sự.',
  'Thiên quý': 'Nên làm: Mọi việc đều sang trọng, cát lợi.',
  'Cát thần': 'Nên làm: Khởi sự mang lại may mắn.',
  'Địa tài': 'Nên làm: Cầu tài, giao dịch, kinh doanh.',
  'Nguyệt giải': 'Nên làm: Giải oan, tháo dỡ, dọn dẹp.',
  'Trực tính': 'Nên làm: Khởi công, giao dịch.',
  'Nguyệt đức hợp': 'Nên làm: Mọi việc đều tốt, mang lại sự hòa hợp.',
  'Thiên đức hợp': 'Nên làm: Mọi việc đều hanh thông, thuận lợi.',
  'Nguyệt không hợp': 'Nên làm: Sửa nhà, dọn dẹp, phá dỡ.',
  'Nhân chuyên': 'Nên làm: Đại cát tinh, hóa giải mọi hung tinh, tốt vạn sự.',
  'Sát cống': 'Nên làm: Đại cát tinh, hóa giải sát khí, trăm việc đều cát lợi.',
  'Tứ tướng': 'Nên làm: Mọi việc, cầu tài cầu lộc.',
  'Bất tương': 'Nên làm: Đại cát cho cưới hỏi, đính hôn.',
  'Tuế hợp': 'Nên làm: Mọi việc, vạn sự hòa hợp.',
  'Đại minh': 'Nên làm: Mọi việc hanh thông, rực rỡ.',
  'Thần tại': 'Nên làm: Tế tự, cầu phúc, xin xỏ.',
  'Kim quỹ': 'Nên làm: Sao Hoàng đạo, tốt cho cầu tài, đính hôn.',
  'Âm tướng': 'Nên làm: Tốt cho công việc của nữ giới.',
  'Dương tướng': 'Nên làm: Tốt cho công việc của nam giới.',
  'Tuế lộc': 'Nên làm: Rất tốt cho cầu tài, cầu lộc, nhậm chức.',
  'Đại hồng sa': 'Nên làm: Mọi việc thuận lợi, rực rỡ.',
  'Tục thế': 'Nên làm: Giá thú, cầu tự, sinh đẻ.',

  // --- HUNG TINH (SAO XẤU) ---
  'Thổ phủ': 'Kỵ: Xây dựng, động thổ, phá thổ.',
  'Thiên cương': 'Kỵ: Khởi công, di dời, kết hôn, dễ xảy ra tranh chấp.',
  'Tử thần': 'Kỵ: Chữa bệnh, xuất hành, cầu y.',
  'Nguyệt hình': 'Kỵ: Di dời, mở cửa hàng, giá thú.',
  'Đại hao': 'Kỵ: Cầu tài, kinh doanh, xuất hành, dễ thất thoát tiền bạc.',
  'Tiểu hao': 'Kỵ: Kinh doanh, mua sắm lớn, dễ hao tài tốn của.',
  'Cô thần': 'Kỵ: Giá thú, cưới hỏi, dễ cô độc.',
  'Quả tú': 'Kỵ: Giá thú, kết hôn, đính hôn.',
  'Kiếp sát': 'Kỵ: Xuất hành, giá thú, an táng, làm việc lớn.',
  'Tai sát': 'Kỵ: Giá thú, an táng, xuất hành, dễ gặp tai ương.',
  'Tuế phá': 'Kỵ: Làm việc lớn, xây dựng, xuất hành, kinh doanh.',
  'Tuế sát': 'Kỵ: Xây dựng, cưới hỏi, xuất hành.',
  'Bạch hổ': 'Kỵ: An táng, cưới hỏi, xuất hành.',
  'Chu tước': 'Kỵ: Giao dịch, ký kết, tranh chấp, dễ gặp thị phi.',
  'Huyền vũ': 'Kỵ: An táng, xuất hành, cẩn thận mất trộm.',
  'Câu trận': 'Kỵ: Xây dựng, an táng, tranh chấp pháp lý.',
  'Đằng xà': 'Kỵ: Xuất hành, dễ gặp chuyện rắc rối, trắc trở.',
  'Quy kỵ': 'Kỵ: Xuất hành, dời nhà, nhập trạch.',
  'Yếm đối': 'Kỵ: Giá thú, cưới hỏi, đính hôn.',
  'Chiêu dao': 'Kỵ: Xuất hành, kiện tụng, dễ gặp tai tiếng.',
  'Huyết chi': 'Kỵ: Châm cứu, phẫu thuật, cắt máu.',
  'Cửu không': 'Kỵ: Xuất hành, giao dịch, cầu tài, mở cửa hàng.',
  'Cửu khảm': 'Kỵ: Đi thuyền, xuất hành đường thủy.',
  'Trùng nhật': 'Kỵ: An táng, tang lễ.',
  'Phục nhật': 'Kỵ: An táng, tang lễ.',
  'Thiên cẩu': 'Kỵ: Tế tự, cầu phúc.',
  'Du họa': 'Kỵ: Làm nhà, xuất hành, di chuyển.',
  'Hàm trì': 'Kỵ: Giá thú, kết hôn.',
  'Vãng vong': 'Kỵ: Xuất hành, giá thú, cầu tài, di dời.',
  'Nguyệt sát': 'Kỵ: Cầu tài, mở cửa hàng, giao dịch.',
  'Nguyệt hư': 'Kỵ: Giá thú, mở cửa hàng, kết hôn.',
  'Nguyệt khách': 'Kỵ: Động thổ, xây dựng, phá dỡ.',
  'Âm thác': 'Kỵ: Xuất hành, giá thú, đính ước.',
  'Dương thác': 'Kỵ: Xuất hành, giá thú, đính ước.',
  'Tứ kích': 'Kỵ: Động thổ, sửa nhà, phá vỡ.',
  'Hao khách': 'Kỵ: Kinh doanh, xuất tiền, giao dịch.',
  'Xúc thủy long': 'Kỵ: Đi thuyền, xuất hành đường thủy.',
  'Tứ phế': 'Kỵ: Đại kỵ mọi việc khởi sự, không nên làm việc lớn.',
  'Ngũ hư': 'Kỵ: Giá thú, an táng.',
  'Thổ phù': 'Kỵ: Xây dựng, động thổ.',
  'Đại sát': 'Kỵ: Trăm việc đều kỵ, tuyệt đối tránh làm việc lớn.',
  'Tử khí': 'Kỵ: An táng, cầu bệnh.',
  'Bát long': 'Kỵ: Đi thuyền, vượt sông.',
  'Địa nang': 'Kỵ: Động thổ, sửa nhà.',
  'Thiên tặc': 'Kỵ: Xuất hành, kinh doanh, cẩn thận mất trộm.',
  'Bát phong': 'Kỵ: Xuất hành, đi biển, đi thuyền.',
  'Cửu tiêu': 'Kỵ: Xây dựng, lợp nhà.',
  'Ngũ mộ': 'Kỵ: An táng, xây mộ.',
  'Thất ô': 'Kỵ: Xuất hành, đi xa.',
  'Thiên lại': 'Kỵ: Nhậm chức, kiện tụng, tranh chấp.',
  'Trí tử': 'Kỵ: Chữa bệnh, an táng.',
  'Nguyệt kiến': 'Kỵ: Động thổ, xây dựng.',
  'Thổ ôn': 'Kỵ: Xây dựng, đào bới, động thổ.',
  'Thiên lao': 'Kỵ: Xuất hành, kiện tụng, tranh chấp.',
  'Cô dương': 'Kỵ: Giá thú, kết hôn.',
  'Tuyệt âm': 'Kỵ: Giá thú, nhập trạch.',
  'Phi liêm': 'Kỵ: Xuất hành, dời nhà.',
  'Đại bộ': 'Kỵ: Chữa bệnh, cầu y.',
  'Hắc đạo': 'Kỵ: Sao xấu chung, kỵ khởi sự việc lớn.',
  'Nguyệt phá': 'Kỵ: Sửa nhà, động thổ, cưới hỏi.',
  'Thiên hỏa': 'Kỵ: Lợp nhà, làm bếp, phòng hỏa hoạn.',
  'Nguyệt yếm': 'Kỵ: Giá thú, xuất hành.',
  'Địa hỏa': 'Kỵ: Làm bếp, trồng trọt.',
  'Băng tiêu ngõa hãm': 'Kỵ: Lợp nhà, dỡ nhà, xây dựng.',
  'Hoang vu': 'Kỵ: Gieo trồng, xây dựng.',
  'Thần cách': 'Kỵ: Tế tự, cầu phúc.',
  'Nguyệt hại': 'Kỵ: Mọi việc trọng đại, dễ đổ vỡ.',
  'Tiểu không vong': 'Kỵ: Xuất hành, giao dịch, ký kết.',
  'Đại không vong': 'Kỵ: Xuất hành, làm việc lớn.',
  'Thiên ngục': 'Kỵ: Xuất hành, kiện tụng, tranh chấp pháp lý.',
  'Thiên bình': 'Kỵ: Dời nhà, xuất hành.',
  'Tử phù': 'Kỵ: An táng, tranh chấp.',
  'Địa tặc': 'Kỵ: Khởi tạo, dời nhà, cẩn thận trộm cắp.',
  'Tứ cùng': 'Kỵ: Giao dịch, kinh doanh, xuất tiền.',
  'Ngũ ly': 'Kỵ: Giá thú, hợp tác, kết hôn.',
  'Bát chuyên': 'Kỵ: Giá thú, cưới hỏi.',
  'Hoành thiên': 'Kỵ: Xuất hành, đi xa.',
  'Thọ tử': 'Kỵ: Trăm việc đều kỵ, tuyệt đối tránh cưới hỏi, động thổ, an táng.',
  'Ly sàng': 'Kỵ: Giá thú, cưới hỏi.',
  'Xích khẩu': 'Kỵ: Giao dịch, kiện tụng, dễ gặp thị phi, cãi vã.',
  'Tuyệt yên': 'Kỵ: Xuất hành, dời nhà, nhập trạch.',
  'Yếm': 'Kỵ: Giá thú, cưới hỏi.',
  'Tứ hao': 'Kỵ: Kinh doanh, cầu tài, mở cửa hàng.',
  'Ngũ thần': 'Kỵ: Làm việc trọng đại.',
  'Phá bại': 'Kỵ: Kinh doanh, mở cửa hàng, giao dịch.',
  'Lôi công': 'Kỵ: Xây dựng, lợp nhà, cất nóc.',
  'Bát tọa': 'Kỵ: Di dời, nhậm chức, dời nhà.',
  'Thiên hình': 'Kỵ: Sao Hắc đạo, kỵ tố tụng, tranh chấp pháp lý.',
  'Sát chủ': 'Kỵ: Đại hung tinh. Tuyệt đối kiêng kỵ mọi việc khởi sự, trọng đại.',
  'Tam nương sát': 'Kỵ: Ngày kỵ dân gian, không nên khởi sự việc lớn như cưới hỏi, khai trương.'
};

const YI_JI_MAP: Record<string, string> = {
  '嫁娶': 'Cưới hỏi', '出行': 'Xuất hành', '动土': 'Động thổ', '祈福': 'Cầu phúc', '祭祀': 'Tế tự', '交易': 'Giao dịch', '纳财': 'Nạp tài', '开市': 'Khai trương', '安床': 'An sàng', '安葬': 'An táng', '入殓': 'Nhập liệm', '修造': 'Sửa chữa', '拆卸': 'Tháo dỡ', '起基': 'Khởi công', '移徙': 'Di dời', '入宅': 'Nhập trạch', '纳采': 'Đính hôn', '订盟': 'Đính ước', '裁衣': 'May áo', '冠笄': 'Cắt tóc', '开仓': 'Mở kho', '纳畜': 'Chăn nuôi', '破土': 'Phá thổ', '启钻': 'Khởi cữu', '伐木': 'Đốn gỗ', '理发': 'Cắt tóc', '沐浴': 'Tắm gội', '治病': 'Chữa bệnh', '破屋': 'Phá nhà', '坏垣': 'Phá tường', '扫舍': 'Quét dọn', '开池': 'Mở ao', '开厕': 'Mở nhà vệ sinh', '造庙': 'Xây đền', '塞穴': 'Lấp hang', '余事勿取': 'Các việc khác không nên làm', '诸事不宜': 'Mọi việc đều kỵ', '造桥': 'Xây cầu', '塑绘': 'Tạc tượng', '开渠': 'Đào mương', '穿井': 'Đào giếng', '栽种': 'Gieo trồng', '结网': 'Giăng lưới', '畋猎': 'Săn bắn', '捕捉': 'Bắt thú', '教牛马': 'Huấn luyện thú', '造畜稠': 'Làm chuồng', '立券': 'Ký hợp đồng', '开光': 'Khai quang', '竖柱': 'Dựng cột', '上梁': 'Cất nóc', '造门': 'Làm cửa', '安香': 'Đặt bát hương', '解除': 'Giải oan', '求医': 'Cầu y', '会亲友': 'Họp mặt', '进人口': 'Nhận con nuôi', '纳奴妾': 'Nhận người giúp việc', '修墓': 'Sửa mộ', '造葬': 'Xây mộ', '探病': 'Thăm bệnh', '赴任': 'Nhậm chức', '割蜜': 'Thu hoạch mật', '酝酿': 'Ủ rượu', '合帐': 'Làm màn', '放水': 'Tháo nước', '造车器': 'Đóng xe', '造船': 'Đóng thuyền', '修水门': 'Sửa cống', '补垣': 'Vá tường', '平治道涂': 'Làm đường', '修表章': 'Dâng sớ', '祈嗣': 'Cầu tự', '入学': 'Nhập học', '求嗣': 'Cầu tự', '挂匾': 'Treo biển', '出火': 'Di dời bát hương', '安门': 'Dựng cửa', '谢土': 'Tạ thổ', '作灶': 'Làm bếp', '移柩': 'Di quan', '修坟': 'Sửa mộ', '架马': 'Lên đòn dông', '作梁': 'Cất nóc', '无': 'Không', '合寿木': 'Làm quan tài', '破木': 'Chẻ gỗ'
};

const JOB_CATEGORIES = [
  { id: '', label: 'Tốt nói chung (Tất cả công việc)', keywords: [] },
  { id: 'hon_thu', label: 'Hôn thú, giá thú (ngày cưới, đám hỏi)', keywords: ['Cưới hỏi', 'Đính hôn', 'Đính ước', 'Kết hôn', 'Giá thú'] },
  { id: 'xay_dung', label: 'Xây dựng, làm nhà, sửa nhà', keywords: ['Sửa chữa', 'Khởi công', 'Cất nóc', 'Xây đền', 'Sửa nhà', 'Làm cửa', 'Làm nhà', 'Dựng cột', 'Xây cầu', 'Phá nhà'] },
  { id: 'khai_truong', label: 'Khai trương, mở hàng', keywords: ['Khai trương', 'Mở cửa hàng', 'Mở kho', 'Mở ao'] },
  { id: 'an_tang', label: 'An táng, mai táng', keywords: ['An táng', 'Mai táng', 'Nhập liệm', 'Xây mộ', 'Sửa mộ', 'Khởi cữu'] },
  { id: 'te_tu', label: 'Tế tự, tế lễ, đặt bát hương', keywords: ['Tế tự', 'Cầu phúc', 'Đặt bát hương', 'Tế lễ', 'Làm việc thiện'] },
  { id: 'dong_tho', label: 'Động thổ', keywords: ['Động thổ', 'Phá thổ', 'San lấp', 'Đào giếng', 'Khởi công'] },
  { id: 'xuat_hanh', label: 'Xuất hành, di chuyển', keywords: ['Xuất hành', 'Di dời', 'Đi thuyền', 'Đi xa'] },
  { id: 'giao_dich', label: 'Giao dịch, ký hợp đồng', keywords: ['Giao dịch', 'Ký hợp đồng', 'Lập khế ước', 'Thu tiền'] },
  { id: 'cau_tai', label: 'Cầu tài, lộc', keywords: ['Cầu tài', 'Nạp tài', 'Cầu lộc'] },
  { id: 'to_tung', label: 'Tố tụng, giải oan', keywords: ['Giải oan', 'Tố tụng', 'Kiện cáo'] },
  { id: 'lam_phuc', label: 'Làm việc thiện, làm phúc', keywords: ['Làm việc thiện', 'Làm phúc', 'Cầu phúc', 'Giải oan'] },
  { id: 'nhap_trach', label: 'Nhập trạch (về nhà mới)', keywords: ['Nhập trạch', 'Dời nhà', 'Di dời'] },
  { id: 'khai_nghiep', label: 'Khai nghiệp (bắt đầu công việc mới)', keywords: ['Khai nghiệp', 'Nhậm chức', 'Nhận việc', 'Khai trương'] },
  { id: 'cau_tu', label: 'Cầu tự (cầu con cái)', keywords: ['Cầu tự', 'Cầu phúc'] },
  { id: 'khai_giang', label: 'Khai giảng, đăng ký khóa học', keywords: ['Nhập học', 'Khai giảng'] },
  { id: 'chua_benh', label: 'Cầu sức khỏe, chữa bệnh', keywords: ['Chữa bệnh', 'Cầu y', 'Cầu sức khỏe'] },
  { id: 'nhan_nuoi', label: 'Nhận con nuôi, nhận giúp việc', keywords: ['Nhận con nuôi', 'Nhận người giúp việc'] }
];

// Hàm Translate loại bỏ 100% tiếng Trung bằng mã Regex
const translateArray = (arr: string[], map: Record<string, string>) => {
  if (!arr || arr.length === 0) return [];
  return arr.map(item => map[item] || item)
            .filter(item => !/[\u4e00-\u9fa5]/.test(item))
            .filter(item => item !== 'Không'); // Xóa bỏ chữ Không bị thừa
};

const getDayEvaluation = (date: Date) => {
  const dayInfo = getCanChiDay(date);
  const lunar = getLunarDate(date);
  
  // Lấy chuẩn Tháng Tiết Khí (Nguyệt Lệnh) làm gốc khởi vòng và an sao Ngọc Hạp Thông Thư
  let monthChiIdx = date.getMonth(); 
  try {
    const solarH = Solar.fromYmdHms(date.getFullYear(), date.getMonth() + 1, date.getDate(), 12, 0, 0);
    const idx = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'].indexOf(solarH.getLunar().getMonthZhiExact()); 
    if(idx !== -1) monthChiIdx = idx;
  } catch (e) {}

  // Quy đổi số tháng âm lịch tương ứng với Tiết Khí (Dùng để khớp ma trận Ngọc Hạp chuẩn xác)
  // Tháng Tý = 11, Sửu = 12, Dần = 1, Mão = 2, Thìn = 3, Tỵ = 4, Ngọ = 5, Mùi = 6, Thân = 7, Dậu = 8, Tuất = 9, Hợi = 10
  const m = ((monthChiIdx - 2 + 12) % 12) + 1;

  // Khởi vòng Hoàng Đạo chuẩn theo Nguyệt Lệnh Tiết Khí
  const hoangDaoMap: Record<number, number[]> = {
    2: [0, 1, 4, 5, 7, 10], 8: [0, 1, 4, 5, 7, 10], // Dần, Thân
    3: [2, 3, 6, 7, 9, 0],  9: [2, 3, 6, 7, 9, 0],   // Mão, Dậu
    4: [4, 5, 8, 9, 11, 2], 10: [4, 5, 8, 9, 11, 2], // Thìn, Tuất
    5: [6, 7, 10, 11, 1, 4], 11: [6, 7, 10, 11, 1, 4], // Tỵ, Hợi
    0: [8, 9, 0, 1, 3, 6],   6: [8, 9, 0, 1, 3, 6],    // Tý, Ngọ
    1: [10, 11, 2, 3, 5, 8], 7: [10, 11, 2, 3, 5, 8]   // Sửu, Mùi
  };
  const isHoangDao = hoangDaoMap[monthChiIdx]?.includes(dayInfo.chiIdx);

  const folkTaboos = getFolkTaboos(lunar.monthNum, lunar.day, CHI_CHU[dayInfo.chiIdx]);
  
  // Tính Trực chuẩn theo Nguyệt lệnh Tiết khí
  const trucIdx = (dayInfo.chiIdx - monthChiIdx + 12) % 12;
  const TRUC_12_LOCAL = ['Kiến', 'Trừ', 'Mãn', 'Bình', 'Định', 'Chấp', 'Phá', 'Nguy', 'Thành', 'Thâu', 'Khai', 'Bế'];
  const trucName = TRUC_12_LOCAL[trucIdx];

  const manualStars = getManualStars(trucIdx);
  let allCat = [...manualStars.cat];
  let allHung = [...manualStars.hung];

  // AN SAO CHUẨN NGỌC HẠP THÔNG THƯ THEO NGUYỆT LỆNH TIẾT KHÍ
  try {
    const chiDay = CHI_CHU[dayInfo.chiIdx]; 
    const canDay = CAN_CHU[dayInfo.canIdx]; 

    let ngocHapCat: string[] = [];
    let ngocHapHung: string[] = [];

    const thienDucMap: Record<number, string> = { 1: 'Đinh', 2: 'Thân', 3: 'Nhâm', 4: 'Tân', 5: 'Hợi', 6: 'Giáp', 7: 'Quý', 8: 'Dần', 9: 'Bính', 10: 'Ất', 11: 'Tỵ', 12: 'Canh' };
    if (canDay === thienDucMap[m] || chiDay === thienDucMap[m]) ngocHapCat.push('Thiên đức');

    if ([1, 5, 9].includes(m) && canDay === 'Bính') ngocHapCat.push('Nguyệt đức');
    else if ([2, 6, 10].includes(m) && canDay === 'Giáp') ngocHapCat.push('Nguyệt đức');
    else if ([3, 7, 11].includes(m) && canDay === 'Nhâm') ngocHapCat.push('Nguyệt đức');
    else if ([4, 8, 12].includes(m) && canDay === 'Canh') ngocHapCat.push('Nguyệt đức');

    const thienHyMap: Record<number, string> = { 1: 'Tuất', 2: 'Hợi', 3: 'Tý', 4: 'Sửu', 5: 'Dần', 6: 'Mão', 7: 'Thìn', 8: 'Tỵ', 9: 'Ngọ', 10: 'Mùi', 11: 'Thân', 12: 'Dậu' };
    if (chiDay === thienHyMap[m]) ngocHapCat.push('Thiên hỷ');

    const sinhKhiMap: Record<number, string> = { 1: 'Tý', 2: 'Sửu', 3: 'Dần', 4: 'Mão', 5: 'Thìn', 6: 'Tỵ', 7: 'Ngọ', 8: 'Mùi', 9: 'Thân', 10: 'Dậu', 11: 'Tuất', 12: 'Hợi' };
    if (chiDay === sinhKhiMap[m]) ngocHapCat.push('Sinh khí');

    if ([1, 2].includes(m) && chiDay === 'Thân') ngocHapCat.push('Giải thần');
    else if ([3, 4].includes(m) && chiDay === 'Tuất') ngocHapCat.push('Giải thần');
    else if ([5, 6].includes(m) && chiDay === 'Tý') ngocHapCat.push('Giải thần');
    else if ([7, 8].includes(m) && chiDay === 'Dần') ngocHapCat.push('Giải thần');
    else if ([9, 10].includes(m) && chiDay === 'Thìn') ngocHapCat.push('Giải thần');
    else if ([11, 12].includes(m) && chiDay === 'Ngọ') ngocHapCat.push('Giải thần');

    const dichMaMap: Record<number, string> = { 1: 'Thân', 5: 'Thân', 9: 'Thân', 2: 'Tỵ', 6: 'Tỵ', 10: 'Tỵ', 3: 'Dần', 7: 'Dần', 11: 'Dần', 4: 'Hợi', 8: 'Hợi', 12: 'Hợi' };
    if (chiDay === dichMaMap[m]) ngocHapCat.push('Dịch mã');

    // Bổ sung sao Thiên Mã chuẩn học thuật (CG 2 góp ý)
    const thienMaMap: Record<number, string> = { 1: 'Ngọ', 2: 'Thân', 3: 'Tuất', 4: 'Tý', 5: 'Dần', 6: 'Thìn', 7: 'Ngọ', 8: 'Thân', 9: 'Tuất', 10: 'Tý', 11: 'Dần', 12: 'Thìn' };
    if (chiDay === thienMaMap[m]) ngocHapCat.push('Thiên mã');

    const satChuMap: Record<number, string> = { 1: 'Tỵ', 2: 'Tý', 3: 'Mùi', 4: 'Mão', 5: 'Thân', 6: 'Tuất', 7: 'Hợi', 8: 'Sửu', 9: 'Ngọ', 10: 'Dậu', 11: 'Dần', 12: 'Thìn' };
    if (chiDay === satChuMap[m]) ngocHapHung.push('Sát chủ');

    const thoTuMap: Record<number, string> = { 1: 'Tuất', 2: 'Thìn', 3: 'Hợi', 4: 'Tỵ', 5: 'Tý', 6: 'Ngọ', 7: 'Sửu', 8: 'Mùi', 9: 'Dần', 10: 'Thân', 11: 'Mão', 12: 'Dậu' };
    if (chiDay === thoTuMap[m]) ngocHapHung.push('Thọ tử');

    const nguyetPhaMap: Record<number, string> = { 1: 'Thân', 2: 'Dậu', 3: 'Tuất', 4: 'Hợi', 5: 'Tý', 6: 'Sửu', 7: 'Dần', 8: 'Mão', 9: 'Thìn', 10: 'Tỵ', 11: 'Ngọ', 12: 'Mùi' };
    if (chiDay === nguyetPhaMap[m]) ngocHapHung.push('Nguyệt phá');

    const daiHaoMap: Record<number, string> = { 1: 'Thân', 2: 'Tuất', 3: 'Tý', 4: 'Dần', 5: 'Thìn', 6: 'Ngọ', 7: 'Tuất', 8: 'Tý', 9: 'Dần', 10: 'Thìn', 11: 'Ngọ', 12: 'Thân' };
    if (chiDay === daiHaoMap[m]) ngocHapHung.push('Đại hao');

    const kiepSatMap: Record<number, string> = { 1: 'Hợi', 5: 'Hợi', 9: 'Hợi', 2: 'Dần', 6: 'Dần', 10: 'Dần', 3: 'Tỵ', 7: 'Tỵ', 11: 'Tỵ', 4: 'Thân', 8: 'Thân', 12: 'Thân' };
    if (chiDay === kiepSatMap[m]) ngocHapHung.push('Kiếp sát');

    allCat = [...allCat, ...ngocHapCat];
    allHung = [...allHung, ...ngocHapHung];
  } catch (e) {}

  allCat = Array.from(new Set(allCat));
  
  // Chặn lọc tuyệt đối: Không đưa Ngày kỵ dân gian vào danh sách Sao Xấu
  allHung = Array.from(new Set(allHung)).filter(s => !['Tam nương sát', 'Nguyệt kỵ', 'Vãng vong'].includes(s));

  // THUẬT TOÁN ĐÁNH GIÁ CHẤM ĐIỂM LOGIC 4 BƯỚC
  const DAI_CAT = ['Thiên đức', 'Nguyệt đức', 'Thiên ân', 'Thiên hỷ', 'Thiên xá', 'Giải thần', 'Sinh khí', 'Thiên y', 'Tam hợp', 'Nhân chuyên', 'Sát cống'];
  const CUU_GIAI = ['Thiên xá', 'Nhân chuyên', 'Sát cống', 'Giải thần', 'Thiên đức', 'Nguyệt đức'];
  
  // Vãng vong, Sát chủ, Thọ tử là Án tử - KHÔNG THỂ CỨU GIẢI (Tiếp thu CG 1, 3, 4)
  const UNRESCUABLE = ['Sát chủ', 'Thọ tử', 'Thụ tử', 'Vãng vong'];
  const RESCUABLE = ['Tam nương sát', 'Nguyệt kỵ', 'Nguyệt phá', 'Tứ phế', 'Đại sát', 'Tuyệt âm', 'Đại hao', 'Kiếp sát']; 

  let score = isHoangDao ? 3.5 : 2.5; 
  
  const allBadThings = [...allHung, ...folkTaboos];
  const hasUnrescuable = allBadThings.some(s => UNRESCUABLE.includes(s));
  const hasRescuable = allBadThings.some(s => RESCUABLE.includes(s));
  const hasCuuGiai = allCat.some(s => CUU_GIAI.includes(s));

  if (hasUnrescuable) {
     score = 1.0; // Khóa cứng điểm liệt thấp nhất
  } else if (hasRescuable) {
     if (hasCuuGiai) {
        score = isHoangDao ? 3.0 : 2.5; 
        score += (allCat.filter(s => DAI_CAT.includes(s)).length * 0.2); 
        score = Math.min(3.5, score); // Khóa trần điểm cứu giải
     } else {
        score = 1.5; 
     }
  } else {
     score += (allCat.filter(s => DAI_CAT.includes(s)).length * 0.3);
  }

  score = Math.max(1.0, Math.min(5.0, score));
  let text = score >= 4.0 ? "Ngày tốt" : (score >= 3.0 ? "Ngày trung bình" : "Ngày xấu");
  if (score >= 4.5) text = "Ngày rất tốt";

  let generalDesc = "";
  if (score >= 4.5) generalDesc = "Vạn sự hanh thông, đại cát đại lợi.";
  else if (hasUnrescuable) generalDesc = `Ngày Đại Kỵ (${allBadThings.filter(s => UNRESCUABLE.includes(s)).join(', ')}). Tuyệt đối tránh khởi sự, sao tốt không thể hóa giải.`;
  else if (hasRescuable && !hasCuuGiai) generalDesc = `Phạm Đại kỵ (${allBadThings.filter(s => RESCUABLE.includes(s)).join(', ')}), tránh làm việc lớn.`;
  else if (hasRescuable && hasCuuGiai) generalDesc = `Phạm kỵ (${allBadThings.filter(s => RESCUABLE.includes(s)).join(', ')}) nhưng may mắn có sao Cứu giải, có thể tiến hành công việc nhỏ.`;
  else generalDesc = isHoangDao ? "Ngày tốt, có nhiều cát tinh phù trợ." : "Thích hợp làm các công việc nhỏ, sinh hoạt hàng ngày.";

  return { score: score.toFixed(1), text, isHoangDao, folkTaboos, generalDesc, catTinh: allCat, hungTinh: allHung, hasFatal: hasUnrescuable || (hasRescuable && !hasCuuGiai), trucName };
};

const getDayDetails = (date: Date) => {
  const evalData = getDayEvaluation(date);
  const dayInfo = getCanChiDay(date);
  
  let tietKhi = "Đang cập nhật...";
  let lunarYi: string[] = [];
  let lunarJi: string[] = [];
  let hyThan = "Đang cập nhật...";
  let taiThan = "Đang cập nhật...";

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

    const DIR_MAP: Record<string, string> = { '正东': 'Chính Đông', '正西': 'Chính Tây', '正南': 'Chính Nam', '正北': 'Chính Bắc', '东南': 'Đông Nam', '东北': 'Đông Bắc', '西南': 'Tây Nam', '西北': 'Tây Bắc' };
    hyThan = DIR_MAP[lunar.getPositionXiDesc()] || lunar.getPositionXiDesc();
    taiThan = DIR_MAP[lunar.getPositionCaiDesc()] || lunar.getPositionCaiDesc();
    
    lunarYi = translateArray(lunar.getDayYi(), YI_JI_MAP);
    lunarJi = translateArray(lunar.getDayJi(), YI_JI_MAP);
  } catch(e) {}

  const NHI_THAP_BAT_TU_VN = ['Giác', 'Cang', 'Đê', 'Phòng', 'Tâm', 'Vĩ', 'Cơ', 'Đẩu', 'Ngưu', 'Nữ', 'Hư', 'Nguy', 'Thất', 'Bích', 'Khuê', 'Lâu', 'Vị', 'Mão', 'Tất', 'Chủy', 'Sâm', 'Tỉnh', 'Quỷ', 'Liễu', 'Tinh', 'Trương', 'Dực', 'Chẩn'];
  const anchorDate = Date.UTC(2026, 4, 1); 
  const diffSao = Math.floor((Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - anchorDate) / 86400000);
  const saoName = NHI_THAP_BAT_TU_VN[((diffSao % 28) + 28 + 1) % 28];
  
  const SAO_LUCK: Record<string, string> = {
    'Giác': 'Cát', 'Cang': 'Hung', 'Đê': 'Hung', 'Phòng': 'Cát', 'Tâm': 'Hung', 'Vĩ': 'Cát', 'Cơ': 'Cát',
    'Đẩu': 'Cát', 'Ngưu': 'Hung', 'Nữ': 'Hung', 'Hư': 'Hung', 'Nguy': 'Hung', 'Thất': 'Cát', 'Bích': 'Cát',
    'Khuê': 'Hung', 'Lâu': 'Cát', 'Vị': 'Cát', 'Mão': 'Hung', 'Tất': 'Cát', 'Chủy': 'Hung', 'Sâm': 'Cát',
    'Tỉnh': 'Cát', 'Quỷ': 'Hung', 'Liễu': 'Hung', 'Tinh': 'Hung', 'Trương': 'Cát', 'Dực': 'Hung', 'Chẩn': 'Cát'
  };

  const TRUC_12_LOCAL = ['Kiến', 'Trừ', 'Mãn', 'Bình', 'Định', 'Chấp', 'Phá', 'Nguy', 'Thành', 'Thâu', 'Khai', 'Bế'];
  const manualYiJi = getManualYiJi(TRUC_12_LOCAL.indexOf(evalData.trucName));

  const ganVal = Math.floor(dayInfo.canIdx / 2) + 1;
  const zhiVal = Math.floor((dayInfo.chiIdx % 6) / 2) + 1;
  let sumNguHanh = ganVal + zhiVal;
  if (sumNguHanh > 5) sumNguHanh -= 5;
  const NA_YIN_MAP: any = { 1: 'Mộc', 2: 'Kim', 3: 'Thủy', 4: 'Hỏa', 5: 'Thổ' };

  // --- THUẬT TOÁN LOẠI TRỪ LỖI LOGIC NÊN LÀM / KIÊNG KỴ ---
  const capitalizeFirst = (s: string) => {
      if (!s) return '';
      return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  };
  
  let rawHop = [...manualYiJi.hop.replace(/\.$/, '').split(', '), ...lunarYi].map(s => capitalizeFirst(s.trim())).filter(s => s !== '');
  let rawKy = [...manualYiJi.ky.replace(/\.$/, '').split(', '), ...lunarJi].map(s => capitalizeFirst(s.trim())).filter(s => s !== '');

  if (rawHop.includes('Mọi việc đều kỵ') || rawHop.includes('Các việc khác không nên làm')) {
      rawHop = rawHop.filter(s => s !== 'Mọi việc đều kỵ' && s !== 'Các việc khác không nên làm');
      rawKy.push('Mọi việc đều kỵ');
  }

  // --- THUẬT TOÁN CATEGORY MAPPING: LỌC CÔNG VIỆC CHUYÊN BIỆT THEO TÍNH CHẤT SAO (Tiếp thu CG 3) ---
  const allStarsAndTaboos = [...evalData.catTinh, ...evalData.hungTinh, ...evalData.folkTaboos];
  
  // Nhóm Hôn nhân: Gặp Cô thần, Quả tú, Không phòng, Tam nương, Thọ tử, Sát chủ -> CẤM CƯỚI HỎI
  const kỵCuoiHoi = ['Cô thần', 'Quả tú', 'Không phòng', 'Tam nương sát', 'Thọ tử', 'Sát chủ', 'Vãng vong', 'Nguyệt phá'];
  if (allStarsAndTaboos.some(s => kỵCuoiHoi.includes(s))) {
      rawHop = rawHop.filter(job => !['Cưới hỏi', 'Kết hôn', 'Giá thú', 'Đính hôn'].some(keyword => job.includes(keyword)));
  }
  
  // Nhóm Xây dựng: Gặp Thổ phủ, Địa tặc, Kiếp sát, Trực Phá, Thọ tử, Sát chủ -> CẤM ĐỘNG THỔ/LÀM NHÀ
  const kỵXayDung = ['Thổ phủ', 'Địa tặc', 'Kiếp sát', 'Phá', 'Thọ tử', 'Sát chủ', 'Vãng vong'];
  if (allStarsAndTaboos.some(s => kỵXayDung.includes(s)) || evalData.trucName === 'Phá') {
      rawHop = rawHop.filter(job => !['Động thổ', 'Khởi công', 'Phá thổ', 'Xây nhà', 'Sửa nhà', 'Làm nhà'].some(keyword => job.includes(keyword)));
  }

  // Nhóm Tài chính: Gặp Đại hao, Tiểu hao, Nguyệt phá -> CẤM KHAI TRƯƠNG/GIAO DỊCH
  const kỵTaiChinh = ['Đại hao', 'Tiểu hao', 'Nguyệt phá', 'Thọ tử', 'Sát chủ'];
  if (allStarsAndTaboos.some(s => kỵTaiChinh.includes(s))) {
      rawHop = rawHop.filter(job => !['Khai trương', 'Mở cửa hàng', 'Ký hợp đồng', 'Giao dịch', 'Thu tiền'].some(keyword => job.includes(keyword)));
  }

  const majorEvents = ['Cưới hỏi', 'Kết hôn', 'Giá thú', 'Khai trương', 'Mở cửa hàng', 'Động thổ', 'Phá thổ', 'Khởi công', 'Nhập trạch', 'Ký hợp đồng', 'Giao dịch', 'An táng', 'Mai táng', 'Xuất hành', 'Đính hôn', 'Nhậm chức'];
  if (evalData.hasFatal) {
      rawHop = rawHop.filter(job => !majorEvents.some(major => job.toLowerCase().includes(major.toLowerCase())));
  }

  const isSameMeaning = (a: string, b: string) => {
      const aLow = a.toLowerCase(); const bLow = b.toLowerCase();
      if (aLow === bLow) return true;
      if (aLow.length > 4 && bLow.length > 4 && (aLow.includes(bLow) || bLow.includes(aLow))) return true;
      const checkGroup = (group: string[]) => group.some(w => aLow.includes(w)) && group.some(w => bLow.includes(w));
      if (checkGroup(['khai trương', 'mở cửa hàng', 'mở hàng'])) return true;
      if (checkGroup(['cưới hỏi', 'kết hôn', 'giá thú', 'đính hôn'])) return true;
      if (checkGroup(['động thổ', 'khởi công', 'phá thổ'])) return true;
      if (checkGroup(['an táng', 'mai táng', 'nhập liệm', 'khởi cữu'])) return true;
      if (checkGroup(['nhập trạch', 'dời nhà', 'di dời'])) return true;
      return false;
  };

  let uniqueKy: string[] = [];
  rawKy.forEach(item => { if (!uniqueKy.some(u => isSameMeaning(u, item))) uniqueKy.push(item); });
  
  let uniqueHop: string[] = [];
  rawHop.forEach(item => { if (!uniqueHop.some(u => isSameMeaning(u, item))) uniqueHop.push(item); });

  let finalKyList = [...uniqueKy];
  let finalHopList = uniqueHop.filter(hopItem => {
      return !finalKyList.some(kyItem => isSameMeaning(kyItem, hopItem) || kyItem === 'Mọi việc đều kỵ');
  });

  const hopText = finalHopList.length > 0 ? finalHopList.join(', ') + '.' : 'Chỉ nên làm các công việc nhỏ, sinh hoạt hàng ngày.';
  let baseKyText = finalKyList.length > 0 ? finalKyList.join(', ') + '.' : 'Không có kiêng kỵ lớn.';

  let kyText = baseKyText;
  const UNRESCUABLE = ['Sát chủ', 'Thọ tử', 'Thụ tử', 'Vãng vong'];
  if (evalData.folkTaboos.length > 0 || evalData.hungTinh.some(s => UNRESCUABLE.includes(s))) {
      const kyCauses = evalData.folkTaboos.length > 0 ? evalData.folkTaboos : evalData.hungTinh.filter(s => UNRESCUABLE.includes(s));
      kyText = `Kiêng kỵ việc trọng đại vì phạm (${kyCauses.join(', ')}). ` + kyText;
  }

  const GIO_HOANG_DAO = {
    'Dần': 'Tý (23-1), Sửu (1-3), Thìn (7-9), Tỵ (9-11), Mùi (13-15), Tuất (19-21)',
    'Thân': 'Tý (23-1), Sửu (1-3), Thìn (7-9), Tỵ (9-11), Mùi (13-15), Tuất (19-21)',
    'Mão': 'Tý (23-1), Dần (3-5), Mão (5-7), Ngọ (11-13), Mùi (13-15), Dậu (17-19)',
    'Dậu': 'Tý (23-1), Dần (3-5), Mão (5-7), Ngọ (11-13), Mùi (13-15), Dậu (17-19)',
    'Thìn': 'Dần (3-5), Thìn (7-9), Tỵ (9-11), Thân (15-17), Dậu (17-19), Hợi (21-23)',
    'Tuất': 'Dần (3-5), Thìn (7-9), Tỵ (9-11), Thân (15-17), Dậu (17-19), Hợi (21-23)',
    'Tỵ': 'Sửu (1-3), Thìn (7-9), Ngọ (11-13), Mùi (13-15), Tuất (19-21), Hợi (21-23)',
    'Hợi': 'Sửu (1-3), Thìn (7-9), Ngọ (11-13), Mùi (13-15), Tuất (19-21), Hợi (21-23)',
    'Tý': 'Tý (23-1), Sửu (1-3), Mão (5-7), Ngọ (11-13), Thân (15-17), Dậu (17-19)',
    'Ngọ': 'Tý (23-1), Sửu (1-3), Mão (5-7), Ngọ (11-13), Thân (15-17), Dậu (17-19)',
    'Sửu': 'Dần (3-5), Mão (5-7), Tỵ (9-11), Thân (15-17), Tuất (19-21), Hợi (21-23)',
    'Mùi': 'Dần (3-5), Mão (5-7), Tỵ (9-11), Thân (15-17), Tuất (19-21), Hợi (21-23)'
  };

  const FULL_NAYIN: Record<string, string> = {
    'Giáp Tý': 'Hải Trung Kim', 'Ất Sửu': 'Hải Trung Kim', 'Bính Dần': 'Lư Trung Hỏa', 'Đinh Mão': 'Lư Trung Hỏa', 'Mậu Thìn': 'Đại Lâm Mộc', 'Kỷ Tỵ': 'Đại Lâm Mộc', 'Canh Ngọ': 'Lộ Bàng Thổ', 'Tân Mùi': 'Lộ Bàng Thổ', 'Nhâm Thân': 'Kiếm Phong Kim', 'Quý Dậu': 'Kiếm Phong Kim', 'Giáp Tuất': 'Sơn Đầu Hỏa', 'Ất Hợi': 'Sơn Đầu Hỏa', 'Bính Tý': 'Giản Hạ Thủy', 'Đinh Sửu': 'Giản Hạ Thủy', 'Mậu Dần': 'Thành Đầu Thổ', 'Kỷ Mão': 'Thành Đầu Thổ', 'Canh Thìn': 'Bạch Lạp Kim', 'Tân Tỵ': 'Bạch Lạp Kim', 'Nhâm Ngọ': 'Dương Liễu Mộc', 'Quý Mùi': 'Dương Liễu Mộc', 'Giáp Thân': 'Tuyền Trung Thủy', 'Ất Dậu': 'Tuyền Trung Thủy', 'Bính Tuất': 'Ốc Thượng Thổ', 'Đinh Hợi': 'Ốc Thượng Thổ', 'Mậu Tý': 'Thích Lịch Hỏa', 'Kỷ Sửu': 'Thích Lịch Hỏa', 'Canh Dần': 'Tùng Bách Mộc', 'Tân Mão': 'Tùng Bách Mộc', 'Nhâm Thìn': 'Trường Lưu Thủy', 'Quý Tỵ': 'Trường Lưu Thủy', 'Giáp Ngọ': 'Sa Trung Kim', 'Ất Mùi': 'Sa Trung Kim', 'Bính Thân': 'Sơn Hạ Hỏa', 'Đinh Dậu': 'Sơn Hạ Hỏa', 'Mậu Tuất': 'Bình Địa Mộc', 'Kỷ Hợi': 'Bình Địa Mộc', 'Canh Tý': 'Bích Thượng Thổ', 'Tân Sửu': 'Bích Thượng Thổ', 'Nhâm Dần': 'Kim Bạch Kim', 'Quý Mão': 'Kim Bạch Kim', 'Giáp Thìn': 'Phú Đăng Hỏa', 'Ất Tỵ': 'Phú Đăng Hỏa', 'Bính Ngọ': 'Thiên Hà Thủy', 'Đinh Mùi': 'Thiên Hà Thủy', 'Mậu Thân': 'Đại Trạch Thổ', 'Kỷ Dậu': 'Đại Trạch Thổ', 'Canh Tuất': 'Thoa Xuyến Kim', 'Tân Hợi': 'Thoa Xuyến Kim', 'Nhâm Tý': 'Tang Đố Mộc', 'Quý Sửu': 'Tang Đố Mộc', 'Giáp Dần': 'Đại Khê Thủy', 'Ất Mão': 'Đại Khê Thủy', 'Bính Thìn': 'Sa Trung Thổ', 'Đinh Tỵ': 'Sa Trung Thổ', 'Mậu Ngọ': 'Thiên Thượng Hỏa', 'Kỷ Mùi': 'Thiên Thượng Hỏa', 'Canh Thân': 'Thạch Lựu Mộc', 'Tân Dậu': 'Thạch Lựu Mộc', 'Nhâm Tuất': 'Đại Hải Thủy', 'Quý Hợi': 'Đại Hải Thủy'
  };

  const canChiDayStr = `${CAN_CHU[dayInfo.canIdx]} ${CHI_CHU[dayInfo.chiIdx]}`;
  const fullNguHanhDay = `${NA_YIN_MAP[sumNguHanh]} (${FULL_NAYIN[canChiDayStr] || ''})`;

  let fullNguHanhYear = "Đang cập nhật...";
  try {
    const lunarObj = Solar.fromYmdHms(date.getFullYear(), date.getMonth() + 1, date.getDate(), 12, 0, 0).getLunar();
    const CAN_MAP: any = {'甲':'Giáp', '乙':'Ất', '丙':'Bính', '丁':'Đinh', '戊':'Mậu', '己':'Kỷ', '庚':'Canh', '辛':'Tân', '壬':'Nhâm', '癸':'Quý'};
    const CHI_MAP: any = {'子':'Tý', '丑':'Sửu', '寅':'Dần', '卯':'Mão', '辰':'Thìn', '巳':'Tỵ', '午':'Ngọ', '未':'Mùi', '申':'Thân', '酉':'Dậu', '戌':'Tuất', '亥':'Hợi'};
    const yCanStr = CAN_MAP[lunarObj.getYearGan()] || '';
    const yChiStr = CHI_MAP[lunarObj.getYearZhi()] || '';
    if(yCanStr && yChiStr) fullNguHanhYear = FULL_NAYIN[`${yCanStr} ${yChiStr}`] || "Đang cập nhật...";
  } catch(e){}

  // --- THUẬT TOÁN ĐỐI CHIẾU THIÊN CAN XUNG KHẮC VÀ ĐỊA CHI XUNG (Tiếp thu CG 4) ---
  const canXungMap: Record<string, string> = { 'Giáp': 'Mậu', 'Ất': 'Kỷ', 'Bính': 'Canh', 'Đinh': 'Tân', 'Mậu': 'Nhâm', 'Kỷ': 'Quý', 'Canh': 'Giáp', 'Tân': 'Ất', 'Nhâm': 'Bính', 'Quý': 'Đinh' };
  const currentCanDay = CAN_CHU[dayInfo.canIdx];
  const currentChiDay = CHI_CHU[dayInfo.chiIdx];
  
  // Tìm ra các Can và Chi bị xung khắc trực tiếp hình thành tuổi đại xung
  const chiXungStr = CHI_CHU[(dayInfo.chiIdx + 6) % 12];
  const canXungNangNhat = Object.keys(canXungMap).find(key => canXungMap[key] === currentCanDay) || CAN_CHU[(dayInfo.canIdx + 4) % 10];
  const canXungVừa = canXungMap[currentCanDay] || CAN_CHU[(dayInfo.canIdx + 6) % 10];
  
  const tuoiDaiXungNgay = `${canXungNangNhat} ${chiXungStr}, ${canXungVừa} ${chiXungStr}`;

  const monthChiIdxForThapNhi = (lunar.monthNum + 1) % 12;
  const thanhLongMap: Record<number, number> = { 2: 0, 8: 0, 3: 2, 9: 2, 4: 4, 10: 4, 5: 6, 11: 6, 0: 8, 6: 8, 1: 10, 7: 10 };
  const thanhLongStart = thanhLongMap[monthChiIdxForThapNhi] !== undefined ? thanhLongMap[monthChiIdxForThapNhi] : 0;
  const THAP_NHI_THAN = ['Thanh Long', 'Minh Đường', 'Thiên Hình', 'Chu Tước', 'Kim Quỹ', 'Bảo Quang', 'Bạch Hổ', 'Ngọc Đường', 'Thiên Lao', 'Nguyên Vũ', 'Tư Mệnh', 'Câu Trận'];
  const hoangDaoType = THAP_NHI_THAN[(dayInfo.chiIdx - thanhLongStart + 12) % 12];
  const tuoiXungThang = `${CHI_CHU[(monthChiIdxForThapNhi + 6) % 12]}`;

  return {
    truc: evalData.trucName,
    sao: saoName,
    saoDesc: SAO_LUCK[saoName] === 'Cát' ? `Ngày có sao ${saoName} chiếu mệnh, là sao Cát, làm việc gì cũng hanh thông, thuận lợi.` : `Ngày có sao ${saoName} chiếu mệnh, là sao Hung, vạn sự cần cẩn trọng.`,
    nguHanh: fullNguHanhDay,
    nguHanhNienMenh: fullNguHanhYear,
    hoangDaoType: hoangDaoType,
    tuoiXungThang: tuoiXungThang,
    tietKhi,
    hyThan,
    taiThan,
    catTinh: evalData.catTinh,
    hungTinh: evalData.hungTinh,
    hop: hopText,
    ky: kyText,
    gioHoangDao: GIO_HOANG_DAO[CHI_CHU[dayInfo.chiIdx] as keyof typeof GIO_HOANG_DAO] || "Đang cập nhật...",
    tuoiXung: `${CAN_CHU[(dayInfo.canIdx + 6)%10]} ${CHI_CHU[(dayInfo.chiIdx + 6)%12].toLowerCase()}`,
    generalDesc: evalData.generalDesc,
    folkTaboos: evalData.folkTaboos
  };
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
  '9/1': { name: 'Lễ hội Đền Bà chúa Me', isDayOff: false, startYear: 2019 },
  '15/1': { name: 'Tết Nguyên Tiêu', isDayOff: false, startYear: 0 },
  '21/3': { name: 'Lễ Đản thần Bà Chúa Me', isDayOff: false, startYear: 1688 },
  '3/3': { name: 'Tết Hàn thực', isDayOff: false, startYear: 0 },
  '10/3': { name: 'Giỗ tổ Hùng Vương', isDayOff: true, startYear: 0, dayOffStartYear: 2007 },
  '15/4': { name: 'Lễ Phật Đản', isDayOff: false, startYear: 0 },
  '5/5': { name: 'Tết Đoan ngọ', isDayOff: false, startYear: 0 },
  '7/7': { name: 'Lễ Thất tịch', isDayOff: false, startYear: 0 },
  '15/7': { name: 'Lễ Vu Lan', isDayOff: false, startYear: 0 },
  '15/8': { name: 'Tết Trung thu', isDayOff: false, startYear: 0 },
  '9/9': { name: 'Tết Trùng cửu', isDayOff: false, startYear: 0 },
  '21/9': { name: 'Lễ Húy nhật Bà Chúa Me', isDayOff: false, startYear: 1751 },
  '10/10': { name: 'Tết Trùng thập', isDayOff: false, startYear: 0 },
  '15/10': { name: 'Tết Hạ Nguyên', isDayOff: false, startYear: 0 },
  '23/12': { name: 'Ông Táo về trời', isDayOff: false, startYear: 0 },
  '29/12': { name: 'Tết Nguyên đán', isDayOff: true, startYear: 0 },
  '30/12': { name: 'Tết Nguyên đán', isDayOff: true, startYear: 0 }
};

interface UserEvent { id: string; dateStr: string; title: string; time: string; location?: string; reminderAdvance: number; userId?: string; email?: string; }

export default function Calendar() {
  const [activeTab, setActiveTab] = useState<'calendar' | 'converter' | 'find-good-days'>('calendar');
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

  const [fgdDob, setFgdDob] = useState('');
  const [fgdMonth, setFgdMonth] = useState(new Date().getMonth() + 1);
  const [fgdYear, setFgdYear] = useState(new Date().getFullYear());
  const [fgdJob, setFgdJob] = useState('');
  const [fgdResult, setFgdResult] = useState<any>(null);

  const [qLunarDay, setQLunarDay] = useState('');
  const [qLunarMonth, setQLunarMonth] = useState('');
  const [qLunarYear, setQLunarYear] = useState('');

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

  const openModalForAdd = () => { 
    if (!auth.currentUser) { setShowLoginPrompt(true); return; }
    setEditingId(null); setNewEventTitle(''); setNewEventLocation(''); setNewEventTime('08:00'); setNewReminderAdvance(0); setShowEventModal(true); 
  };
  
  const openModalForEdit = (ev: UserEvent) => { 
    if (!auth.currentUser) { setShowLoginPrompt(true); return; }
    setEditingId(ev.id); setNewEventTitle(ev.title); setNewEventTime(ev.time); setNewEventLocation(ev.location || ''); setNewReminderAdvance(ev.reminderAdvance || 0); setShowEventModal(true); 
  };

  const handleGoogleLogin = async () => {
    try { 
      await signInWithPopup(auth, googleProvider); 
    } catch (error: any) { 
      console.error("Lỗi đăng nhập:", error); 
      if (error.code === 'auth/popup-blocked') {
         alert("Trình duyệt đang chặn cửa sổ đăng nhập. Vui lòng cấp quyền (Cho phép mở Pop-up) để tiếp tục.");
      } else if (error.code !== 'auth/popup-closed-by-user' && error.code !== 'auth/cancelled-popup-request') {
         alert("LỖI BẢO MẬT TRÌNH DUYỆT: Nếu bạn đang mở web từ ứng dụng Zalo/Facebook, vui lòng bấm vào nút 3 chấm ở góc phải màn hình, chọn 'Mở bằng trình duyệt' (Chrome/Safari) để có thể đăng nhập Google!");
      }
    } 
  };

  const handleSaveEvent = async () => {
    if (!newEventTitle || !auth.currentUser) return;
    const dateStr = `${selectedDate.getFullYear()}-${(selectedDate.getMonth()+1).toString().padStart(2,'0')}-${selectedDate.getDate().toString().padStart(2,'0')}`;
    let updatedEvents: UserEvent[] = [];
    
    if (editingId) { 
      const ev = { id: editingId, dateStr, title: newEventTitle, time: newEventTime, location: newEventLocation, reminderAdvance: newReminderAdvance, userId: auth.currentUser.uid, email: auth.currentUser.email || '' };
      updatedEvents = events.map(e => e.id === editingId ? ev : e); 
      setEvents(updatedEvents);
      localStorage.setItem('user_events', JSON.stringify(updatedEvents));
      try { await setDoc(doc(db, "events", ev.id), ev); } catch (e) {}
    } else { 
      const newEv = { id: Date.now().toString(), dateStr, title: newEventTitle, time: newEventTime, location: newEventLocation, reminderAdvance: newReminderAdvance, userId: auth.currentUser.uid, email: auth.currentUser.email || '' };
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

  const handleQuickLunarSearch = () => {
    const d = parseInt(qLunarDay), m = parseInt(qLunarMonth), y = parseInt(qLunarYear);
    if (!d || !m || !y) return alert("Vui lòng nhập đầy đủ Ngày, Tháng, Năm âm lịch!");
    try {
        let found = null;
        const start = new Date(y, 0, 1);
        for(let i=0; i<380; i++) {
            const td = new Date(start.getTime() + i*86400000); 
            const ln = getLunarDate(td);
            if (ln.day === d && ln.monthNum === m) { found = td; break; }
        }
        if (found) {
            setSelectedDate(found);
            setCurrentDate(found);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
            alert("Không tìm thấy ngày Âm lịch này!");
        }
    } catch(e) {}
  };

  const handleFindGoodDays = () => {
    let userChiIdx = -1;
    let userCanChiStr = '';
    let dobLunarObj = null;
    
    if (fgdDob) {
      const dObj = new Date(fgdDob);
      userCanChiStr = getCanChiYear(dObj.getFullYear());
      const chiStr = userCanChiStr.split(' ')[1];
      userChiIdx = CHI_CHU.indexOf(chiStr);
      dobLunarObj = getLunarDate(dObj);
    }

    const daysInMo = getDaysInMonth(fgdYear, fgdMonth - 1);
    let goodDays = [];
    const clashDays = [];

    const selectedCategory = JOB_CATEGORIES.find(c => c.id === fgdJob);
    const jobKeywords = selectedCategory ? selectedCategory.keywords : [];

    for (let d = 1; d <= daysInMo; d++) {
      const testDate = new Date(fgdYear, fgdMonth - 1, d);
      const dayInfo = getCanChiDay(testDate);
      const evalData = getDayEvaluation(testDate);
      const detData = getDayDetails(testDate);

      const isClash = userChiIdx !== -1 && Math.abs(dayInfo.chiIdx - userChiIdx) === 6;
      if (isClash) {
        clashDays.push(`${d}/${fgdMonth}`);
      }

      let jobMatch = true;
      if (jobKeywords.length > 0) {
          const hopTextLower = detData.hop.toLowerCase();
          jobMatch = jobKeywords.some(kw => hopTextLower.includes(kw.toLowerCase()));
      }
      
      if (!isClash && parseFloat(evalData.score) >= 3.0 && jobMatch) {
          goodDays.push({ date: testDate, evalData, detData, dayInfo });
      }
    }

    goodDays.sort((a, b) => parseFloat(b.evalData.score) - parseFloat(a.evalData.score));

    let xungNam = "Chưa nhập ngày sinh";
    let xungThang = "Chưa nhập ngày sinh";
    if (userChiIdx !== -1) {
      const xungChi = CHI_CHU[(userChiIdx + 6) % 12];
      xungNam = `Các năm ${xungChi}`;
      const thangXungMap: Record<string, string> = {
          'Tý': 'Tháng 5 (Ngọ)', 'Sửu': 'Tháng 6 (Mùi)', 'Dần': 'Tháng 7 (Thân)', 'Mão': 'Tháng 8 (Dậu)', 
          'Thìn': 'Tháng 9 (Tuất)', 'Tỵ': 'Tháng 10 (Hợi)', 'Ngọ': 'Tháng 11 (Tý)', 'Mùi': 'Tháng 12 (Sửu)', 
          'Thân': 'Tháng 1 (Dần)', 'Dậu': 'Tháng 2 (Mão)', 'Tuất': 'Tháng 3 (Thìn)', 'Hợi': 'Tháng 4 (Tỵ)'
      };
      xungThang = thangXungMap[CHI_CHU[userChiIdx]] || "Không xác định";
    }

    setFgdResult({
      userCanChi: userCanChiStr,
      lunarDob: dobLunarObj,
      goodDays,
      clashDays: clashDays.length > 0 ? clashDays.join(', ') : "Không có",
      xungNam,
      xungThang
    });
  };
  
  const goToDate = () => {
    if(cResultDate) {
        setSelectedDate(cResultDate); setCurrentDate(cResultDate);
        setActiveTab('calendar');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const generateMonthGrid = () => {
    const year = currentDate.getFullYear(); const month = currentDate.getMonth();
    const daysInMonth = getDaysInMonth(year, month); const daysInPrevMonth = getDaysInMonth(year, month - 1); const firstDay = getFirstDayOfMonth(year, month);
    const grid = [];
    
    for (let i = 0; i < firstDay; i++) {
      const d = daysInPrevMonth - firstDay + i + 1; const prevDate = new Date(year, month - 1, d); const lunar = getLunarDate(prevDate);
      grid.push(<div key={`prev-${i}`} onClick={() => {setCurrentDate(prevDate); setSelectedDate(prevDate);}} className="h-20 sm:h-28 lg:h-32 p-1 sm:p-2 border border-[#1e293b] opacity-30 cursor-pointer hover:bg-[#1e293b]"><div className="flex justify-between items-start font-sans"><span className="text-lg sm:text-xl font-bold text-slate-500">{d}</span><span className="text-[12px] sm:text-sm font-semibold text-slate-400">{lunar.day}</span></div></div>);
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
            <span className={`text-[12px] sm:text-sm font-semibold ${lunar.day === 1 || lunar.day === 15 ? 'text-sky-400 font-bold' : 'text-slate-400'}`}>{(lunar.day === 1 || lunar.day === 15) ? `${lunar.day}/${lunar.monthStr}` : lunar.day}</span>
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
      grid.push(<div key={`next-${i}`} onClick={() => {setCurrentDate(nextDate); setSelectedDate(nextDate);}} className="h-20 sm:h-28 lg:h-32 p-1 sm:p-2 border border-[#1e293b] opacity-30 cursor-pointer hover:bg-[#1e293b]"><div className="flex justify-between items-start font-sans"><span className="text-lg sm:text-xl font-bold text-slate-500">{d}</span><span className="text-[12px] sm:text-sm font-semibold text-slate-400">{lunar.day}</span></div></div>);
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
      
      {/* HEADER TABS */}
      <div className="flex flex-wrap gap-2 mb-6 border-b border-[#1e293b] pb-4 font-sans">
         <button onClick={() => setActiveTab('calendar')} className={`px-4 py-2.5 rounded-lg font-bold text-sm transition-all flex items-center gap-2 ${activeTab === 'calendar' ? 'bg-sky-600 text-white shadow-[0_0_15px_rgba(2,132,199,0.5)]' : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'}`}><CalendarIcon size={16}/> Lịch Vạn Niên</button>
         <button onClick={() => setActiveTab('find-good-days')} className={`px-4 py-2.5 rounded-lg font-bold text-sm transition-all flex items-center gap-2 ${activeTab === 'find-good-days' ? 'bg-emerald-600 text-white shadow-[0_0_15px_rgba(5,150,105,0.5)]' : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'}`}><Search size={16}/> Tìm ngày tốt</button>
         <button onClick={() => setActiveTab('converter')} className={`px-4 py-2.5 rounded-lg font-bold text-sm transition-all flex items-center gap-2 ${activeTab === 'converter' ? 'bg-amber-600 text-white shadow-[0_0_15px_rgba(217,119,6,0.5)]' : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'}`}><ArrowRightLeft size={16}/> Đổi ngày Âm - Dương</button>
      </div>

      {activeTab === 'calendar' && (
        <>
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
                    <p><span className="text-slate-400 font-semibold">Giờ Hoàng Đạo:</span> {dayDet.gioHoangDao}</p>
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
                <select value={currentDate.getMonth()} onChange={(e) => setCurrentDate(new Date(currentDate.getFullYear(), parseInt(e.target.value), 1))} className="flex-1 sm:w-auto bg-[#1e293b] border border-slate-700 text-slate-200 rounded-lg px-4 py-2.5 text-sm lg:text-base font-semibold focus:outline-none focus:border-sky-500 font-sans">
                  {Array.from({length: 12}).map((_, i) => <option key={i} value={i}>Tháng {i + 1}</option>)}
                </select>
                <select value={currentDate.getFullYear()} onChange={(e) => setCurrentDate(new Date(parseInt(e.target.value), currentDate.getMonth(), 1))} className="flex-1 sm:w-auto bg-[#1e293b] border border-slate-700 text-slate-200 rounded-lg px-4 py-2.5 text-sm lg:text-base font-semibold focus:outline-none focus:border-sky-500 font-sans">
                  {Array.from({length: 201}).map((_, i) => <option key={i} value={1900 + i}>năm {1900 + i}</option>)}
                </select>
              </div>
            </div>

            <div className="p-4 sm:p-6 lg:p-8 bg-[#05070a]">
              <div className="grid grid-cols-7 gap-px mb-2 text-center text-xs lg:text-sm font-bold text-sky-400 uppercase tracking-widest bg-[#0a0f18] py-4 rounded-lg border border-[#1e293b]">
                <div>Thứ 2</div><div>Thứ 3</div><div>Thứ 4</div><div>Thứ 5</div><div>Thứ 6</div><div>Thứ 7</div><div className="text-red-500">Chủ nhật</div>
              </div>
              <div className="grid grid-cols-7 gap-px bg-[#1e293b] border border-[#1e293b] rounded-lg overflow-hidden">
                {generateMonthGrid()}
              </div>
            </div>
          </div>

          {/* TÌM NHANH NGÀY ÂM LỊCH */}
          <div className="bg-[#0f172a] border border-[#1e293b] rounded-2xl p-4 sm:p-6 shadow-xl mt-6 flex flex-col sm:flex-row items-center gap-4 font-sans">
             <span className="text-emerald-400 font-bold uppercase tracking-widest text-sm whitespace-nowrap flex items-center gap-2"><Search size={18}/> Tìm nhanh Âm lịch</span>
             <div className="flex gap-2 w-full sm:w-auto flex-1">
                <input type="number" placeholder="Ngày" value={qLunarDay} onChange={e=>setQLunarDay(e.target.value)} className="w-1/3 bg-[#05070a] border border-[#1e293b] rounded-lg p-2.5 text-center text-slate-200 focus:border-emerald-500 focus:outline-none font-sans text-sm" />
                <input type="number" placeholder="Tháng" value={qLunarMonth} onChange={e=>setQLunarMonth(e.target.value)} className="w-1/3 bg-[#05070a] border border-[#1e293b] rounded-lg p-2.5 text-center text-slate-200 focus:border-emerald-500 focus:outline-none font-sans text-sm" />
                <input type="number" placeholder="Năm" value={qLunarYear} onChange={e=>setQLunarYear(e.target.value)} className="w-1/3 bg-[#05070a] border border-[#1e293b] rounded-lg p-2.5 text-center text-slate-200 focus:border-emerald-500 focus:outline-none font-sans text-sm" />
             </div>
             <button onClick={handleQuickLunarSearch} className="w-full sm:w-auto px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg transition shadow-[0_0_15px_rgba(5,150,105,0.4)] whitespace-nowrap font-sans text-sm">ĐI TỚI NGÀY</button>
          </div>
        </>
      )}

      {/* TAB 2: ĐỔI NGÀY ÂM - DƯƠNG */}
      {activeTab === 'converter' && (
        <div className="bg-[#0f172a] border border-[#1e293b] rounded-2xl p-6 lg:p-8 shadow-xl font-sans">
           <h3 className="text-xl font-bold text-amber-500 flex items-center gap-2 mb-6 uppercase tracking-widest font-sans"><ArrowRightLeft size={24} /> Đổi ngày Âm - Dương</h3>
           <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              <div className="md:col-span-3">
                <select value={convType} onChange={e => {setConvType(e.target.value as 'S2L' | 'L2S'); setCResult(''); setCResultDate(null);}} className="w-full bg-[#05070a] border border-[#1e293b] rounded-lg p-3 text-slate-200 text-sm font-semibold focus:outline-none focus:border-brand h-full font-sans">
                   <option value="S2L">Dương ➔ Âm</option>
                   <option value="L2S">Âm ➔ Dương</option>
                </select>
              </div>
              <div className="md:col-span-6 flex gap-2">
                 <input type="number" placeholder="Ngày" value={cDay} onChange={e=>setCDay(e.target.value)} className="w-1/3 bg-[#05070a] border border-[#1e293b] rounded-lg p-3 text-center text-slate-200 focus:outline-none focus:border-brand font-sans" />
                 <input type="number" placeholder="Tháng" value={cMonth} onChange={e=>setCMonth(e.target.value)} className="w-1/3 bg-[#05070a] border border-[#1e293b] rounded-lg p-3 text-center text-slate-200 focus:outline-none focus:border-brand font-sans" />
                 <input type="number" placeholder="Năm" value={cYear} onChange={e=>setCYear(e.target.value)} className="w-1/3 bg-[#05070a] border border-[#1e293b] rounded-lg p-3 text-center text-slate-200 focus:outline-none focus:border-brand font-sans" />
              </div>
              <div className="md:col-span-3">
                 <button onClick={doConvert} className="w-full h-full bg-amber-600 text-white font-bold rounded-lg hover:bg-amber-500 transition shadow-[0_0_15px_rgba(217,119,6,0.4)] py-3 font-sans">XEM KẾT QUẢ</button>
              </div>
           </div>
           {cResult && (
              <div className="mt-6 p-6 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-between">
                 <span className="text-emerald-400 font-bold text-xl">{cResult}</span>
                 {cResultDate && (
                   <button onClick={goToDate} className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold transition shadow-lg shadow-emerald-900/50 font-sans">
                     <CalendarIcon size={18}/> Mở lịch ngày này
                   </button>
                 )}
              </div>
           )}
        </div>
      )}

      {/* TAB 3: TÌM NGÀY TỐT TRONG THÁNG */}
      {activeTab === 'find-good-days' && (
        <div className="bg-[#0f172a] border border-[#1e293b] rounded-2xl p-6 lg:p-8 shadow-xl font-sans">
           <h3 className="text-xl font-bold text-emerald-500 flex items-center gap-2 mb-6 uppercase tracking-widest font-sans"><Search size={24} /> Tìm Ngày Tốt Trong Tháng</h3>
           
           <div className="bg-[#05070a] p-6 rounded-xl border border-[#1e293b] mb-8 space-y-6">
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                   <label className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-widest block font-sans">Ngày sinh (Dương lịch)</label>
                   <input type="date" value={fgdDob} onChange={e => setFgdDob(e.target.value)} className="w-full bg-[#0f172a] border border-[#1e293b] rounded-lg p-3 text-slate-200 focus:border-emerald-500 focus:outline-none font-sans" />
                </div>
                <div>
                   <label className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-widest block font-sans">Tìm trong Tháng (DL)</label>
                   <select value={fgdMonth} onChange={e => setFgdMonth(Number(e.target.value))} className="w-full bg-[#0f172a] border border-[#1e293b] rounded-lg p-3 text-slate-200 focus:border-emerald-500 focus:outline-none font-sans">
                     {Array.from({length: 12}).map((_, i) => <option key={i} value={i+1}>Tháng {i+1}</option>)}
                   </select>
                </div>
                <div>
                   <label className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-widest block font-sans">Tìm trong Năm (DL)</label>
                   <select value={fgdYear} onChange={e => setFgdYear(Number(e.target.value))} className="w-full bg-[#0f172a] border border-[#1e293b] rounded-lg p-3 text-slate-200 focus:border-emerald-500 focus:outline-none font-sans">
                     {Array.from({length: 10}).map((_, i) => <option key={i} value={new Date().getFullYear() + i}>{new Date().getFullYear() + i}</option>)}
                   </select>
                </div>
                <div>
                   <label className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-widest block font-sans">Việc cần làm</label>
                   <select value={fgdJob} onChange={e => setFgdJob(e.target.value)} className="w-full bg-[#0f172a] border border-[#1e293b] rounded-lg p-3 text-slate-200 focus:border-emerald-500 focus:outline-none font-sans">
                     {JOB_CATEGORIES.map(cat => <option key={cat.id} value={cat.id}>{cat.label}</option>)}
                   </select>
                </div>
             </div>
             
             {(!fgdDob) && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-400 text-sm italic font-medium flex items-center gap-2 font-sans">
                   <AlertTriangle size={16}/> Hãy nhập Ngày sinh (Dương lịch) để hệ thống tìm ngày tốt chính xác, không xung khắc với tuổi của bạn.
                </div>
             )}

             <button onClick={handleFindGoodDays} className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold font-sans uppercase tracking-widest rounded-xl transition shadow-[0_0_15px_rgba(5,150,105,0.4)]">XEM KẾT QUẢ</button>
           </div>

           {fgdResult && (
             <div className="space-y-8 animate-in fade-in duration-500 font-sans">
                {/* 1. THÔNG TIN NGƯỜI XEM */}
                <div className="bg-[#05070a] border border-[#1e293b] rounded-xl p-6">
                   <h4 className="text-brand font-bold uppercase tracking-widest mb-4 border-b border-[#1e293b] pb-2 font-sans">Thông tin phong thủy tuổi</h4>
                   {fgdResult.userCanChi ? (
                     <div className="space-y-2 text-sm text-slate-300 font-sans">
                        <p>Năm sinh âm lịch: <span className="text-white font-bold">{fgdResult.userCanChi}</span></p>
                        <p>Các năm không hợp tuổi: <span className="text-rose-400 font-bold">{fgdResult.xungNam}</span></p>
                        <p>Các tháng âm lịch xung tuổi (Nên tránh): <span className="text-rose-400 font-bold">{fgdResult.xungThang}</span></p>
                        <p>Các ngày dương lịch trong tháng {fgdMonth} xung khắc tuổi: <span className="text-rose-400 font-bold">{fgdResult.clashDays}</span></p>
                     </div>
                   ) : (
                     <p className="text-slate-500 italic text-sm font-sans">Chưa nhập thông tin ngày sinh để phân tích xung khắc.</p>
                   )}
                </div>

                {/* 3. DANH SÁCH NGÀY TỐT */}
                <div>
                   <h4 className="text-emerald-400 font-bold uppercase tracking-widest mb-4 flex items-center gap-2 font-sans"><CheckCircle size={18}/> Danh sách ngày tốt tháng {fgdMonth}/{fgdYear}</h4>
                   {fgdResult.goodDays.length > 0 ? (
                     <div className="space-y-4">
                        {fgdResult.goodDays.map((item: any, idx: number) => (
                           <div key={idx} className="bg-[#05070a] border border-[#1e293b] hover:border-emerald-500/50 transition-colors rounded-xl p-6">
                              <div className="flex justify-between items-center mb-4 border-b border-[#1e293b] pb-3">
                                 <h5 className="text-lg font-bold text-emerald-400 font-sans">
                                   Ngày {item.date.getDate()}/{item.date.getMonth()+1}/{item.date.getFullYear()} <span className="text-slate-300 text-sm font-medium ml-2 font-sans">(Âm lịch: {getLunarDate(item.date).day}/{getLunarDate(item.date).monthStr} - {item.dayInfo.text})</span>
                                 </h5>
                                 <div className="flex items-center gap-1 font-bold text-white bg-[#1e293b] px-3 py-1 rounded-lg font-sans">[{item.evalData.score}] {renderStars(item.evalData.score)}</div>
                              </div>
                              <div className="space-y-4 text-sm text-slate-300 font-sans">
                                 <div>
                                    <strong className="text-white">1. Thông tin chung: </strong>
                                    Là <span className="text-amber-400 font-bold">{item.evalData.text.toLowerCase()}</span>. {item.evalData.generalDesc} 
                                    <br/>Trực <span className="text-amber-400 font-bold">{item.detData.truc}</span>. Kiểu ngày: <span className={item.evalData.isHoangDao ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>{item.evalData.isHoangDao ? 'Hoàng Đạo' : 'Hắc Đạo'}</span>.
                                 </div>
                                 <div>
                                    <strong className="text-white">2. Giờ hoàng đạo: </strong>
                                    <span className="text-amber-400 font-bold">{item.detData.gioHoangDao}</span>
                                 </div>
                                 <div>
                                    <strong className="text-white">3. Hệ thống sao: </strong>
                                    <br/>- <span className="text-emerald-400 font-bold">Sao tốt:</span> {item.detData.catTinh.length > 0 ? (
                                      item.detData.catTinh.map((s: string, sIdx: number) => (
                                        <span key={sIdx} className="hover:text-amber-400 transition-colors cursor-help relative group" title={STAR_MEANINGS[s] || "Đang cập nhật ý nghĩa..."}>{s}{sIdx < item.detData.catTinh.length - 1 ? ', ' : ''}</span>
                                      ))
                                    ) : 'Không có'}
                                    <br/>- <span className="text-rose-400 font-bold">Sao xấu:</span> {item.detData.hungTinh.length > 0 ? (
                                      item.detData.hungTinh.map((s: string, sIdx: number) => (
                                        <span key={sIdx} className="hover:text-amber-400 transition-colors cursor-help relative group" title={STAR_MEANINGS[s] || "Đang cập nhật ý nghĩa..."}>{s}{sIdx < item.detData.hungTinh.length - 1 ? ', ' : ''}</span>
                                      ))
                                    ) : 'Không có'}
                                    <br/>- Nhị thập bát tú: Sao <span className="text-amber-400 font-bold">{item.detData.sao}</span>. <i className="text-slate-400 font-sans">"{item.detData.saoDesc}"</i>
                                 </div>
                              </div>
                           </div>
                        ))}
                     </div>
                   ) : (
                     <div className="p-8 text-center bg-[#05070a] border border-[#1e293b] rounded-xl text-slate-400 font-sans">
                        Rất tiếc, không tìm thấy ngày nào phù hợp với yêu cầu của bạn trong tháng này. Hãy thử chọn công việc khác hoặc tìm sang tháng sau nhé!
                     </div>
                   )}
                </div>
             </div>
           )}
        </div>
      )}

      {/* HIỂN THỊ LƯU Ý TRẠCH CÁT (ÁP DỤNG CHUNG) */}
      <div className="mt-8 p-6 lg:p-8 bg-[#0f172a] border border-[#1e293b] rounded-2xl shadow-xl font-sans">
        <h3 className="text-lg font-bold text-brand uppercase tracking-widest mb-4 border-b border-[#1e293b] pb-3 font-sans">Lưu ý xem ngày tốt</h3>
        <div className="space-y-4 text-sm text-slate-300 leading-relaxed font-sans">
          <p>Ứng dụng Lịch Vạn niên AI với công nghệ lõi là sử dụng thư viện thiên văn học mã nguồn mở Lunar-javascript, tài liệu tích hợp các lý luận cổ đại Trung Hoa làm nền tảng thuật toán. Ngoài ra, các quy tắc phân tích chọn ngày chuyên sâu được tham chiếu nghiêm ngặt theo "Ngọc Hạp Thông Thư" của Việt Nam và những tài liệu kinh điển về phong thủy trạch cát truyền thống. Theo đó, cách tính ngày tốt xấu của Lịch Vạn niên AI như sau:</p>
          <ol className="list-decimal pl-5 space-y-3">
            <li>Xác định tính chất Hoàng đạo (tốt) hoặc Hắc đạo (xấu) của ngày để thiết lập mức điểm xuất phát.</li>
            <li>Xác định các hung tinh mang sát khí cực mạnh. Nếu hệ thống phát hiện ngày đó phạm các đại kỵ như Sát Chủ, Thọ Tử, Thiên Cương, điểm số sẽ lập tức bị kéo về mức thấp nhất và bị loại bỏ hoàn toàn khỏi danh sách ngày tốt, bất chấp trong ngày có bao nhiêu sao tốt đi kèm.</li>
            <li>Đối với các ngày phạm kỵ dân gian ở mức độ nhẹ hơn (như Tam Nương, Nguyệt Kỵ, Vãng Vong), hệ thống cũng sẽ hạ điểm nhưng nếu phát hiện có các Đại Cát tinh có năng lực "Cứu giải" vạn vật (như Thiên Xá, Nhân Chuyên, Sát Cống, Giải Thần), hệ thống sẽ kích hoạt cơ chế bù trừ, nâng điểm số lên mức an toàn để có thể thực hiện một số công việc nhất định.</li>
            <li>Cuối cùng, thuật toán đối chiếu trực tiếp Can Chi của ngày với tuổi (năm sinh âm lịch) của người sử dụng. Dù một ngày có điểm số cao tuyệt đối (Đại Cát với đại đa số), nhưng nếu phạm Lục xung với bản mệnh người xem, ngày đó cũng sẽ bị hệ thống tự động loại bỏ.</li>
          </ol>
          <p>Thực chất, việc đánh giá ngày tốt xấu là một quá trình phân tích tổng hợp, đa tầng và lồng ghép nhiều hệ thống lý luận khác nhau. Một ngày được ứng dụng đề xuất là "Ngày Tốt" khi thỏa mãn đồng thời hai điều kiện: (1) Đạt điểm số từ 3.0 trở lên (đã qua bù trừ, chế hóa) và (2) Tuyệt đối không xung khắc với tuổi của người sử dụng.</p>
          <p className="italic text-slate-300 mt-6 border-t border-[#1e293b] pt-4 font-sans">Lịch Vạn niên AI không sáng tạo ra các nội dung này. Lịch chỉ là sự kết hợp giữa công nghệ hiện đại với một hệ thống thiên văn, trạch cát, phong thủy truyền thống mang đậm bản sắc văn hóa phương Đông, để người dùng tham khảo, tự chiêm nghiệm bản thân, phục vụ cho việc học tập, nghiên cứu và đời sống. Một ngày được coi là ngày tốt thực sự phải hài hòa các yếu tố "Thiên - Địa - Nhân" hợp nhất.</p>
        </div>
      </div>

      {/* MODAL CHI TIẾT NGÀY PHONG THỦY */}
      <AnimatePresence>
        {showDayDetail && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/90 backdrop-blur-md z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className="bg-[#0f172a] border border-[#1e293b] rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-[0_0_100px_rgba(56,189,248,0.1)]">
              
              {/* HEADER UI */}
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
                  <p className="mt-2 font-sans">Kiểu ngày: <span className={`font-bold ${dayEval.isHoangDao ? 'text-emerald-400' : 'text-rose-400'}`}>{dayDet.hoangDaoType} {dayEval.isHoangDao ? 'Hoàng Đạo' : 'Hắc Đạo'}</span></p>
                  <p className="font-sans">Trực: <span className="text-amber-400 font-bold">{dayDet.truc}</span></p>
                  
                  <h5 className="font-bold text-white mt-4 mb-1 font-sans">Ngũ hành & Tiết khí</h5>
                  <p className="font-sans">Nạp âm ngày: <span className="text-sky-400 font-bold">{dayDet.nguHanh}</span></p>
                  <p className="font-sans">Ngũ hành niên mệnh: <span className="text-sky-400 font-bold">{dayDet.nguHanhNienMenh}</span></p>
                  <p className="font-sans">Tiết khí: <span className="text-emerald-400 font-bold">{dayDet.tietKhi}</span></p>
                  
                  <h5 className="font-bold text-white mt-4 mb-1 font-sans">Hướng xuất hành</h5>
                  <p className="font-sans">Hỷ thần - TỐT: <span className="text-emerald-400 font-bold">{dayDet.hyThan}</span></p>
                  <p className="font-sans">Tài thần - TỐT: <span className="text-emerald-400 font-bold">{dayDet.taiThan}</span></p>
                  
                  <h5 className="font-bold text-white mt-4 mb-1 font-sans">Nhị thập bát tú</h5>
                  <p className="font-sans">
                    Sao chiếu mệnh: <span className="text-amber-400 font-bold">{dayDet.sao}</span> 
                    {(() => {
                      const SAO_DETAILS: Record<string, string> = {
                        'Giác': '(Thuộc hành: Mộc, Con vật: Giao Long)', 'Cang': '(Thuộc hành: Kim, Con vật: Long)', 'Đê': '(Thuộc hành: Thổ, Con vật: Lạc)', 'Phòng': 'Thuộc hành: Thái Dương, Con vật: Thố)', 'Tâm': '(Thuộc hành: Thái Âm, Con vật: Hồ)', 'Vĩ': '(Thuộc hành: Hỏa, Con vật: Hổ)', 'Cơ': '(Thuộc hành: Thủy, Con vật: Báo)', 'Đẩu': '(Thuộc hành: Mộc, Con vật: Giải)', 'Ngưu': '(Thuộc hành: Kim, Con vật: Ngưu)', 'Nữ': '(Thuộc hành: Thổ, Con vật: Sưu)', 'Hư': '(Thuộc hành: Thái Dương, Con vật: Thử)', 'Nguy': '(Thuộc hành: Thái Âm, Con vật: Én)', 'Thất': '(Thuộc hành: Hỏa, Con vật: Trư)', 'Bích': '(Thuộc hành: Thủy, Con vật: Du)', 'Khuê': '(Thuộc hành: Mộc, Con vật: Lang)', 'Lâu': '(Thuộc hành: Kim, Con vật: Cẩu)', 'Vị': '(Thuộc hành: Thổ, Con vật: Trĩ)', 'Mão': '(Thuộc hành: Thái Dương, Con vật: Kê)', 'Tất': '(Thuộc hành: Thái Âm, Con vật: Ô)', 'Chủy': '(Thuộc hành: Hỏa, Con vật: Hầu)', 'Sâm': '(Thuộc hành: Thủy, Con vật: Viên)', 'Tỉnh': '(Thuộc hành: Mộc, Con vật: Hãn)', 'Quỷ': '(Thuộc hành: Kim, Con vật: Dương)', 'Liễu': '(Thuộc hành: Thổ, Con vật: Chương)', 'Tinh': '(Thuộc hành: Thái Dương, Con vật: Mã)', 'Trương': '(Thuộc hành: Thái Âm, Con vật: Lộc)', 'Dực': '(Thuộc hành: Hỏa, Con vật: Xà)', 'Chẩn': '(Thuộc hành: Thủy, Con vật: Chẩn)'
                      };
                      return <span className="text-slate-400 ml-1.5 text-xs">{SAO_DETAILS[dayDet.sao] || ''}</span>;
                    })()}
                  </p>

                  {dayDet.folkTaboos.length > 0 && (
                    <>
                      <h5 className="font-bold text-white mt-4 mb-1 font-sans">Ngày đại kỵ</h5>
                      <p className="font-sans"><span className="text-rose-400 font-bold">{dayDet.folkTaboos.join(', ')}</span></p>
                    </>
                  )}
                </div>

                {/* 2. MỨC ĐỘ PHÙ HỢP CÔNG VIỆC */}
                <div>
                  <h4 className="text-brand font-bold text-base mb-2 font-sans uppercase tracking-widest">2. Việc nên làm và không nên làm</h4>
                  <p className="font-sans"><span className="text-emerald-400 font-bold">Nên làm (Cát):</span> {dayDet.hop}</p>
                  <p className="mt-2 font-sans"><span className="text-rose-400 font-bold">Kiêng kỵ (Hung):</span> <span>{dayDet.ky}</span></p>
                </div>

                {/* 3. CÁC SAO TỐT XẤU THEO NGỌC HẠP THÔNG THƯ */}
                <div>
                  <h4 className="text-brand font-bold text-base mb-2 font-sans uppercase tracking-widest">3. Các sao tốt xấu (Ngọc Hạp Thông Thư)</h4>
                  <p className="font-sans"><span className="text-emerald-400 font-bold">Các sao tốt:</span> {dayDet.catTinh.length > 0 ? (
                      dayDet.catTinh.map((s: string, sIdx: number) => (
                        <span key={sIdx} className="hover:text-amber-400 transition-colors cursor-help relative group" title={STAR_MEANINGS[s] || "Đang cập nhật ý nghĩa..."}>{s}{sIdx < dayDet.catTinh.length - 1 ? ', ' : ''}</span>
                      ))
                    ) : 'Không có'}</p>
                  <p className="mt-2 font-sans"><span className="text-rose-400 font-bold">Các sao xấu:</span> {dayDet.hungTinh.length > 0 ? (
                      dayDet.hungTinh.map((s: string, sIdx: number) => (
                        <span key={sIdx} className="hover:text-amber-400 transition-colors cursor-help relative group" title={STAR_MEANINGS[s] || "Đang cập nhật ý nghĩa..."}>{s}{sIdx < dayDet.hungTinh.length - 1 ? ', ' : ''}</span>
                      ))
                    ) : 'Không có'}</p>
                </div>

                {/* 4. GIỜ HOÀNG ĐẠO */}
                <div>
                  <h4 className="text-brand font-bold text-base mb-2 font-sans uppercase tracking-widest">4. Giờ Hoàng đạo</h4>
                  <p className="font-sans"><span className="text-amber-400 font-bold">Giờ lành:</span> {dayDet.gioHoangDao}.</p>
                </div>

                {/* 5. XUNG KHẮC */}
                <div>
                  <h4 className="text-brand font-bold text-base mb-2 font-sans uppercase tracking-widest">5. Xung khắc</h4>
                  <p className="text-white font-bold mt-1 font-sans">- Tuổi xung khắc nặng nhất với ngày (Thiên can & Địa chi xung):</p>
                  <p className="font-sans pl-4">Các tuổi <span className="text-rose-400 font-bold">{dayDet.tuoiDaiXungNgay}</span> bị đại xung với ngày này, tuyệt đối thận trọng khởi sự.</p>
                  
                  <p className="text-white font-bold mt-2 font-sans">- Tuổi xung khắc với tháng:</p>
                  <p className="font-sans pl-4">Tháng này xung khắc với những người có địa chi tuổi là <span className="text-rose-400 font-bold">{dayDet.tuoiXungThang}</span>.</p>
                </div>

              </div>
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
                <label className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-widest block font-sans">Nội dung <span className="text-red-400">*</span></label>
                <input type="text" value={newEventTitle} onChange={e => setNewEventTitle(e.target.value)} placeholder="VD: Báo cáo công tác tuần..." className="w-full bg-[#05070a] border border-[#1e293b] rounded-lg p-3 lg:p-4 text-slate-200 text-sm lg:text-base focus:outline-none focus:border-sky-500 transition-colors" />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-widest block font-sans">Thời gian</label>
                  <input type="time" value={newEventTime} onChange={e => setNewEventTime(e.target.value)} className="w-full bg-[#05070a] border border-[#1e293b] rounded-lg p-3 lg:p-4 text-slate-200 text-sm lg:text-base focus:outline-none focus:border-sky-500 transition-colors" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-widest block font-sans">Báo trước</label>
                  <select value={newReminderAdvance} onChange={e => setNewReminderAdvance(Number(e.target.value))} className="w-full bg-[#05070a] border border-[#1e293b] rounded-lg p-3 lg:p-4 text-slate-200 text-sm lg:text-base focus:outline-none focus:border-sky-500 transition-colors font-sans">
                    <option value={0}>Đúng giờ</option>
                    <option value={15}>15 phút</option>
                    <option value={30}>30 phút</option>
                    <option value={60}>1 tiếng</option>
                    <option value={1440}>1 ngày (24h)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-widest block flex items-center gap-1 font-sans">
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