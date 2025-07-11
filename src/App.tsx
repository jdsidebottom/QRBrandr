import React, { useState, useRef, useCallback, useEffect } from 'react';
import QRCode from 'qrcode';
import jsPDF from 'jspdf';
import { Download, Upload, QrCode, Settings, Image as ImageIcon, RefreshCw, Sun, Moon, Square, Circle, FileImage, FileText, File } from 'lucide-react';

interface QROptions {
  text: string;
  size: number;
  errorCorrectionLevel: 'L' | 'M' | 'Q' | 'H';
  logoSize: number;
  logoFile: File | null;
  logoShape: 'square' | 'rounded';
}

type ExportFormat = 'png' | 'svg' | 'pdf';

const ERROR_CORRECTION_LEVELS = {
  L: { label: 'Low (7%)', value: 'L' as const },
  M: { label: 'Medium (15%)', value: 'M' as const },
  Q: { label: 'Quartile (25%)', value: 'Q' as const },
  H: { label: 'High (30%)', value: 'H' as const },
};

const LOGO_SHAPES = {
  square: { label: 'Square', value: 'square' as const, icon: Square },
  rounded: { label: 'Rounded', value: 'rounded' as const, icon: Circle },
};

const EXPORT_FORMATS = {
  png: { label: 'PNG', value: 'png' as const, icon: FileImage, description: 'High-quality raster image' },
  svg: { label: 'SVG', value: 'svg' as const, icon: FileText, description: 'Scalable vector graphics' },
  pdf: { label: 'PDF', value: 'pdf' as const, icon: File, description: 'Portable document format' },
};

function App() {
  const [options, setOptions] = useState<QROptions>({
    text: 'https://example.com',
    size: 300,
    errorCorrectionLevel: 'H',
    logoSize: 20,
    logoFile: null,
    logoShape: 'rounded',
  });

  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [qrSvgString, setQrSvgString] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [autoGenerate, setAutoGenerate] = useState(true);
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('png');
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved ? saved === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Apply theme to document
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
  };

  const generateQRCode = useCallback(async () => {
    if (!options.text.trim()) return;
    
    setIsGenerating(true);
    
    try {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Set canvas size
      canvas.width = options.size;
      canvas.height = options.size;

      // Generate QR code with theme-appropriate colors
      await QRCode.toCanvas(canvas, options.text, {
        width: options.size,
        margin: 2,
        errorCorrectionLevel: options.errorCorrectionLevel,
        color: {
          dark: isDarkMode ? '#ffffff' : '#000000',
          light: isDarkMode ? '#1f2937' : '#ffffff'
        }
      });

      // Generate SVG version for vector export
      const svgString = await QRCode.toString(options.text, {
        type: 'svg',
        width: options.size,
        margin: 2,
        errorCorrectionLevel: options.errorCorrectionLevel,
        color: {
          dark: isDarkMode ? '#ffffff' : '#000000',
          light: isDarkMode ? '#1f2937' : '#ffffff'
        }
      });
      setQrSvgString(svgString);

      // Add logo if provided
      if (options.logoFile) {
        const img = new Image();
        img.onload = () => {
          const logoSizePixels = (options.size * options.logoSize) / 100;
          const x = (options.size - logoSizePixels) / 2;
          const y = (options.size - logoSizePixels) / 2;

          // Create background for logo (theme-appropriate)
          const padding = logoSizePixels * 0.1;
          ctx.fillStyle = isDarkMode ? '#1f2937' : '#ffffff';
          
          if (options.logoShape === 'rounded') {
            // Create rounded background
            const radius = (logoSizePixels + padding * 2) / 2;
            const centerX = x - padding + radius;
            const centerY = y - padding + radius;
            
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
            ctx.fill();
            
            // Clip for rounded logo
            ctx.save();
            ctx.beginPath();
            ctx.arc(x + logoSizePixels / 2, y + logoSizePixels / 2, logoSizePixels / 2, 0, 2 * Math.PI);
            ctx.clip();
            ctx.drawImage(img, x, y, logoSizePixels, logoSizePixels);
            ctx.restore();
          } else {
            // Square background and logo
            ctx.fillRect(
              x - padding,
              y - padding,
              logoSizePixels + padding * 2,
              logoSizePixels + padding * 2
            );
            ctx.drawImage(img, x, y, logoSizePixels, logoSizePixels);
          }
          
          // Update data URL
          setQrDataUrl(canvas.toDataURL('image/png'));
        };
        img.src = URL.createObjectURL(options.logoFile);
      } else {
        setQrDataUrl(canvas.toDataURL('image/png'));
      }
    } catch (error) {
      console.error('Error generating QR code:', error);
    } finally {
      setIsGenerating(false);
    }
  }, [options, isDarkMode]);

  useEffect(() => {
    if (autoGenerate) {
      generateQRCode();
    }
  }, [generateQRCode, autoGenerate]);

  const handleManualGenerate = () => {
    generateQRCode();
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      setOptions(prev => ({ ...prev, logoFile: file }));
    }
  };

  const downloadQRCode = async () => {
    if (!qrDataUrl && selectedFormat === 'png') return;
    if (!qrSvgString && selectedFormat === 'svg') return;
    
    const timestamp = Date.now();
    const baseFilename = `qrbrandr-qr-code-${timestamp}`;
    
    try {
      switch (selectedFormat) {
        case 'png':
          const pngLink = document.createElement('a');
          pngLink.download = `${baseFilename}.png`;
          pngLink.href = qrDataUrl;
          pngLink.click();
          break;
          
        case 'svg':
          let svgContent = qrSvgString;
          
          // Add logo to SVG if present
          if (options.logoFile) {
            const logoSizePercent = options.logoSize;
            const logoSize = (options.size * logoSizePercent) / 100;
            const x = (options.size - logoSize) / 2;
            const y = (options.size - logoSize) / 2;
            const padding = logoSize * 0.1;
            
            // Convert logo to base64
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();
            
            img.onload = () => {
              canvas.width = logoSize;
              canvas.height = logoSize;
              
              if (ctx) {
                ctx.drawImage(img, 0, 0, logoSize, logoSize);
                const logoDataUrl = canvas.toDataURL('image/png');
                
                // Create logo elements for SVG
                const backgroundRect = options.logoShape === 'rounded' 
                  ? `<circle cx="${x + logoSize/2}" cy="${y + logoSize/2}" r="${(logoSize + padding * 2)/2}" fill="${isDarkMode ? '#1f2937' : '#ffffff'}"/>`
                  : `<rect x="${x - padding}" y="${y - padding}" width="${logoSize + padding * 2}" height="${logoSize + padding * 2}" fill="${isDarkMode ? '#1f2937' : '#ffffff'}"/>`;
                
                const logoElement = options.logoShape === 'rounded'
                  ? `<defs><clipPath id="logoClip"><circle cx="${x + logoSize/2}" cy="${y + logoSize/2}" r="${logoSize/2}"/></clipPath></defs><image x="${x}" y="${y}" width="${logoSize}" height="${logoSize}" href="${logoDataUrl}" clip-path="url(#logoClip)"/>`
                  : `<image x="${x}" y="${y}" width="${logoSize}" height="${logoSize}" href="${logoDataUrl}"/>`;
                
                // Insert logo into SVG
                svgContent = svgContent.replace('</svg>', `${backgroundRect}${logoElement}</svg>`);
                
                const svgBlob = new Blob([svgContent], { type: 'image/svg+xml' });
                const svgUrl = URL.createObjectURL(svgBlob);
                const svgLink = document.createElement('a');
                svgLink.download = `${baseFilename}.svg`;
                svgLink.href = svgUrl;
                svgLink.click();
                URL.revokeObjectURL(svgUrl);
              }
            };
            img.src = URL.createObjectURL(options.logoFile);
          } else {
            const svgBlob = new Blob([svgContent], { type: 'image/svg+xml' });
            const svgUrl = URL.createObjectURL(svgBlob);
            const svgLink = document.createElement('a');
            svgLink.download = `${baseFilename}.svg`;
            svgLink.href = svgUrl;
            svgLink.click();
            URL.revokeObjectURL(svgUrl);
          }
          break;
          
        case 'pdf':
          const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
          });
          
          // Calculate dimensions for centering
          const pdfWidth = pdf.internal.pageSize.getWidth();
          const pdfHeight = pdf.internal.pageSize.getHeight();
          const qrSizeMM = Math.min(pdfWidth * 0.6, pdfHeight * 0.6); // 60% of page size
          const xPos = (pdfWidth - qrSizeMM) / 2;
          const yPos = (pdfHeight - qrSizeMM) / 2;
          
          // Add title
          pdf.setFontSize(20);
          pdf.setTextColor(0, 0, 0);
          pdf.text('QR Code', pdfWidth / 2, 30, { align: 'center' });
          
          // Add QR code image
          if (qrDataUrl) {
            pdf.addImage(qrDataUrl, 'PNG', xPos, yPos, qrSizeMM, qrSizeMM);
          }
          
          // Add footer with generation info
          pdf.setFontSize(10);
          pdf.setTextColor(100, 100, 100);
          pdf.text(`Generated by QRBrandr on ${new Date().toLocaleDateString()}`, pdfWidth / 2, pdfHeight - 20, { align: 'center' });
          pdf.text(`Content: ${options.text.substring(0, 50)}${options.text.length > 50 ? '...' : ''}`, pdfWidth / 2, pdfHeight - 15, { align: 'center' });
          
          pdf.save(`${baseFilename}.pdf`);
          break;
      }
    } catch (error) {
      console.error('Error downloading QR code:', error);
    }
  };

  const clearLogo = () => {
    setOptions(prev => ({ ...prev, logoFile: null }));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="min-h-screen py-8 px-4 transition-colors duration-300">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4 relative">
            <QrCode className="w-10 h-10 text-primary-600 dark:text-primary-400" />
            <h1 className="text-4xl font-bold bg-gradient-to-r from-primary-600 to-primary-800 dark:from-primary-400 dark:to-primary-600 bg-clip-text text-transparent">
              QRBrandr
            </h1>
            
            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="absolute right-0 p-2 rounded-lg bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-gray-200 dark:border-gray-700 hover:bg-white dark:hover:bg-gray-800 transition-all duration-200 shadow-md hover:shadow-lg"
              aria-label="Toggle theme"
            >
              {isDarkMode ? (
                <Sun className="w-5 h-5 text-yellow-500" />
              ) : (
                <Moon className="w-5 h-5 text-gray-600" />
              )}
            </button>
          </div>
          <p className="text-gray-600 dark:text-gray-300 text-lg max-w-2xl mx-auto">
            Create professional QR codes with embedded logos and images. Export in multiple formats for any use case.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Controls Panel */}
          <div className="space-y-6">
            <div className="glass-card rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <Settings className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100">QR Code Settings</h2>
              </div>

              {/* Text Input */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Text or URL to Encode
                </label>
                <textarea
                  value={options.text}
                  onChange={(e) => setOptions(prev => ({ ...prev, text: e.target.value }))}
                  placeholder="Enter text, URL, or any data..."
                  className="input-field resize-none h-24"
                />
              </div>

              {/* Size Control */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  QR Code Size: {options.size}px
                </label>
                <input
                  type="range"
                  min="100"
                  max="400"
                  step="10"
                  value={options.size}
                  onChange={(e) => setOptions(prev => ({ ...prev, size: parseInt(e.target.value) }))}
                  className="slider w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                  <span>100px</span>
                  <span>400px</span>
                </div>
              </div>

              {/* Error Correction Level */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Error Correction Level
                </label>
                <select
                  value={options.errorCorrectionLevel}
                  onChange={(e) => setOptions(prev => ({ 
                    ...prev, 
                    errorCorrectionLevel: e.target.value as 'L' | 'M' | 'Q' | 'H' 
                  }))}
                  className="input-field"
                >
                  {Object.entries(ERROR_CORRECTION_LEVELS).map(([key, level]) => (
                    <option key={key} value={level.value}>
                      {level.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Higher levels allow larger image overlays while maintaining scannability
                </p>
              </div>

              {/* Auto-generate Toggle */}
              <div className="mb-6">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={autoGenerate}
                    onChange={(e) => setAutoGenerate(e.target.checked)}
                    className="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500 dark:bg-gray-700"
                  />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Auto-generate on changes
                  </span>
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Uncheck to manually control when QR codes are generated
                </p>
              </div>

              {/* Generate Button */}
              <button
                onClick={handleManualGenerate}
                disabled={isGenerating || !options.text.trim()}
                className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGenerating ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Generating...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    Generate QR Code
                  </>
                )}
              </button>
            </div>

            {/* Logo Upload */}
            <div className="glass-card rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <ImageIcon className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100">Logo/Image Embedding</h2>
              </div>

              <div className="mb-4">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="btn-secondary w-full flex items-center justify-center gap-2"
                >
                  <Upload className="w-4 h-4" />
                  Upload Logo/Image
                </button>
              </div>

              {options.logoFile && (
                <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-green-700 dark:text-green-300 font-medium">
                      {options.logoFile.name}
                    </span>
                    <button
                      onClick={clearLogo}
                      className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 text-sm font-medium"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              )}

              {options.logoFile && (
                <div className="space-y-4">
                  {/* Logo Shape Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                      Logo Shape
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      {Object.entries(LOGO_SHAPES).map(([key, shape]) => {
                        const IconComponent = shape.icon;
                        return (
                          <button
                            key={key}
                            onClick={() => setOptions(prev => ({ ...prev, logoShape: shape.value }))}
                            className={`flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all duration-200 ${
                              options.logoShape === shape.value
                                ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                                : 'border-gray-200 dark:border-gray-600 bg-white/50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-500'
                            }`}
                          >
                            <IconComponent className="w-4 h-4" />
                            <span className="text-sm font-medium">{shape.label}</span>
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                      Choose between square or rounded logo appearance
                    </p>
                  </div>

                  {/* Logo Size */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Logo Size: {options.logoSize}% of QR Code
                    </label>
                    <input
                      type="range"
                      min="10"
                      max="30"
                      step="1"
                      value={options.logoSize}
                      onChange={(e) => setOptions(prev => ({ ...prev, logoSize: parseInt(e.target.value) }))}
                      className="slider w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
                    />
                    <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                      <span>10%</span>
                      <span>30%</span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Keep logo size reasonable to maintain QR code scannability
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Preview and Download */}
          <div className="space-y-6">
            <div className="glass-card rounded-2xl p-6">
              <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-4">Preview</h2>
              
              <div className="flex justify-center mb-6">
                <div className="relative">
                  {isGenerating && (
                    <div className="absolute inset-0 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-lg flex items-center justify-center z-10">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 dark:border-primary-400"></div>
                    </div>
                  )}
                  <canvas
                    ref={canvasRef}
                    className="border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg bg-white dark:bg-gray-800"
                    style={{ maxWidth: '100%', height: 'auto' }}
                  />
                </div>
              </div>

              {/* Export Format Selection */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Export Format
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {Object.entries(EXPORT_FORMATS).map(([key, format]) => {
                    const IconComponent = format.icon;
                    return (
                      <button
                        key={key}
                        onClick={() => setSelectedFormat(format.value)}
                        className={`flex flex-col items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all duration-200 ${
                          selectedFormat === format.value
                            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                            : 'border-gray-200 dark:border-gray-600 bg-white/50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-500'
                        }`}
                      >
                        <IconComponent className="w-5 h-5" />
                        <div className="text-center">
                          <div className="text-sm font-medium">{format.label}</div>
                          <div className="text-xs opacity-75">{format.description}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                onClick={downloadQRCode}
                disabled={!qrDataUrl || isGenerating}
                className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download className="w-4 h-4" />
                Download {EXPORT_FORMATS[selectedFormat].label}
              </button>
            </div>

            {/* Instructions */}
            <div className="glass-card rounded-2xl p-6">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-3">Export Formats</h3>
              <div className="space-y-3 text-sm text-gray-600 dark:text-gray-300">
                <div className="flex items-start gap-2">
                  <FileImage className="w-4 h-4 text-primary-500 dark:text-primary-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium">PNG - High-quality raster image</p>
                    <p className="text-xs opacity-75">Perfect for web use, social media, and printing</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <FileText className="w-4 h-4 text-primary-500 dark:text-primary-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium">SVG - Scalable vector graphics</p>
                    <p className="text-xs opacity-75">Infinitely scalable, ideal for logos and professional printing</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <File className="w-4 h-4 text-primary-500 dark:text-primary-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium">PDF - Portable document format</p>
                    <p className="text-xs opacity-75">Professional documents, presentations, and archival</p>
                  </div>
                </div>
              </div>
              
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <h4 className="font-medium text-gray-800 dark:text-gray-100 mb-2">Quick Tips</h4>
                <div className="space-y-2 text-xs text-gray-600 dark:text-gray-300">
                  <p>• Use PNG for general web and social media sharing</p>
                  <p>• Choose SVG for professional branding and large-scale printing</p>
                  <p>• Select PDF for formal documents and presentations</p>
                  <p>• Higher error correction levels work better with embedded logos</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
