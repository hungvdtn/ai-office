import React, { useState, useRef, useCallback, useEffect } from 'react';
import { 
  FileText, Scissors, PlusSquare, Download, AlertCircle, Upload, X, 
  GripVertical, Files, FileType, Loader2, Trash2, Layout, Copy, CheckCircle2, Archive
} from 'lucide-react';
import { PDFDocument } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import { saveAs } from 'file-saver';
import JSZip from 'jszip';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import Tesseract from 'tesseract.js';
import { motion, AnimatePresence } from 'motion/react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragOverlay } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, rectSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

interface PDFPageItem { id: string; originalFile: File; originalFileName: string; originalPageIndex: number; thumbnailUrl: string; isSelected?: boolean; }

const cleanExtractedText = (rawText: string) => {
  if (!rawText) return "";
  let cleaned = rawText.replace(/[^\w\s\dàáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ.,:;?!\(\)"'/%-]/g, ' ');
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  if (cleaned.length < 2 && !/[a-zA-Z0-9à-ỹÀ-Ỹ]/.test(cleaned)) return "";
  return cleaned;
};

const PageCard = React.forwardRef<HTMLDivElement, any>(({ page, index, isOverlay, onDelete, onDuplicate, onSelect, attributes, listeners, style }, ref) => {
  return (
    <div ref={ref} style={style} onClick={() => onSelect && onSelect(page.id)} className={`relative group bg-[#0f172a] border rounded-xl overflow-hidden transition-all ${isOverlay ? 'scale-105 shadow-2xl ring-4 ring-brand/50 z-50 cursor-grabbing' : 'cursor-pointer shadow-lg'} ${page.isSelected && !isOverlay ? 'border-brand ring-2 ring-brand/50 scale-[0.98]' : 'border-[#1e293b] hover:border-brand/50'}`}>
      <div className="aspect-[3/4] relative overflow-hidden bg-black/40">
        <img src={page.thumbnailUrl} alt={`Trang ${index + 1}`} className="w-full h-full object-contain pointer-events-none bg-white" />
        {page.isSelected && !isOverlay && <div className="absolute top-2 right-2 z-10 bg-brand text-bg-dark rounded-full p-0.5 shadow-lg"><CheckCircle2 size={16} fill="currentColor" className="text-white" /></div>}
        {!isOverlay && (
          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
              <div {...attributes} {...listeners} onClick={(e) => e.stopPropagation()} className="p-2 bg-brand text-bg-dark rounded-full cursor-grab active:cursor-grabbing hover:scale-110 transition-transform touch-none" style={{ touchAction: 'none' }} title="Kéo thả"><GripVertical size={16} /></div>
              <button onClick={(e) => { e.stopPropagation(); onDuplicate(page.id); }} className="p-2 bg-blue-500 text-white rounded-full hover:bg-blue-600 transition hover:scale-110" title="Nhân bản"><Copy size={16} /></button>
              <button onClick={(e) => { e.stopPropagation(); onDelete(page.id); }} className="p-2 bg-rose-500 text-white rounded-full hover:bg-rose-600 transition hover:scale-110" title="Xóa"><Trash2 size={16} /></button>
          </div>
        )}
      </div>
      <div className="p-2 flex justify-between items-center text-[10px] bg-[#0f172a]">
        <div className="flex items-center gap-1.5"><span className="bg-brand/20 text-brand px-1.5 py-0.5 rounded font-bold">P {index + 1}</span></div>
        <span className="text-slate-500 italic truncate max-w-[60px]">{page.originalFileName}</span>
      </div>
    </div>
  );
});

function SortablePage(props: any) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.page.id });
  const style = { transform: CSS.Translate.toString(transform), transition, opacity: isDragging ? 0.3 : 1 };
  return <PageCard ref={setNodeRef} style={style} attributes={attributes} listeners={listeners} {...props} />;
}

export default function PDFProcessor() {
  const [activeTab, setActiveTab] = useState<'cut' | 'merge' | 'word'>('cut');
  const [pages, setPages] = useState<PDFPageItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processStatus, setProcessStatus] = useState<string>(''); 
  const [processProgress, setProcessProgress] = useState(0);
  const [wordFileReady, setWordFileReady] = useState<{ blob: Blob, name: string } | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [splitInterval, setSplitInterval] = useState<number>(2);
  const [forceOCR, setForceOCR] = useState<boolean>(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  const extractPagesFromFiles = async (files: File[]) => {
    setIsProcessing(true); setProcessStatus('Đang bóc tách dữ liệu trang...'); await new Promise(resolve => setTimeout(resolve, 50)); 
    const newPages: PDFPageItem[] = [];
    for (const file of files) {
      if (!file || file.type !== 'application/pdf') continue;
      try {
        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer.slice(0) });
        const pdf = await loadingTask.promise;
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 0.8 });
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          canvas.height = viewport.height; canvas.width = viewport.width;
          if (context) {
            await page.render({ canvasContext: context, viewport }).promise;
            newPages.push({ id: `p-${Date.now()}-${file.name}-${i}-${Math.random()}`, originalFile: file, originalFileName: file.name, originalPageIndex: i - 1, thumbnailUrl: canvas.toDataURL('image/jpeg', 0.8), isSelected: false });
          }
        }
      } catch (error) { console.error("Lỗi xử lý file:", file.name, error); }
    }
    setPages(prev => activeTab === 'merge' ? [...prev, ...newPages] : newPages);
    setIsProcessing(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files && e.target.files.length > 0) { extractPagesFromFiles(Array.from(e.target.files)); e.target.value = ''; } };
  const preventDefaults = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); };
  const handleDragEnter = (e: React.DragEvent) => { preventDefaults(e); setIsDraggingOver(true); };
  const handleDragLeave = (e: React.DragEvent) => { preventDefaults(e); setIsDraggingOver(false); };
  const handleDrop = (e: React.DragEvent) => { preventDefaults(e); setIsDraggingOver(false); const droppedFiles = Array.from(e.dataTransfer.files) as File[]; if (droppedFiles.length > 0) extractPagesFromFiles(droppedFiles); };

  const deletePage = (id: string) => setPages(prev => prev.filter(p => p.id !== id));
  const duplicatePage = (id: string) => { setPages(prev => { const idx = prev.findIndex(p => p.id === id); if (idx === -1) return prev; const copy = { ...prev[idx], id: `copy-${Date.now()}-${Math.random()}`, isSelected: false }; const newList = [...prev]; newList.splice(idx + 1, 0, copy); return newList; }); };
  const toggleSelectPage = (id: string) => setPages(prev => prev.map(p => p.id === id ? { ...p, isSelected: !p.isSelected } : p));
  const deleteSelected = () => setPages(prev => prev.filter(p => !p.isSelected));
  const deselectAll = () => setPages(prev => prev.map(p => ({ ...p, isSelected: false })));

  const handleDragStart = (event: any) => setActiveId(event.active.id);
  const handleDragEnd = (event: any) => { const { active, over } = event; if (over && active.id !== over.id) { setPages((items) => arrayMove(items, items.findIndex(i => i.id === active.id), items.findIndex(i => i.id === over.id))); } setActiveId(null); };

  const buildPdfFromPages = async (targetPages: PDFPageItem[]) => {
    const newPdf = await PDFDocument.create();
    const loadedPdfs = new Map<File, any>();
    for (const pageItem of targetPages) {
      let sourcePdf = loadedPdfs.get(pageItem.originalFile);
      if (!sourcePdf) {
        const arrayBuffer = await pageItem.originalFile.arrayBuffer();
        sourcePdf = await PDFDocument.load(arrayBuffer);
        loadedPdfs.set(pageItem.originalFile, sourcePdf);
      }
      const [copiedPage] = await newPdf.copyPages(sourcePdf, [pageItem.originalPageIndex]);
      newPdf.addPage(copiedPage);
    }
    return await newPdf.save();
  };

  const downloadSinglePdf = async () => {
    if (pages.length === 0) return;
    setIsProcessing(true); setProcessStatus('Đang đóng gói file PDF...');
    try {
      const pdfBytes = await buildPdfFromPages(pages);
      saveAs(new Blob([pdfBytes], { type: 'application/pdf' }), activeTab === 'cut' ? 'AIBTeM_Cut.pdf' : 'AIBTeM_Merged.pdf');
    } catch (error) { alert("Lỗi khi đóng gói PDF."); } 
    finally { setIsProcessing(false); }
  };

  const downloadSelectedPdf = async () => {
    const selectedPages = pages.filter(p => p.isSelected);
    if (selectedPages.length === 0) return;
    setIsProcessing(true); setProcessStatus('Đang đóng gói các trang được chọn...');
    try {
      const pdfBytes = await buildPdfFromPages(selectedPages);
      saveAs(new Blob([pdfBytes], { type: 'application/pdf' }), `AIBTeM_Cut_${selectedPages.length}_Trang.pdf`);
    } catch (error) { alert("Lỗi khi xuất file."); } 
    finally { setIsProcessing(false); }
  };

  const downloadIntervalSplit = async () => {
    if (pages.length === 0) return;
    setIsProcessing(true); setProcessStatus('Đang chia tách và nén file ZIP...');
    try {
      const zip = new JSZip();
      const chunkSize = Math.max(1, splitInterval);
      let fileIndex = 1;
      for (let i = 0; i < pages.length; i += chunkSize) {
        const chunk = pages.slice(i, i + chunkSize);
        const pdfBytes = await buildPdfFromPages(chunk);
        zip.file(`AIBTeM_Phan_${fileIndex}_(${chunk.length}_Trang).pdf`, pdfBytes);
        fileIndex++;
      }
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      saveAs(zipBlob, `AIBTeM_Tach_Hang_Loat.zip`);
    } catch (error) { alert("Lỗi khi nén file ZIP."); } 
    finally { setIsProcessing(false); }
  };

  const convertToWord = async (file: File) => {
    setIsProcessing(true); setProcessProgress(0); setWordFileReady(null);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const loadingTask = pdfjsLib.getDocument({ data: bytes });
      const pdf = await loadingTask.promise;
      const paragraphs: Paragraph[] = [];

      const addCleanParagraph = (text: string) => {
          const cleanedText = cleanExtractedText(text);
          if (cleanedText) paragraphs.push(new Paragraph({ children: [new TextRun({ text: cleanedText, size: 28, font: "Times New Roman" })], spacing: { after: 200 } }));
      };

      for (let i = 1; i <= pdf.numPages; i++) {
        setProcessStatus(`Đang phân tích định dạng trang ${i}/${pdf.numPages}...`);
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        let pageText = "";

        if (!forceOCR && textContent.items.length > 0) {
            let lastY = -1;
            textContent.items.forEach((item: any) => {
              if (lastY !== -1 && Math.abs(item.transform[5] - lastY) > 5) { addCleanParagraph(pageText); pageText = item.str; } 
              else { pageText += " " + item.str; }
              lastY = item.transform[5];
            });
            addCleanParagraph(pageText);
        } else {
            setProcessStatus(`Đang chạy AI OCR quét ảnh trang ${i}/${pdf.numPages}...`);
            const viewport = page.getViewport({ scale: 2.0 });
            const canvas = document.createElement('canvas'); const context = canvas.getContext('2d');
            canvas.height = viewport.height; canvas.width = viewport.width;
            if (context) {
                await page.render({ canvasContext: context, viewport }).promise;
                const imgData = canvas.toDataURL('image/jpeg', 1.0);
                const { data: { text } } = await Tesseract.recognize(imgData, 'vie', { logger: m => console.log(m) });
                const lines = text.split('\n');
                lines.forEach(line => addCleanParagraph(line));
            }
        }
        setProcessProgress(Math.round((i / pdf.numPages) * 100));
      }
      setProcessStatus('Đang đóng gói file Word...');
      const doc = new Document({ styles: { default: { document: { run: { font: "Times New Roman" } } } }, sections: [{ children: paragraphs }] });
      setWordFileReady({ blob: await Packer.toBlob(doc), name: `AIBTeM_${file.name.replace('.pdf', '.docx')}` });
    } catch (error) { console.error(error); alert("Lỗi trích xuất Word."); } finally { setIsProcessing(false); }
  };

  const activePage = activeId ? pages.find(p => p.id === activeId) : null;
  const activePageIndex = activeId ? pages.findIndex(p => p.id === activeId) : -1;
  const selectedCount = pages.filter(p => p.isSelected).length;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 w-full">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          {/* ĐỔI FONT CHỮ SANG SANS BOLD */}
          <h1 className="text-3xl font-sans font-bold text-slate-100 flex items-center gap-3">
            <FileText className="text-brand" size={32} /> Studio Xử lý PDF
          </h1>
          <p className="text-slate-500 text-sm mt-1">Trình biên tập tài liệu PDF đa năng với xem trước thời gian thực.</p>
        </div>
        {pages.length > 0 && (
            <div className="bg-brand/10 border border-brand/20 px-4 py-2 rounded-lg flex items-center gap-4">
                <div className="flex items-center gap-2">
                   <Files size={16} className="text-brand" />
                   <span className="text-xs font-bold text-brand uppercase tracking-widest">Tổng: {pages.length}</span>
                </div>
                {selectedCount > 0 && (
                  <div className="flex items-center gap-3 pl-4 border-l border-brand/20">
                     <span className="text-[10px] font-black text-emerald-400 uppercase tracking-tighter">Đã chọn: {selectedCount}</span>
                     <button onClick={deselectAll} className="text-[10px] text-slate-400 font-bold hover:text-white">BỎ CHỌN</button>
                     <button onClick={deleteSelected} className="text-[10px] text-rose-500 font-bold hover:underline">XÓA</button>
                  </div>
                )}
            </div>
        )}
      </div>

      <div className="office-card overflow-hidden bg-panel/50 border-[#1e293b]">
        <div className="flex border-b border-[#1e293b] bg-[#0f172a]/50 overflow-x-auto no-scrollbar">
          {[
            { id: 'cut', label: 'Cắt & Tách PDF', icon: Scissors },
            { id: 'merge', label: 'Ghép PDF', icon: PlusSquare },
            { id: 'word', label: 'Chuyển sang Word', icon: FileType },
          ].map((tab) => (
            <button 
              key={tab.id}
              onClick={() => { setActiveTab(tab.id as any); setPages([]); setWordFileReady(null); }}
              className={`px-8 py-5 text-xs font-bold uppercase tracking-[0.1em] flex items-center gap-3 transition-all relative shrink-0 ${
                activeTab === tab.id ? 'text-brand' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <tab.icon size={16} /> {tab.label}
              {activeTab === tab.id && <motion.div layoutId="activeTabPdf" className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand" />}
            </button>
          ))}
        </div>

        <div className="p-4 md:p-8">
          {activeTab !== 'word' && (
            <div className="space-y-8">
              <div 
                onDragOver={preventDefaults} onDragEnter={handleDragEnter} onDragLeave={handleDragLeave} onDrop={handleDrop}
                className={`flex flex-col items-center justify-center border-2 border-dashed rounded-2xl p-6 md:p-10 bg-black/20 transition-all group relative ${
                  isDraggingOver ? 'border-brand bg-brand/5 scale-[1.01]' : 'border-[#1e293b] hover:border-brand/40'
                }`}
              >
                <input type="file" multiple={activeTab === 'merge'} accept=".pdf" onChange={handleFileUpload} className="hidden" id="pdf-upload" />
                <label htmlFor="pdf-upload" className="cursor-pointer flex flex-col items-center text-center w-full h-full py-4">
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center shadow-lg transition-all mb-4 ${
                    isDraggingOver ? 'bg-brand text-bg-dark scale-110' : 'bg-[#1e293b] group-hover:scale-110 group-hover:bg-brand transition-all'
                  }`}>
                    {isDraggingOver ? <CheckCircle2 size={32} /> : <Upload className="text-brand group-hover:text-bg-dark transition-colors" size={24} />}
                  </div>
                  <h3 className="text-slate-200 font-bold mb-1">
                    {activeTab === 'cut' ? "Tải lên 1 file PDF nguồn" : "Chọn các file PDF cần ghép"}
                  </h3>
                  <p className="text-slate-500 text-xs">Kéo & Thả file vào đây hoặc nhấp để chọn tệp</p>
                </label>
              </div>

              {isProcessing && (
                  <div className="flex flex-col items-center justify-center gap-4 py-10">
                      <Loader2 size={32} className="text-brand animate-spin" />
                      <div className="flex flex-col items-center">
                         <span className="text-sm text-slate-300 font-bold italic">{processStatus}</span>
                      </div>
                  </div>
              )}

              {!isProcessing && pages.length > 0 && (
                <div className="space-y-6">
                  <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-[#1e293b]/20 p-4 rounded-xl border border-[#1e293b]">
                    <div className="flex flex-col">
                       <h3 className="text-[10px] font-black text-brand uppercase tracking-[0.2em] mb-1">Bàn làm việc trực quan</h3>
                       <p className="text-xs text-slate-500">Kéo thả để sắp xếp, nhấp vào trang để chọn.</p>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-3">
                        {activeTab === 'cut' ? (
                           <>
                             <button onClick={downloadSinglePdf} className="office-button-primary bg-slate-700 hover:bg-slate-600 border-none text-xs">
                                Lưu toàn bộ
                             </button>

                             {selectedCount > 0 && (
                               <button onClick={downloadSelectedPdf} className="office-button-primary bg-emerald-600 hover:bg-emerald-500 border-none text-xs">
                                 <Download size={14} /> Xuất {selectedCount} trang chọn
                               </button>
                             )}

                             <div className="flex items-center gap-2 bg-black/40 rounded-lg p-1.5 border border-[#1e293b]">
                               <span className="text-xs text-slate-400 pl-2">Tách mỗi:</span>
                               <input 
                                 type="number" min="1" max={pages.length} value={splitInterval} 
                                 onChange={(e) => setSplitInterval(Number(e.target.value) || 1)}
                                 className="w-12 bg-[#0f172a] border border-[#1e293b] rounded text-xs text-center py-1 text-slate-200 outline-none focus:border-brand"
                               />
                               <span className="text-xs text-slate-400">trang</span>
                               <button onClick={downloadIntervalSplit} className="office-button-secondary border-none py-1.5 text-xs bg-brand/10 text-brand">
                                  <Archive size={14} /> Tải Zip
                               </button>
                             </div>
                           </>
                        ) : (
                           <button onClick={downloadSinglePdf} className="office-button-primary text-xs">
                              <Download size={14} /> Ghép & Tải xuống
                           </button>
                        )}
                    </div>
                  </div>

                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
                    <SortableContext items={pages.map(p => p.id)} strategy={rectSortingStrategy}>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 md:gap-6 pb-20">
                        {pages.map((page, index) => (
                          <SortablePage key={page.id} page={page} index={index} onDelete={deletePage} onDuplicate={duplicatePage} onSelect={toggleSelectPage} />
                        ))}
                      </div>
                    </SortableContext>
                    <DragOverlay>
                      {activePage ? <PageCard page={activePage} index={activePageIndex} isOverlay={true} /> : null}
                    </DragOverlay>
                  </DndContext>
                </div>
              )}
            </div>
          )}

          {activeTab === 'word' && (
              <div className="max-w-xl mx-auto py-10 space-y-8">
              <div className="text-center space-y-4">
                 <div className="w-20 h-20 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto">
                    <FileType className="text-blue-500" size={40} />
                 </div>
                 <h2 className="text-xl font-bold text-slate-100">Chuyển đổi PDF sang Word (.docx)</h2>
                 <p className="text-slate-500 text-sm leading-relaxed">Bộ lọc rác thông minh (Loại bỏ ký hiệu con dấu) & Ép buộc Font Times New Roman.</p>
              </div>

              {!isProcessing && !wordFileReady && (
                   <div className="space-y-6">
                       <div className="bg-[#1e293b]/50 border border-brand/20 rounded-xl p-4 flex items-center justify-between gap-4 cursor-pointer hover:bg-[#1e293b]" onClick={() => setForceOCR(!forceOCR)}>
                          <div className="flex flex-col">
                             <span className="text-sm font-bold text-slate-200">Chế độ Nhận diện ảnh (OCR)</span>
                             <span className="text-xs text-slate-500">Bật tính năng này nếu file PDF xuất ra bị trống chữ hoặc chỉ hiện chữ Watermark.</span>
                          </div>
                          <div className={`w-12 h-6 rounded-full transition-colors flex items-center px-1 ${forceOCR ? 'bg-brand' : 'bg-slate-700'}`}>
                              <motion.div layout className="w-4 h-4 bg-white rounded-full" animate={{ x: forceOCR ? 24 : 0 }} transition={{ type: 'spring', stiffness: 500, damping: 30 }} />
                          </div>
                       </div>

                       <div 
                        onDragOver={preventDefaults} onDragEnter={handleDragEnter} onDragLeave={handleDragLeave}
                        onDrop={(e) => { preventDefaults(e); setIsDraggingOver(false); const f = e.dataTransfer.files[0]; if (f) convertToWord(f); }}
                        className={`border-2 border-dashed rounded-2xl p-12 bg-black/20 text-center transition-all ${
                          isDraggingOver ? 'border-blue-500 bg-blue-500/5' : 'border-[#1e293b] hover:border-blue-500/40'
                        }`}
                       >
                            <input type="file" accept=".pdf" className="hidden" id="word-upload" onChange={(e) => { if (e.target.files?.[0]) convertToWord(e.target.files[0]); }} />
                            <label htmlFor="word-upload" className="cursor-pointer group flex flex-col items-center">
                                <Upload className={`mb-4 transition-colors ${isDraggingOver ? 'text-blue-500' : 'text-slate-500 group-hover:text-blue-500'}`} size={32} />
                                <span className="text-sm font-semibold text-slate-400">Chọn tệp PDF nguồn</span>
                            </label>
                       </div>
                   </div>
              )}

              {isProcessing && (
                <div className="space-y-4">
                  <div className="flex justify-between text-xs font-mono text-slate-400">
                    <span className="italic">{processStatus}</span><span>{processProgress}%</span>
                  </div>
                  <div className="w-full h-2 bg-[#1e293b] rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 transition-all duration-300 shadow-[0_0_10px_rgba(59,130,246,0.5)]" style={{ width: `${processProgress}%` }} />
                  </div>
                </div>
              )}

              {wordFileReady && (
                  <div className="bg-emerald-500/10 border border-emerald-500/20 p-8 rounded-2xl flex flex-col items-center text-center gap-6">
                      <CheckCircle2 size={40} className="text-emerald-500" />
                      <div className="space-y-1">
                         <div className="text-emerald-500 font-bold px-3 py-1 bg-emerald-500/20 rounded text-[10px] uppercase tracking-widest inline-block mb-2">Chuyển đổi thành công</div>
                         <div className="text-slate-100 text-sm font-bold truncate max-w-xs">{wordFileReady.name}</div>
                      </div>
                      <button onClick={() => saveAs(wordFileReady.blob, wordFileReady.name)} className="office-button-primary bg-emerald-500 text-bg-dark hover:bg-emerald-400 w-full justify-center py-4">
                        <Download size={18} /> Tải file Word (.docx)
                      </button>
                      <button onClick={() => setWordFileReady(null)} className="text-[10px] text-slate-500 uppercase font-black hover:text-brand transition">
                         THỰC HIỆN FILE KHÁC
                      </button>
                  </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}