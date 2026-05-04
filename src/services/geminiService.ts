import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: import.meta.env.GEMINI_API_KEY || "" });

export async function performOCR(imageBox: { data: string; mimeType: string }) {
  const result = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: {
      parts: [
        {
          inlineData: {
            data: imageBox.data,
            mimeType: imageBox.mimeType,
          },
        },
        {
          text: "Bạn là chuyên gia OCR tài liệu tiếng Việt. Hãy trích xuất toàn bộ văn bản từ hình ảnh này. Giữ nguyên định dạng bảng biểu (dưới dạng markdown table), tiêu đề và các dấu thanh tiếng Việt một cách chính xác nhất. Không thêm bớt ý kiến cá nhân.",
        },
      ],
    },
  });
  return result.text || "Không thể trích xuất văn bản.";
}

export async function generateMeetingMinutes(input: { type: 'audio' | 'text', data: string, mimeType?: string }) {
  const contents: any[] = [];
  
  if (input.type === 'audio' && input.mimeType) {
    contents.push({
      inlineData: {
        data: input.data,
        mimeType: input.mimeType
      }
    });
  } else {
    contents.push({ text: input.data });
  }

  contents.push({
    text: `Hãy đóng vai Thư ký hội đồng sư phạm chuyên nghiệp. Xử lý nội dung cuộc họp sau:
1. Chuyển toàn bộ nội dung thành văn bản (Transcribe).
2. Phân loại ý kiến theo từng đại biểu (nếu có thông tin).
3. Tổng hợp thành Biên bản cuộc họp theo mẫu chuẩn hành chính Việt Nam bao gồm:
- Tiêu đề (Biên bản cuộc họp...)
- Thời gian, địa điểm
- Thành phần tham dự
- Nội dung diễn biến chi tiết
- Kết luận và Phân công nhiệm vụ.
Ngôn ngữ: Tiếng Việt chuẩn mực, thuật ngữ chuyên môn giáo dục/hành chính.`
  });

  const result = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: { parts: contents },
  });

  return result.text || "Không thể tạo biên bản.";
}

export async function summarizeDocument(text: string) {
  const result = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Hãy tóm tắt văn bản sau một cách súc tích cho lãnh đạo văn phòng: \n\n ${text}`,
  });
  return result.text || "Không thể tóm tắt.";
}
