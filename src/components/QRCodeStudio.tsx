import React from 'react';

export default function QRCodeStudio() {
  return (
    <div className="w-full h-full bg-[#f4f7f6] overflow-hidden flex flex-col">
      <iframe
        src="/qrcode/index.html"
        className="w-full flex-1 border-none"
        title="Công cụ tạo mã QR"
        sandbox="allow-scripts allow-same-origin allow-downloads"
      />
    </div>
  );
}