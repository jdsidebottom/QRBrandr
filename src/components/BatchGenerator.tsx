import React, { useState, useRef, useCallback } from 'react';
import QRCode from 'qrcode';
import jsPDF from 'jspdf';
import { Upload, Download, FileText, Archive, Grid, Trash2, Plus, Eye, EyeOff } from 'lucide-react';

interface BatchItem {
  id: string;
  text: string;
  filename?: string;
}

interface BatchGeneratorProps {
  isDarkMode: boolean;
}

type BatchExportFormat = 'png-zip' | 'pdf-pages' | 'pdf-grid';

const BATCH_EXPORT_FORMATS = {
  'png-zip': { label: 'PNG Archive', icon: Archive, description: 'Individual PNG files in ZIP' },
  'pdf-pages': { label: 'PDF Pages', icon: FileText, description: 'One QR code per page' },
  'pdf-grid': { label: 'PDF Grid', icon: Grid, description: 'Multiple QR codes per page' },
};

const BatchGenerator: React.FC<BatchGeneratorProps> = ({ isDarkMode }) => {
  const [batchItems, setBatchItems] = useState<BatchItem[]>([
    { id: '1', text: 'https://example.com', filename: 'example-website' },
    { id: '2', text: 'mailto:contact@company.com', filename: 'contact-email' },
    { id: '3', text: 'tel:+1234567890', filename: 'phone-number' },
  ]);
  const [selectedFormat, setSelectedFormat] = useState<BatchExportFormat>('png-zip');
  const [isGenerating, setIsGenerating] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const [qrSize] = useState(200);
  const [errorCorrectionLevel] = useState<'L' | 'M' | 'Q' | 'H'>('H');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addBatchItem = () => {
    const newItem: BatchItem = {
      id: Date.now().toString(),
      text: '',
      filename: `qr-code-${batchItems.length + 1}`,
    };
    setBatchItems([...batchItems, newItem]);
  };

  const updateBatchItem = (id: string, field: keyof BatchItem, value: string) => {
    setBatchItems(items =>
      items.map(item =>
        item.id === id ? { ...item, [field]: value } : item
      )
    );
  };

  const removeBatchItem = (id: string) => {
    setBatchItems(items => items.filter(item => item.id !== id));
  };

  const handleCSVUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const csv = e.target?.result as string;
      const lines = csv.split('\n').filter(line => line.trim());
      
      // Skip header if it exists
      const dataLines = lines[0].toLowerCase().includes('text') || lines[0].toLowerCase().includes('url') 
        ? lines.slice(1) 
        : lines;
      
      const newItems: BatchItem[] = dataLines.map((line, index) => {
        const [text, filename] = line.split(',').map(s => s.trim().replace(/"/g, ''));
        return {
          id: (Date.now() + index).toString(),
          text: text || '',
          filename: filename || `qr-code-${index + 1}`,
        };
      }).filter(item => item.text);

      setBatchItems(newItems);
    };
    reader.readAsText(file);
  };

  const generateQRCodeDataURL = useCallback(async (text: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      canvas.width = qrSize;
      canvas.height = qrSize;

      QRCode.toCanvas(canvas, text, {
        width: qrSize,
        margin: 2,
        errorCorrectionLevel,
        color: {
          dark: isDarkMode ? '#ffffff' : '#000000',
          light: isDarkMode ? '#1f2937' : '#ffffff'
        }
      }).then(() => {
        resolve(canvas.toDataURL('image/png'));
      }).catch(reject);
    });
  }, [qrSize, errorCorrectionLevel, isDarkMode]);

  const downloadBatch = async () => {
    if (batchItems.length === 0 || batchItems.every(item => !item.text.trim())) return;
    
    setIsGenerating(true);
    
    try {
      const validItems = batchItems.filter(item => item.text.trim());
      
      switch (selectedFormat) {
        case 'png-zip':
          // For PNG ZIP, we'll create individual downloads since we can't create ZIP files in browser
          for (const item of validItems) {
            const dataUrl = await generateQRCodeDataURL(item.text);
            const link = document.createElement('a');
            link.download = `${item.filename || 'qr-code'}.png`;
            link.href = dataUrl;
            link.click();
            // Small delay between downloads
            await new Promise(resolve => setTimeout(resolve, 100));
          }
          break;
          
        case 'pdf-pages':
          const pdfPages = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
          });
          
          for (let i = 0; i < validItems.length; i++) {
            const item = validItems[i];
            if (i > 0) pdfPages.addPage();
            
            const dataUrl = await generateQRCodeDataURL(item.text);
            const pdfWidth = pdfPages.internal.pageSize.getWidth();
            const pdfHeight = pdfPages.internal.pageSize.getHeight();
            const qrSizeMM = Math.min(pdfWidth * 0.6, pdfHeight * 0.6);
            const xPos = (pdfWidth - qrSizeMM) / 2;
            const yPos = (pdfHeight - qrSizeMM) / 2;
            
            // Add title
            pdfPages.setFontSize(16);
            pdfPages.setTextColor(0, 0, 0);
            pdfPages.text(item.filename || `QR Code ${i + 1}`, pdfWidth / 2, 30, { align: 'center' });
            
            // Add QR code
            pdfPages.addImage(dataUrl, 'PNG', xPos, yPos, qrSizeMM, qrSizeMM);
            
            // Add content text
            pdfPages.setFontSize(10);
            pdfPages.setTextColor(100, 100, 100);
            const maxWidth = pdfWidth - 40;
            const textLines = pdfPages.splitTextToSize(item.text, maxWidth);
            pdfPages.text(textLines, pdfWidth / 2, yPos + qrSizeMM + 20, { align: 'center' });
          }
          
          pdfPages.save(`qrbrandr-batch-${Date.now()}.pdf`);
          break;
          
        case 'pdf-grid':
          const pdfGrid = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
          });
          
          const pdfWidth = pdfGrid.internal.pageSize.getWidth();
          const pdfHeight = pdfGrid.internal.pageSize.getHeight();
          const margin = 20;
          const cols = 2;
          const rows = 3;
          const cellWidth = (pdfWidth - margin * 2) / cols;
          const cellHeight = (pdfHeight - margin * 2) / rows;
          const qrSizeMM = Math.min(cellWidth * 0.7, cellHeight * 0.5);
          
          let currentPage = 0;
          
          for (let i = 0; i < validItems.length; i++) {
            const item = validItems[i];
            const pageIndex = Math.floor(i / (cols * rows));
            const cellIndex = i % (cols * rows);
            
            if (pageIndex > currentPage) {
              pdfGrid.addPage();
              currentPage = pageIndex;
            }
            
            const col = cellIndex % cols;
            const row = Math.floor(cellIndex / cols);
            const x = margin + col * cellWidth;
            const y = margin + row * cellHeight;
            
            const dataUrl = await generateQRCodeDataURL(item.text);
            
            // Center QR code in cell
            const qrX = x + (cellWidth - qrSizeMM) / 2;
            const qrY = y + 10;
            
            pdfGrid.addImage(dataUrl, 'PNG', qrX, qrY, qrSizeMM, qrSizeMM);
            
            // Add filename
            pdfGrid.setFontSize(8);
            pdfGrid.setTextColor(0, 0, 0);
            pdfGrid.text(item.filename || `QR ${i + 1}`, x + cellWidth / 2, qrY + qrSizeMM + 8, { align: 'center' });
            
            // Add truncated content
            pdfGrid.setFontSize(6);
            pdfGrid.setTextColor(100, 100, 100);
            const truncatedText = item.text.length > 30 ? item.text.substring(0, 30) + '...' : item.text;
            pdfGrid.text(truncatedText, x + cellWidth / 2, qrY + qrSizeMM + 15, { align: 'center' });
          }
          
          pdfGrid.save(`qrbrandr-grid-${Date.now()}.pdf`);
          break;
      }
    } catch (error) {
      console.error('Error generating batch QR codes:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Batch Controls */}
      <div className="glass-card rounded-2xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Batch QR Generation</h2>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="btn-secondary flex items-center gap-2"
            >
              {showPreview ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              {showPreview ? 'Hide Preview' : 'Show Preview'}
            </button>
            <button
              onClick={addBatchItem}
              className="btn-primary flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Item
            </button>
          </div>
        </div>

        {/* CSV Upload */}
        <div className="mb-6">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleCSVUpload}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="btn-secondary flex items-center gap-2"
          >
            <Upload className="w-4 h-4" />
            Import CSV File
          </button>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            CSV format: text,filename (header row optional)
          </p>
        </div>

        {/* Export Format Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Export Format
          </label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {Object.entries(BATCH_EXPORT_FORMATS).map(([key, format]) => {
              const IconComponent = format.icon;
              return (
                <button
                  key={key}
                  onClick={() => setSelectedFormat(key as BatchExportFormat)}
                  className={`flex flex-col items-center justify-center gap-2 p-4 rounded-lg border-2 transition-all duration-200 ${
                    selectedFormat === key
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                      : 'border-gray-200 dark:border-gray-600 bg-white/50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-500'
                  }`}
                >
                  <IconComponent className="w-6 h-6" />
                  <div className="text-center">
                    <div className="text-sm font-medium">{format.label}</div>
                    <div className="text-xs opacity-75">{format.description}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Generate Button */}
        <button
          onClick={downloadBatch}
          disabled={isGenerating || batchItems.every(item => !item.text.trim())}
          className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isGenerating ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              Generating Batch...
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              Generate & Download Batch
            </>
          )}
        </button>
      </div>

      {/* Batch Items */}
      <div className="glass-card rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">
          Batch Items ({batchItems.length})
        </h3>
        
        <div className="space-y-4 max-h-96 overflow-y-auto">
          {batchItems.map((item, index) => (
            <div key={item.id} className="flex items-center gap-4 p-4 bg-white/50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
              <div className="flex-shrink-0 w-8 h-8 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center">
                <span className="text-sm font-medium text-primary-600 dark:text-primary-400">
                  {index + 1}
                </span>
              </div>
              
              <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    Content
                  </label>
                  <input
                    type="text"
                    value={item.text}
                    onChange={(e) => updateBatchItem(item.id, 'text', e.target.value)}
                    placeholder="Enter text, URL, or data..."
                    className="input-field text-sm"
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    Filename
                  </label>
                  <input
                    type="text"
                    value={item.filename || ''}
                    onChange={(e) => updateBatchItem(item.id, 'filename', e.target.value)}
                    placeholder="Optional filename..."
                    className="input-field text-sm"
                  />
                </div>
              </div>
              
              <button
                onClick={() => removeBatchItem(item.id)}
                className="flex-shrink-0 p-2 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors duration-200"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
        
        {batchItems.length === 0 && (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <Grid className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No batch items yet. Add some items to get started!</p>
          </div>
        )}
      </div>

      {/* Preview Grid */}
      {showPreview && batchItems.some(item => item.text.trim()) && (
        <div className="glass-card rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Preview</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {batchItems
              .filter(item => item.text.trim())
              .slice(0, 12)
              .map((item) => (
                <div key={item.id} className="text-center">
                  <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700 mb-2">
                    <canvas
                      ref={(canvas) => {
                        if (canvas && item.text.trim()) {
                          QRCode.toCanvas(canvas, item.text, {
                            width: 120,
                            margin: 1,
                            errorCorrectionLevel,
                            color: {
                              dark: isDarkMode ? '#ffffff' : '#000000',
                              light: isDarkMode ? '#1f2937' : '#ffffff'
                            }
                          }).catch(console.error);
                        }
                      }}
                      className="w-full h-auto"
                    />
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                    {item.filename || 'Untitled'}
                  </p>
                </div>
              ))}
          </div>
          
          {batchItems.filter(item => item.text.trim()).length > 12 && (
            <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-4">
              ... and {batchItems.filter(item => item.text.trim()).length - 12} more items
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default BatchGenerator;
