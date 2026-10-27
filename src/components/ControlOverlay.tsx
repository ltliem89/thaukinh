import React, { useRef, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowLeftFromLine,
  ArrowRightFromLine,
  ArrowUpFromLine,
  BookOpen,
  Box,
  ChevronDown,
  ChevronUp,
  Eye,
  Focus,
  GripHorizontal,
  Hand,
  HelpCircle,
  Info,
  Moon,
  Pause,
  Play,
  Power,
  RotateCcw,
  Sliders,
  Sparkles,
  Sun,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  AppScreenState,
  BeamMode,
  CameraPreset,
  OpticsCalculationResult,
  OpticsState,
} from '../types/optics';
import { LENS_CATALOG, getLensSpec } from '../utils/lensCatalog';
import { TEXTBOOK_PRESETS, TEXTBOOK_QA } from '../utils/textbookPresets';
import { labAudio } from '../utils/audio';

interface ControlOverlayProps {
  screenState: AppScreenState;
  setScreenState: (s: AppScreenState) => void;
  state: OpticsState;
  calc: OpticsCalculationResult;
  onUpdateState: (patch: Partial<OpticsState>) => void;
  onReset: () => void;
}

export const ControlOverlay: React.FC<ControlOverlayProps> = ({
  screenState,
  setScreenState,
  state,
  calc,
  onUpdateState,
  onReset,
}) => {
  // Details & drawers are hidden by default ("ẩn chi tiết trong thanh menu khi cần gọi")
  const [topMenuOpen, setTopMenuOpen] = useState(false);
  const [bottomDrawer, setBottomDrawer] = useState<'none' | 'lens_box' | 'sliders'>('none');

  // Raised Power Switch widget horizontal drag offset (default 0 = left side)
  const [powerBtnOffsetX, setPowerBtnOffsetX] = useState(0);
  const dragStartRef = useRef<{ startX: number; initialOffset: number; moved: boolean } | null>(
    null
  );

  const [aiQuestion, setAiQuestion] = useState('');
  const [aiAnswer, setAiAnswer] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const currentLensSpec = getLensSpec(state.lensProfileId);

  const handleApplyPreset = (presetId: string) => {
    const found = TEXTBOOK_PRESETS.find((p) => p.id === presetId);
    if (!found) return;
    labAudio.playLensSwap(found.state.lensType === 'converging');
    onUpdateState({
      ...found.state,
      activePresetId: presetId,
    });
  };

  const handleSelectLensFromBox = (lensId: (typeof LENS_CATALOG)[number]['id']) => {
    const spec = getLensSpec(lensId);
    labAudio.playLensSwap(spec.lensType === 'converging');
    onUpdateState({
      lensProfileId: spec.id,
      lensType: spec.lensType,
      focalLength: spec.focalLengthCm,
      refractiveIndex: spec.refractiveIndex,
    });
  };

  const handleAskPhysicsAi = async (customPrompt?: string) => {
    setAiLoading(true);
    setAiError(null);
    try {
      const response = await fetch('/api/optics-explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lensType: `${currentLensSpec.name} (${currentLensSpec.codeLabel})`,
          focalLength: currentLensSpec.codeLabel,
          sourceX: state.experimentMode === 'f_object' ? -calc.d : state.lampPos - state.lensPos,
          screenX: calc.screenDistance,
          beamMode: state.beamMode,
          rayTilt: state.rayAngleDeg,
          rayHeight: state.rayOffsetY,
          question: customPrompt ?? aiQuestion,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Không thể kết nối máy chủ phân tích.');
      }
      setAiAnswer(data.explanation);
    } catch (err: unknown) {
      setAiError(err instanceof Error ? err.message : 'Lỗi kết nối.');
    } finally {
      setAiLoading(false);
    }
  };

  if (screenState === 'title') {
    return (
      <div className="pointer-events-auto absolute inset-0 z-30 flex flex-col justify-between p-8 md:p-12 bg-[#0b0f17]/75">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>VẬT LÝ &amp; KHOA HỌC TỰ NHIÊN 9 · QUANG HỌC THỰC NGHIỆM 3D</span>
          <span className="font-mono-tabular">f : +5 · +10 · +15 · -10 · -20 · ∞</span>
        </div>

        <div className="my-auto max-w-2xl">
          <svg
            viewBox="0 0 680 145"
            className="w-full max-w-[580px] h-auto mb-5"
            aria-label="Quang Học 3D - Thấu Kính Hội Tụ và Phân Kì"
          >
            <defs>
              <linearGradient id="beamGrad" x1="0%" y1="50%" x2="100%" y2="50%">
                <stop offset="0%" stopColor="#fbbf24" />
                <stop offset="55%" stopColor="#38bdf8" />
                <stop offset="100%" stopColor="#f59e0b" />
              </linearGradient>
            </defs>
            <line x1="10" y1="32" x2="102" y2="32" stroke="#f59e0b" strokeWidth="3" />
            <line x1="102" y1="32" x2="118" y2="37" stroke="#e0f2fe" strokeWidth="3.5" />
            <line x1="118" y1="37" x2="195" y2="62" stroke="#fbbf24" strokeWidth="3" />
            <line x1="10" y1="62" x2="210" y2="62" stroke="#38bdf8" strokeWidth="2.5" strokeDasharray="6 4" />
            <line x1="10" y1="92" x2="102" y2="92" stroke="#f59e0b" strokeWidth="3" />
            <line x1="102" y1="92" x2="118" y2="87" stroke="#e0f2fe" strokeWidth="3.5" />
            <line x1="118" y1="87" x2="195" y2="62" stroke="#fbbf24" strokeWidth="3" />
            <path
              d="M110 12 Q128 62 110 112 Q92 62 110 12 Z"
              fill="rgba(56, 189, 248, 0.25)"
              stroke="#38bdf8"
              strokeWidth="2.5"
            />
            <circle cx="195" cy="62" r="5" fill="#fef08a" />
            <text
              x="230"
              y="58"
              fill="url(#beamGrad)"
              fontFamily="Plus Jakarta Sans, sans-serif"
              fontWeight="700"
              fontSize="42"
              letterSpacing="-0.02em"
            >
              QUANG HỌC 3D
            </text>
            <text
              x="230"
              y="98"
              fill="#f1f5f9"
              fontFamily="Plus Jakarta Sans, sans-serif"
              fontWeight="600"
              fontSize="24"
            >
              Thấu Kính Hội Tụ &amp; Thấu Kính Phân Kì
            </text>
            <text
              x="230"
              y="128"
              fill="#94a3b8"
              fontFamily="IBM Plex Mono, monospace"
              fontWeight="400"
              fontSize="13"
            >
              Đèn khe chắn (1, 2, 3 tia, khe hẹp) · Hộp thấu kính (+5, +10, +15, -10, -20, ∞)
            </text>
          </svg>

          <p className="text-sm md:text-base text-slate-300 leading-relaxed mb-7 max-w-xl">
            Mô phỏng 3D trực quan: nguồn điện gọn bên trái có nút bấm nổi dễ bật/tắt và di chuyển được; thông số hiển thị bằng ký hiệu chuẩn vật lý; chi tiết chữ ẩn gọn trong thanh menu trên và dưới để khoảng giữa mô phỏng hoàn toàn thông thoáng.
          </p>

          <div className="flex flex-wrap items-center gap-4">
            <button
              onClick={() => {
                labAudio.playPowerSwitch(true);
                setScreenState('playing');
              }}
              className="px-6 py-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-sm transition-colors flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0"
            >
              <Play className="w-4 h-4 fill-current" />
              Bắt đầu Thí nghiệm (Enter / Space)
            </button>
          </div>
        </div>

        <div className="text-xs text-slate-400 font-mono-tabular">
          Nguồn điện (6) bên trái · Đầu đèn (1): 1 tia, 2 tia, 3 tia, khe hẹp · Hộp thấu kính (3): +5, +10, +15, -10, -20, ∞
        </div>
      </div>
    );
  }

  // Symbolic physics values ("thông số hiển thị bằng ký hiệu")
  const dPrimeSymbol =
    state.lensType === 'flat'
      ? '∞'
      : calc.imageType === 'infinity'
      ? '∞'
      : calc.dPrime !== null
      ? `${calc.dPrime > 0 ? '+' : ''}${calc.dPrime.toFixed(1)}cm`
      : '—';

  const kSymbol =
    calc.magnification !== null && Number.isFinite(calc.magnification)
      ? `${calc.magnification > 0 ? '+' : ''}${calc.magnification.toFixed(2)}`
      : '—';

  const detailedTextStatus = !state.powerOn
    ? 'Nguồn điện (6) đang TẮT — Nhấp nút Nguồn nổi bên trái hoặc trên hộp nguồn 3D để bật đèn (1).'
    : state.lensType === 'flat'
    ? 'Bản mặt phẳng song song (f = ∞): Tia sáng truyền thẳng (hoặc ló ra song song tia tới), không hội tụ và không phân kì.'
    : state.experimentMode === 'laser_rays'
    ? state.lensType === 'converging'
      ? `Thấu kính hội tụ (${currentLensSpec.codeLabel}): Chùm tia tới song song khúc xạ hội tụ tại tiêu điểm chính F'.`
      : `Thấu kính phân kì (${currentLensSpec.codeLabel}): Chùm tia ló phân kì, đường kéo dài cắt nhau tại tiêu điểm ảo F.`
    : calc.imageType === 'real'
    ? calc.isFocusedOnScreen
      ? 'Ảnh thật, ngược chiều với vật chữ F và hiện rõ nét trên màn chắn (4).'
      : 'Ảnh thật, ngược chiều — Kéo màn chắn (4) đến đúng vị trí d’ để thu ảnh rõ nét.'
    : calc.imageType === 'virtual'
    ? `Ảnh ảo, cùng chiều, ${Math.abs(calc.magnification || 1) > 1 ? 'lớn hơn vật' : 'nhỏ hơn vật'} — Không hứng được trên màn chắn (4), quan sát bằng cách đặt mắt nhìn qua thấu kính.`
    : 'Vật đặt tại tiêu điểm F (d = f) — Chùm tia ló song song, ảnh ở vô cực (∞).';

  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex flex-col justify-between p-2.5 md:p-3">
      {/* ==================== TOP BAR (Strictly at Top Edge) ==================== */}
      <div className="relative flex flex-wrap items-center justify-between gap-2">
        {/* Left Cluster: Raised Movable Power Switch (Default Left) + Compact Symbolic Metrics */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Nút bấm bật/tắt nguồn nổi lên, mặc định bên trái, có thể kéo di chuyển */}
          <div
            style={{ transform: `translate3d(${powerBtnOffsetX}px, 0, 0)` }}
            className="pointer-events-auto flex items-center bg-[#0f172a] border-2 border-slate-700 rounded-xl p-1 shadow-[0_5px_0_rgb(15,23,42),0_8px_16px_rgba(0,0,0,0.6)] select-none"
          >
            {/* Drag handle for moving the switch horizontally */}
            <div
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                dragStartRef.current = {
                  startX: e.clientX,
                  initialOffset: powerBtnOffsetX,
                  moved: false,
                };
              }}
              onPointerMove={(e) => {
                if (!dragStartRef.current) return;
                const dx = e.clientX - dragStartRef.current.startX;
                if (Math.abs(dx) > 3) dragStartRef.current.moved = true;
                const nextX = Math.max(0, Math.min(280, dragStartRef.current.initialOffset + dx));
                setPowerBtnOffsetX(nextX);
              }}
              onPointerUp={() => {
                dragStartRef.current = null;
              }}
              title="Kéo để di chuyển cụm công tắc nguồn (6) (hoặc kéo trực tiếp nguồn 3D trên bàn)"
              className="px-1 py-1.5 text-slate-400 hover:text-amber-300 cursor-grab active:cursor-grabbing flex items-center"
            >
              <GripHorizontal className="w-3.5 h-3.5" />
            </div>

            {/* Raised 3D-style Tactile Push Button */}
            <button
              onClick={() => {
                const nextPower = !state.powerOn;
                labAudio.playPowerSwitch(nextPower);
                onUpdateState({ powerOn: nextPower });
              }}
              className={`px-3 py-1 rounded-lg font-mono-tabular text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                state.powerOn
                  ? 'bg-emerald-400 text-slate-950 shadow-[0_3px_0_rgb(5,150,105)] translate-y-0 active:translate-y-0.5'
                  : 'bg-rose-500 text-white shadow-[0_4px_0_rgb(159,18,57)] -translate-y-0.5 active:translate-y-0'
              }`}
              title="Bật / Tắt Nguồn điện (6)"
            >
              <Power className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>(6) {state.powerOn ? 'ON' : 'OFF'}</span>
              <span className="text-[10px] opacity-80">{state.voltage}V</span>
            </button>
          </div>

          {/* Symbolic Physics Readout ("thông số hiển thị bằng ký hiệu") */}
          <div className="pointer-events-auto flex items-center gap-2.5 bg-[#0f172a]/95 border border-slate-800 px-3 py-1.5 rounded-lg font-mono-tabular text-xs">
            <span title="Tiêu cự thấu kính (3)">
              <span className="text-slate-400">f=</span>
              <strong className="text-amber-300">{currentLensSpec.codeLabel}</strong>
            </span>
            <span className="text-slate-700">|</span>
            <span title="Chiết suất thấu kính">
              <span className="text-slate-400">n=</span>
              <strong className="text-slate-200">{state.refractiveIndex.toFixed(2)}</strong>
            </span>

            {state.experimentMode === 'f_object' ? (
              <>
                <span className="text-slate-700">|</span>
                <span title="Khoảng cách từ vật (2) đến thấu kính (3)">
                  <span className="text-slate-400">d=</span>
                  <strong className="text-slate-100">{calc.d.toFixed(1)}cm</strong>
                </span>
                <span className="text-slate-700">|</span>
                <span title="Khoảng cách từ ảnh đến thấu kính (3)">
                  <span className="text-slate-400">d&apos;=</span>
                  <strong
                    className={
                      calc.imageType === 'real' ? 'text-emerald-400' : 'text-sky-300'
                    }
                  >
                    {dPrimeSymbol}
                  </strong>
                </span>
                <span className="text-slate-700">|</span>
                <span title="Độ phóng đại ảnh k = -d'/d">
                  <span className="text-slate-400">k=</span>
                  <strong className="text-slate-200">{kSymbol}</strong>
                </span>
              </>
            ) : (
              <>
                <span className="text-slate-700">|</span>
                <span title="Độ lệch tâm chùm tia y">
                  <span className="text-slate-400">y=</span>
                  <strong className="text-slate-100">{state.rayOffsetY.toFixed(1)}cm</strong>
                </span>
                <span className="text-slate-700">|</span>
                <span title="Góc nghiêng tia sáng α">
                  <span className="text-slate-400">α=</span>
                  <strong className="text-slate-100">{state.rayAngleDeg.toFixed(1)}°</strong>
                </span>
              </>
            )}
          </div>
        </div>

        {/* Right Cluster: 5 Camera Direction Icon Buttons + Collapsible Menu Triggers */}
        <div className="pointer-events-auto flex flex-wrap items-center gap-1.5 bg-[#0f172a]/95 border border-slate-800 p-1 rounded-lg">
          {/* Hand Pan & Right Rotate guide + 5 Camera View Icon Buttons: Trung tâm, Trái, Phải, Trên xuống, Sau tới */}
          <div className="flex items-center gap-0.5 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
            <span
              className="px-1.5 py-0.5 text-[11px] font-medium text-amber-300 flex items-center gap-1.5 border-r border-slate-800 pr-2 mr-0.5 whitespace-nowrap"
              title="Chuột trái: Giữ kéo màn hình di chuyển qua lại hoặc kéo thiết bị / tia sáng · Chuột phải: Giữ kéo để xoay góc nhìn 3D · Con lăn chuột: Phóng to / thu nhỏ tại vị trí con trỏ"
            >
              <Hand className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>Chuột trái: Di chuyển · Chuột phải: Xoay</span>
            </span>

            {(
              [
                {
                  id: 'overview',
                  title: 'Về trung tâm (Góc nhìn đầy đủ cả bàn)',
                  icon: <Focus className="w-3.5 h-3.5" />,
                },
                {
                  id: 'left_view',
                  title: 'Nhìn từ bên trái qua',
                  icon: <ArrowRightFromLine className="w-3.5 h-3.5" />,
                },
                {
                  id: 'right_view',
                  title: 'Nhìn từ bên phải qua',
                  icon: <ArrowLeftFromLine className="w-3.5 h-3.5" />,
                },
                {
                  id: 'top_down',
                  title: 'Nhìn từ trên xuống',
                  icon: <ArrowDownToLine className="w-3.5 h-3.5" />,
                },
                {
                  id: 'back_view',
                  title: 'Nhìn từ phía sau tới',
                  icon: <ArrowUpFromLine className="w-3.5 h-3.5" />,
                },
              ] as Array<{ id: CameraPreset; title: string; icon: React.ReactNode }>
            ).map((camBtn) => (
              <button
                key={camBtn.id}
                onClick={() => {
                  onUpdateState({ cameraPreset: camBtn.id });
                  window.dispatchEvent(
                    new CustomEvent('optics-camera-preset', { detail: camBtn.id })
                  );
                }}
                title={camBtn.title}
                className={`p-1.5 rounded transition-colors cursor-pointer ${
                  state.cameraPreset === camBtn.id
                    ? 'bg-amber-500 text-slate-950 font-semibold'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                {camBtn.icon}
              </button>
            ))}
          </div>

          {/* Menu Chi Tiết Chữ & Kịch Bản ("ẩn chi tiết trong thanh menu khi cần gọi") */}
          <button
            onClick={() => setTopMenuOpen((prev) => !prev)}
            className={`px-2.5 py-1 text-xs font-medium rounded flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              topMenuOpen
                ? 'bg-amber-500 text-slate-950 font-semibold'
                : 'bg-slate-800/90 text-slate-200 hover:bg-slate-700'
            }`}
          >
            <Info className="w-3.5 h-3.5" />
            <span>Menu Chi Tiết</span>
            {topMenuOpen ? (
              <ChevronUp className="w-3 h-3" />
            ) : (
              <ChevronDown className="w-3 h-3" />
            )}
          </button>

          <button
            onClick={() => setScreenState('guide_modal')}
            className="px-2.5 py-1 text-xs font-medium rounded bg-sky-500/20 text-sky-300 border border-sky-500/30 hover:bg-sky-500/30 transition-colors flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>SGK 8.12</span>
          </button>

          <button
            onClick={() => {
              const isDarkRoom = state.ambientLightLevel <= 20;
              labAudio.playPowerSwitch(true);
              if (isDarkRoom) {
                onUpdateState({ ambientLightLevel: 80, tableBrightness: 85 });
              } else {
                onUpdateState({ ambientLightLevel: 10, tableBrightness: 25 });
              }
            }}
            className={`px-2 py-1 text-xs font-medium rounded flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              state.ambientLightLevel <= 20
                ? 'bg-indigo-500/30 text-indigo-200 border border-indigo-400/40'
                : 'bg-slate-800 text-amber-300 hover:bg-slate-700'
            }`}
            title="Chuyển nhanh giữa Phòng thí nghiệm tối (tia sáng nổi bật rõ nhất) và Phòng sáng; có thể chỉnh chi tiết trong mục Điều Chỉnh ở thanh dưới"
          >
            {state.ambientLightLevel <= 20 ? (
              <>
                <Moon className="w-3.5 h-3.5 text-indigo-300" />
                <span>Phòng tối</span>
              </>
            ) : (
              <>
                <Sun className="w-3.5 h-3.5 text-amber-300" />
                <span>Độ sáng</span>
              </>
            )}
          </button>

          <button
            onClick={() => onUpdateState({ showLabels: !state.showLabels })}
            className={`px-2 py-1 text-xs font-mono-tabular font-semibold rounded transition-colors cursor-pointer ${
              state.showLabels
                ? 'bg-slate-700 text-amber-300'
                : 'text-slate-400 hover:bg-slate-800'
            }`}
            title="Ẩn / Hiện ký hiệu (1)–(6), O, F, F' trên mô hình 3D"
          >
            (1–6)
          </button>

          <button
            onClick={() => {
              const nextMuted = !state.muted;
              labAudio.muted = nextMuted;
              onUpdateState({ muted: nextMuted });
            }}
            className="p-1.5 rounded text-slate-300 hover:bg-slate-800 transition-colors cursor-pointer"
            title={state.muted ? 'Bật âm thanh' : 'Tắt âm thanh'}
          >
            {state.muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={onReset}
            className="p-1.5 rounded text-slate-300 hover:bg-slate-800 transition-colors cursor-pointer"
            title="Đặt lại mặc định"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setScreenState('paused')}
            className="p-1.5 rounded text-slate-300 hover:bg-slate-800 transition-colors cursor-pointer"
            title="Tạm dừng (Esc)"
          >
            <Pause className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* TOP DROPDOWN MENU: Text Descriptions, Legend (1)-(6), & Presets (Only shown when called) */}
        {topMenuOpen && (
          <div className="pointer-events-auto absolute top-full right-0 mt-1.5 w-full max-w-xl bg-[#0f172a] border border-slate-700 rounded-xl p-3.5 shadow-2xl z-30">
            <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-slate-800">
              <span className="text-xs font-semibold text-amber-300">
                Chi Tiết Hiện Tượng &amp; Bố Trí Thí Nghiệm (Hình 8.12)
              </span>
              <button
                onClick={() => setTopMenuOpen(false)}
                className="text-xs text-slate-400 hover:text-white cursor-pointer"
              >
                Đóng ✕
              </button>
            </div>

            {/* Text Explanation of Current Optical State */}
            <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-200 mb-3 leading-relaxed">
              <strong className="text-amber-300">{currentLensSpec.name}: </strong>
              {detailedTextStatus}
            </div>

            {/* Quick Textbook Presets */}
            <div className="mb-3">
              <div className="text-[11px] font-semibold text-slate-400 mb-1.5">
                Chọn nhanh thí nghiệm mẫu:
              </div>
              <div className="flex flex-wrap gap-1.5">
                {TEXTBOOK_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => {
                      handleApplyPreset(preset.id);
                      setTopMenuOpen(false);
                    }}
                    className={`px-2.5 py-1 text-xs font-medium rounded transition-colors cursor-pointer ${
                      state.activePresetId === preset.id
                        ? 'bg-amber-500 text-slate-950 font-semibold'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Legend of Symbols (1)-(6) & Mouse Controls */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 text-[11px] text-slate-300 bg-slate-900/70 p-2.5 rounded-lg border border-slate-800/80 font-mono-tabular mb-2.5">
              <div><strong className="text-amber-300">(1)</strong>: Đèn chiếu khe tia</div>
              <div><strong className="text-amber-300">(2) F</strong>: Vật sáng chữ F</div>
              <div><strong className="text-amber-300">(3) TK</strong>: Giá lắp thấu kính</div>
              <div><strong className="text-amber-300">(4)</strong>: Màn hứng ảnh</div>
              <div><strong className="text-amber-300">(5)</strong>: Giá quang học</div>
              <div><strong className="text-amber-300">(6)</strong>: Nguồn điện (Kéo được)</div>
            </div>

            <div className="text-[11px] text-slate-300 bg-slate-900/90 px-2.5 py-2 rounded-lg border border-slate-800 flex flex-wrap items-center justify-between gap-2">
              <span><strong className="text-amber-300">Chuột trái:</strong> Di chuyển màn hình / kéo thiết bị &amp; tia sáng</span>
              <span><strong className="text-sky-300">Chuột phải:</strong> Xoay góc nhìn 3D</span>
              <span><strong className="text-emerald-300">Con lăn:</strong> Phóng to / thu nhỏ tại con trỏ</span>
            </div>
          </div>
        )}
      </div>

      {/* ==================== BOTTOM BAR (Strictly at Bottom Edge) ==================== */}
      <div className="mx-auto w-full max-w-[980px] flex flex-col items-center">
        {/* Expandable Bottom Menu Drawer (Hidden by default so middle is 100% clear) */}
        {bottomDrawer !== 'none' && (
          <div className="pointer-events-auto w-full mb-1.5 bg-[#0f172a]/95 border border-slate-800 rounded-xl p-3 shadow-2xl">
            <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-slate-800">
              <span className="text-xs font-semibold text-amber-300">
                {bottomDrawer === 'lens_box'
                  ? 'Hộp Chứa Thấu Kính Tiêu Chuẩn (+5, +10, +15, -10, -20, ∞)'
                  : 'Điều Chỉnh Vị Trí (d, d’), Điện Áp & Góc Nhìn 3D'}
              </span>
              <button
                onClick={() => setBottomDrawer('none')}
                className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 cursor-pointer"
              >
                Thu gọn xuống thanh dưới ✕
              </button>
            </div>

            {bottomDrawer === 'lens_box' ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                {LENS_CATALOG.map((item) => {
                  const isSelected = state.lensProfileId === item.id;
                  const isConverging = item.lensType === 'converging';
                  const isDiverging = item.lensType === 'diverging';
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleSelectLensFromBox(item.id)}
                      className={`group flex flex-col items-center p-2 rounded-lg border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-slate-800 border-amber-400 shadow-md'
                          : 'bg-slate-900/80 border-slate-800 hover:border-slate-600'
                      }`}
                    >
                      <div className="relative w-full h-12 bg-[#0b0f17] rounded border border-slate-800/80 flex items-center justify-center mb-1.5 overflow-hidden">
                        <svg viewBox="0 0 60 80" className="w-11 h-12">
                          <line x1="2" y1="22" x2="24" y2="22" stroke="#f59e0b" strokeWidth="2" />
                          <line x1="2" y1="40" x2="58" y2="40" stroke="#38bdf8" strokeWidth="1.5" strokeDasharray="3 2" />
                          <line x1="2" y1="58" x2="24" y2="58" stroke="#f59e0b" strokeWidth="2" />
                          {isConverging ? (
                            <>
                              <line x1="24" y1="22" x2="35" y2="25" stroke="#e0f2fe" strokeWidth="2" />
                              <line
                                x1="35"
                                y1="25"
                                x2={item.focalLengthCm === 5 ? '47' : item.focalLengthCm === 10 ? '53' : '58'}
                                y2="40"
                                stroke="#fbbf24"
                                strokeWidth="2"
                              />
                              <line x1="24" y1="58" x2="35" y2="55" stroke="#e0f2fe" strokeWidth="2" />
                              <line
                                x1="35"
                                y1="55"
                                x2={item.focalLengthCm === 5 ? '47' : item.focalLengthCm === 10 ? '53' : '58'}
                                y2="40"
                                stroke="#fbbf24"
                                strokeWidth="2"
                              />
                            </>
                          ) : isDiverging ? (
                            <>
                              <line x1="22" y1="22" x2="38" y2="19" stroke="#e0f2fe" strokeWidth="2" />
                              <line
                                x1="38"
                                y1="19"
                                x2="58"
                                y2={item.focalLengthCm === 10 ? '8' : '13'}
                                stroke="#fbbf24"
                                strokeWidth="2"
                              />
                              <line x1="22" y1="58" x2="38" y2="61" stroke="#e0f2fe" strokeWidth="2" />
                              <line
                                x1="38"
                                y1="61"
                                x2="58"
                                y2={item.focalLengthCm === 10 ? '72' : '67'}
                                stroke="#fbbf24"
                                strokeWidth="2"
                              />
                            </>
                          ) : (
                            <>
                              <line x1="24" y1="22" x2="36" y2="22" stroke="#e0f2fe" strokeWidth="2" />
                              <line x1="36" y1="22" x2="58" y2="22" stroke="#fbbf24" strokeWidth="2" />
                              <line x1="24" y1="58" x2="36" y2="58" stroke="#e0f2fe" strokeWidth="2" />
                              <line x1="36" y1="58" x2="58" y2="58" stroke="#fbbf24" strokeWidth="2" />
                            </>
                          )}
                          <path
                            d={item.svgPath}
                            fill={isSelected ? 'rgba(56, 189, 248, 0.38)' : 'rgba(148, 163, 184, 0.25)'}
                            stroke={isSelected ? '#38bdf8' : '#94a3b8'}
                            strokeWidth="2"
                          />
                        </svg>
                        <span
                          className={`absolute top-1 right-1 text-[11px] font-mono-tabular font-bold px-1.5 py-0.2 rounded ${
                            isConverging
                              ? 'bg-amber-500 text-slate-950'
                              : isDiverging
                              ? 'bg-sky-400 text-slate-950'
                              : 'bg-slate-200 text-slate-950'
                          }`}
                        >
                          {item.codeLabel}
                        </span>
                      </div>
                      <span className="text-[11px] font-semibold text-slate-200 truncate w-full text-center">
                        {item.shortName}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-center font-mono-tabular">
                  {state.experimentMode === 'f_object' ? (
                    <div className="flex flex-col gap-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-400">d (Vật → TK)</span>
                        <span className="text-amber-300">{calc.d.toFixed(1)} cm</span>
                      </div>
                      <input
                        type="range"
                        min={4}
                        max={34}
                        step={0.5}
                        value={calc.d}
                        onChange={(e) => {
                          const newD = parseFloat(e.target.value);
                          const newObjPos = Math.max(-38, state.lensPos - newD);
                          const newLampPos = Math.min(state.lampPos, newObjPos - 5);
                          labAudio.playRailSlideTick();
                          onUpdateState({ objectPos: newObjPos, lampPos: newLampPos });
                        }}
                        className="optics-slider w-full"
                      />
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-400">y / α</span>
                        <span className="text-amber-300">
                          {state.rayOffsetY.toFixed(1)}cm · {state.rayAngleDeg}°
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="range"
                          min={-2.5}
                          max={2.5}
                          step={0.1}
                          value={state.rayOffsetY}
                          onChange={(e) => onUpdateState({ rayOffsetY: parseFloat(e.target.value) })}
                          className="optics-slider w-1/2"
                        />
                        <input
                          type="range"
                          min={-10}
                          max={10}
                          step={0.5}
                          value={state.rayAngleDeg}
                          onChange={(e) =>
                            onUpdateState({ rayAngleDeg: parseFloat(e.target.value) })
                          }
                          className="optics-slider w-1/2"
                        />
                      </div>
                    </div>
                  )}

                  {/* Slider: Vị trí Đèn (1) */}
                  <div className="flex flex-col gap-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">x₁ (Đèn 1)</span>
                      <span className="text-slate-200">{state.lampPos} cm</span>
                    </div>
                    <input
                      type="range"
                      min={-42}
                      max={
                        state.experimentMode === 'f_object' ? state.objectPos - 5 : state.lensPos - 6
                      }
                      step={0.5}
                      value={state.lampPos}
                      onChange={(e) => {
                        labAudio.playRailSlideTick();
                        onUpdateState({ lampPos: parseFloat(e.target.value) });
                      }}
                      className="optics-slider w-full"
                    />
                  </div>

                  {/* Slider: Vị trí Màn chắn (4) */}
                  <div className="flex flex-col gap-1">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-400">x₄ (Màn 4)</span>
                      <div className="flex items-center gap-1.5">
                        {state.experimentMode === 'f_object' &&
                          calc.imageType === 'real' &&
                          calc.dPrime !== null &&
                          calc.dPrime <= 42 && (
                            <button
                              onClick={() => {
                                const targetX = Math.min(
                                  42,
                                  Math.round((state.lensPos + calc.dPrime!) * 2) / 2
                                );
                                labAudio.playFocusChime();
                                onUpdateState({ screenPos: targetX });
                              }}
                              className="text-[10px] px-1.5 py-0.2 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded hover:bg-emerald-500/30 cursor-pointer"
                            >
                              x₄=d&apos;
                            </button>
                          )}
                        <span className="text-emerald-300">{calc.screenDistance.toFixed(1)} cm</span>
                      </div>
                    </div>
                    <input
                      type="range"
                      min={state.lensPos + 4}
                      max={42}
                      step={0.5}
                      value={state.screenPos}
                      onChange={(e) => {
                        labAudio.playRailSlideTick();
                        onUpdateState({ screenPos: parseFloat(e.target.value) });
                      }}
                      className="optics-slider w-full"
                    />
                  </div>

                  {/* Camera & Visual Toggles */}
                  <div className="flex flex-wrap items-center justify-end gap-1">
                    {(
                      [
                        { id: 'overview', label: '3D Chung' },
                        { id: 'lens_macro', label: 'Cận TK' },
                        { id: 'eye_view', label: 'Đặt mắt' },
                        { id: 'screen_closeup', label: 'Màn (4)' },
                      ] as Array<{ id: CameraPreset; label: string }>
                    ).map((cam) => (
                      <button
                        key={cam.id}
                        onClick={() => onUpdateState({ cameraPreset: cam.id })}
                        className={`px-2 py-1 text-[11px] font-medium rounded cursor-pointer ${
                          state.cameraPreset === cam.id
                            ? 'bg-sky-500 text-slate-950 font-semibold'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        {cam.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Row 2: Ambient Lab Lighting & Table Surface Brightness Controls */}
                <div className="pt-2.5 border-t border-slate-800/90 grid grid-cols-1 sm:grid-cols-3 gap-3 items-center font-mono-tabular">
                  {/* Slider: Ánh sáng môi trường (Phòng thí nghiệm) */}
                  <div className="flex flex-col gap-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400 flex items-center gap-1">
                        <Moon className="w-3 h-3 text-indigo-300" />
                        <span>Ánh sáng phòng</span>
                      </span>
                      <span className="text-indigo-300 font-semibold">
                        {state.ambientLightLevel}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      value={state.ambientLightLevel}
                      onChange={(e) =>
                        onUpdateState({ ambientLightLevel: parseFloat(e.target.value) })
                      }
                      className="optics-slider w-full"
                    />
                  </div>

                  {/* Slider: Độ sáng mặt bàn thí nghiệm */}
                  <div className="flex flex-col gap-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400 flex items-center gap-1">
                        <Sun className="w-3 h-3 text-amber-300" />
                        <span>Độ sáng mặt bàn</span>
                      </span>
                      <span className="text-amber-300 font-semibold">
                        {state.tableBrightness}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={10}
                      max={100}
                      step={5}
                      value={state.tableBrightness}
                      onChange={(e) =>
                        onUpdateState({ tableBrightness: parseFloat(e.target.value) })
                      }
                      className="optics-slider w-full"
                    />
                  </div>

                  {/* Quick Lighting Presets */}
                  <div className="flex flex-wrap items-center justify-end gap-1.5">
                    <button
                      onClick={() =>
                        onUpdateState({ ambientLightLevel: 10, tableBrightness: 25 })
                      }
                      className={`px-2.5 py-1 text-[11px] font-medium rounded cursor-pointer transition-colors ${
                        state.ambientLightLevel <= 15 && state.tableBrightness <= 30
                          ? 'bg-indigo-500 text-white font-semibold'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                      title="Làm tối phòng và mặt bàn để tia sáng rực rỡ, sắc nét nhất"
                    >
                      Phòng tối (Tia rõ)
                    </button>
                    <button
                      onClick={() =>
                        onUpdateState({ ambientLightLevel: 45, tableBrightness: 65 })
                      }
                      className={`px-2.5 py-1 text-[11px] font-medium rounded cursor-pointer transition-colors ${
                        state.ambientLightLevel > 15 &&
                        state.ambientLightLevel < 75 &&
                        state.tableBrightness > 30
                          ? 'bg-amber-500 text-slate-950 font-semibold'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      Tiêu chuẩn
                    </button>
                    <button
                      onClick={() =>
                        onUpdateState({ ambientLightLevel: 90, tableBrightness: 95 })
                      }
                      className={`px-2.5 py-1 text-[11px] font-medium rounded cursor-pointer transition-colors ${
                        state.ambientLightLevel >= 75
                          ? 'bg-sky-400 text-slate-950 font-semibold'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      Phòng sáng
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* MAIN COMPACT SINGLE-LINE BOTTOM BAR (Always at Bottom Edge, Middle Viewport 100% Open) */}
        <div className="pointer-events-auto w-full bg-[#0f172a]/95 border border-slate-800 rounded-xl px-2.5 py-1.5 shadow-xl flex flex-wrap items-center justify-between gap-2">
          {/* 1. Đầu kiểm tia trên đèn (1) */}
          <div className="flex items-center gap-1">
            <span className="text-[11px] font-mono-tabular font-semibold text-slate-400 px-1">
              (1):
            </span>
            {(
              [
                { id: 'single', label: '1 tia' },
                { id: 'double', label: '2 tia' },
                { id: 'triple', label: '3 tia' },
                { id: 'bundle', label: 'Khe hẹp' },
                { id: 'f_rays', label: 'Vật F' },
              ] as Array<{ id: BeamMode; label: string }>
            ).map((b) => {
              const isActive =
                b.id === 'f_rays'
                  ? state.experimentMode === 'f_object'
                  : state.experimentMode === 'laser_rays' && state.beamMode === b.id;
              return (
                <button
                  key={b.id}
                  onClick={() => {
                    labAudio.playRailSlideTick();
                    if (b.id === 'f_rays') {
                      onUpdateState({ experimentMode: 'f_object', beamMode: 'f_rays' });
                    } else {
                      onUpdateState({ experimentMode: 'laser_rays', beamMode: b.id });
                    }
                  }}
                  className={`px-2 py-1 text-xs font-medium rounded transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    isActive
                      ? 'bg-amber-500 text-slate-950 font-semibold'
                      : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  {b.label}
                </button>
              );
            })}
          </div>

          {/* 2. Quick Symbolic Lens Box Selector (+5, +10, +15, -10, -20, ∞) */}
          <div className="flex items-center gap-1 font-mono-tabular">
            <span className="text-[11px] font-semibold text-slate-400 px-1">(3) f:</span>
            {LENS_CATALOG.map((item) => {
              const isSelected = state.lensProfileId === item.id;
              const isConv = item.lensType === 'converging';
              const isDiv = item.lensType === 'diverging';
              return (
                <button
                  key={item.id}
                  onClick={() => handleSelectLensFromBox(item.id)}
                  title={`${item.name} — ${item.description}`}
                  className={`px-2 py-1 text-xs font-bold rounded border transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                    isSelected
                      ? isConv
                        ? 'bg-amber-500 text-slate-950 border-amber-300'
                        : isDiv
                        ? 'bg-sky-400 text-slate-950 border-sky-200'
                        : 'bg-slate-200 text-slate-950 border-white'
                      : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-600'
                  }`}
                >
                  {item.codeLabel.replace(' cm', '')}
                </button>
              );
            })}
          </div>

          {/* 3. Expandable Detail Menus ("ẩn chi tiết trong thanh menu khi cần gọi") */}
          <div className="flex items-center gap-1">
            <button
              onClick={() =>
                setBottomDrawer((prev) => (prev === 'lens_box' ? 'none' : 'lens_box'))
              }
              className={`px-2.5 py-1 rounded text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                bottomDrawer === 'lens_box'
                  ? 'bg-amber-500 text-slate-950 font-semibold'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
              title="Mở / Ẩn sơ đồ mặt cắt Hộp thấu kính"
            >
              <Box className="w-3.5 h-3.5" />
              <span>Hộp Kính</span>
            </button>

            <button
              onClick={() =>
                setBottomDrawer((prev) => (prev === 'sliders' ? 'none' : 'sliders'))
              }
              className={`px-2.5 py-1 rounded text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                bottomDrawer === 'sliders'
                  ? 'bg-sky-400 text-slate-950 font-semibold'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
              title="Mở / Ẩn thanh trượt vị trí và góc nhìn"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Điều Chỉnh</span>
            </button>
          </div>
        </div>
      </div>

      {/* PAUSE MODAL */}
      {screenState === 'paused' && (
        <div className="pointer-events-auto fixed inset-0 z-40 flex items-center justify-center bg-[#0b0f17]/80 p-4">
          <div className="w-full max-w-md bg-[#0f172a] border border-slate-800 rounded-xl p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-white mb-2">Tạm dừng Phòng Thí Nghiệm</h2>
            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              Nguồn điện (6) đã thu gọn bên trái kèm nút bấm nổi (có thể kéo di chuyển); mọi thông số hiển thị bằng ký hiệu và các chi tiết chữ được ẩn gọn trong thanh menu trên/dưới.
            </p>
            <div className="space-y-2 text-xs text-slate-300 font-mono-tabular bg-slate-900/90 p-3.5 rounded-lg border border-slate-800 mb-5">
              <div>Chuột trái : Di chuyển màn hình (bàn tay) / kéo thiết bị &amp; tia sáng</div>
              <div>Chuột phải : Giữ kéo để xoay góc nhìn 3D quanh bàn</div>
              <div>Con lăn    : Thu phóng tại đúng vị trí con trỏ chuột</div>
              <div>(6) ON/OFF : Nhấp nút nguồn nổi bên trái hoặc kéo nguồn 3D</div>
              <div>(1) Đầu đèn: Chọn 1 tia, 2 tia, 3 tia, Khe hẹp, Vật F</div>
              <div>(3) f      : Chọn +5, +10, +15, -10, -20, ∞ ở thanh dưới</div>
            </div>
            <div className="flex items-center justify-end gap-2.5">
              <button
                onClick={() => {
                  onReset();
                  setScreenState('playing');
                }}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium cursor-pointer"
              >
                Đặt lại từ đầu
              </button>
              <button
                onClick={() => setScreenState('playing')}
                className="px-5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold cursor-pointer"
              >
                Tiếp tục Thí nghiệm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TEXTBOOK MODAL */}
      {screenState === 'guide_modal' && (
        <div className="pointer-events-auto fixed inset-0 z-40 flex items-center justify-center bg-[#0b0f17]/80 p-4">
          <div className="w-full max-w-3xl max-h-[88vh] overflow-y-auto bg-[#0f172a] border border-slate-800 rounded-xl p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-800">
              <div>
                <h2 className="text-lg font-bold text-white">
                  Nguyên Lý Thấu Kính &amp; Giải Đáp Thí Nghiệm Hình 8.12
                </h2>
                <p className="text-xs text-slate-400">
                  Hội tụ (+5 cm, +10 cm, +15 cm), Phân kì (-10 cm, -20 cm) và Bản mặt phẳng song song (∞)
                </p>
              </div>
              <button
                onClick={() => setScreenState('playing')}
                className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 cursor-pointer"
              >
                Đóng (Esc)
              </button>
            </div>

            <div className="space-y-3 mb-6">
              {TEXTBOOK_QA.map((item, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-lg bg-slate-900/90 border border-slate-800 flex flex-col gap-2"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-amber-400">{item.section}</span>
                    <button
                      onClick={() => {
                        handleApplyPreset(item.presetId);
                        setScreenState('playing');
                      }}
                      className="px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-xs font-medium flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      Mô phỏng trên bàn 3D
                    </button>
                  </div>
                  <h3 className="text-sm font-semibold text-slate-100">{item.question}</h3>
                  <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line">
                    {item.answer}
                  </p>
                </div>
              ))}
            </div>

            <div className="p-4 rounded-lg bg-slate-900 border border-slate-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-sky-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  Phân tích chuyên sâu trạng thái quang học hiện tại (Chế độ Tư duy Cao)
                </span>
                <button
                  onClick={() => handleAskPhysicsAi()}
                  disabled={aiLoading}
                  className="px-3 py-1 rounded bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-slate-950 text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0"
                >
                  {aiLoading ? 'Đang suy luận...' : 'Phân tích trạng thái hiện tại'}
                </button>
              </div>

              <div className="flex gap-2 mt-2">
                <input
                  type="text"
                  value={aiQuestion}
                  onChange={(e) => setAiQuestion(e.target.value)}
                  placeholder="Hỏi về thấu kính +5, +10, +15, -10, -20, kính phẳng ∞ hoặc thí nghiệm Hình 8.12..."
                  className="flex-1 bg-[#0b0f17] border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-100 outline-none focus:border-sky-400"
                />
                <button
                  onClick={() => handleAskPhysicsAi(aiQuestion)}
                  disabled={aiLoading || !aiQuestion.trim()}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-xs font-medium text-slate-200 flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                  Hỏi
                </button>
              </div>

              {aiError && <p className="mt-2 text-xs text-rose-400">{aiError}</p>}
              {aiAnswer && (
                <div className="mt-3 p-3 rounded bg-[#0b0f17] border border-slate-800 text-xs text-slate-200 leading-relaxed whitespace-pre-line">
                  {aiAnswer}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
