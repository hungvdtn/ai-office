import React from 'react';

export default function QRCodeStudio() {
  return (
    <div className="w-full h-[calc(100vh-70px)] bg-[#f4f7f6] overflow-hidden">
      <iframe
        src="/qrcode/index.html"
        className="w-full h-full border-none m-0 p-0 block"
        title="Công cụ tạo mã QR"
        sandbox="allow-scripts allow-same-origin allow-downloads"
      />
    </div>
  );
}