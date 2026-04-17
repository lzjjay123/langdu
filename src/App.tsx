import React, { useState, useRef, useEffect } from 'react';
import { 
  BookOpen, 
  Mic, 
  Square, 
  RefreshCcw, 
  Eye, 
  EyeOff, 
  Volume2, 
  Star, 
  CheckCircle2, 
  AlertCircle,
  HelpCircle,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Play,
  Languages,
  RotateCcw,
  List,
  History
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { analyzePronunciation, prepareLesson } from './lib/ai';

// --- Types ---

interface Correction {
  word: string;
  errorType: 'skipped' | 'mispronounced';
  suggestion: string;
}

interface AnalysisResult {
  rating: number;
  feedback: string;
  corrections: Correction[];
  fluency: string;
}

interface Sentence {
  english: string;
  chinese: string;
}

interface CachedLesson {
  text: string;
  sentences: Sentence[];
  timestamp: number;
}

// --- Components ---

const Header = () => (
  <header className="flex items-center justify-between p-4 sm:p-6 bg-white border-b border-orange-100 sticky top-0 z-50">
    <div className="flex items-center gap-2 sm:gap-3">
      <div className="w-8 h-8 sm:w-10 sm:h-10 bg-orange-400 rounded-xl flex items-center justify-center text-white shadow-lg shadow-orange-100 rotate-3">
        <Sparkles size={20} className="sm:size-[24px]" />
      </div>
      <div>
        <h1 className="text-lg sm:text-xl font-bold text-gray-800 tracking-tight">English Recitation Pal</h1>
        <p className="text-[10px] sm:text-xs text-orange-500 font-medium tracking-wide flex items-center gap-1">
          英语背诵小伙伴 <Sparkles size={8} className="sm:size-[10px]" />
        </p>
      </div>
    </div>
  </header>
);

export default function App() {
  const [text, setText] = useState('');
  const [sentences, setSentences] = useState<Sentence[]>([]);
  const [stage, setStage] = useState<'input' | 'learn' | 'memorize' | 'recite' | 'result'>('input');
  const [currentSentenceIdx, setCurrentSentenceIdx] = useState(0);
  const [showTranslation, setShowTranslation] = useState<boolean[]>([]);
  const [hideLevel, setHideLevel] = useState(0); 
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [cachedLessons, setCachedLessons] = useState<CachedLesson[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showSentencePicker, setShowSentencePicker] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // --- Effects ---

  useEffect(() => {
    const saved = localStorage.getItem('english_lessons');
    if (saved) {
      try {
        setCachedLessons(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse cached lessons');
      }
    }
  }, []);

  const saveLessonToCache = (newText: string, newSentences: Sentence[]) => {
    const newLesson: CachedLesson = {
      text: newText,
      sentences: newSentences,
      timestamp: Date.now()
    };
    const updated = [newLesson, ...cachedLessons.filter(l => l.text !== newText)].slice(0, 10);
    setCachedLessons(updated);
    localStorage.setItem('english_lessons', JSON.stringify(updated));
  };

  // --- Functions ---

  const handleStartLearn = async (providedText?: string) => {
    const textToUse = providedText || text;
    if (!textToUse.trim()) return;

    // Check cache
    const existing = cachedLessons.find(l => l.text === textToUse);
    if (existing) {
      setSentences(existing.sentences);
      setShowTranslation(new Array(existing.sentences.length).fill(false));
      setStage('learn');
      setCurrentSentenceIdx(0);
      setText(textToUse);
      setShowHistory(false);
      return;
    }

    setIsLoading(true);
    try {
      const data = await prepareLesson(textToUse);
      setSentences(data.sentences);
      setShowTranslation(new Array(data.sentences.length).fill(false));
      saveLessonToCache(textToUse, data.sentences);
      setStage('learn');
      setCurrentSentenceIdx(0);
      setShowHistory(false);
    } catch (err: any) {
      console.error("Preparation Error:", err);
      const errorMessage = err?.message || '未知错误';
      alert(`准备课程失败：${errorMessage}\n\n解决办法：\n1. 如果已在 Netlify 设置环境变量，请在 Deploys 菜单选择 "Clear cache and deploy site" 重新部署一遍。\n2. 确保环境变量名完全一致：DASHSCOPE_API_KEY`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNextSentence = () => {
    if (currentSentenceIdx < sentences.length - 1) {
      setCurrentSentenceIdx(currentSentenceIdx + 1);
    } else {
      setStage('memorize');
    }
  };

  const handlePrevSentence = () => {
    if (currentSentenceIdx > 0) {
      setCurrentSentenceIdx(currentSentenceIdx - 1);
    }
  };

  const speakText = (content: string, slow = false) => {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(content);
    utterance.lang = 'en-US';
    
    // Try to find a more natural voice
    const voices = window.speechSynthesis.getVoices();
    const premiumVoice = voices.find(v => v.name.includes('Google') && v.lang.startsWith('en')) || 
                        voices.find(v => v.name.includes('Premium') && v.lang.startsWith('en')) ||
                        voices.find(v => v.lang.startsWith('en'));
    
    if (premiumVoice) utterance.voice = premiumVoice;
    
    utterance.rate = slow ? 0.6 : 0.95;
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
  };

  const speakWord = (word: string) => {
    window.speechSynthesis.cancel();
    const cleanWord = word.replace(/[.,/#!$%^&*;:{}=\-_`~()]/g,"");
    const utterance = new SpeechSynthesisUtterance(cleanWord);
    utterance.lang = 'en-US';
    
    const voices = window.speechSynthesis.getVoices();
    const premiumVoice = voices.find(v => v.name.includes('Google') && v.lang.startsWith('en')) || voices.find(v => v.lang.startsWith('en'));
    if (premiumVoice) utterance.voice = premiumVoice;
    
    utterance.rate = 0.8;
    window.speechSynthesis.speak(utterance);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { 
        mimeType: 'audio/webm',
        audioBitsPerSecond: 64000 // Optimized for speech clarity vs file size
      });
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);
        analyzeAudio(audioBlob);
      };

      recorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => {
        setRecordingTime((t) => t + 1);
      }, 1000);
    } catch (err) {
      console.error(err);
      alert('无法开启麦克风，请检查权限。');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const analyzeAudio = async (blob: Blob) => {
    setIsLoading(true);
    try {
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = async () => {
        try {
          const base64data = (reader.result as string).split(',')[1];
          const reference = stage === 'learn' ? (sentences[currentSentenceIdx]?.english || '') : text;
          if (!reference) throw new Error("Reference text is missing");
          
          const result = await analyzePronunciation(reference, base64data, blob.type);
          setAnalysisResult(result);
          setStage('result');
        } catch (err) {
          console.error("Analysis inner error:", err);
          alert('分析失败，请检查网络或重试。');
        } finally {
          setIsLoading(false);
        }
      };
    } catch (err) {
      console.error("Reader error:", err);
      setIsLoading(false);
      alert('音频处理出错。');
    }
  };

  const renderEnglishWithWords = (content: string) => {
    const tokens = content.split(/(\s+)/);
    return tokens.map((token, i) => {
      if (token.trim().length === 0) return <span key={i}>{token}</span>;
      const cleanWord = token.replace(/[.,/#!$%^&*;:{}=\-_`~()]/g,"");
      return (
        <span key={i} className="group relative inline-block cursor-default">
          <span className="hover:text-blue-500 transition-colors">{token}</span>
          <button 
            onClick={(e) => { e.stopPropagation(); speakWord(cleanWord); }}
            className="absolute -top-7 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 bg-gray-800 text-white p-1 rounded-md transition-all scale-75 group-hover:scale-100 z-10"
          >
            <Volume2 size={10} />
          </button>
        </span>
      );
    });
  };

  const renderWordsHidden = (content: string) => {
    const words = content.split(/\s+/);
    return words.map((word, i) => {
      let isHidden = false;
      if (hideLevel === 1 && i % 4 === 0) isHidden = true;
      if (hideLevel === 2 && i % 2 === 0) isHidden = true;
      if (hideLevel === 3) isHidden = true;

      return (
        <span key={i} className="inline-block mr-1">
          {isHidden ? (
            <span className="bg-gray-200 text-transparent border-b-2 border-gray-400 rounded px-1 transition-all duration-300 select-none cursor-help hover:text-gray-400">
              {word}
            </span>
          ) : (
            <span className="hover:text-blue-500 cursor-default transition-colors">{word}</span>
          )}
        </span>
      );
    });
  };

  return (
    <div className="min-h-screen bg-[#FDFCF8] font-sans text-gray-800 pb-20">
      <Header />

      <main className="max-w-3xl mx-auto px-4 sm:px-8 pt-6">
        <AnimatePresence mode="wait">
          {/* STAGE: INPUT */}
          {stage === 'input' && (
            <motion.div
              key="input"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div className="bg-white rounded-3xl p-6 sm:p-8 border-2 border-orange-50 shadow-sm relative overflow-hidden">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-blue-50 text-blue-500 rounded-2xl">
                      <BookOpen size={24} />
                    </div>
                    <h2 className="text-xl sm:text-2xl font-bold text-gray-900">请老师帮我领读</h2>
                  </div>
                  {cachedLessons.length > 0 && (
                    <button 
                      onClick={() => setShowHistory(!showHistory)}
                      className={`p-3 rounded-2xl transition-all ${showHistory ? 'bg-blue-500 text-white shadow-lg' : 'bg-gray-50 text-gray-400 hover:text-blue-500'}`}
                      title="学习历史"
                    >
                      <History size={20} />
                    </button>
                  )}
                </div>

                {showHistory && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    className="mb-8 border-b border-gray-100 pb-6 space-y-3"
                  >
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest px-2">最近学习的内容</h3>
                    <div className="grid gap-2">
                       {cachedLessons.map((lesson, idx) => (
                         <button 
                          key={idx}
                          onClick={() => handleStartLearn(lesson.text)}
                          className="text-left p-4 bg-gray-50 hover:bg-blue-50 rounded-2xl border border-transparent hover:border-blue-100 transition-all group"
                         >
                           <p className="line-clamp-1 text-gray-700 font-medium group-hover:text-blue-700">{lesson.text}</p>
                           <p className="text-[10px] text-gray-400 mt-1">{new Date(lesson.timestamp).toLocaleDateString()}</p>
                         </button>
                       ))}
                    </div>
                  </motion.div>
                )}

                <textarea
                  className="w-full h-48 sm:h-56 p-6 bg-gray-50 rounded-2xl border-2 border-transparent focus:border-blue-400 focus:bg-white outline-none transition-all resize-none text-lg leading-relaxed text-gray-700 placeholder:text-gray-300"
                  placeholder="在此输入英文段落..."
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                />
                
                <div className="mt-8 flex justify-end">
                  <button
                    onClick={() => handleStartLearn()}
                    disabled={!text.trim() || isLoading}
                    className="flex items-center gap-2 px-8 py-4 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 text-white font-bold rounded-2xl shadow-lg transition-all active:scale-95 group"
                  >
                    {isLoading ? 'AI正在思考...' : '开始逐句学习'} 
                    {!isLoading && <ChevronRight size={20} className="group-hover:translate-x-1 transition-transform" />}
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {stage === 'learn' && sentences.length > 0 && (
            <motion.div
              key="learn"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4 px-1"
            >
              <div className="flex items-center justify-between mb-2">
                <button onClick={() => setStage('input')} className="flex items-center gap-1 text-gray-500 hover:text-gray-800 font-medium text-xs sm:text-sm">
                  <ChevronLeft size={14} /> 重新开始
                </button>
                <button 
                  onClick={() => setShowSentencePicker(!showSentencePicker)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] sm:text-xs font-bold transition-all ${
                    showSentencePicker ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-400'
                  }`}
                >
                  <List size={12} /> 第 {currentSentenceIdx + 1}/{sentences.length} 句
                </button>
              </div>

              {showSentencePicker && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white rounded-2xl p-3 border border-blue-50 shadow-sm flex flex-wrap gap-1.5"
                >
                  {sentences.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => { setCurrentSentenceIdx(i); setShowSentencePicker(false); }}
                      className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center font-bold text-[10px] sm:text-xs transition-all ${
                        currentSentenceIdx === i ? 'bg-blue-500 text-white' : 'bg-gray-50 text-gray-400'
                      }`}
                    >
                      {i + 1}
                    </button>
                  ))}
                </motion.div>
              )}

              <div className="bg-white rounded-[2.5rem] p-6 sm:p-10 border-2 border-blue-50 shadow-sm relative overflow-hidden">
                {/* Processing Overlay */}
                <AnimatePresence>
                  {isLoading && (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 bg-white/90 backdrop-blur-sm z-50 flex flex-col items-center justify-center gap-4 text-center p-6"
                    >
                      <div className="relative">
                        <div className="w-16 h-16 border-4 border-blue-100 border-t-blue-500 rounded-full animate-spin" />
                        <Sparkles className="absolute inset-0 m-auto text-blue-500 animate-pulse" size={24} />
                      </div>
                      <div>
                        <p className="text-lg font-bold text-gray-900">AI 老师正在批改...</p>
                        <p className="text-xs text-gray-400 mt-1">正在分析您的发音细节</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="flex flex-col gap-5 sm:gap-8">
                  <div>
                    <div className="text-2xl sm:text-3xl leading-[1.4] sm:leading-snug font-bold text-gray-900 mb-6 drop-shadow-sm">
                      {renderEnglishWithWords(sentences[currentSentenceIdx].english)}
                    </div>
                    <div className="text-orange-500 text-sm sm:text-lg font-medium pt-5 border-t border-orange-100/50 flex items-start gap-2">
                      <Languages size={16} className="mt-1 shrink-0 opacity-50" />
                      {sentences[currentSentenceIdx].chinese}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:flex sm:items-center gap-2.5 sm:gap-4 pt-4">
                    <button 
                      onClick={() => speakText(sentences[currentSentenceIdx].english)}
                      className="px-4 py-3.5 bg-blue-50 text-blue-600 rounded-2xl hover:bg-blue-100 font-bold transition-all flex items-center justify-center gap-2 text-sm sm:text-base active:scale-95"
                    >
                      <Play size={18} fill="currentColor" /> 标准朗读
                    </button>
                    <button 
                      onClick={() => speakText(sentences[currentSentenceIdx].english, true)}
                      className="px-4 py-3.5 bg-gray-50 text-gray-500 rounded-2xl hover:bg-gray-100 font-bold transition-all flex items-center justify-center gap-2 text-sm sm:text-base active:scale-95"
                    >
                      <Volume2 size={18} /> 慢速
                    </button>
                    <div className="hidden sm:block flex-1" />
                    <button
                      onClick={isRecording ? stopRecording : startRecording}
                      className={`col-span-2 sm:col-span-1 p-4 rounded-2xl transition-all shadow-xl flex items-center justify-center gap-3 active:scale-90 ${
                        isRecording ? 'bg-red-500 text-white shadow-red-200 ring-8 ring-red-50 animate-pulse' : 'bg-orange-500 text-white shadow-orange-100'
                      }`}
                    >
                      {isRecording ? <Square size={24} fill="white" /> : <Mic size={24} />}
                      <span className="font-bold sm:hidden">{isRecording ? '说完了，去批改' : '点我开始跟读'}</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center bg-white/50 backdrop-blur-md p-2 rounded-[2rem] border border-white mt-4">
                <button 
                  disabled={currentSentenceIdx === 0}
                  onClick={handlePrevSentence}
                  className="p-4 bg-white text-gray-400 rounded-2xl disabled:opacity-20 hover:bg-blue-50 hover:text-blue-500 transition-all shadow-sm"
                >
                  <ChevronLeft size={24} />
                </button>
                <div className="text-center px-4">
                  <div className="flex gap-1.5">
                    {sentences.map((_, i) => (
                      <div key={i} className={`h-1.5 rounded-full transition-all duration-300 ${i === currentSentenceIdx ? 'bg-blue-500 w-6 sm:w-8' : 'bg-gray-200 w-2 sm:w-3'}`} />
                    ))}
                  </div>
                </div>
                <button 
                  onClick={handleNextSentence}
                   className={`p-4 rounded-2xl shadow-lg transition-all active:scale-95 ${
                    currentSentenceIdx === sentences.length - 1 ? 'bg-green-500 text-white' : 'bg-blue-500 text-white shadow-blue-100'
                  }`}
                >
                  {currentSentenceIdx === sentences.length - 1 ? <CheckCircle2 size={24} /> : <ChevronRight size={24} />}
                </button>
              </div>
            </motion.div>
          )}

          {/* STAGE: MEMORIZE (Full Text) */}
          {stage === 'memorize' && (
            <motion.div key="memorize" className="space-y-6">
              <div className="flex items-center justify-between">
                <button onClick={() => setStage('learn')} className="text-sm font-medium text-gray-400 hover:text-gray-800 flex items-center gap-1">
                  <ChevronLeft size={16} /> 返回句子练习
                </button>
                <div className="px-4 py-1.5 bg-green-100 text-green-700 rounded-full text-xs font-bold uppercase tracking-wider">
                  第二阶段：全文突破
                </div>
              </div>

              <div className="bg-white rounded-3xl p-8 border-2 border-green-50 shadow-sm relative pt-16">
                 <div className="absolute top-4 right-4 flex gap-2">
                    <button onClick={() => speakText(text)} className="p-3 bg-blue-50 text-blue-500 rounded-xl"><Volume2 size={24} /></button>
                    <button onClick={() => setHideLevel((h) => (h + 1) % 4)} className={`p-3 rounded-xl transition-all ${hideLevel > 0 ? 'bg-orange-500 text-white' : 'bg-orange-50 text-orange-500'}`}>
                      {hideLevel === 0 ? <EyeOff size={24} /> : <Eye size={24} />}
                    </button>
                 </div>
                 <div className="text-2xl leading-[1.7] text-gray-800">
                   {renderWordsHidden(text)}
                 </div>
                 <div className="mt-10 pt-10 border-t border-gray-50 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-3 bg-gray-50 px-4 py-2 rounded-xl text-[10px] font-bold text-gray-400 uppercase">
                      挑战设置
                      <div className="flex gap-1">
                         {[0,1,2,3].map(l => <div key={l} className={`h-1.5 w-6 rounded-full transition-all ${hideLevel >= l ? 'bg-orange-400' : 'bg-gray-200'}`} />)}
                      </div>
                    </div>
                    <button onClick={() => setStage('recite')} className="w-full sm:w-auto px-10 py-4 bg-orange-500 text-white font-bold rounded-2xl shadow-lg transition-all active:scale-95">
                      开始最终录音
                    </button>
                 </div>
              </div>
            </motion.div>
          )}

          {/* STAGE: RECITE (Final Recording) */}
          {stage === 'recite' && (
             <motion.div key="recite" className="py-20 text-center space-y-8">
               <div className="space-y-4">
                 <h2 className="text-3xl font-extrabold text-gray-900">大声背诵吧！</h2>
                 <p className="text-gray-500">别紧张，深呼吸，像和好朋友聊天一样说出来。</p>
               </div>
               <div className="relative inline-block">
                 {isRecording && <div className="absolute -inset-10 bg-red-400 opacity-20 rounded-full animate-ping" />}
                 <button 
                  onClick={isRecording ? stopRecording : startRecording}
                  disabled={isLoading}
                  className={`relative w-48 h-48 rounded-full flex flex-col items-center justify-center transition-all ${
                    isRecording ? 'bg-red-500 text-white shadow-2xl animate-pulse' : 'bg-blue-500 text-white hover:bg-blue-600 shadow-xl'
                  }`}
                 >
                   {isRecording ? <Square size={48} /> : <Mic size={48} />}
                   <span className="mt-2 text-xs font-bold uppercase tracking-widest">{isRecording ? '停止' : '开始'}</span>
                 </button>
               </div>
               {isLoading && (
                 <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-blue-500 font-bold flex items-center justify-center gap-2">
                    <RefreshCcw size={16} className="animate-spin" /> AI老师大脑飞速运转中，请稍后...
                 </motion.p>
               )}
             </motion.div>
          )}

          {/* STAGE: RESULT */}
          {stage === 'result' && analysisResult && (
            <motion.div key="result" className="space-y-6">
               <div className="bg-white rounded-3xl p-6 sm:p-10 border-2 border-orange-100 shadow-sm">
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-6 mb-10">
                     <div className="space-y-2">
                        <h2 className="text-3xl font-bold text-gray-900">挑战总结</h2>
                        <div className="flex gap-1 text-orange-400">
                          {[1,2,3,4,5].map(s => <Star key={s} size={32} fill={s <= analysisResult.rating ? 'currentColor' : 'none'} />)}
                        </div>
                     </div>
                     <div className="px-6 py-4 bg-orange-50 rounded-2xl border border-orange-100 text-center">
                        <p className="text-[10px] text-orange-400 font-bold uppercase tracking-widest mb-1">流畅度评分</p>
                        <p className="text-lg font-bold text-orange-600">{analysisResult.fluency}</p>
                     </div>
                  </div>

                  <div className="bg-green-50 rounded-2xl p-6 border border-green-100 mb-8">
                     <h3 className="text-green-800 font-bold mb-2 flex items-center gap-2">
                        <Sparkles size={18} /> 老师评语
                     </h3>
                     <p className="text-green-700 leading-relaxed font-medium">{analysisResult.feedback}</p>
                  </div>

                  {analysisResult.corrections.length > 0 ? (
                    <div className="space-y-6">
                       <h3 className="font-bold text-gray-800 border-l-4 border-red-400 pl-4">需要注意的细节</h3>
                       <div className="grid gap-4">
                         {analysisResult.corrections.map((c, i) => (
                           <div key={i} className="flex items-start gap-4 p-5 bg-red-50/50 rounded-2xl border border-red-100">
                              <div className={`shrink-0 px-2 py-1 rounded text-[10px] font-bold uppercase ${c.errorType === 'skipped' ? 'bg-orange-200 text-orange-700' : 'bg-red-200 text-red-700'}`}>
                                {c.errorType === 'skipped' ? '漏读' : '发音'}
                              </div>
                              <div>
                                <p className="text-xl font-bold text-red-900">"{c.word}"</p>
                                <p className="text-sm text-red-700 font-medium mt-1">{c.suggestion}</p>
                              </div>
                           </div>
                         ))}
                       </div>
                    </div>
                  ) : (
                    <div className="text-center py-10 bg-blue-50 rounded-3xl border-2 border-dashed border-blue-200">
                       <CheckCircle2 size={64} className="text-blue-500 mx-auto mb-4" />
                       <p className="text-2xl font-bold text-blue-900">登峰造极！</p>
                       <p className="text-blue-700 mt-2">完全没有任何错误，你简直是个天才！</p>
                    </div>
                  )}

                  <div className="mt-12 flex flex-col sm:flex-row gap-4">
                     <button onClick={() => setStage('learn')} className="flex-1 py-4 bg-blue-500 text-white font-bold rounded-2xl hover:bg-blue-600 shadow-lg shadow-blue-100 transition-all flex items-center justify-center gap-2">
                       <Languages size={20} /> 继续练习句子
                     </button>
                     <button onClick={() => { setStage('input'); setText(''); setAnalysisResult(null); }} className="px-8 py-4 bg-gray-100 text-gray-400 font-bold rounded-2xl hover:bg-gray-200 transition-all">
                       <RotateCcw size={20} />
                     </button>
                  </div>
               </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
