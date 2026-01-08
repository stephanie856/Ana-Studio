
import React, { useState, useEffect, useRef } from 'react';
import { 
  ArrowDownTrayIcon, 
  HeartIcon, 
  SparklesIcon,
  PencilSquareIcon,
  PhotoIcon,
  ExclamationTriangleIcon,
  AdjustmentsHorizontalIcon
} from '@heroicons/react/24/outline';
import { 
  Sticker, 
  GenerationSettings, 
  TextOverlay, 
  StickerFormat
} from './types';
import { 
  HAIR_STYLES, 
  OUTFIT_CATEGORIES, 
  EXPRESSIONS, 
  POSES, 
  SCENES, 
  GLASSES_OPTIONS 
} from './constants';
import { generateAnaSticker, extractQuotesFromText, ExtractedQuote } from './geminiService';
import { 
  setDriveConfig,
  initializeGoogleAuth,
  handleAuthClick,
  uploadStickerToDrive,
  isAuthenticatedWithDrive
} from './driveService';

// --- Components ---

const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'ghost' }> = ({ 
  children, className, variant = 'primary', ...props 
}) => {
  const variants = {
    primary: 'bg-[#FF1493] text-white hover:bg-[#D81B60] shadow-md active:scale-95 disabled:hover:bg-[#FF1493]',
    secondary: 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 shadow-sm active:scale-95',
    danger: 'bg-red-50 text-red-600 hover:bg-red-100 active:scale-95',
    ghost: 'bg-transparent text-gray-500 hover:bg-gray-100 active:scale-95'
  };
  return (
    <button 
      className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${className}`} 
      {...props}
    >
      {children}
    </button>
  );
};

const SelectField: React.FC<{ label: string, value: string, options: string[], onChange: (val: any) => void }> = ({ label, value, options, onChange }) => (
  <div className="flex flex-col gap-1 w-full">
    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{label}</label>
    <select 
      value={value} 
      onChange={(e) => onChange(e.target.value)}
      className="bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#FF1493]/20 focus:border-[#FF1493] outline-none transition-all cursor-pointer"
    >
      {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
    </select>
  </div>
);

const StickerCanvas = React.forwardRef<HTMLCanvasElement, { 
  imageUrl?: string; 
  textOverlay: TextOverlay; 
  format: StickerFormat;
}>(({ imageUrl, textOverlay, format }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    // Determine canvas size by format
    const sizes: Record<StickerFormat, { w: number; h: number }> = {
      'Die-Cut Square': { w: 2048, h: 2048 },
      'Die-Cut Landscape': { w: 2560, h: 1440 },
      'Die-Cut Vertical': { w: 1440, h: 2560 },
      'Circular Vignette': { w: 2048, h: 2048 },
      'Classic Rectangle': { w: 2200, h: 1600 },
    };
    const { w, h } = sizes[format] || sizes['Die-Cut Square'];
    canvas.width = w;
    canvas.height = h;
    ctx.clearRect(0, 0, w, h);

    const centerX = w / 2;
    const fontFam = textOverlay.font === 'Anton' ? 'Anton, sans-serif' : 
                    textOverlay.font === 'Bebas Neue' ? '"Bebas Neue", sans-serif' :
                    textOverlay.font === 'Montserrat' ? 'Montserrat, sans-serif' : 'Inter, sans-serif';

    const lines = [textOverlay.mainText, textOverlay.subText].filter(Boolean);
    const sizesPx = [textOverlay.sizeMain, textOverlay.sizeSub];
    const colors = [textOverlay.colorMain, textOverlay.colorSub];

    // Compute start Y
    const totalHeight = sizesPx.reduce((acc, s) => acc + s, 0) + (lines.length - 1) * (textOverlay.leading * 12);
    let startY = h / 2 - totalHeight / 2;

    // Build mask canvas to create a unified offset border
    const mask = document.createElement('canvas');
    mask.width = w;
    mask.height = h;
    const mctx = mask.getContext('2d')!;
    mctx.clearRect(0, 0, w, h);
    mctx.textAlign = 'center';
    mctx.textBaseline = 'middle';
    mctx.lineJoin = 'round';

    lines.forEach((txt, idx) => {
      const y = startY + sizesPx.slice(0, idx).reduce((a, b) => a + b, 0) + (idx > 0 ? textOverlay.leading * 12 * idx : 0) + sizesPx[idx] / 2;
      mctx.font = `${idx === 0 ? '900' : '700'} ${sizesPx[idx]}px ${fontFam}`;
      // Draw solid mask glyphs using outline color
      mctx.fillStyle = textOverlay.colorOutline;
      mctx.fillText(txt.toUpperCase(), centerX, y);
    });

    // Offset border via radial copies (Cricut-style)
    if (textOverlay.backgroundStyle === 'offset-border') {
      ctx.save();
      for (let r = 1; r <= (textOverlay.offsetWidth || 20); r += 2) {
        for (let a = 0; a < Math.PI * 2; a += Math.PI / 12) {
          const dx = Math.cos(a) * r;
          const dy = Math.sin(a) * r;
          ctx.drawImage(mask, dx, dy);
        }
      }
      ctx.restore();
    } else if (textOverlay.backgroundStyle === 'speech-bubble') {
      // Rounded bubble around text bounds
      const metrics = lines.map((txt, idx) => {
        mctx.font = `${idx === 0 ? '900' : '700'} ${sizesPx[idx]}px ${fontFam}`;
        const measure = mctx.measureText(txt.toUpperCase());
        return { width: measure.width, height: sizesPx[idx] };
      });
      const bubbleWidth = Math.max(...metrics.map(m => m.width)) + (textOverlay.offsetWidth || 20) * 2;
      const bubbleHeight = totalHeight + (textOverlay.offsetWidth || 20) * 2;
      const bubbleX = centerX - bubbleWidth / 2;
      const bubbleY = h / 2 - bubbleHeight / 2;
      const radius = Math.min((textOverlay.offsetWidth || 20), 40);
      ctx.save();
      ctx.fillStyle = textOverlay.colorOutline;
      // rounded rect path
      ctx.beginPath();
      ctx.moveTo(bubbleX + radius, bubbleY);
      ctx.lineTo(bubbleX + bubbleWidth - radius, bubbleY);
      ctx.quadraticCurveTo(bubbleX + bubbleWidth, bubbleY, bubbleX + bubbleWidth, bubbleY + radius);
      ctx.lineTo(bubbleX + bubbleWidth, bubbleY + bubbleHeight - radius);
      ctx.quadraticCurveTo(bubbleX + bubbleWidth, bubbleY + bubbleHeight, bubbleX + bubbleWidth - radius, bubbleY + bubbleHeight);
      ctx.lineTo(bubbleX + radius, bubbleY + bubbleHeight);
      ctx.quadraticCurveTo(bubbleX, bubbleY + bubbleHeight, bubbleX, bubbleY + bubbleHeight - radius);
      ctx.lineTo(bubbleX, bubbleY + radius);
      ctx.quadraticCurveTo(bubbleX, bubbleY, bubbleX + radius, bubbleY);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // Draw fill text on top
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    lines.forEach((txt, idx) => {
      const y = startY + sizesPx.slice(0, idx).reduce((a, b) => a + b, 0) + (idx > 0 ? textOverlay.leading * 12 * idx : 0) + sizesPx[idx] / 2;
      ctx.font = `${idx === 0 ? '900' : '700'} ${sizesPx[idx]}px ${fontFam}`;
      if (textOverlay.hasShadow) {
        ctx.shadowColor = 'rgba(0,0,0,0.35)';
        ctx.shadowBlur = 12;
        ctx.shadowOffsetX = 4;
        ctx.shadowOffsetY = 6;
      }
      ctx.fillStyle = colors[idx] || textOverlay.colorMain;
      ctx.fillText(txt.toUpperCase(), centerX, y);
      ctx.shadowColor = 'transparent';
    });
    ctx.restore();
  }, [imageUrl, textOverlay, format]);

  useEffect(() => {
    if (typeof ref === 'function') ref(canvasRef.current!);
    else if (ref && 'current' in (ref as any)) (ref as any).current = canvasRef.current;
  }, [ref]);

  return (
    <canvas 
      ref={canvasRef} 
      className="w-full h-auto rounded-3xl shadow-[0_40px_80px_-15px_rgba(0,0,0,0.3)] max-h-[75vh] object-contain bg-transparent"
    />
  );
});

// --- Main App ---

export default function App() {
  const [activeTab, setActiveTab] = useState<'generate' | 'text' | 'history' | 'quotes'>('generate');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<Sticker[]>([]);
  const [currentSticker, setCurrentSticker] = useState<Sticker | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Quote finder state
  const [bookText, setBookText] = useState('');
  const [extractedQuotes, setExtractedQuotes] = useState<ExtractedQuote[]>([]);
  const [quotesLoading, setQuotesLoading] = useState(false);
  const [quotesError, setQuotesError] = useState<string | null>(null);
  
  const [settings, setSettings] = useState<GenerationSettings>({
    prompt: '',
    hair: 'Long Blonde Box Braids',
    outfit: '',
    outfitCategory: 'Cozy',
    expression: 'Neutral',
    pose: 'Sitting',
    scene: 'Living Room',
    glasses: 'Red Rectangular',
    format: 'Die-Cut Square',
    includeCompanion: false
  });

  const [textOverlay, setTextOverlay] = useState<TextOverlay>({
    mainText: 'DOING NOTHING',
    subText: 'IS THE PLAN',
    font: 'Montserrat',
    colorMain: '#FFFFFF',
    colorSub: '#FF6B6B',
    colorOutline: '#000000',
    sizeMain: 44,
    sizeSub: 28,
    tracking: 1,
    leading: 1.1,
    hasOutline: true,
    hasShadow: true,
    position: 'Integrated'
  });

  useEffect(() => {
    const saved = localStorage.getItem('ana_sticker_history_v5');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) setHistory(parsed);
      } catch (e) { console.error(e); }
    }
  }, []);

  useEffect(() => {
    if (history.length > 0) {
      try {
        localStorage.setItem('ana_sticker_history_v5', JSON.stringify(history.slice(0, 4)));
      } catch (e) { console.warn("Quota full"); }
    }
  }, [history]);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const imageUrl = await generateAnaSticker(settings, textOverlay);
      const newSticker: Sticker = {
        id: `sticker-${Date.now()}`,
        timestamp: Date.now(),
        imageUrl,
        finalUrl: imageUrl,
        settings: { ...settings },
        textOverlay: { ...textOverlay },
        isFavorite: false
      };
      setCurrentSticker(newSticker);
      setHistory(prev => [newSticker, ...prev]);
    } catch (err: any) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!currentSticker) return;
    const link = document.createElement('a');
    link.download = `ana-sticker-${Date.now()}.png`;
    link.href = currentSticker.imageUrl;
    link.click();
  };

  // Drive config: read from localStorage if present
  useEffect(() => {
    const apiKey = localStorage.getItem('drive_api_key');
    const clientId = localStorage.getItem('drive_client_id');
    if (apiKey && clientId) {
      setDriveConfig({ apiKey, clientId });
      initializeGoogleAuth().catch(() => {});
    }
  }, []);

  const handleSaveToDrive = async () => {
    if (!currentSticker) return;
    try {
      await initializeGoogleAuth();
      await handleAuthClick();
      const fileName = `${(currentSticker.textOverlay?.mainText || 'ana-sticker').replace(/[^a-z0-9\-]+/gi,'-').toLowerCase()}-${Date.now()}.png`;
      const file = await uploadStickerToDrive(currentSticker.imageUrl, fileName);
      if (file) {
        alert('Saved to Drive: ' + file.name);
      } else {
        alert('Failed to save to Drive.');
      }
    } catch (e: any) {
      alert('Drive error: ' + (e?.message || 'Unknown error'));
    }
  };

  const handleExtractQuotes = async () => {
    if (!bookText.trim()) {
      setQuotesError('Please paste some text first');
      return;
    }
    setQuotesLoading(true);
    setQuotesError(null);
    setExtractedQuotes([]);
    try {
      const quotes = await extractQuotesFromText(bookText);
      setExtractedQuotes(quotes);
    } catch (err: any) {
      setQuotesError(err.message || 'Failed to extract quotes');
    } finally {
      setQuotesLoading(false);
    }
  };

  const handleUseQuote = (quote: string) => {
    setTextOverlay({...textOverlay, mainText: quote, subText: ''});
    setActiveTab('text');
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#fcf9f7] text-gray-900 font-['Inter']">
      <header className="bg-white/80 backdrop-blur-md border-b border-gray-100 px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center text-white shadow-lg shadow-black/10">
            <SparklesIcon className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tighter leading-none mb-0.5">Ana Studio</h1>
            <p className="text-[9px] text-[#FF1493] font-black uppercase tracking-[0.2em]">Authentic Sticker Craft</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant={activeTab !== 'history' ? 'primary' : 'ghost'} onClick={() => setActiveTab('generate')} className="text-[10px] uppercase tracking-[0.15em] px-6 rounded-xl">Studio</Button>
          <Button variant={activeTab === 'history' ? 'primary' : 'ghost'} onClick={() => setActiveTab('history')} className="text-[10px] uppercase tracking-[0.15em] px-6 rounded-xl">History</Button>
        </div>
      </header>

      <main className="flex-1 flex flex-col md:flex-row h-[calc(100vh-73px)] overflow-hidden">
        <aside className="w-full md:w-[420px] bg-white border-r border-gray-100 overflow-y-auto p-6 flex flex-col gap-6 scrollbar-hide">
          <div className="flex bg-gray-100/60 p-1.5 rounded-2xl">
            <button onClick={() => setActiveTab('generate')} className={`flex-1 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'generate' ? 'bg-white text-black shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>Visuals</button>
            <button onClick={() => setActiveTab('text')} className={`flex-1 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'text' ? 'bg-white text-black shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>Type</button>
            <button onClick={() => setActiveTab('quotes')} className={`flex-1 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'quotes' ? 'bg-white text-black shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>Quotes</button>
            <button onClick={() => setActiveTab('history')} className={`flex-1 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'history' ? 'bg-white text-black shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>History</button>
          </div>

          {activeTab === 'generate' && (
            <div className="space-y-6 animate-in slide-in-from-left duration-300">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Additional Scene Detail</label>
                <textarea 
                  value={settings.prompt}
                  onChange={(e) => setSettings({...settings, prompt: e.target.value})}
                  placeholder="e.g. wrapped in a thick blue blanket, watching TV..."
                  className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 text-sm h-24 focus:ring-2 focus:ring-[#FF1493]/20 outline-none resize-none transition-all placeholder:text-gray-300"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <SelectField label="Hair" value={settings.hair} options={HAIR_STYLES} onChange={(v) => setSettings({...settings, hair: v})} />
                <SelectField label="Outfit" value={settings.outfitCategory} options={OUTFIT_CATEGORIES} onChange={(v) => setSettings({...settings, outfitCategory: v})} />
                <SelectField label="Vibe" value={settings.expression} options={EXPRESSIONS} onChange={(v) => setSettings({...settings, expression: v})} />
                <SelectField label="Pose" value={settings.pose} options={POSES} onChange={(v) => setSettings({...settings, pose: v})} />
                <SelectField label="Location" value={settings.scene} options={SCENES} onChange={(v) => setSettings({...settings, scene: v})} />
                <SelectField label="Glasses" value={settings.glasses} options={GLASSES_OPTIONS} onChange={(v) => setSettings({...settings, glasses: v})} />
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100 group transition-colors">
                <div className="flex gap-3 items-center">
                  <div className="w-9 h-9 bg-white rounded-xl flex items-center justify-center text-[#FF1493] shadow-sm">
                    <HeartIcon className="w-5 h-5" />
                  </div>
                  <p className="text-[10px] font-black text-gray-700 uppercase tracking-widest">Puppy Companion</p>
                </div>
                <input 
                  type="checkbox" 
                  checked={settings.includeCompanion}
                  onChange={(e) => setSettings({...settings, includeCompanion: e.target.checked})}
                  className="w-6 h-6 rounded-lg border-gray-200 text-[#FF1493] focus:ring-[#FF1493]/20 cursor-pointer accent-[#FF1493]"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Sticker Format</label>
                <div className="flex gap-2 p-1 bg-gray-50 rounded-xl border border-gray-100 flex-wrap">
                  {(['Die-Cut Square', 'Die-Cut Landscape', 'Die-Cut Vertical', 'Circular Vignette', 'Classic Rectangle'] as StickerFormat[]).map(fmt => (
                    <button
                      key={fmt}
                      onClick={() => setSettings({...settings, format: fmt})}
                      className={`flex-1 py-2 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all whitespace-nowrap ${settings.format === fmt ? 'bg-black text-white shadow-md' : 'text-gray-400 hover:bg-gray-200'}`}
                    >
                      {fmt.split(' ')[fmt.split(' ').length - 1]}
                    </button>
                  ))}
                </div>
              </div>

              <Button onClick={handleGenerate} disabled={loading} className="w-full py-5 text-sm font-black tracking-widest uppercase rounded-2xl shadow-xl shadow-[#FF1493]/10">
                {loading ? 'Crafting Artist Piece...' : 'Produce Sticker'}
              </Button>

              {error && (
                <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3">
                  <ExclamationTriangleIcon className="w-5 h-5 text-red-500 shrink-0" />
                  <p className="text-xs text-red-600 font-bold">{error}</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'text' && (
            <div className="space-y-6 animate-in slide-in-from-right duration-300">
              <div className="space-y-4 bg-gray-50 p-5 rounded-3xl border border-gray-100">
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Main Message</label>
                  <input type="text" value={textOverlay.mainText} onChange={(e) => setTextOverlay({...textOverlay, mainText: e.target.value})} className="bg-white border border-gray-100 rounded-xl p-3.5 text-sm font-black focus:ring-2 focus:ring-[#FF1493]/20 outline-none" />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Supporting Line</label>
                  <input type="text" value={textOverlay.subText} onChange={(e) => setTextOverlay({...textOverlay, subText: e.target.value})} className="bg-white border border-gray-100 rounded-xl p-3.5 text-sm font-bold focus:ring-2 focus:ring-[#FF1493]/20 outline-none" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <SelectField label="Font" value={textOverlay.font} options={['Anton', 'Montserrat', 'Bebas Neue', 'Inter']} onChange={(v) => setTextOverlay({...textOverlay, font: v})} />
                <SelectField label="Placement" value={textOverlay.position} options={['Top', 'Bottom', 'Integrated']} onChange={(v) => setTextOverlay({...textOverlay, position: v})} />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-3">
                   <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Text Color</label>
                   <div className="flex flex-wrap gap-2">
                      {['#FFFFFF', '#000000', '#FF1493', '#FF0000', '#00CED1'].map(c => (
                        <button key={c} onClick={() => setTextOverlay({...textOverlay, colorMain: c, colorSub: c})} className={`w-8 h-8 rounded-full border-2 transition-all hover:scale-110 ${textOverlay.colorMain === c ? 'border-black ring-2 ring-black/10' : 'border-transparent shadow-sm'}`} style={{backgroundColor: c}} />
                      ))}
                   </div>
                </div>
                <div className="space-y-3">
                   <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Outline Color</label>
                   <div className="flex flex-wrap gap-2">
                      {['#000000', '#FFFFFF', '#FF1493', '#666666'].map(c => (
                        <button key={c} onClick={() => setTextOverlay({...textOverlay, colorOutline: c})} className={`w-8 h-8 rounded-full border-2 transition-all hover:scale-110 ${textOverlay.colorOutline === c ? 'border-black ring-2 ring-black/10' : 'border-transparent shadow-sm'}`} style={{backgroundColor: c}} />
                      ))}
                   </div>
                </div>
              </div>

              <div className="space-y-4 p-5 bg-gray-50 rounded-3xl border border-gray-100">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Main Text Size</label>
                    <span className="text-[10px] font-black text-[#FF1493]">{textOverlay.sizeMain}px</span>
                  </div>
                  <input type="range" min="20" max="100" value={textOverlay.sizeMain} onChange={(e) => setTextOverlay({...textOverlay, sizeMain: parseInt(e.target.value)})} className="w-full accent-[#FF1493]" />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Supporting Text Size</label>
                    <span className="text-[10px] font-black text-[#FF1493]">{textOverlay.sizeSub}px</span>
                  </div>
                  <input type="range" min="15" max="80" value={textOverlay.sizeSub} onChange={(e) => setTextOverlay({...textOverlay, sizeSub: parseInt(e.target.value)})} className="w-full accent-[#FF1493]" />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Letter Spacing</label>
                    <span className="text-[10px] font-black text-[#FF1493]">{textOverlay.tracking}</span>
                  </div>
                  <input type="range" min="0" max="15" value={textOverlay.tracking} onChange={(e) => setTextOverlay({...textOverlay, tracking: parseInt(e.target.value)})} className="w-full accent-[#FF1493]" />
                </div>
              </div>

              <div className="flex gap-4">
              <div className="space-y-3">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Text Background Style</label>
                <div className="flex gap-2 flex-wrap">
                  {[
                    { value: 'offset-border', label: 'Offset Border', preset: 'Offset 20px' },
                    { value: 'speech-bubble', label: 'Speech Bubble', preset: 'Speech Bubble' },
                    { value: 'none', label: 'Bold Outlined', preset: 'Bold Outlined' }
                  ].map(style => (
                    <button
                      key={style.value}
                      onClick={() => setTextOverlay({...textOverlay, backgroundStyle: style.value as any})}
                      className={`flex-1 py-2.5 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all whitespace-nowrap ${
                        textOverlay.backgroundStyle === style.value 
                          ? 'bg-[#FF1493] text-white shadow-md' 
                          : 'bg-white border border-gray-100 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {style.preset}
                    </button>
                  ))}
                </div>
              </div>

              {textOverlay.backgroundStyle === 'offset-border' && (
                <div className="space-y-2 p-4 bg-blue-50 rounded-2xl border border-blue-100">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-black text-gray-700 uppercase tracking-widest">Offset Width</label>
                    <span className="text-[10px] font-black text-[#FF1493]">{textOverlay.offsetWidth}px</span>
                  </div>
                  <input type="range" min="15" max="30" step="5" value={textOverlay.offsetWidth} onChange={(e) => setTextOverlay({...textOverlay, offsetWidth: parseInt(e.target.value)})} className="w-full accent-[#FF1493]" />
                  <div className="flex gap-1 mt-2">
                    {[15, 20, 25, 30].map(w => (
                      <button key={w} onClick={() => setTextOverlay({...textOverlay, offsetWidth: w})} className={`flex-1 py-1.5 text-[8px] font-black rounded transition-all ${textOverlay.offsetWidth === w ? 'bg-[#FF1493] text-white' : 'bg-white border border-blue-200 text-gray-600'}`}>{w}px</button>
                    ))}
                  </div>
                </div>
              )}

              </div>

              <div className="flex gap-4">
                 <button onClick={() => setTextOverlay({...textOverlay, hasOutline: !textOverlay.hasOutline})} className={`flex-1 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest border-2 transition-all ${textOverlay.hasOutline ? 'border-black bg-black text-white shadow-xl' : 'border-gray-100 text-gray-400 hover:border-gray-200'}`}>Heavy Outline</button>
                 <button onClick={() => setTextOverlay({...textOverlay, hasShadow: !textOverlay.hasShadow})} className={`flex-1 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest border-2 transition-all ${textOverlay.hasShadow ? 'border-black bg-black text-white shadow-xl' : 'border-gray-100 text-gray-400 hover:border-gray-200'}`}>Soft Shadow</button>
              </div>

              {/* Text-only Preview */}
              <div className="space-y-3">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Text Sticker Preview</label>
                <div className="bg-white rounded-3xl border border-gray-100 p-4">
                  <StickerCanvas ref={undefined as any} textOverlay={textOverlay} format={settings.format} />
                  <div className="mt-4 flex gap-3">
                    <Button onClick={() => {
                      const canv = document.querySelector('canvas');
                      if (!canv) return;
                      const link = document.createElement('a');
                      link.download = `text-sticker-${Date.now()}.png`;
                      link.href = (canv as HTMLCanvasElement).toDataURL('image/png');
                      link.click();
                    }} className="flex-1">Download Text Sticker</Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="grid grid-cols-2 gap-4 pb-12 animate-in fade-in duration-300">
              {history.length === 0 ? (
                <div className="col-span-2 text-center py-20 text-gray-300 font-black uppercase text-[10px] tracking-widest">No Archival Data</div>
              ) : (
                history.map(s => (
                  <div key={s.id} onClick={() => { setCurrentSticker(s); setSettings(s.settings); setTextOverlay(s.textOverlay); }} className={`group relative cursor-pointer border-4 rounded-[2rem] overflow-hidden transition-all ${currentSticker?.id === s.id ? 'border-[#FF1493] scale-95' : 'border-transparent hover:border-gray-100'}`}>
                    <img src={s.imageUrl} className="w-full aspect-square object-cover" />
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'quotes' && (
            <div className="space-y-6 animate-in slide-in-from-right duration-300">
              <div className="space-y-3">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Paste Book Text</label>
                <textarea
                  value={bookText}
                  onChange={(e) => setBookText(e.target.value)}
                  placeholder="Paste a chapter or passage from your book here..."
                  className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 text-sm h-40 focus:ring-2 focus:ring-[#FF1493]/20 outline-none resize-none transition-all placeholder:text-gray-300"
                />
              </div>

              <Button
                onClick={handleExtractQuotes}
                disabled={quotesLoading || !bookText.trim()}
                className="w-full py-4 text-sm font-black tracking-widest uppercase rounded-2xl shadow-lg"
              >
                {quotesLoading ? 'Extracting Quotes...' : 'Find Sticker Quotes'}
              </Button>

              {quotesError && (
                <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3">
                  <ExclamationTriangleIcon className="w-5 h-5 text-red-500 shrink-0" />
                  <p className="text-xs text-red-600 font-bold">{quotesError}</p>
                </div>
              )}

              {extractedQuotes.length > 0 && (
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Suggested Quotes</label>
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {extractedQuotes.map((item, idx) => (
                      <div key={idx} className="p-4 bg-white border border-gray-100 rounded-2xl hover:border-[#FF1493] transition-all">
                        <p className="font-black text-sm text-gray-900 mb-2">"{item.quote}"</p>
                        <p className="text-xs text-gray-600 mb-3">{item.why}</p>
                        <button
                          onClick={() => handleUseQuote(item.quote)}
                          className="w-full py-2 bg-[#FF1493] text-white text-[9px] font-black uppercase tracking-widest rounded-lg hover:bg-[#D81B60] transition-all active:scale-95"
                        >
                          Use This Quote
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </aside>

        <section className="flex-1 p-8 md:p-16 flex flex-col items-center justify-center relative bg-[#fafafa]">
          {loading && (
            <div className="absolute inset-0 z-40 bg-white/70 backdrop-blur-md flex items-center justify-center">
              <div className="text-center space-y-6">
                <div className="relative w-24 h-24 mx-auto">
                  <div className="absolute inset-0 border-[6px] border-[#FF1493]/10 rounded-full"></div>
                  <div className="absolute inset-0 border-[6px] border-[#FF1493] rounded-full border-t-transparent animate-spin"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <SparklesIcon className="w-10 h-10 text-[#FF1493]" />
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-lg font-black tracking-tight">Painting Ana...</p>
                  <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Artist Studio Mode Active</p>
                </div>
              </div>
            </div>
          )}

          {currentSticker ? (
            <div className="w-full max-w-2xl flex flex-col items-center gap-10">
              <div className="relative group">
                <div className="absolute -inset-20 bg-gradient-to-br from-[#FF1493]/15 to-[#00CED1]/15 blur-[120px] opacity-40"></div>
                <img 
                  src={currentSticker.imageUrl} 
                  alt="Generated Ana Sticker"
                  className="w-full h-auto rounded-3xl shadow-[0_40px_80px_-15px_rgba(0,0,0,0.3)] max-h-[75vh] object-contain"
                />
              </div>
              <div className="flex flex-col gap-4 w-full max-w-lg">
                 <button onClick={() => setActiveTab('text')} className="flex items-center gap-3 px-10 py-5 bg-white border border-gray-100 rounded-[2rem] text-xs font-black text-gray-900 shadow-xl shadow-gray-200/40 active:scale-95 transition-all">
                   <PencilSquareIcon className="w-5 h-5" />
                   Edit Text & Style
                 </button>
                 <button onClick={() => setActiveTab('generate')} className="flex items-center gap-3 px-10 py-5 bg-white border border-gray-100 rounded-[2rem] text-xs font-black text-gray-900 shadow-xl shadow-gray-200/40 active:scale-95 transition-all">
                   <SparklesIcon className="w-5 h-5" />
                   Edit Character
                 </button>
                 <div className="flex gap-3">
                   <button onClick={handleDownload} className="flex-1 flex items-center justify-center gap-3 px-10 py-5 bg-[#FF1493] text-white rounded-[2rem] text-xs font-black shadow-2xl shadow-[#FF1493]/30 active:scale-95 transition-all">
                     <ArrowDownTrayIcon className="w-5 h-5" />
                     Download
                   </button>
                   <button onClick={handleSaveToDrive} className="flex-1 flex items-center justify-center gap-3 px-10 py-5 bg-blue-500 text-white rounded-[2rem] text-xs font-black shadow-2xl shadow-blue-500/30 active:scale-95 transition-all hover:bg-blue-600">
                     <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                       <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4c-1.48 0-2.85.43-4.01 1.17l1.46 1.46C10.21 5.23 11.08 5 12 5c3.04 0 5.5 2.46 5.5 5.5v.5H19c1.66 0 3 1.34 3 3 0 1.13-.64 2.11-1.56 2.62l1.45 1.45c.9-.86 1.48-2.04 1.48-3.36V12c0-.82-.15-1.6-.43-2.32zm-11.9 2.5H6.5v5h1.9v-5zm4-6h-1.9v4h1.9V6.54zM5 18h14v2H5z"/>
                     </svg>
                     Save to Drive
                   </button>
                 </div>
              </div>
            </div>
          ) : (
            <div className="text-center space-y-8">
              <div className="w-28 h-28 bg-white rounded-[2.5rem] shadow-2xl flex items-center justify-center mx-auto text-[#FF1493] ring-1 ring-gray-100">
                <SparklesIcon className="w-14 h-14" />
              </div>
              <div className="space-y-3">
                <h2 className="text-5xl font-black tracking-tighter text-gray-900 leading-tight">Authentic Ana Studio.</h2>
                <p className="text-gray-400 max-w-sm mx-auto font-medium text-lg leading-relaxed">
                  Craft painterly stickers with professional typography, exactly like your reference.
                </p>
              </div>
              <button 
                onClick={handleGenerate} 
                disabled={loading}
                className="px-14 py-5 bg-black text-white text-[11px] font-black uppercase tracking-[0.2em] rounded-[2rem] shadow-2xl hover:scale-105 active:scale-95 transition-all"
              >
                Launch Studio
              </button>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
