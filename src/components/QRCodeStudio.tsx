import React, { useEffect } from 'react';
import { db } from '../firebase';
import { doc, setDoc, increment } from 'firebase/firestore';

export default function QRCodeStudio() {
  
  // Hàm lắng nghe sự kiện "bắn" ra từ iframe index.html
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      // Xác nhận đúng tín hiệu tải QR
      if (event.data === 'QR_DOWNLOADED') {
        try {
          // Ra lệnh cho Firebase cộng dồn thêm 1 vào dữ liệu hệ thống
          const statsRef = doc(db, 'system_stats', 'qr_usage');
          await setDoc(statsRef, { totalDownloads: increment(1) }, { merge: true });
        } catch (error) {
          console.error("Lỗi cập nhật thống kê QR:", error);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  return (
    <div className="w-full h-[calc(100vh-70px)] bg-[#f4f7f6] overflow-hidden flex flex-col">
      <iframe
        src="/qrcode/index.html"
        className="w-full h-full border-none m-0 p-0 block"
        title="Công cụ tạo mã QR"
        sandbox="allow-scripts allow-same-origin allow-downloads"
      />
    </div>
  );
}