/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { 
  FileText, Scan, Languages, ChevronRight, HelpCircle, Menu, X, 
  CalendarDays, QrCode, Image as ImageIcon, Search, Sparkles, LogIn, LogOut, Users, Bell, Clock, MapPin, Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import PDFProcessor from './components/PDFProcessor';
import OCRStudio from './components/OCRStudio';
import Scanner from './components/Scanner';
import Calendar from './components/Calendar';
import DocReviewStudio from './components/DocReviewStudio';
import QRCodeStudio from './components/QRCodeStudio';

// --- IMPORT FIREBASE ---
import { auth, db, googleProvider } from './firebase';
import { signInWithPopup, signInWithRedirect, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { collection, getDocs } from 'firebase/firestore';

type Module = 'calendar' | 'pdf' | 'ocr' | 'scanner' | 'admin' | 'docreview' | 'qrcode'; 

// --- BẢNG ĐIỀU KHIỂN DÀNH CHO ADMIN (CẤU TRÚC VÀ GIAO DIỆN NÂNG CẤP) ---
const AdminPanel = () => {
  const [stats, setStats] = useState({ users: 0, events: 0, qrDownloads: 0, loading: true });
  const [userList, setUserList] = useState<any[]>([]);

  useEffect(() => {
     const fetchStats = async () => {
        try {
           const { collection, getDocs, doc, getDoc } = await import('firebase/firestore');
           
           // 1. Quét dữ liệu người dùng và sự kiện (Như cũ)
           const usersSnap = await getDocs(collection(db, 'users'));
           const eventsSnap = await getDocs(collection(db, 'events'));
           
           let usersMap = new Map();
           usersSnap.forEach(doc => {
              const data = doc.data();
              usersMap.set(doc.id, {
                 id: doc.id,
                 displayName: data.displayName || 'Thành viên hệ thống',
                 email: data.email || 'Ẩn danh',
                 joinedDate: data.joinedDate || 'Chưa rõ',
                 lastLogin: data.lastLogin || 'Chưa rõ',
                 tools: data.tools || []
              });
           });

           eventsSnap.forEach(doc => {
              const data = doc.data();
              if (data.userId && !usersMap.has(data.userId)) {
                 usersMap.set(data.userId, {
                    id: data.userId,
                    displayName: 'Tài khoản cũ',
                    email: data.email || 'Không có email',
                    joinedDate: 'Trước hệ thống',
                    lastLogin: 'Chưa rõ',
                    tools: ['Lịch']
                 });
              } else if (data.userId && usersMap.has(data.userId)) {
                 const u = usersMap.get(data.userId);
                 if (!u.tools.includes('Lịch')) u.tools.push('Lịch');
              }
           });

           // 2. Lấy dữ liệu thống kê từ tính năng quét QR ẩn danh
           let qrCount = 0;
           const qrRef = doc(db, 'system_stats', 'qr_usage');
           const qrSnap = await getDoc(qrRef);
           if (qrSnap.exists()) {
               qrCount = qrSnap.data().totalDownloads || 0;
           }

           const list = Array.from(usersMap.values());
           setStats({ users: list.length, events: eventsSnap.size, qrDownloads: qrCount, loading: false });
           setUserList(list);
        } catch(e) { 
           console.error("Lỗi tải dữ liệu quản trị:", e); 
           setStats(s => ({...s, loading: false})); 
        }
     }
     fetchStats();
  }, []);

  const exportToCSV = () => {
    const headers = ["Họ và tên", "Email", "Ngày tham gia", "Công cụ sử dụng", "Cấp bậc", "Lần đăng nhập cuối"];
    const rows = userList.map(u => [
      u.displayName,
      u.email,
      u.joinedDate,
      u.tools ? u.tools.join(' - ') : 'Chưa rõ',
      ['hungvdtnai@gmail.com', 'hungvdtn@gmail.com'].includes(u.email?.toLowerCase()) ? "Quản trị viên" : "Người dùng",
      u.lastLogin
    ]);

    const csvContent = "\ufeff" + [headers.join(","), ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Bao_cao_nguoi_dung_Van_phong_so_${new Date().toLocaleDateString('vi-VN').replace(/\//g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
     <div className="p-4 md:p-8 text-slate-200 animate-in fade-in duration-500 font-sans">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <h2 className="text-xl md:text-2xl font-bold text-brand flex items-center gap-3">
             <Users size={28} /> Hệ thống kiểm soát thành viên Quản trị
          </h2>
          {!stats.loading && userList.length > 0 && (
            <button 
              onClick={exportToCSV}
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black rounded-lg transition-transform hover:scale-105 shadow-lg shadow-emerald-900/30 uppercase tracking-wider cursor-pointer"
            >
              <Download size={16}/> Xuất dữ liệu báo cáo (CSV)
            </button>
          )}
        </div>

        {stats.loading ? (
           <p className="text-slate-400 flex items-center gap-2">Đang thiết lập kết nối và trích xuất dữ liệu đám mây...</p>
        ) : (
           <div className="space-y-8">
              {/* CHUYỂN TỪ GRID 2 CỘT SANG GRID 3 CỘT ĐỂ CHỨA THỐNG KÊ QR */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 <div className="bg-[#0f172a] p-8 rounded-2xl border border-sky-900/50 shadow-[0_0_30px_rgba(56,189,248,0.1)] relative overflow-hidden group hover:border-sky-500 transition-colors">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><Users size={64}/></div>
                    <h3 className="text-slate-400 font-bold mb-2 uppercase tracking-widest text-sm relative z-10">Tổng tài khoản</h3>
                    <p className="text-5xl font-black text-sky-400 relative z-10">{stats.users}</p>
                    <p className="text-xs text-slate-500 mt-2 relative z-10">Tài khoản định danh hệ thống</p>
                 </div>
                 
                 <div className="bg-[#0f172a] p-8 rounded-2xl border border-emerald-900/50 shadow-[0_0_30px_rgba(5,150,105,0.1)] relative overflow-hidden group hover:border-emerald-500 transition-colors">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><CalendarDays size={64}/></div>
                    <h3 className="text-slate-400 font-bold mb-2 uppercase tracking-widest text-sm relative z-10">Sự kiện Lịch</h3>
                    <p className="text-5xl font-black text-emerald-400 relative z-10">{stats.events}</p>
                    <p className="text-xs text-slate-500 mt-2 relative z-10">Hồ sơ công việc đồng bộ hóa</p>
                 </div>

                 {/* KHỐI THỐNG KÊ MỚI DÀNH CHO QR CODE */}
                 <div className="bg-[#0f172a] p-8 rounded-2xl border border-amber-900/50 shadow-[0_0_30px_rgba(245,158,11,0.1)] relative overflow-hidden group hover:border-amber-500 transition-colors">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><QrCode size={64}/></div>
                    <h3 className="text-slate-400 font-bold mb-2 uppercase tracking-widest text-sm relative z-10">Lượt tạo & Tải QR</h3>
                    <p className="text-5xl font-black text-amber-400 relative z-10">{stats.qrDownloads}</p>
                    <p className="text-xs text-slate-500 mt-2 relative z-10">Thống kê từ người dùng ẩn danh</p>
                 </div>
              </div>

              <div className="bg-[#0f172a] p-6 rounded-2xl border border-[#1e293b]">
                 <h3 className="text-brand font-bold uppercase tracking-widest mb-6 text-sm">Hồ sơ chi tiết phân tích người dùng</h3>
                 <div className="overflow-x-auto custom-scrollbar">
                   <table className="w-full text-sm text-left text-slate-300">
                     <thead className="text-xs text-slate-400 uppercase bg-[#1e293b]/50 tracking-wider">
                       <tr>
                         <th className="px-6 py-4 rounded-tl-lg">Thông tin người dùng</th>
                         <th className="px-6 py-4">Sự kiện (Công cụ)</th>
                         <th className="px-6 py-4">Cấp bậc</th>
                         <th className="px-6 py-4 rounded-tr-lg">Lần đăng nhập cuối</th>
                       </tr>
                     </thead>
                     <tbody className="divide-y divide-[#1e293b]">
                       {userList.map((u, i) => {
                         const isCurrentAdmin = ['hungvdtnai@gmail.com', 'hungvdtn@gmail.com'].includes(u.email?.toLowerCase());
                         return (
                           <tr key={i} className="hover:bg-[#1e293b]/30 transition-colors">
                             <td className="px-6 py-4 space-y-1">
                               <div className="font-bold text-white text-base">{u.displayName}</div>
                               <div className="text-xs text-sky-400 font-mono font-medium">{u.email}</div>
                               <div className="text-[11px] text-slate-500 font-medium pt-1">Tham gia: {u.joinedDate}</div>
                             </td>
                             <td className="px-6 py-4">
                               <div className="flex flex-wrap gap-1.5">
                                 {u.tools && u.tools.length > 0 ? (
                                   u.tools.map((toolName: string, tIdx: number) => (
                                     <span key={tIdx} className={`px-2.5 py-1 text-[10px] font-black uppercase rounded-md tracking-wider border ${toolName === 'Lịch' ? 'bg-sky-500/10 text-sky-400 border-sky-500/20' : 'bg-purple-500/10 text-purple-400 border-purple-500/20'}`}>
                                       {toolName === 'Lịch' ? 'Lịch Vạn Niên' : 'Rà lỗi văn bản'}
                                     </span>
                                   ))
                                 ) : (
                                   <span className="text-slate-600 text-xs italic">Không có dữ liệu</span>
                                 )}
                               </div>
                             </td>
                             <td className="px-6 py-4">
                               <span className={`px-2.5 py-1 text-[10px] font-black uppercase rounded-md tracking-wider border ${isCurrentAdmin ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                                 {isCurrentAdmin ? "Quản trị viên" : "Người dùng"}
                               </span>
                             </td>
                             <td className="px-6 py-4 font-bold text-slate-300 text-sm">
                               {u.lastLogin}
                             </td>
                           </tr>
                         );
                       })}
                       {userList.length === 0 && (
                         <tr><td colSpan={4} className="px-6 py-8 text-center text-slate-500 italic">Hệ thống chưa ghi nhận tài khoản tương tác.</td></tr>
                       )}
                     </tbody>
                   </table>
                 </div>
              </div>
           </div>
        )}
     </div>
  );
};

// --- NỘI DUNG TRỢ GIÚP THEO TỪNG CHỨC NĂNG ---
const HelpContent = ({ module }: { module: string }) => {
  switch (module) {
    case 'calendar':
      return (
        <div className="space-y-4 text-sm text-slate-300 leading-relaxed font-sans">
           <h3 className="font-bold text-brand text-lg">Hướng dẫn sử dụng Lịch Vạn niên AI</h3>
           <p>Ứng dụng Lịch Vạn niên AI được thiết kế với công nghệ lõi API sử dụng thư viện mã nguồn mở Lunar-javascript, là tài liệu tích hợp các lý luận cổ đại Trung Hoa về thiên văn, trạch cát, thuật số làm nền tảng thuật toán. Ngoài ra, các quy tắc phân tích chọn ngày chuyên sâu được tham chiếu theo bộ sách cổ "Ngọc Hạp Thông Thư" của Việt Nam và những tài liệu kinh điển về phong thủy, trạch cát truyền thống.</p>
           <p>Lịch Vạn niên AI được bổ sung đầy đủ các ngày lễ tết theo quy định của Việt Nam. Ngày có đánh dấu màu đỏ là các ngày Chủ Nhật và các ngày lễ, Tết được nghỉ làm việc; ngày đánh dấu màu vàng là các ngày lễ/kỷ niệm thông thường, không được nghỉ; ngày màu trắng là ngày làm việc bình thường.</p>
           <p>Điểm khác biệt với các Lịch Vạn niên khác, Lịch Vạn niên AI còn có thể giúp người sử dụng lập lịch làm việc, bổ sung các sự kiện cần ghi nhớ vào lịch, đồng thời cài đặt cảnh báo nhắc lịch công việc bằng trình duyệt (tiếng kêu ting ting). Bạn có thể cài đặt cảnh báo trước 15 phút, 30 phút, trước 1 tiếng hoặc trước 1 ngày.</p>
           <p>Để ghi chú vào lịch bạn chỉ cần nháy thực đơn Thêm sự kiện và điền các thông tin cần thiết, sau đó lưu sự kiện.</p>
           <p className="font-bold text-sky-400 mt-4">Ngoài ra, Lịch Vạn niên AI còn có các tính năng chuyên sâu:</p>
           <ul className="list-none space-y-2">
             <li><strong className="text-white">(1). Xem ngày chi tiết:</strong> Để biết tính chất tốt, xấu của ngày đó;</li>
             <li><strong className="text-white">(2). Tìm các ngày tốt trong một tháng:</strong> Có thể tìm ngày tốt chung hoặc có thể tìm ngày tốt cho từng việc;</li>
             <li><strong className="text-white">(3). Đổi ngày:</strong> Đổi ngày âm hoặc dương sang ngày dương hoặc âm tương ứng.</li>
           </ul>
        </div>
      );
    case 'pdf':
      return (
        <div className="space-y-4 text-sm text-slate-300 leading-relaxed font-sans">
          <h3 className="font-bold text-brand text-lg">Hướng dẫn sử dụng Xử lý PDF</h3>
          <p>Cung cấp bộ công cụ cắt, ghép, và sắp xếp lại trang PDF bằng thao tác kéo thả. Đặc biệt có tính năng chuyển PDF sang Word (.docx), tự động làm sạch ký hiệu thừa và định dạng chuẩn font Times New Roman dùng cho hành chính.</p>
          <h4 className="font-bold text-white">Công cụ này có 3 chức năng:</h4>
          <p className="font-bold text-sky-400">1. Cắt và tách file PDF:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Bước 1: Bạn tải lên file PDF bất kỳ;</li>
            <li>Bước 2: Xuất hiện giao diện của từng trang PDF. Tại đây, bạn đưa chuột vào từng trang xuất hiện 3 nút công cụ: Nút màu vàng có chấm đen (di chuyển trang), Nút màu xanh (copy trang), Nút màu đỏ (xóa trang).</li>
            <li>Bước 3: Sau khi edit xong bạn có thể tách bằng nhiều cách:<br/>
            - <strong>Cách 1:</strong> Chọn các trang bất kỳ. Nhấn nút "Xuất n trang chọn" ➔ Lưu file.<br/>
            - <strong>Cách 2:</strong> Chọn khoảng cách chia tách ➔ Nhấn "Tải Zip" để tách hàng loạt.</li>
          </ul>
          <p className="font-bold text-sky-400">2. Ghép file PDF</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Bước 1: Tải lên các file PDF cần ghép.</li>
            <li>Bước 2: Edit hoặc biên tập lại các file PDF (thêm, bớt, xóa, di chuyển).</li>
            <li>Bước 3: Chọn "Ghép & Tải xuống".</li>
          </ul>
          <p className="font-bold text-sky-400">3. Chuyển sang file word</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Bước 1: Tải file PDF cần chuyển.</li>
            <li>Bước 2: Tải file word đã được chuyển.</li>
          </ul>
        </div>
      );
    case 'ocr':
      return (
        <div className="space-y-4 text-sm text-slate-300 leading-relaxed font-sans">
          <h3 className="font-bold text-brand text-lg">Hướng dẫn sử dụng Trích xuất OCR</h3>
          <p>Sử dụng Trí tuệ nhân tạo (AI) chạy nội bộ (Offline) để nhận diện và bóc tách văn bản từ hình ảnh JPG/PNG. Đảm bảo bảo mật tuyệt đối 100% tài liệu nhạy cảm do dữ liệu không bị gửi lên mạng.</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Bước 1: Tải hình ảnh có text cần trích xuất thành văn bản</li>
            <li>Bước 2: Chọn bắt đầu trích xuất</li>
            <li>Bước 3: Kết quả trích xuất ở khung hình bên phải, chọn Docx để dowload xuống</li>
          </ul>
        </div>
      );
    case 'scanner':
      return (
        <div className="space-y-4 text-sm text-slate-300 leading-relaxed font-sans">
          <h3 className="font-bold text-brand text-lg">Hướng dẫn Scan tài liệu</h3>
          <p>Chức năng này bạn nên sử dụng trên điện thoại. Mặc định sau khi scan sẽ xuất thành file PDF ở dạng bản màu hoặc đen trắng.</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Bước 1: Đặt văn bản cần scan ngay ngắn trên mặt phẳng;</li>
            <li>Bước 2: Bật chức năng Scan Tài liệu từ Ứng dụng; nháy chọn Cho phép sử dụng Cam của điện thoại nếu được hỏi.</li>
            <li>Bước 3: Chọn chế độ Scan. Có 2 chế độ: Bản màu và Đen trắng, tùy thuộc vào nhu cầu của bạn. Ví dụ: Cần scan file văn bản có dấu, có hình ảnh màu sắc thì chọn chế độ Màu sắc.</li>
            <li>Bước 4: Đưa điện thoại song song với văn bản cần scan; điều chỉnh tay để văn bản nằm khít trong khung màu vàng của Cam.</li>
            <li>Bước 5: Nháy nút chụp ảnh</li>
            <li>Bước 6: Tiếp tục Scan trang tiếp theo nếu văn bản có nhiều trang</li>
            <li>Bước 7: Khi đã Scan xong thì chọn nút Xong, nếu muốn hủy thì chọn Hủy.</li>
            <li>Bước 8: Lưu file Scan vào zalo hoặc vào các ứng dụng khác để sử dụng</li>
          </ul>
        </div>
      );
      case 'docreview':
      return (
        <div className="space-y-4 text-sm text-slate-300 leading-relaxed font-sans">
          <h3 className="font-bold text-brand text-lg">Hướng dẫn rà lỗi tài liệu</h3>
          <p>Công cụ “Rà lỗi văn bản” được thiết kế để rà soát lỗi chính tả, lỗi kỹ thuật, ngữ pháp, lỗi sử dụng từ của văn bản theo chuẩn quy tắc tiếng Việt và các quy định tại Nghị định 30/2020/NĐ-CP, giúp người dùng nâng cao chất lượng soạn thảo các văn bản, tối ưu hóa công việc.</p>
          <p className="font-bold text-rose-400">Bạn phải đăng nhập với tài khoản Google để sử dụng chức năng này, vì công cụ này có sử dụng AI trong rà soát.</p>
          <p>Bạn tải văn bản cần rà soát (chỉ file .docx mới được chấp nhận). Nếu là tài liệu của file .doc bạn có thể Save as …chuyển thành .docx hoặc bôi đen toàn bộ văn bản, chọn copy, chọn nút “Dán văn bản” và dán văn bản vào khung cần rà soát.</p>
          
          <p className="font-bold text-sky-400 mt-2">Để rà lỗi văn bản có 2 lựa chọn:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>(1) Rà soát chính tả:</strong> Dùng trong trường hợp văn bản ngắn, đơn giản, cần xử lý nhanh. Kết quả rà soát là các lỗi chính tả, lỗi viết hoa, lỗi kỹ thuật (đánh máy, thừa ký tự, thừa chữ; khoảng trắng, dấu câu…). Kết quả chỉ trong 1, 2 giây cho hàng trăm trang, gần như không độ trễ.</li>
            <li><strong>(2) Rà soát kỹ:</strong> Dùng trong trường hợp muốn rà soát kỹ lưỡng văn bản đòi hỏi độ chính xác cao cả về chính tả, ngữ pháp mà còn cả ngữ, nghĩa của từ, câu trong văn bản. Vì độ phức tạp cao, nên thời gian rà soát lâu, khoảng 15s/trang. Kết quả rà soát là các lỗi chính tả, kỹ thuật văn bản, ngữ pháp, sử dụng từ v.v… </li>
          </ul>
          
          <p>Giao diện kết quả rà soát của cả 2 tính năng đều cực kỳ thân thiện, thông minh, dễ sử dụng. Bạn có thể xem lại từng từ, từng chỗ bị cho là lỗi (có nêu lý do từng lỗi), nếu thấy đúng, thì ấn chấp nhận hệ thống sẽ sửa hoặc lỗi không đúng thì chọn Bỏ qua, không sửa.</p>
          
          <p className="font-bold text-sky-400 mt-2">Sau khi sửa xong, bạn có 2 lựa chọn:</p>
          <ul className="list-none space-y-1 pl-2">
            <li>(1) Tải word: Kết quả sửa được tải xuống dưới dạng file .docx; </li>
            <li>(2) Chọn nút “Copy” để copy và dán vào file word của bạn đang làm. </li>
          </ul>

          <p className="font-bold text-amber-400 mt-2">Lưu ý:</p>
          <ol className="list-decimal pl-5 space-y-1">
            <li>Nếu bạn quan tâm đến định dạng của văn bản, khi bạn tải file word lên, sửa xong, download xuống, định dạng sẽ không còn được như ban đầu. Bạn phải định dạng lại theo ý bạn.</li>
            <li>Bạn có thể chỉ dùng công cụ này tìm lỗi, sau đó tự sửa ngay trong file word đang soạn thảo, để giữ nguyên định dạng.</li>
            <li>Xử lý chính tả tiếng Việt là một việc vô cùng khó, nên AI có thể có sai sót. Nếu kết quả trả về quá nhiều lỗi không đúng, bạn hãy thực hiện lại thao tác rà soát.</li>
          </ol>
        </div>
      );
      case 'qrcode':
      return (
        <div className="space-y-4 text-sm text-slate-300 leading-relaxed font-sans">
          <h3 className="font-bold text-brand text-lg">Hướng dẫn tạo mã QR Code</h3>
          <p>Mã QR không đơn thuần là một biểu tượng đồ họa mã hóa; nó chính là “cây cầu” liên kết tức thì giữa không gian vật lý và không gian số.</p>
          
          <p className="font-bold text-sky-400 mt-2">Bạn dùng QR Code để làm gì?</p>
          <ol className="list-decimal pl-5 space-y-1.5">
            <li>Bạn muốn truy cập nhanh vào một link website nào đó về tài liệu, về ứng dụng mà không cần phải nhập các địa chỉ?</li>
            <li>Bạn muốn biết thông tin về trang thiết bị của gia đình mình; của cơ quan, đơn vị mình (loại thiết bị, thời gian sử dụng, bảo hành, nguồn gốc, xuất xứ….) mà không cần mở dữ liệu tra cứu?</li>
            <li>Bạn muốn gửi thông tin cho mọi người cần liên hệ làm việc với mình, mà không cần nhiều thao tác?</li>
            <li>Bạn muốn chia sẻ thông tin về wifi cho đại biểu tham dự hội nghị; khách đến cơ quan làm việc, để mọi người không phải tìm, nhập mật khẩu?</li>
            <li>Bạn cần chia sẻ số điện thoại cho mọi người mà không quá lộ liễu?</li>
          </ol>
          <p className="mt-2">Năm loại mã QR Code tích hợp sẵn trong ứng dụng này sẽ giúp bạn dễ dàng giải quyết mọi nhu cầu nêu trên.</p>
          
          <p className="font-bold text-sky-400 mt-4">Điểm đặc biệt của ứng dụng:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Chất lượng cao:</strong> QR Code được kết xuất sắc nét, chuẩn định dạng cấu trúc hình ảnh và không bị hỏng lỗi trong quá trình quét.</li>
            <li><strong>Tùy biến giao diện chuyên nghiệp:</strong> Hỗ trợ thiết lập đổi màu sắc, bo góc các điểm ảnh, thay đổi hoa văn cấu trúc nền và chèn hình ảnh Logo cơ quan ở chính giữa mã để tăng tính thẩm mỹ cao.</li>
            <li><strong>Tiện ích tối đa:</strong> Hoàn toàn miễn phí, thao tác xử lý tức thì không có độ trễ.</li>
          </ul>

          <p className="text-xs text-slate-500 mt-6 pt-2 border-t border-[#1e293b]">
            Để xem thêm các tài liệu phân tích ứng dụng thực tế, Bạn có thể tham khảo trực tiếp bài viết hướng dẫn sâu tại liên kết: <a href="https://lamchuaigiaoduc.vn/cong-cu-tao-ma-qr-mien-phi/" target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:underline font-medium">lamchuaigiaoduc.vn</a>.
          </p>
        </div>
      );
  }
}

// --- BẢNG TRỢ GIÚP NỔI (DRAGGABLE & RESIZABLE) ---
const DraggableHelp = ({ activeModule, onClose }: { activeModule: string, onClose: () => void }) => {
  const [pos, setPos] = useState({ x: window.innerWidth > 768 ? window.innerWidth - 450 : 20, y: 80 });
  const dragRef = useRef({ isDragging: false, origin: { x: 0, y: 0 } });

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    dragRef.current = { isDragging: true, origin: { x: e.clientX - pos.x, y: e.clientY - pos.y } };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current.isDragging) return;
    setPos({ x: e.clientX - dragRef.current.origin.x, y: e.clientY - dragRef.current.origin.y });
  };
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    dragRef.current.isDragging = false;
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  return (
    <div 
      className="fixed z-50 bg-[#0f172a]/95 backdrop-blur-xl border-2 border-brand/50 rounded-xl shadow-[0_0_30px_rgba(0,0,0,0.8)] flex flex-col"
      style={{ left: pos.x, top: pos.y, width: window.innerWidth > 400 ? 400 : window.innerWidth - 40, height: 500, resize: 'both', overflow: 'hidden' }}
    >
      <div 
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
        className="p-3 bg-brand/20 cursor-move flex justify-between items-center border-b border-brand/30 touch-none"
      >
         <h3 className="font-bold text-brand flex items-center gap-2 pointer-events-none">
           <HelpCircle size={18}/> Trợ giúp
         </h3>
         
         <button 
           onPointerDown={(e) => { e.stopPropagation(); onClose(); }}
           onClick={(e) => { e.stopPropagation(); onClose(); }}
           className="p-1.5 bg-rose-500/20 hover:bg-rose-500 rounded-lg text-rose-400 hover:text-white transition-colors cursor-pointer"
         >
           <X size={18}/>
         </button>
      </div>
      <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
         <HelpContent module={activeModule} />
      </div>
    </div>
  );
}

export default function App() {
  const [activeModule, setActiveModule] = useState<Module>('calendar');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false); 

  // QUẢN LÝ TRẠNG THÁI ĐĂNG NHẬP
  const [user, setUser] = useState<User | null>(null);

  // --- TRẠNG THÁI QUẢN LÝ BÁO THỨC (ALARM) ---
  const [ringingEvent, setRingingEvent] = useState<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const alarmedIds = useRef<Set<string>>(new Set());

  // THIẾT LẬP QUYỀN ADMIN
  const ADMIN_EMAILS = ['hungvdtnai@gmail.com', 'hungvdtn@gmail.com'];
  const isAdmin = user && ADMIN_EMAILS.includes(user.email?.toLowerCase() || '');

  // Thuật toán tự động cập nhật vết đăng nhập và phân loại công cụ sử dụng lên Cloud Firestore
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => { 
        setUser(currentUser); 
        if (currentUser) {
           try {
              const { doc, setDoc, getDoc } = await import('firebase/firestore');
              const userRef = doc(db, 'users', currentUser.uid);
              const userSnap = await getDoc(userRef);
              
              const now = new Date();
              const dateStr = `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}`;
              
              let currentModuleTag = '';
              if (activeModule === 'calendar') currentModuleTag = 'Lịch';
              if (activeModule === 'docreview') currentModuleTag = 'Rà lỗi';

              if (!userSnap.exists()) {
                 // Trường hợp tài khoản mới đăng nhập hệ sinh thái lần đầu
                 await setDoc(userRef, {
                    uid: currentUser.uid,
                    displayName: currentUser.displayName || 'Thành viên Văn phòng số',
                    email: currentUser.email || '',
                    joinedDate: dateStr,
                    lastLogin: dateStr,
                    lastLoginTimestamp: Date.now(),
                    tools: currentModuleTag ? [currentModuleTag] : []
                 });
              } else {
                 // Trường hợp thành viên cũ quay lại tương tác hệ thống
                 const existingData = userSnap.data();
                 const currentTools = existingData.tools || [];
                 
                 if (currentModuleTag && !currentTools.includes(currentModuleTag)) {
                    currentTools.push(currentModuleTag);
                 }
                 
                 await setDoc(userRef, {
                    lastLogin: dateStr,
                    lastLoginTimestamp: Date.now(),
                    displayName: currentUser.displayName || existingData.displayName || 'Thành viên Văn phòng số',
                    tools: currentTools
                 }, { merge: true });
              }
           } catch(e) { console.error("Lỗi đồng bộ thông tin tài khoản:", e); }
        }
    });
    return () => unsubscribe();
  }, [activeModule]);

  // --- THUẬT TOÁN BÁO SỰ KIỆN KÈM VƯỢT RÀO CẢN DI ĐỘNG ---
  useEffect(() => {
    // Khởi tạo Audio
    audioRef.current = new Audio('/nhac_bao_hieu.mp3');
    audioRef.current.loop = true;
    audioRef.current.load();

    // Trick để "Mở khóa âm thanh" và "Xin quyền Thông báo" bằng tương tác ĐẦU TIÊN của người dùng
    const unlockAudioAndNotify = () => {
      // 1. Xin quyền thông báo ngay khi người dùng chạm vào màn hình (Bắt buộc với iOS/Android)
      if ('Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
          Notification.requestPermission();
      }

      // 2. Mở khóa Audio
      if (audioRef.current) {
        audioRef.current.play().then(() => {
          audioRef.current!.pause();
          audioRef.current!.currentTime = 0;
        }).catch(() => {});
      }
      
      // Hủy lắng nghe sau khi đã mở khóa thành công
      window.removeEventListener('click', unlockAudioAndNotify);
      window.removeEventListener('touchstart', unlockAudioAndNotify);
    };

    window.addEventListener('click', unlockAudioAndNotify);
    window.addEventListener('touchstart', unlockAudioAndNotify);

    const checkAlarms = () => {
      const savedEvents = localStorage.getItem('user_events');
      if (!savedEvents) return;
      const events = JSON.parse(savedEvents);
      const now = new Date();

      events.forEach((ev: any) => {
        if (ev.reminderAdvance === -1) return;
        const [evY, evMo, evD] = ev.dateStr.split('-').map(Number); 
        const [evH, evM] = ev.time.split(':').map(Number);
        const eventTime = new Date(evY, evMo - 1, evD, evH, evM);
        const remindTime = new Date(eventTime.getTime() - (ev.reminderAdvance * 60000));
        
        const alarmKey = `${ev.id}-${now.getHours()}-${now.getMinutes()}`;

        // Kiểm tra giờ và chặn báo lặp lại trong cùng 1 phút
        if (
            remindTime.getFullYear() === now.getFullYear() && 
            remindTime.getMonth() === now.getMonth() && 
            remindTime.getDate() === now.getDate() && 
            remindTime.getHours() === now.getHours() && 
            remindTime.getMinutes() === now.getMinutes() &&
            !alarmedIds.current.has(alarmKey)
        ) {
            alarmedIds.current.add(alarmKey);
            setRingingEvent(ev); // Bật giao diện Chuông
            
            if (audioRef.current) {
                audioRef.current.play().catch(e => console.log('Bị chặn âm thanh do chưa tương tác', e));
            }
            
            // BẮN THÔNG BÁO HỆ THỐNG VỚI QUYỀN ƯU TIÊN CAO
            if ('Notification' in window && Notification.permission === 'granted') { 
                new Notification(`BÁO VIỆC: ${ev.title}`, { 
                    body: `⏰ Lúc: ${ev.time}\n📍 Địa điểm: ${ev.location || 'Không có'}`, 
                    icon: '/Logo_anh.png', 
                    requireInteraction: true, // Bắt buộc thông báo nằm lỳ trên màn hình cho đến khi tắt
                    vibrate: [200, 100, 200, 100, 200, 100, 200] // Rung mạnh trên điện thoại Android
                }); 
            }
        }
      });
    };

    // Kiểm tra liên tục mỗi 10 giây
    const interval = setInterval(checkAlarms, 10000); 
    return () => {
        clearInterval(interval);
        window.removeEventListener('click', unlockAudioAndNotify);
        window.removeEventListener('touchstart', unlockAudioAndNotify);
    };
  }, []);

  const stopAlarm = () => {
      if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
      }
      setRingingEvent(null);
  };

  const handleLogin = async () => { 
    try { 
      // Quay về dùng duy nhất 1 lệnh Popup cho cả Máy tính và Điện thoại (Giống như cũ)
      await signInWithPopup(auth, googleProvider); 
    } catch (error: any) { 
      console.error("Lỗi đăng nhập:", error); 
      if (error.code === 'auth/popup-blocked') {
         alert("Trình duyệt đang chặn cửa sổ đăng nhập. Vui lòng cấp quyền (Cho phép mở Pop-up) để tiếp tục.");
      } else if (error.code !== 'auth/popup-closed-by-user' && error.code !== 'auth/cancelled-popup-request') {
         alert("LỖI BẢO MẬT: Nếu bạn đang mở web từ trong ứng dụng Zalo/Facebook, vui lòng bấm nút 3 chấm góc phải, chọn 'Mở bằng trình duyệt' (Chrome/Safari) để đăng nhập!");
      }
    } 
  };
  
  const handleLogout = async () => { try { await signOut(auth); } catch (error) { console.error(error); } };

  const modules = [
    { id: 'calendar', label: 'Lịch Vạn Niên', icon: CalendarDays },
    { id: 'pdf', label: 'Xử lý PDF', icon: FileText },
    { id: 'ocr', label: 'Trích xuất OCR', icon: Languages },
    { id: 'scanner', label: 'Scan Tài liệu', icon: Scan },
    { id: 'docreview', label: 'Rà lỗi văn bản', icon: FileText },
    { id: 'qrcode', label: 'Tạo mã QR', icon: QrCode },
    { id: 'idphoto', label: 'Tạo ảnh thẻ', icon: ImageIcon, isExternal: true, url: 'https://lamchuaigiaoduc.vn/id-photo/' },
    { id: 'gemini', label: 'Trợ lý Gemini', icon: Sparkles, isExternal: true, url: 'https://gemini.google.com/app' },
  ];

  const displayModules = [...modules];
  if (isAdmin) {
     displayModules.push({ id: 'admin', label: 'Admin (Quản trị)', icon: Users });
  }

  return (
    <div className="flex h-screen w-full max-w-[100vw] bg-[#05070a] text-[#e2e8f0] overflow-hidden relative">
      <style dangerouslySetInnerHTML={{__html: `
        * {
          font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif !important;
        }
      `}} />

      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsMobileMenuOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 md:hidden"
          />
        )}
      </AnimatePresence>

      <aside className={`fixed inset-y-0 left-0 z-40 md:relative md:z-20 ${isSidebarOpen ? 'w-64' : 'w-20'} bg-[#0f172a] border-r border-[#1e293b] flex flex-col flex-shrink-0 transition-all duration-300 ease-in-out shadow-2xl overflow-x-hidden ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div className="p-6 flex items-center justify-between border-b border-[#1e293b] flex-shrink-0">
          {(isSidebarOpen || isMobileMenuOpen) ? (
            <div className="flex flex-col">
              <h1 className="text-xl font-black tracking-widest text-brand uppercase whitespace-nowrap">AI OFFICE</h1>
              <span className="text-xs tracking-normal font-medium text-slate-400 uppercase mt-1">Văn phòng AI Chuyên biệt</span>
            </div>
          ) : (
            <div className="w-8 h-8 rounded bg-brand/10 flex items-center justify-center text-brand font-bold text-xs flex-shrink-0">AI</div>
          )}
          <button onClick={() => { window.innerWidth < 768 ? setIsMobileMenuOpen(false) : setIsSidebarOpen(!isSidebarOpen); }} className="p-1.5 hover:bg-[#1e293b] rounded-md text-slate-500 transition-colors flex-shrink-0">
            {isMobileMenuOpen ? <X size={18} /> : (isSidebarOpen ? <X size={18} className="hidden md:block" /> : <Menu size={18} className="hidden md:block" />)}
            {!isMobileMenuOpen && <X size={18} className="md:hidden" />}
          </button>
        </div>

        <nav className="flex-1 py-6 space-y-1 overflow-y-auto overflow-x-hidden custom-scrollbar">
          {displayModules.map((m) => (
            <button
              key={m.id}
              onClick={() => { m.isExternal ? window.open(m.url, '_blank') : setActiveModule(m.id as Module); setIsMobileMenuOpen(false); }}
              className={activeModule === m.id ? 'sidebar-link-active w-full whitespace-nowrap' : 'sidebar-link w-full whitespace-nowrap'}
            >
              <m.icon size={18} className={activeModule === m.id ? 'text-brand flex-shrink-0' : 'flex-shrink-0'} />
              {(isSidebarOpen || isMobileMenuOpen) && <span className="text-sm font-medium truncate">{m.label}</span>}
              {(isSidebarOpen || isMobileMenuOpen) && m.isExternal && <ChevronRight size={14} className="ml-auto opacity-50 flex-shrink-0" />}
            </button>
          ))}
        </nav>

        <div className="pb-6 border-t border-[#1e293b] flex-shrink-0 flex flex-col">
          {/* Nút Trợ giúp căn trái thẳng hàng với các thực đơn phía trên */}
          <button onClick={() => setShowHelpModal(true)} className="sidebar-link w-full whitespace-nowrap mb-2 mt-4">
            <HelpCircle size={18} className="flex-shrink-0" />
            {(isSidebarOpen || isMobileMenuOpen) && <span className="text-sm font-medium">Trợ giúp</span>}
          </button>

          {/* Logo AIBTeM */}
          <div className="px-6 mt-2">
            <a href="https://lamchuaigiaoduc.vn" target="_blank" rel="noreferrer" className={`flex items-center transition-transform hover:scale-105 origin-left ${!(isSidebarOpen || isMobileMenuOpen) ? 'hidden' : ''}`}>
              <img src="Logo_anh.png" alt="AIBTeM Logo" className="h-10 w-auto object-contain rounded-full drop-shadow-[0_0_15px_rgba(56,189,248,0.4)]" />
            </a>
            {/* Trạng thái khi thu gọn menu (vẫn nháy được link và không bị mờ) */}
            {!(isSidebarOpen || isMobileMenuOpen) && (
              <a href="https://lamchuaigiaoduc.vn" target="_blank" rel="noreferrer" className="flex items-center transition-transform hover:scale-105 origin-left">
                <img src="Logo_anh.png" alt="AIBTeM Logo" className="h-8 w-8 object-contain rounded-full drop-shadow-[0_0_10px_rgba(56,189,248,0.3)]" />
              </a>
            )}
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden bg-[radial-gradient(circle_at_top_right,#0f172a, #05070a)] w-full">
        <header className="h-[70px] bg-[#0f172a]/80 backdrop-blur-md border-b border-[#1e293b] flex items-center justify-between px-4 md:px-8 z-10 flex-shrink-0">
          <div className="flex items-center gap-3 md:gap-4 font-bold text-slate-500">
            <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 -ml-2 text-slate-400 hover:text-brand transition-colors md:hidden"><Menu size={24} /></button>
            <div className="hidden sm:flex items-center gap-3 text-[11px] tracking-widest uppercase font-semibold">
              <span>Vị trí hiện tại:</span>
              <span className="text-brand flex items-center gap-2"><ChevronRight size={12} className="text-slate-500" />{displayModules.find(m => m.id === activeModule)?.label || 'Ứng dụng ngoài'}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-4 md:gap-6">
            {user ? (
              <div className="flex items-center gap-2 bg-[#1e293b]/50 p-1.5 pr-3 rounded-full border border-[#1e293b]">
                 <img src={user.photoURL || ''} alt="Avatar" className="w-8 h-8 rounded-full shadow-[0_0_10px_rgba(56,189,248,0.3)]" title={user.email || ''} />
                 <button onClick={handleLogout} className="text-slate-400 hover:text-rose-400 transition-colors ml-1" title="Đăng xuất"><LogOut size={18} /></button>
              </div>
            ) : (
              <button onClick={handleLogin} className="flex items-center gap-2 px-5 py-2.5 bg-brand text-bg-dark text-xs font-bold rounded-full transition-all hover:scale-105 shadow-lg shadow-brand/20">
                 <LogIn size={16} /> Đăng nhập
              </button>
            )}
          </div>
        </header>

        <div className={`flex-1 overflow-y-auto overflow-x-hidden relative ${activeModule === 'qrcode' ? 'p-0' : 'p-4 md:p-6 lg:p-8'}`}>
          <div className="absolute inset-0 dot-grid opacity-10 pointer-events-none" />
          <div className="w-full mx-auto relative z-10 overflow-x-hidden">
            <AnimatePresence mode="wait">
              <motion.div key={activeModule} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3, ease: "easeOut" }} className="w-full">
                {activeModule === 'pdf' && <PDFProcessor />}
                {activeModule === 'ocr' && <OCRStudio />}
                {activeModule === 'scanner' && <Scanner />}
                {activeModule === 'calendar' && <Calendar />}
                {activeModule === 'admin' && <AdminPanel />}
                {activeModule === 'docreview' && <DocReviewStudio />}
                {activeModule === 'qrcode' && <QRCodeStudio />}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </main>

      {/* --- GIAO DIỆN BÁO SỰ KIỆN --- */}
      <AnimatePresence>
         {ringingEvent && (
            <motion.div 
               initial={{ opacity: 0, scale: 0.9, y: 50 }} 
               animate={{ opacity: 1, scale: 1, y: 0 }} 
               exit={{ opacity: 0, scale: 0.9, y: 50 }} 
               className="fixed bottom-10 left-1/2 transform -translate-x-1/2 z-[200] bg-rose-600 rounded-2xl shadow-[0_0_80px_rgba(225,29,72,0.6)] p-6 md:p-8 flex flex-col items-center gap-4 border-2 border-rose-400 w-[90%] max-w-sm font-sans"
            >
               <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-inner animate-bounce">
                  <Bell className="text-rose-600 animate-pulse" size={40} />
               </div>
               <div className="text-center">
                 <p className="text-rose-100 font-bold uppercase tracking-widest text-xs mb-1">Báo sự kiện</p>
                 <h3 className="text-xl md:text-2xl font-black text-white">{ringingEvent.title}</h3>
                 <p className="text-base font-bold text-rose-200 mt-2 flex items-center justify-center gap-2">
                    <Clock size={18}/> Thời gian: {ringingEvent.time}
                 </p>
                 {ringingEvent.location && (
                    <p className="text-sm font-medium text-rose-100 mt-1 flex items-center justify-center gap-1">
                       <MapPin size={16}/> {ringingEvent.location}
                    </p>
                 )}
               </div>
               <button 
                  onClick={stopAlarm} 
                  className="mt-4 bg-white text-rose-600 hover:bg-rose-100 w-full px-6 py-3 rounded-xl font-black uppercase tracking-widest transition-colors shadow-lg"
               >
                  ĐÃ HIỂU / TẮT CHUÔNG
               </button>
            </motion.div>
         )}
      </AnimatePresence>

      {showHelpModal && <DraggableHelp activeModule={activeModule} onClose={() => setShowHelpModal(false)} />}
    </div>
  );
}