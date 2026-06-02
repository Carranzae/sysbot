'use client';

import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import {
  X, Save, Upload, Download, Settings, Zap, Layers, Palette, Type, Move, Trash2, Music, Film,
  Layout, Mic, Mic2, MessageSquare, Sparkles, Sliders, Grid3x3, FileVideo, Play, Undo2, Redo2,
  Scissors, Plus, RotateCcw, Minus, Maximize2, Wind, MoveRight, ChevronUp, ChevronDown, Aperture,
  Copy, Cloud, Flame, Monitor, Smartphone, Square, Lock, Box, Clock, Target, Info, Activity,
  Command, Pause, SkipBack, SkipForward, Volume2, VolumeX, FastForward, Rewind, ChevronLeft,
  ChevronRight, Video, Image, FileImage, Star, Wand2, Ratio, SplitSquareHorizontal,
  RotateCw, FlipHorizontal2, AlignCenter, PanelLeft, ZoomIn, ZoomOut, Crosshair, Clapperboard,
  BarChart2, Gauge, Cpu, HardDrive, ScreenShare, Share2, Check, AlertCircle, GripVertical,
  Eye, EyeOff, RefreshCw, Workflow, Lightbulb, Globe, BookOpen
} from 'lucide-react';

import { MultimediaTool } from './pro-editor/tools/MultimediaTool';
import { TemplatesTool } from './pro-editor/tools/TemplatesTool';
import { ElementsTool } from './pro-editor/tools/ElementsTool';
import { AudioTool } from './pro-editor/tools/AudioTool';
import { TextTool } from './pro-editor/tools/TextTool';
import { SubtitlesTool } from './pro-editor/tools/SubtitlesTool';
import { TransitionsTool } from './pro-editor/tools/TransitionsTool';
import { EffectsTool } from './pro-editor/tools/EffectsTool';
import { FiltersTool } from './pro-editor/tools/FiltersTool';
import { AdjustmentsTool } from './pro-editor/tools/AdjustmentsTool';
import { CompositionsTool } from './pro-editor/tools/CompositionsTool';
import { LayersTool } from './pro-editor/tools/LayersTool';
import { VoiceoverTool } from './pro-editor/tools/VoiceoverTool';
import { RenderHud } from './pro-editor/tools/RenderHud';
import { AudioMixerTool } from './pro-editor/tools/AudioMixerTool';
import { OverlayTool } from './pro-editor/tools/OverlayTool';
import { ShapesTool } from './pro-editor/tools/ShapesTool';
import { VersionsTool } from './pro-editor/tools/VersionsTool';
import { KeyframesTool } from './pro-editor/tools/KeyframesTool';
import { InspectorTool } from './pro-editor/tools/InspectorTool';
import { ShortcutsModal } from './pro-editor/tools/ShortcutsModal';
import { CinematicScopes } from './pro-editor/tools/CinematicScopes';

interface DraggableElement {
  id: string;
  type: 'text' | 'sticker' | 'image' | 'video' | 'blur' | 'shape';
  content: string;
  x: number;
  y: number;
  fontSize?: number;
  color?: string;
  startSec?: number;
  endSec?: number;
  isBackgroundRemoved?: boolean;
  rotation?: number;
  scale?: number;
  fontFamily?: string;
  motion?: string;
  blendMode?: string;
  opacity?: number;
  dropShadow?: string;
  outerGlow?: string;
  keyframes?: {
    [prop: string]: {
      time: number;
      value: number;
      easing?: 'linear' | 'ease-in' | 'ease-out' | 'bezier';
    }[];
  };
}

interface TimelineClip {
  id: string;
  kind?: 'video' | 'audio';
  file: File;
  url: string;
  durationSec?: number;
  startSec?: number;
  endSec?: number;
  transition?: { id: string; duration: number };
  volume?: number;
  isMuted?: boolean;
  color?: string;
}

interface ProEditorProps {
  open: boolean;
  onOpenChange: (isOpen: boolean) => void;
  mediaFile?: File | null;
  onMediaChange: (file: File | null) => void;
  businessId?: string;
}

const INITIAL_VIDEO_SETTINGS = {
  brightness: 100,
  contrast: 100,
  saturation: 100,
  temperature: 100,
  tint: 100,
  highlights: 100,
  shadows: 100,
  vignette: 0,
  dreamyGlow: 0,
  filmGrain: 0,
  filter: 'none',
  aspectRatio: '9:16',
  smartCutoutEnabled: false,
  markingAction: 'focus',
  isMaskInverted: false,
  backgroundBlur: 0,
  backgroundBrightness: 100,
  backgroundPan: 0,
  backgroundAtmosphere: 'none',
  backgroundImage: null as string | null,
  backgroundColor: 'transparent',
  scale: 100,
  chromaKeyColor: 'none',
  chromaIntensity: 50,
  lightWrapIntensity: 40,
};

const CLIP_COLORS = [
  'bg-violet-500/30 border-violet-400/50',
  'bg-sky-500/30 border-sky-400/50',
  'bg-emerald-500/30 border-emerald-400/50',
  'bg-amber-500/30 border-amber-400/50',
  'bg-rose-500/30 border-rose-400/50',
  'bg-cyan-500/30 border-cyan-400/50',
];

export default function ProEditor({ open, onOpenChange, mediaFile, onMediaChange }: ProEditorProps) {
  const [clips, setClips] = useState<TimelineClip[]>([]);
  const [elements, setElements] = useState<DraggableElement[]>([]);
  const [selectedElement, setSelectedElement] = useState<string | null>(null);
  const [selectedTimelineClipId, setSelectedTimelineClipId] = useState<string | null>(null);
  const [activeClipId, setActiveClipId] = useState<string | null>(null);
  const [playheadSec, setPlayheadSec] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(100);
  const [zoom, setZoom] = useState(2);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRendering, setIsRendering] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [videoSettings, setVideoSettings] = useState(INITIAL_VIDEO_SETTINGS);
  const [selectionPoints, setSelectionPoints] = useState<{ x: number; y: number; type: 'positive' | 'negative' }[]>([]);
  const [alignmentGuides, setAlignmentGuides] = useState<{ x: number | null; y: number | null }>({ x: null, y: null });
  const [selectedTool, setSelectedTool] = useState('multimedia');
  const [history, setHistory] = useState<any[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showScopePanel, setShowScopePanel] = useState(false);
  const [projectName, setProjectName] = useState('Sin título');
  const [isEditingProjectName, setIsEditingProjectName] = useState(false);
  const [savedStatus, setSavedStatus] = useState<'saved' | 'unsaved' | 'saving'>('saved');
  const [draggingClipId, setDraggingClipId] = useState<string | null>(null);
  const [timelineHoverSec, setTimelineHoverSec] = useState<number | null>(null);

  const canvasRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const projectNameRef = useRef<HTMLInputElement>(null);

  // ---------- History ----------
  const pushHistory = useCallback(() => {
    const state = { clips, elements, videoSettings };
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(JSON.parse(JSON.stringify(state)));
    if (newHistory.length > 50) newHistory.shift();
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    setSavedStatus('unsaved');
  }, [clips, elements, history, historyIndex, videoSettings]);

  const undo = useCallback(() => {
    if (historyIndex <= 0) return;
    const prev = history[historyIndex - 1];
    setClips(prev.clips);
    setElements(prev.elements);
    setVideoSettings(prev.videoSettings);
    setHistoryIndex(historyIndex - 1);
  }, [history, historyIndex]);

  const redo = useCallback(() => {
    if (historyIndex >= history.length - 1) return;
    const next = history[historyIndex + 1];
    setClips(next.clips);
    setElements(next.elements);
    setVideoSettings(next.videoSettings);
    setHistoryIndex(historyIndex + 1);
  }, [history, historyIndex]);

  // ---------- Timeline calc ----------
  const videoTimeline = useMemo(() => {
    let current = 0;
    return clips
      .filter(c => (c.kind || 'video') === 'video')
      .map(c => {
        const duration = (c.endSec ?? c.durationSec ?? 10) - (c.startSec ?? 0);
        const node = { clip: c, startGlobal: current, endGlobal: current + duration };
        current += duration;
        return node;
      });
  }, [clips]);

  const audioTimeline = useMemo(() => {
    return clips.filter(c => c.kind === 'audio');
  }, [clips]);

  const totalDurationSec = useMemo(() => {
    return videoTimeline.length > 0 ? videoTimeline[videoTimeline.length - 1].endGlobal : 30;
  }, [videoTimeline]);

  const activeClip = useMemo(() => {
    return clips.find(c => c.id === activeClipId) || null;
  }, [clips, activeClipId]);

  // ---------- Clips management ----------
  const addClips = useCallback(
    (files: File[]) => {
      pushHistory();
      const newClips: TimelineClip[] = files.map((f, i) => ({
        id: `clip-${Date.now()}-${i}`,
        kind: f.type.startsWith('audio') ? 'audio' : 'video',
        file: f,
        url: URL.createObjectURL(f),
        startSec: 0,
        durationSec: 10,
        volume: 100,
        isMuted: false,
        color: CLIP_COLORS[clips.length % CLIP_COLORS.length],
      }));
      setClips(prev => [...prev, ...newClips]);
      if (newClips[0].kind === 'video' && !activeClipId) {
        setActiveClipId(newClips[0].id);
      }
    },
    [activeClipId, clips.length, pushHistory],
  );

  const deleteClip = useCallback(
    (id: string) => {
      pushHistory();
      setClips(prev => prev.filter(c => c.id !== id));
      if (activeClipId === id) setActiveClipId(null);
      if (selectedTimelineClipId === id) setSelectedTimelineClipId(null);
    },
    [activeClipId, pushHistory, selectedTimelineClipId],
  );

  const splitClipAtPlayhead = useCallback(() => {
    if (!selectedTimelineClipId) return;
    const node = videoTimeline.find(n => n.clip.id === selectedTimelineClipId);
    if (!node) return;
    if (playheadSec <= node.startGlobal || playheadSec >= node.endGlobal) return;
    const localSplit = (node.clip.startSec ?? 0) + (playheadSec - node.startGlobal);
    pushHistory();
    setClips(prev =>
      prev.flatMap(c => {
        if (c.id !== selectedTimelineClipId) return [c];
        const a: TimelineClip = { ...c, id: `${c.id}-a`, endSec: localSplit };
        const b: TimelineClip = { ...c, id: `${c.id}-b`, startSec: localSplit, durationSec: (c.durationSec ?? 10) - localSplit };
        return [a, b];
      }),
    );
  }, [playheadSec, pushHistory, selectedTimelineClipId, videoTimeline]);

  // ---------- Elements ----------
  const updateElement = (id: string, updates: Partial<DraggableElement>) => {
    setElements(prev => prev.map(el => (el.id === id ? { ...el, ...updates } : el)));
    setSavedStatus('unsaved');
  };

  const addTextElement = useCallback(() => {
    pushHistory();
    const newEl: DraggableElement = {
      id: `text-${Date.now()}`,
      type: 'text',
      content: 'NUEVO TEXTO',
      x: 50,
      y: 50,
      fontSize: 48,
      color: '#ffffff',
      startSec: playheadSec,
      endSec: playheadSec + 5,
      scale: 1,
      rotation: 0,
      opacity: 100,
    };
    setElements(prev => [...prev, newEl]);
    setSelectedElement(newEl.id);
    setSelectedTool('text');
  }, [playheadSec, pushHistory]);

  const addShapeElement = useCallback(
    (type: any) => {
      pushHistory();
      const newEl: DraggableElement = {
        id: `shape-${Date.now()}`,
        type: 'shape',
        content: type,
        x: 50,
        y: 50,
        fontSize: 100,
        color: '#3b82f6',
        startSec: playheadSec,
        endSec: playheadSec + 5,
        scale: 1,
        rotation: 0,
        opacity: 100,
      };
      setElements(prev => [...prev, newEl]);
      setSelectedElement(newEl.id);
    },
    [playheadSec, pushHistory],
  );

  const duplicateElement = useCallback((id: string) => {
    const el = elements.find(e => e.id === id);
    if (!el) return;
    pushHistory();
    const copy: DraggableElement = { ...el, id: `${el.type}-${Date.now()}`, x: el.x + 3, y: el.y + 3 };
    setElements(prev => [...prev, copy]);
    setSelectedElement(copy.id);
  }, [elements, pushHistory]);

  const deleteElement = useCallback((id: string) => {
    pushHistory();
    setElements(prev => prev.filter(el => el.id !== id));
    if (selectedElement === id) setSelectedElement(null);
  }, [pushHistory, selectedElement]);

  // ---------- Playback ----------
  const togglePlay = useCallback(() => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
    }
    setIsPlaying(p => !p);
  }, [isPlaying]);

  const seekTo = useCallback((sec: number) => {
    setPlayheadSec(sec);
    if (videoRef.current) videoRef.current.currentTime = sec;
  }, []);

  const skipBack = useCallback(() => seekTo(Math.max(0, playheadSec - 5)), [playheadSec, seekTo]);
  const skipForward = useCallback(() => seekTo(Math.min(totalDurationSec, playheadSec + 5)), [playheadSec, totalDurationSec, seekTo]);
  const goToStart = useCallback(() => seekTo(0), [seekTo]);
  const goToEnd = useCallback(() => seekTo(totalDurationSec), [seekTo, totalDurationSec]);

  // ---------- Keyboard shortcuts ----------
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
      if (e.code === 'KeyJ') skipBack();
      if (e.code === 'KeyL') skipForward();
      if (e.code === 'KeyK') { e.preventDefault(); togglePlay(); }
      if ((e.metaKey || e.ctrlKey) && e.code === 'KeyZ') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
      if (e.code === 'Delete' || e.code === 'Backspace') {
        if (selectedElement) deleteElement(selectedElement);
      }
      if (e.code === 'KeyC' && (e.metaKey || e.ctrlKey) && selectedElement) duplicateElement(selectedElement);
      if (e.code === 'KeyS' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); handleSave(); }
      if (e.code === 'Equal' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); setZoom(z => Math.min(8, z + 0.5)); }
      if (e.code === 'Minus' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); setZoom(z => Math.max(0.5, z - 0.5)); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, togglePlay, skipBack, skipForward, undo, redo, selectedElement, deleteElement, duplicateElement]);

  // ---------- Drop zone ----------
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(true);
  };
  const handleDragLeave = () => setIsDraggingOver(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    const files = Array.from(e.dataTransfer.files).filter(
      f => f.type.startsWith('video/') || f.type.startsWith('audio/') || f.type.startsWith('image/'),
    );
    if (files.length) addClips(files);
  };

  // ---------- File input ----------
  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length) addClips(files);
    e.target.value = '';
  };

  // ---------- Save ----------
  const handleSave = async () => {
    setSavedStatus('saving');
    await new Promise(r => setTimeout(r, 800));
    setSavedStatus('saved');
  };

  // ---------- Format time ----------
  const formatTime = useCallback((s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const r = Math.floor(s % 60);
    const f = Math.floor((s % 1) * 30);
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}:${String(f).padStart(2, '0')}`;
    return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}:${String(f).padStart(2, '0')}`;
  }, []);

  // ---------- Timeline click ----------
  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const offsetX = e.clientX - rect.left - 160;
    if (offsetX < 0) return;
    const sec = offsetX / pxPerSec;
    seekTo(Math.max(0, Math.min(totalDurationSec, sec)));
  };

  const handleTimelineMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const offsetX = e.clientX - rect.left - 160;
    if (offsetX < 0) { setTimelineHoverSec(null); return; }
    setTimelineHoverSec(offsetX / pxPerSec);
  };

  if (!open) return null;

  const pxPerSec = 20 * zoom;
  const timelineWidthPx = totalDurationSec * pxPerSec;

  const toolGroups = [
    {
      label: 'Medios',
      items: [
        { id: 'multimedia', icon: FileVideo, label: 'Media', color: 'text-violet-400' },
        { id: 'templates', icon: Layout, label: 'Plantillas', color: 'text-blue-400' },
        { id: 'elements', icon: Grid3x3, label: 'Stickers', color: 'text-pink-400' },
        { id: 'shapes', icon: Box, label: 'Formas', color: 'text-orange-400' },
      ],
    },
    {
      label: 'Texto',
      items: [
        { id: 'text', icon: Type, label: 'Texto', color: 'text-yellow-400' },
        { id: 'subtitles', icon: MessageSquare, label: 'Subtítulos', color: 'text-cyan-400' },
      ],
    },
    {
      label: 'Visual',
      items: [
        { id: 'filters', icon: Palette, label: 'LUTs', color: 'text-purple-400' },
        { id: 'adjustments', icon: Sliders, label: 'Color', color: 'text-green-400' },
        { id: 'effects', icon: Zap, label: 'Efectos', color: 'text-amber-400' },
        { id: 'overlay', icon: Layers, label: 'Overlays', color: 'text-red-400' },
        { id: 'transitions', icon: Scissors, label: 'Trans.', color: 'text-teal-400' },
      ],
    },
    {
      label: 'Audio',
      items: [
        { id: 'audio', icon: Music, label: 'Audio', color: 'text-emerald-400' },
        { id: 'mixer', icon: BarChart2, label: 'Mixer', color: 'text-sky-400' },
        { id: 'voiceover', icon: Mic, label: 'Voz', color: 'text-rose-400' },
      ],
    },
    {
      label: 'Capas',
      items: [
        { id: 'inspector', icon: Info, label: 'Inspector', color: 'text-slate-300' },
        { id: 'anim', icon: Target, label: 'Keyframes', color: 'text-fuchsia-400' },
        { id: 'compositions', icon: Layers, label: 'Capas', color: 'text-indigo-400' },
        { id: 'versions', icon: Clock, label: 'Versiones', color: 'text-gray-400' },
      ],
    },
  ];

  const selectedToolInfo = toolGroups.flatMap(g => g.items).find(t => t.id === selectedTool);

  return (
    <div
      className="fixed inset-0 z-[1000] bg-[#050709] flex flex-col font-sans overflow-hidden text-slate-200"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Hidden file input */}
      <input ref={fileInputRef} type="file" multiple accept="video/*,audio/*,image/*" onChange={handleFileInput} className="hidden" />

      {/* ======= TOP MENU BAR ======= */}
      <div className="h-9 bg-[#0a0c10] border-b border-white/[0.06] flex items-center px-4 gap-6 shrink-0 z-[200]">
        {/* Logo */}
        <div className="flex items-center gap-2 border-r border-white/10 pr-4">
          <div className="w-5 h-5 bg-gradient-to-br from-violet-500 to-primary rounded-md flex items-center justify-center">
            <Clapperboard className="w-3 h-3 text-white" />
          </div>
          <span className="text-[10px] font-black text-white uppercase tracking-[0.2em]">CinePro</span>
        </div>

        {/* Menu items */}
        {['Archivo', 'Editar', 'Vista', 'Efecto', 'Secuencia', 'Clip', 'Ventana', 'Ayuda'].map(menu => (
          <button key={menu} className="text-[10px] font-semibold text-slate-400 hover:text-white transition-colors tracking-wide">
            {menu}
          </button>
        ))}

        {/* Project name */}
        <div className="flex-1 flex justify-center">
          {isEditingProjectName ? (
            <input
              ref={projectNameRef}
              autoFocus
              value={projectName}
              onChange={e => setProjectName(e.target.value)}
              onBlur={() => setIsEditingProjectName(false)}
              onKeyDown={e => { if (e.key === 'Enter') setIsEditingProjectName(false); }}
              className="bg-white/10 border border-white/20 rounded-md px-3 py-0.5 text-[11px] text-white text-center max-w-[200px] outline-none focus:border-primary"
            />
          ) : (
            <button
              onDoubleClick={() => setIsEditingProjectName(true)}
              className="text-[11px] text-slate-300 hover:text-white flex items-center gap-2 group"
            >
              {projectName}
              <span className="text-[8px] text-slate-600 group-hover:text-slate-400 uppercase tracking-widest">(doble clic para editar)</span>
              {savedStatus === 'saving' && <RefreshCw className="w-3 h-3 text-slate-400 animate-spin" />}
              {savedStatus === 'saved' && <Check className="w-3 h-3 text-emerald-500" />}
              {savedStatus === 'unsaved' && <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />}
            </button>
          )}
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-2 border-l border-white/10 pl-4">
          <button onClick={handleSave} className="flex items-center gap-1.5 px-3 py-1 bg-white/5 hover:bg-white/10 rounded-md text-[10px] font-bold text-slate-400 hover:text-white transition-all border border-white/5">
            <Save className="w-3 h-3" /> Guardar
          </button>
          <button
            onClick={() => setIsRendering(true)}
            className="flex items-center gap-1.5 px-4 py-1 bg-primary hover:bg-primary/80 rounded-md text-[10px] font-black text-white uppercase tracking-widest transition-all shadow-lg shadow-primary/20"
          >
            <Download className="w-3 h-3" /> Exportar
          </button>
          <button onClick={() => setShowShortcuts(true)} className="p-1.5 hover:bg-white/5 rounded-md transition-colors text-slate-500 hover:text-white">
            <Workflow className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => onOpenChange(false)} className="p-1.5 hover:bg-red-500/20 hover:text-red-400 rounded-md transition-colors text-slate-500">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ======= MAIN TOOLBAR ======= */}
      <div className="h-11 bg-[#0d1117] border-b border-white/[0.06] flex items-center px-4 gap-1 shrink-0 z-[100]">
        {/* Selection tools */}
        <div className="flex items-center gap-0.5 border-r border-white/10 pr-3 mr-2">
          {[
            { icon: Move, label: 'Selección', id: 'select' },
            { icon: Scissors, label: 'Cortar', id: 'cut' },
            { icon: Crosshair, label: 'Deslizar', id: 'slide' },
          ].map(tool => (
            <button
              key={tool.id}
              title={tool.label}
              className="p-2 rounded-lg hover:bg-white/5 text-slate-500 hover:text-white transition-all"
            >
              <tool.icon className="w-4 h-4" />
            </button>
          ))}
        </div>

        {/* Add elements */}
        <div className="flex items-center gap-0.5 border-r border-white/10 pr-3 mr-2">
          {[
            { icon: Type, label: 'Texto', action: addTextElement },
            { icon: Image, label: 'Imagen', action: () => fileInputRef.current?.click() },
            { icon: Video, label: 'Video', action: () => fileInputRef.current?.click() },
            { icon: Music, label: 'Audio', action: () => fileInputRef.current?.click() },
          ].map(item => (
            <button
              key={item.label}
              title={item.label}
              onClick={item.action}
              className="p-2 rounded-lg hover:bg-white/5 text-slate-500 hover:text-white transition-all"
            >
              <item.icon className="w-4 h-4" />
            </button>
          ))}
        </div>

        {/* Split & Clip actions */}
        <div className="flex items-center gap-0.5 border-r border-white/10 pr-3 mr-2">
          <button
            title="Dividir clip (cortar en el playhead)"
            onClick={splitClipAtPlayhead}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-[10px] font-bold text-slate-400 hover:text-white transition-all border border-white/5"
          >
            <SplitSquareHorizontal className="w-3.5 h-3.5" /> Dividir
          </button>
          <button
            title="Eliminar clip seleccionado"
            disabled={!selectedTimelineClipId}
            onClick={() => selectedTimelineClipId && deleteClip(selectedTimelineClipId)}
            className="p-2 rounded-lg hover:bg-red-500/10 text-slate-500 hover:text-red-400 disabled:opacity-30 transition-all"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        {/* Undo/Redo */}
        <div className="flex items-center gap-0.5 border-r border-white/10 pr-3 mr-2">
          <button onClick={undo} disabled={historyIndex <= 0} title="Deshacer (Ctrl+Z)" className="p-2 rounded-lg hover:bg-white/5 text-slate-500 hover:text-white disabled:opacity-30 transition-all">
            <Undo2 className="w-4 h-4" />
          </button>
          <button onClick={redo} disabled={historyIndex >= history.length - 1} title="Rehacer (Ctrl+Shift+Z)" className="p-2 rounded-lg hover:bg-white/5 text-slate-500 hover:text-white disabled:opacity-30 transition-all">
            <Redo2 className="w-4 h-4" />
          </button>
        </div>

        {/* Aspect ratio */}
        <div className="flex items-center gap-1.5 border-r border-white/10 pr-3 mr-2">
          <Ratio className="w-3.5 h-3.5 text-slate-600" />
          <select
            value={videoSettings.aspectRatio}
            onChange={e => setVideoSettings(s => ({ ...s, aspectRatio: e.target.value }))}
            className="bg-white/5 border border-white/10 rounded-lg text-[10px] font-bold text-slate-400 px-2 py-1 cursor-pointer outline-none hover:border-white/20"
          >
            <option value="9:16">9:16 Vertical</option>
            <option value="16:9">16:9 Horizontal</option>
            <option value="1:1">1:1 Cuadrado</option>
            <option value="4:5">4:5 Instagram</option>
            <option value="21:9">21:9 Cinematic</option>
          </select>
        </div>

        {/* Zoom */}
        <div className="flex items-center gap-2 border-r border-white/10 pr-3 mr-2">
          <button onClick={() => setZoom(z => Math.max(0.5, z - 0.5))} className="p-1.5 rounded-md hover:bg-white/5 text-slate-500 hover:text-white transition-all">
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-[10px] font-mono text-slate-500 w-10 text-center">{(zoom * 50).toFixed(0)}%</span>
          <button onClick={() => setZoom(z => Math.min(8, z + 0.5))} className="p-1.5 rounded-md hover:bg-white/5 text-slate-500 hover:text-white transition-all">
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Scopes toggle */}
        <button
          onClick={() => setShowScopePanel(s => !s)}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all ${showScopePanel ? 'bg-primary/20 text-primary border border-primary/30' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}
        >
          <Gauge className="w-3.5 h-3.5" /> Scopes
        </button>

        <div className="flex-1" />

        {/* System stats */}
        <div className="flex items-center gap-4 text-[9px] font-mono text-slate-600">
          <div className="flex items-center gap-1"><Cpu className="w-3 h-3" /> GPU 34%</div>
          <div className="flex items-center gap-1"><HardDrive className="w-3 h-3" /> 4.2/8 GB</div>
          <div className="flex items-center gap-1">
            <div className={`w-1.5 h-1.5 rounded-full ${isPlaying ? 'bg-red-500 animate-pulse' : 'bg-slate-600'}`} />
            {isPlaying ? 'REC' : 'PARADO'}
          </div>
        </div>
      </div>

      {/* ======= CONTENT AREA ======= */}
      <div className="flex-1 flex min-h-0">

        {/* ===== LEFT SIDEBAR ===== */}
        {!sidebarCollapsed && (
          <aside className="w-72 bg-[#0d1117] border-r border-white/[0.06] flex flex-col shrink-0 z-50 overflow-hidden">
            {/* Tool tabs */}
            <div className="w-full flex flex-col overflow-y-auto no-scrollbar">
              {toolGroups.map(group => (
                <div key={group.label}>
                  <div className="px-3 pt-3 pb-1">
                    <span className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-700">{group.label}</span>
                  </div>
                  <div className="px-2 pb-1 grid grid-cols-4 gap-0.5">
                    {group.items.map(tool => (
                      <button
                        key={tool.id}
                        onClick={() => setSelectedTool(tool.id)}
                        className={`flex flex-col items-center justify-center py-2.5 rounded-xl transition-all gap-1 ${selectedTool === tool.id ? 'bg-white/10 shadow-inner' : 'hover:bg-white/5'}`}
                        title={tool.label}
                      >
                        <tool.icon className={`w-4 h-4 transition-colors ${selectedTool === tool.id ? tool.color : 'text-slate-600 group-hover:text-slate-400'}`} />
                        <span className={`text-[7px] font-bold uppercase tracking-wider truncate w-full text-center ${selectedTool === tool.id ? 'text-white' : 'text-slate-600'}`}>{tool.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Divider */}
            <div className="h-px bg-white/5 mx-3 my-2" />

            {/* Tool content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
              {selectedToolInfo && (
                <div className="flex items-center gap-2 mb-4 pb-3 border-b border-white/5">
                  <selectedToolInfo.icon className={`w-4 h-4 ${selectedToolInfo.color}`} />
                  <span className="text-[11px] font-black uppercase tracking-widest text-white">{selectedToolInfo.label}</span>
                </div>
              )}
              {selectedTool === 'multimedia' && <MultimediaTool onUploadClick={() => fileInputRef.current?.click()} onAudioUploadClick={() => fileInputRef.current?.click()} setVideoSettings={setVideoSettings} onSmartSplit={() => { }} hasActiveClip={!!activeClipId} />}
              {selectedTool === 'templates' && <TemplatesTool onApplyStyle={setVideoSettings} />}
              {selectedTool === 'elements' && <ElementsTool onAddElement={() => { }} activeElement={null} onUpdateElement={updateElement} />}
              {selectedTool === 'shapes' && <ShapesTool onAddShape={addShapeElement} />}
              {selectedTool === 'text' && <TextTool onAddText={addTextElement} activeElement={elements.find(el => el.id === selectedElement) || null} onUpdateElement={updateElement} />}
              {selectedTool === 'inspector' && <InspectorTool element={elements.find(el => el.id === selectedElement)} onUpdate={(id, up) => updateElement(id, up)} />}
              {selectedTool === 'anim' && <KeyframesTool selectedElementId={selectedElement} playheadSec={playheadSec} elements={elements} onAddKeyframe={() => { }} />}
              {selectedTool === 'audio' && <AudioTool onAddAudio={() => { }} settings={videoSettings} setSettings={setVideoSettings} />}
              {selectedTool === 'mixer' && <AudioMixerTool />}
              {selectedTool === 'voiceover' && <VoiceoverTool onAddAudio={() => { }} />}
              {selectedTool === 'subtitles' && <SubtitlesTool />}
              {selectedTool === 'transitions' && <TransitionsTool activeClipId={activeClipId} onApplyTransition={() => { }} />}
              {selectedTool === 'effects' && <EffectsTool settings={videoSettings} setSettings={setVideoSettings} />}
              {selectedTool === 'filters' && <FiltersTool settings={videoSettings} setSettings={setVideoSettings} />}
              {selectedTool === 'adjustments' && <AdjustmentsTool settings={videoSettings} setSettings={setVideoSettings} onReset={() => setVideoSettings(INITIAL_VIDEO_SETTINGS)} />}
              {selectedTool === 'overlay' && <OverlayTool settings={videoSettings} setSettings={setVideoSettings} />}
              {selectedTool === 'compositions' && <LayersTool elements={elements} setElements={setElements} selectedElement={selectedElement} setSelectedElement={setSelectedElement} />}
              {selectedTool === 'versions' && <VersionsTool />}
            </div>
          </aside>
        )}

        {/* Sidebar collapse button */}
        <button
          onClick={() => setSidebarCollapsed(s => !s)}
          className="absolute left-0 top-1/3 z-[300] translate-y-[-50%] w-4 h-10 bg-[#0d1117] border border-white/10 border-l-0 rounded-r-lg flex items-center justify-center text-slate-600 hover:text-white hover:bg-white/10 transition-all"
          style={{ left: sidebarCollapsed ? 0 : '18rem' }}
        >
          {sidebarCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
        </button>

        {/* ===== CENTER: CANVAS ===== */}
        <main className="flex-1 flex flex-col min-w-0 relative">

          {/* Canvas viewport */}
          <div
            className={`flex-1 relative flex items-center justify-center bg-[#040508] overflow-hidden transition-all ${isDraggingOver ? 'ring-2 ring-primary ring-inset' : ''}`}
          >
            {/* Drag overlay hint */}
            {isDraggingOver && (
              <div className="absolute inset-0 z-50 flex items-center justify-center bg-primary/10 backdrop-blur-sm border-2 border-dashed border-primary/60 rounded-none">
                <div className="text-center">
                  <Upload className="w-12 h-12 text-primary mx-auto mb-3 animate-bounce" />
                  <p className="text-white font-black uppercase tracking-widest text-sm">Suelta aquí para importar</p>
                  <p className="text-slate-400 text-xs mt-1">Video, Audio, Imágenes</p>
                </div>
              </div>
            )}

            {/* Canvas */}
            <div
              ref={canvasRef}
              className="relative shadow-[0_0_120px_rgba(0,0,0,0.95)] bg-black group/preview"
              style={{
                aspectRatio: videoSettings.aspectRatio.replace(':', '/'),
                height: 'min(75vh, 100%)',
                maxWidth: '90%',
              }}
              onClick={() => setSelectedElement(null)}
            >
              {/* Video layer */}
              {activeClip ? (
                <video
                  src={activeClip.url}
                  className="w-full h-full object-contain pointer-events-none"
                  ref={videoRef}
                  muted={isMuted}
                  onTimeUpdate={e => {
                    if (!isPlaying) return;
                    const v = e.currentTarget;
                    const node = videoTimeline.find(n => n.clip.id === activeClipId);
                    if (node) {
                      const localStart = activeClip.startSec || 0;
                      setPlayheadSec(node.startGlobal + (v.currentTime - localStart));
                    }
                  }}
                  onEnded={() => setIsPlaying(false)}
                />
              ) : (
                /* Empty state */
                <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-[#0a0c12] to-black">
                  <div className="border-2 border-dashed border-white/10 rounded-3xl p-12 flex flex-col items-center gap-4 max-w-xs text-center">
                    <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                      <Upload className="w-8 h-8 text-primary" />
                    </div>
                    <div>
                      <p className="text-white font-black text-sm uppercase tracking-widest mb-1">Importar media</p>
                      <p className="text-slate-600 text-[10px]">Arrastra archivos aquí o usa el panel de Media</p>
                    </div>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="px-6 py-2.5 bg-primary/20 border border-primary/40 rounded-xl text-primary text-[11px] font-black uppercase tracking-widest hover:bg-primary/30 transition-all"
                    >
                      Seleccionar archivos
                    </button>
                  </div>
                </div>
              )}

              {/* Elements rendering */}
              {elements
                .filter(el => {
                  const s = el.startSec ?? 0;
                  const e = el.endSec ?? Infinity;
                  return playheadSec >= s && playheadSec <= e;
                })
                .map(el => (
                  <div
                    key={el.id}
                    onClick={e => { e.stopPropagation(); setSelectedElement(el.id); }}
                    onDoubleClick={e => { e.stopPropagation(); if (el.type === 'text') setSelectedTool('text'); }}
                    className={`absolute border-2 transition-all cursor-move select-none ${selectedElement === el.id ? 'border-primary ring-2 ring-primary/20' : 'border-transparent hover:border-white/20'}`}
                    style={{
                      left: `${el.x}%`,
                      top: `${el.y}%`,
                      transform: `translate(-50%, -50%) rotate(${el.rotation || 0}deg) scale(${el.scale || 1})`,
                      color: el.color,
                      fontSize: el.fontSize,
                      opacity: (el.opacity || 100) / 100,
                      mixBlendMode: el.blendMode as any,
                      filter: [
                        el.dropShadow ? `drop-shadow(0 15px 30px ${el.dropShadow})` : '',
                        el.outerGlow ? `drop-shadow(0 0 15px ${el.outerGlow})` : '',
                      ]
                        .filter(Boolean)
                        .join(' '),
                    }}
                  >
                    {el.type === 'text' && (
                      <div className="font-black whitespace-pre px-2">{el.content}</div>
                    )}
                    {el.type === 'shape' && (
                      <div
                        className="w-20 h-20"
                        style={{
                          backgroundColor: el.color,
                          clipPath: el.content === 'circle' ? 'circle(50% at 50% 50%)' : 'none',
                          borderRadius: el.content === 'rounded' ? '12px' : '0',
                        }}
                      />
                    )}

                    {/* Element handles when selected */}
                    {selectedElement === el.id && (
                      <div className="absolute -top-8 left-1/2 -translate-x-1/2 flex gap-1">
                        <button
                          onClick={e => { e.stopPropagation(); duplicateElement(el.id); }}
                          className="w-6 h-6 bg-slate-800 border border-white/20 rounded-md flex items-center justify-center hover:bg-white/20 transition-all"
                        >
                          <Copy className="w-3 h-3 text-white" />
                        </button>
                        <button
                          onClick={e => { e.stopPropagation(); deleteElement(el.id); }}
                          className="w-6 h-6 bg-red-800/80 border border-red-500/40 rounded-md flex items-center justify-center hover:bg-red-600 transition-all"
                        >
                          <Trash2 className="w-3 h-3 text-white" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}

              {/* Alignment guides */}
              {alignmentGuides.x !== null && (
                <div
                  className="absolute top-0 bottom-0 w-px bg-primary/50 pointer-events-none"
                  style={{ left: `${alignmentGuides.x}%` }}
                />
              )}
              {alignmentGuides.y !== null && (
                <div
                  className="absolute left-0 right-0 h-px bg-primary/50 pointer-events-none"
                  style={{ top: `${alignmentGuides.y}%` }}
                />
              )}
            </div>

            {/* Scopes panel */}
            {showScopePanel && <CinematicScopes isPlaying={isPlaying} />}

            {/* ===== PLAYBACK CONTROLS ===== */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50">
              <div className="bg-black/90 backdrop-blur-2xl px-6 py-3 rounded-2xl border border-white/10 flex items-center gap-4 shadow-2xl">
                {/* Time display */}
                <div className="font-mono text-[11px] text-white/60 w-28">
                  <span className="text-white">{formatTime(playheadSec)}</span>
                  <span className="text-slate-600"> / {formatTime(totalDurationSec)}</span>
                </div>

                {/* Playback buttons */}
                <div className="flex items-center gap-1">
                  <button onClick={goToStart} title="Inicio" className="p-1.5 hover:bg-white/10 rounded-lg transition-all text-slate-400 hover:text-white">
                    <SkipBack className="w-4 h-4" />
                  </button>
                  <button onClick={skipBack} title="−5s (J)" className="p-1.5 hover:bg-white/10 rounded-lg transition-all text-slate-400 hover:text-white">
                    <Rewind className="w-4 h-4" />
                  </button>
                  <button
                    onClick={togglePlay}
                    className="w-10 h-10 bg-primary hover:bg-primary/80 rounded-full flex items-center justify-center transition-all hover:scale-105 active:scale-95 shadow-lg shadow-primary/25"
                  >
                    {isPlaying ? (
                      <div className="flex gap-1">
                        <div className="w-1 h-4 bg-white rounded-full" />
                        <div className="w-1 h-4 bg-white rounded-full" />
                      </div>
                    ) : (
                      <Play className="w-5 h-5 text-white fill-white ml-0.5" />
                    )}
                  </button>
                  <button onClick={skipForward} title="+5s (L)" className="p-1.5 hover:bg-white/10 rounded-lg transition-all text-slate-400 hover:text-white">
                    <FastForward className="w-4 h-4" />
                  </button>
                  <button onClick={goToEnd} title="Final" className="p-1.5 hover:bg-white/10 rounded-lg transition-all text-slate-400 hover:text-white">
                    <SkipForward className="w-4 h-4" />
                  </button>
                </div>

                {/* Speed */}
                <div className="flex items-center gap-1 border-l border-white/10 pl-3">
                  {[0.5, 1, 1.5, 2].map(rate => (
                    <button
                      key={rate}
                      onClick={() => { setPlaybackRate(rate); if (videoRef.current) videoRef.current.playbackRate = rate; }}
                      className={`px-2 py-0.5 rounded-md text-[9px] font-bold transition-all ${playbackRate === rate ? 'bg-primary/30 text-primary' : 'text-slate-600 hover:text-white hover:bg-white/5'}`}
                    >
                      {rate}x
                    </button>
                  ))}
                </div>

                {/* Volume */}
                <div className="flex items-center gap-2 border-l border-white/10 pl-3">
                  <button onClick={() => setIsMuted(m => !m)} className="text-slate-400 hover:text-white transition-colors">
                    {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                  </button>
                  <input
                    type="range" min="0" max="100" value={isMuted ? 0 : volume}
                    onChange={e => { setVolume(+e.target.value); if (videoRef.current) videoRef.current.volume = +e.target.value / 100; }}
                    className="w-20 h-1 accent-primary cursor-pointer bg-white/10 rounded-full appearance-none"
                  />
                  <span className="text-[9px] font-mono text-slate-600 w-8">{isMuted ? 0 : volume}%</span>
                </div>
              </div>
            </div>
          </div>

          {/* ===== TIMELINE ===== */}
          <div className="bg-[#0a0c10] border-t border-white/[0.06] flex flex-col" style={{ height: '220px' }}>
            {/* Timeline toolbar */}
            <div className="h-9 bg-[#0d1117] border-b border-white/[0.06] flex items-center justify-between px-4 shrink-0">
              <div className="flex items-center gap-3">
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-600">Línea de Tiempo</span>
                <div className="h-3 w-px bg-white/10" />
                <div className="flex items-center gap-1">
                  <ZoomOut className="w-3 h-3 text-slate-600" />
                  <input
                    type="range" min="0.5" max="8" step="0.1" value={zoom}
                    onChange={e => setZoom(parseFloat(e.target.value))}
                    className="w-24 h-0.5 bg-slate-800 rounded-full appearance-none cursor-pointer accent-primary"
                  />
                  <ZoomIn className="w-3 h-3 text-slate-600" />
                </div>
                <div className="h-3 w-px bg-white/10" />
                <button onClick={splitClipAtPlayhead} className="flex items-center gap-1 text-[9px] font-bold text-slate-500 hover:text-white transition-colors" title="Dividir en playhead (S)">
                  <Scissors className="w-3 h-3" /> Dividir
                </button>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={addTextElement} className="flex items-center gap-1 text-[9px] font-bold px-2 py-1 bg-white/5 border border-white/5 rounded-md text-slate-500 hover:text-white hover:bg-white/10 transition-all">
                  <Plus className="w-3 h-3" /> Pista
                </button>
                <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1 text-[9px] font-bold px-2 py-1 bg-primary/20 border border-primary/30 rounded-md text-primary hover:bg-primary/30 transition-all">
                  <Upload className="w-3 h-3" /> Importar
                </button>
              </div>
            </div>

            {/* Timeline scroll area */}
            <div
              ref={timelineRef}
              className="flex-1 overflow-auto custom-scrollbar relative"
              onClick={handleTimelineClick}
              onMouseMove={handleTimelineMouseMove}
              onMouseLeave={() => setTimelineHoverSec(null)}
            >
              <div className="flex flex-col relative" style={{ width: `${timelineWidthPx + 180}px`, minHeight: '100%' }}>
                {/* Time ruler */}
                <div className="h-6 border-b border-white/5 relative flex-shrink-0 bg-[#08090d]">
                  <div className="absolute inset-0" style={{ paddingLeft: '180px' }}>
                    {Array.from({ length: Math.ceil(totalDurationSec) + 1 }).map((_, i) => {
                      if (i % Math.max(1, Math.round(5 / zoom)) !== 0) return null;
                      return (
                        <div
                          key={i}
                          className="absolute top-0 bottom-0 flex items-end pb-1"
                          style={{ left: i * pxPerSec }}
                        >
                          <div className="w-px h-2.5 bg-white/10" />
                          <span className="text-[7px] font-mono text-slate-700 ml-1">{formatTime(i)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* TRACK: Overlays/Graphics */}
                <div className="h-14 border-b border-white/[0.04] flex items-center bg-black/10 group/row flex-shrink-0">
                  <div className="w-[180px] shrink-0 h-full bg-[#0d1117] border-r border-white/[0.06] flex items-center gap-2 px-3 sticky left-0 z-40">
                    <Layers className="w-3.5 h-3.5 text-emerald-500/70 shrink-0" />
                    <div>
                      <div className="text-[8px] font-black uppercase text-slate-500">V2 Gráficos</div>
                      <div className="text-[7px] text-slate-700">{elements.length} elementos</div>
                    </div>
                    <Eye className="w-3 h-3 text-slate-700 ml-auto hover:text-white cursor-pointer" />
                  </div>
                  <div className="flex-1 h-full relative">
                    {elements.map(el => (
                      <div
                        key={el.id}
                        onClick={e => { e.stopPropagation(); setSelectedElement(el.id); }}
                        className={`absolute top-2 h-10 rounded-lg flex items-center px-2 gap-1.5 cursor-pointer border transition-all ${selectedElement === el.id ? 'border-emerald-400 bg-emerald-500/20' : 'border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10'}`}
                        style={{
                          left: (el.startSec || 0) * pxPerSec,
                          width: Math.max(40, ((el.endSec || 5) - (el.startSec || 0)) * pxPerSec),
                        }}
                      >
                        <Type className="w-2.5 h-2.5 text-emerald-400 shrink-0" />
                        <span className="text-[8px] font-bold text-emerald-300/80 truncate">{el.content}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* TRACK: Master Video */}
                <div className="h-20 border-b border-white/[0.04] flex items-center bg-black/20 group/row flex-shrink-0">
                  <div className="w-[180px] shrink-0 h-full bg-[#0d1117] border-r border-white/[0.06] flex items-center gap-2 px-3 sticky left-0 z-40">
                    <Film className="w-3.5 h-3.5 text-violet-400/80 shrink-0" />
                    <div>
                      <div className="text-[8px] font-black uppercase text-slate-500">V1 Master Video</div>
                      <div className="text-[7px] text-slate-700">{videoTimeline.length} clip(s)</div>
                    </div>
                    <Eye className="w-3 h-3 text-slate-700 ml-auto hover:text-white cursor-pointer" />
                  </div>
                  <div className="flex-1 h-full relative">
                    {videoTimeline.length === 0 && (
                      <button
                        onClick={e => { e.stopPropagation(); fileInputRef.current?.click(); }}
                        className="absolute inset-0 flex items-center justify-center gap-2 text-[9px] font-bold text-slate-700 hover:text-slate-500 transition-colors"
                      >
                        <Plus className="w-3 h-3" /> Añadir video...
                      </button>
                    )}
                    {videoTimeline.map((node, idx) => (
                      <div
                        key={node.clip.id}
                        onClick={e => { e.stopPropagation(); setSelectedTimelineClipId(node.clip.id); setActiveClipId(node.clip.id); }}
                        className={`absolute top-3 h-14 rounded-xl overflow-hidden flex items-center px-3 gap-2 cursor-pointer border-2 transition-all group ${selectedTimelineClipId === node.clip.id ? 'border-violet-400 ring-1 ring-violet-400/20' : 'border-violet-500/20 hover:border-violet-400/40'}`}
                        style={{
                          left: node.startGlobal * pxPerSec,
                          width: Math.max(60, (node.endGlobal - node.startGlobal) * pxPerSec),
                          background: 'linear-gradient(135deg, rgba(139,92,246,0.15), rgba(59,130,246,0.10))',
                        }}
                      >
                        {/* Thumbnail strip simulation */}
                        <div className="absolute inset-0 flex gap-px opacity-20">
                          {Array.from({ length: Math.ceil((node.endGlobal - node.startGlobal) * pxPerSec / 32) }).map((_, i) => (
                            <div key={i} className="w-[32px] h-full bg-violet-600/30 flex-shrink-0" />
                          ))}
                        </div>
                        <Film className="w-3 h-3 text-violet-300 relative z-10 shrink-0" />
                        <span className="text-[8px] font-bold text-violet-200/80 truncate relative z-10">{node.clip.file.name}</span>
                        {/* Duration badge */}
                        <span className="ml-auto text-[7px] font-mono text-violet-400/60 relative z-10 shrink-0">
                          {formatTime(node.endGlobal - node.startGlobal)}
                        </span>
                        {/* Delete button on hover */}
                        <button
                          onClick={e => { e.stopPropagation(); deleteClip(node.clip.id); }}
                          className="absolute right-1.5 top-1 opacity-0 group-hover:opacity-100 p-0.5 bg-red-600/80 rounded-md transition-all"
                        >
                          <X className="w-2 h-2 text-white" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* TRACK: Music/SFX */}
                <div className="h-12 border-b border-white/[0.04] flex items-center flex-shrink-0">
                  <div className="w-[180px] shrink-0 h-full bg-[#0d1117] border-r border-white/[0.06] flex items-center gap-2 px-3 sticky left-0 z-40">
                    <Music className="w-3.5 h-3.5 text-amber-400/70 shrink-0" />
                    <div>
                      <div className="text-[8px] font-black uppercase text-slate-500">A1 Música</div>
                    </div>
                    <VolumeX className="w-3 h-3 text-slate-700 ml-auto hover:text-amber-400 cursor-pointer" />
                  </div>
                  <div className="flex-1 h-full relative flex items-center px-2">
                    {audioTimeline.length > 0 ? audioTimeline.map(clip => (
                      <div
                        key={clip.id}
                        className="h-8 bg-amber-500/10 border border-amber-500/25 rounded-lg flex items-center px-2 gap-1.5"
                        style={{ width: (clip.durationSec || 10) * pxPerSec }}
                      >
                        <div className="flex gap-px items-center h-5">
                          {[...Array(16)].map((_, i) => (
                            <div key={i} className="w-px bg-amber-400/50 rounded-full" style={{ height: `${20 + Math.random() * 80}%` }} />
                          ))}
                        </div>
                        <span className="text-[8px] font-bold text-amber-300/70 truncate">{clip.file.name}</span>
                      </div>
                    )) : (
                      <button
                        onClick={e => { e.stopPropagation(); fileInputRef.current?.click(); }}
                        className="text-[8px] text-slate-700 hover:text-slate-500 flex items-center gap-1.5 transition-colors"
                      >
                        <Plus className="w-3 h-3" /> Añadir música o sonido...
                      </button>
                    )}
                  </div>
                </div>

                {/* TRACK: Voice */}
                <div className="h-12 flex items-center flex-shrink-0">
                  <div className="w-[180px] shrink-0 h-full bg-[#0d1117] border-r border-white/[0.06] flex items-center gap-2 px-3 sticky left-0 z-40">
                    <Mic className="w-3.5 h-3.5 text-rose-400/70 shrink-0" />
                    <div>
                      <div className="text-[8px] font-black uppercase text-slate-500">A2 Voz</div>
                    </div>
                  </div>
                  <div className="flex-1 h-full flex items-center px-2">
                    <button
                      onClick={e => { e.stopPropagation(); setSelectedTool('voiceover'); }}
                      className="text-[8px] text-slate-700 hover:text-slate-500 flex items-center gap-1.5 transition-colors"
                    >
                      <Mic className="w-3 h-3" /> Grabar VO...
                    </button>
                  </div>
                </div>

                {/* Playhead */}
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-primary z-[200] pointer-events-none"
                  style={{ left: 180 + playheadSec * pxPerSec }}
                >
                  <div className="absolute -top-px -left-[7px] w-[15px] h-4 bg-primary rounded-b-sm flex items-center justify-center">
                    <div className="w-px h-2 bg-white/60" />
                  </div>
                  <div className="absolute top-4 -left-px w-px h-full bg-primary/40" />
                </div>

                {/* Hover timecode */}
                {timelineHoverSec !== null && (
                  <div
                    className="absolute top-0 w-px bg-white/10 pointer-events-none z-[190]"
                    style={{ left: 180 + timelineHoverSec * pxPerSec }}
                  >
                    <div className="absolute -top-5 -left-8 bg-black/90 border border-white/10 rounded px-2 py-0.5">
                      <span className="text-[8px] font-mono text-white">{formatTime(timelineHoverSec)}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>

        {/* ===== RIGHT: INSPECTOR (context-sensitive) ===== */}
        {selectedElement && (
          <aside className="w-64 bg-[#0d1117] border-l border-white/[0.06] flex flex-col shrink-0 z-50 overflow-hidden">
            <div className="h-9 border-b border-white/[0.06] flex items-center justify-between px-4">
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Propiedades</span>
              <button onClick={() => setSelectedElement(null)} className="text-slate-600 hover:text-white transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
              <InspectorTool
                element={elements.find(el => el.id === selectedElement)}
                onUpdate={(id, up) => updateElement(id, up)}
              />
            </div>
          </aside>
        )}
      </div>

      {/* ===== STATUS BAR ===== */}
      <div className="h-6 bg-[#050709] border-t border-white/[0.04] flex items-center justify-between px-4 shrink-0 z-[100]">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className={`w-1.5 h-1.5 rounded-full ${isPlaying ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'}`} />
            <span className="text-[8px] font-mono text-slate-600 uppercase tracking-widest">{isPlaying ? 'Reproduciendo' : 'Listo'}</span>
          </div>
          <div className="h-3 w-px bg-white/5" />
          <span className="text-[8px] font-mono text-slate-700">{clips.length} clips · {elements.length} elementos</span>
          <div className="h-3 w-px bg-white/5" />
          <span className="text-[8px] font-mono text-slate-700">Duración: {formatTime(totalDurationSec)}</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-[8px] font-mono text-slate-700">Aspecto: {videoSettings.aspectRatio}</span>
          <div className="h-3 w-px bg-white/5" />
          <span className="text-[8px] font-mono text-slate-700">Zoom: {(zoom * 50).toFixed(0)}%</span>
          <div className="h-3 w-px bg-white/5" />
          <button onClick={() => setShowShortcuts(true)} className="text-[8px] font-mono text-slate-700 hover:text-slate-400 transition-colors flex items-center gap-1">
            <Workflow className="w-2.5 h-2.5" /> Atajos
          </button>
        </div>
      </div>

      {/* ===== MODALS ===== */}
      {showShortcuts && <ShortcutsModal onClose={() => setShowShortcuts(false)} />}
      {isRendering && <RenderHud onClose={() => setIsRendering(false)} projectData={{}} />}
    </div>
  );
}
