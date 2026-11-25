import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Award, Crown, Gavel, GitBranch, Sparkles, Trophy } from 'lucide-react';
import {
  MATCH_STAGE_LABELS,
  MATCH_STATUS_LABELS,
  type Match,
  type StandingRow,
} from '../types/tournament';

interface Bracket2DDiagramProps {
  division: string;
  standingsByGroup: Record<string, StandingRow[]>;
  knockoutMatches: Match[];
  isAdmin: boolean;
  onOpenRefereeForMatch: (matchId: string) => void;
  onSyncKnockoutFromGroups: (division: string) => void;
}

const BASE_TREE_WIDTH = 960;
const BASE_TREE_HEIGHT = 436;
const MIN_ZOOM = 0.34;
const MAX_ZOOM = 2.2;

export const Bracket2DDiagram: React.FC<Bracket2DDiagramProps> = ({
  division,
  standingsByGroup,
  knockoutMatches,
  isAdmin,
  onOpenRefereeForMatch,
  onSyncKnockoutFromGroups,
}) => {
  const [highlightSeed, setHighlightSeed] = useState<string | null>(null);
  const [zoom, setZoom] = useState<number>(1);
  const [fitZoom, setFitZoom] = useState<number>(1);

  const viewportRef = useRef<HTMLDivElement | null>(null);
  const zoomRef = useRef<number>(1);
  const pinchDistanceRef = useRef<number | null>(null);
  const pinchInitialZoomRef = useRef<number>(1);
  const lastTapTimeRef = useRef<number>(0);

  zoomRef.current = zoom;

  const clampZoom = useCallback((nextValue: number) => {
    return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number(nextValue.toFixed(3))));
  }, []);

  const syncFitZoom = useCallback(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    const availableWidth = vp.clientWidth;
    if (availableWidth <= 0) return;
    const nextFit = Math.min(
      1,
      Math.max(MIN_ZOOM, Number(((availableWidth - 16) / BASE_TREE_WIDTH).toFixed(3))),
    );
    setFitZoom(nextFit);
    setZoom(nextFit);
  }, []);

  useEffect(() => {
    syncFitZoom();
    const vp = viewportRef.current;
    if (!vp || typeof ResizeObserver === 'undefined') return;
    let lastWidth = vp.clientWidth;
    const observer = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width || 0;
      if (Math.abs(w - lastWidth) > 12) {
        lastWidth = w;
        syncFitZoom();
      }
    });
    observer.observe(vp);
    return () => observer.disconnect();
  }, [division, syncFitZoom]);

  // Direct two-finger pinch-to-zoom on the diagram canvas (non-passive so browser page zoom is suppressed)
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        pinchDistanceRef.current = Math.hypot(dx, dy);
        pinchInitialZoomRef.current = zoomRef.current;
      } else {
        pinchDistanceRef.current = null;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && pinchDistanceRef.current && pinchDistanceRef.current > 12) {
        e.preventDefault();
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.hypot(dx, dy);
        const ratio = dist / pinchDistanceRef.current;
        setZoom(clampZoom(pinchInitialZoomRef.current * ratio));
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) {
        pinchDistanceRef.current = null;
      }
    };

    vp.addEventListener('touchstart', onTouchStart, { passive: true });
    vp.addEventListener('touchmove', onTouchMove, { passive: false });
    vp.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      vp.removeEventListener('touchstart', onTouchStart);
      vp.removeEventListener('touchmove', onTouchMove);
      vp.removeEventListener('touchend', onTouchEnd);
    };
  }, [clampZoom]);

  // Ctrl/Cmd + Wheel or trackpad pinch zooms directly on the diagram
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      e.stopPropagation();
      const delta = e.deltaY < 0 ? 0.1 : -0.1;
      setZoom((prev) => clampZoom(prev + delta));
    }
  };

  // Double-tap / double-click directly on diagram toggles fit <-> zoomed view
  const handleToggleDirectZoom = () => {
    setZoom((prev) => {
      if (Math.abs(prev - fitZoom) < 0.08) {
        return clampZoom(Math.max(1.1, fitZoom * 1.65));
      }
      return fitZoom;
    });
  };

  const handleTouchTapEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length > 0) return;
    const now = Date.now();
    if (now - lastTapTimeRef.current < 280) {
      handleToggleDirectZoom();
      lastTapTimeRef.current = 0;
    } else {
      lastTapTimeRef.current = now;
    }
  };

  const scaledWidth = Math.round(BASE_TREE_WIDTH * zoom);
  const scaledHeight = Math.round(BASE_TREE_HEIGHT * zoom);

  const groupEntries = Object.entries(standingsByGroup);
  const groupA = groupEntries[0]?.[1] || [];
  const groupB = groupEntries[1]?.[1] || [];

  const quarterfinals = knockoutMatches.filter((m) => m.stage === 'quarterfinal');
  const semifinals = knockoutMatches.filter((m) => m.stage === 'semifinal');
  const semi1 = semifinals[0];
  const semi2 = semifinals[1];
  const thirdPlaceMatch = knockoutMatches.find((m) => m.stage === 'third_place');
  const finalMatch = knockoutMatches.find((m) => m.stage === 'final');

  const seed1AName = semi1?.teamAName || groupA[0]?.teamName || 'Nhất Bảng A';
  const seed2BName = semi1?.teamBName || groupB[1]?.teamName || 'Nhì Bảng B';
  const seed1BName = semi2?.teamAName || groupB[0]?.teamName || 'Nhất Bảng B';
  const seed2AName = semi2?.teamBName || groupA[1]?.teamName || 'Nhì Bảng A';

  const hasQuarterfinals = quarterfinals.length >= 4;

  const championName =
    finalMatch?.winnerSide === 'A'
      ? finalMatch.teamAName
      : finalMatch?.winnerSide === 'B'
      ? finalMatch.teamBName
      : 'Đội thắng Chung kết';

  const bronzeName =
    thirdPlaceMatch?.winnerSide === 'A'
      ? thirdPlaceMatch.teamAName
      : thirdPlaceMatch?.winnerSide === 'B'
      ? thirdPlaceMatch.teamBName
      : 'Đội thắng Tranh Hạng 3';

  const renderLeafTeamCard = (
    seedCode: string,
    teamName: string,
    clubName: string | undefined,
    topPx: number,
  ) => {
    const isHighlighted = highlightSeed === seedCode;
    return (
      <div
        key={seedCode}
        style={{ top: `${topPx}px`, left: '16px', width: '220px', height: '66px' }}
        onMouseEnter={() => setHighlightSeed(seedCode)}
        onMouseLeave={() => setHighlightSeed(null)}
        onClick={() => setHighlightSeed((prev) => (prev === seedCode ? null : seedCode))}
        className={`absolute rounded-xl border bg-white px-3 py-2 flex items-center justify-between gap-2 cursor-pointer transition-colors ${
          isHighlighted
            ? 'border-orange-500 ring-2 ring-orange-200 bg-orange-50/40'
            : 'border-slate-200 hover:border-slate-300'
        }`}
      >
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-semibold text-slate-500 font-mono-num">
            Nhánh {seedCode}
          </div>
          <div className="text-xs font-bold text-slate-900 truncate mt-0.5">{teamName}</div>
          {clubName && (
            <div className="text-[10px] text-slate-500 truncate">{clubName}</div>
          )}
        </div>
      </div>
    );
  };

  const renderQuarterfinalNode = (
    match: Match,
    fallbackTitle: string,
    topPx: number,
  ) => {
    const winnerSide = match.winnerSide;
    return (
      <div
        key={match.id}
        style={{ top: `${topPx}px`, left: '16px', width: '220px', height: '82px' }}
        className="absolute rounded-xl border border-slate-200 bg-white overflow-hidden flex flex-col justify-between"
      >
        <div className="px-2.5 py-1 bg-slate-100 border-b border-slate-200 flex items-center justify-between text-[10px] text-slate-700 font-semibold">
          <span className="font-mono-num">
            #{match.matchNumber} · {match.bracketSlot || fallbackTitle}
          </span>
          <button
            type="button"
            onClick={() => onOpenRefereeForMatch(match.id)}
            className="text-orange-600 hover:text-orange-700 font-bold"
          >
            Sân {match.courtNumber} →
          </button>
        </div>
        <div className="px-2.5 py-1 space-y-0.5 text-[11px]">
          <div className="flex items-center justify-between gap-1.5">
            <span
              className={`truncate ${
                winnerSide === 'A' ? 'font-bold text-slate-900' : 'text-slate-700'
              }`}
            >
              {match.teamAName}
            </span>
            <span className="font-mono-num font-bold text-slate-900 tabular-nums shrink-0">
              {match.scoreA}
            </span>
          </div>
          <div className="flex items-center justify-between gap-1.5">
            <span
              className={`truncate ${
                winnerSide === 'B' ? 'font-bold text-slate-900' : 'text-slate-700'
              }`}
            >
              {match.teamBName}
            </span>
            <span className="font-mono-num font-bold text-slate-900 tabular-nums shrink-0">
              {match.scoreB}
            </span>
          </div>
        </div>
      </div>
    );
  };

  const renderMatchTreeCard = (
    match: Match | undefined,
    fallbackTitle: string,
    seedALabel: string,
    seedBLabel: string,
    fallbackTeamA: string,
    fallbackTeamB: string,
    variant: 'semi' | 'final' | 'bronze',
    leftPx: number,
    topPx: number,
    widthPx: number,
    heightPx: number,
  ) => {
    const isFinal = variant === 'final';
    const isBronze = variant === 'bronze';
    const isSeedAHighlighted = highlightSeed === seedALabel;
    const isSeedBHighlighted = highlightSeed === seedBLabel;

    return (
      <div
        style={{
          left: `${leftPx}px`,
          top: `${topPx}px`,
          width: `${widthPx}px`,
          height: `${heightPx}px`,
        }}
        className={`absolute rounded-xl border bg-white overflow-hidden flex flex-col justify-between ${
          isFinal
            ? 'border-orange-500 ring-1 ring-orange-200'
            : isBronze
            ? 'border-amber-300'
            : 'border-slate-200'
        }`}
      >
        <div
          className={`px-2.5 py-1.5 flex items-center justify-between text-[11px] ${
            isFinal
              ? 'bg-orange-600 text-white'
              : isBronze
              ? 'bg-amber-50 text-amber-950 border-b border-amber-200'
              : 'bg-slate-900 text-white'
          }`}
        >
          <span className="font-mono-num font-bold flex items-center gap-1 truncate">
            {isFinal && <Trophy className="w-3 h-3 shrink-0" />}
            {match
              ? `#${match.matchNumber} · ${match.bracketSlot || MATCH_STAGE_LABELS[match.stage]}`
              : fallbackTitle}
          </span>
          {match && (
            <span className="font-mono-num text-[10px] opacity-90 shrink-0">
              Sân {match.courtNumber} · {match.scheduledTime}
            </span>
          )}
        </div>

        <div className="px-2.5 py-1.5 space-y-1">
          <div
            onMouseEnter={() => setHighlightSeed(seedALabel)}
            onMouseLeave={() => setHighlightSeed(null)}
            onClick={() =>
              setHighlightSeed((prev) => (prev === seedALabel ? null : seedALabel))
            }
            className={`flex items-center justify-between gap-2 px-2 py-1 rounded-lg border text-[11px] cursor-pointer transition-colors ${
              isSeedAHighlighted
                ? 'bg-orange-50 border-orange-500'
                : match?.winnerSide === 'A'
                ? 'bg-emerald-50 border-emerald-400 font-bold text-slate-900'
                : 'bg-slate-50 border-slate-200 text-slate-800'
            }`}
          >
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="font-mono-num text-[10px] font-bold text-slate-500 shrink-0">
                {seedALabel}
              </span>
              <span className="truncate font-semibold">
                {match ? match.teamAName : fallbackTeamA}
              </span>
            </div>
            <span className="font-mono-num text-xs font-extrabold text-slate-900 tabular-nums shrink-0">
              {match ? match.scoreA : 0}
            </span>
          </div>

          <div
            onMouseEnter={() => setHighlightSeed(seedBLabel)}
            onMouseLeave={() => setHighlightSeed(null)}
            onClick={() =>
              setHighlightSeed((prev) => (prev === seedBLabel ? null : seedBLabel))
            }
            className={`flex items-center justify-between gap-2 px-2 py-1 rounded-lg border text-[11px] cursor-pointer transition-colors ${
              isSeedBHighlighted
                ? 'bg-orange-50 border-orange-500'
                : match?.winnerSide === 'B'
                ? 'bg-emerald-50 border-emerald-400 font-bold text-slate-900'
                : 'bg-slate-50 border-slate-200 text-slate-800'
            }`}
          >
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="font-mono-num text-[10px] font-bold text-slate-500 shrink-0">
                {seedBLabel}
              </span>
              <span className="truncate font-semibold">
                {match ? match.teamBName : fallbackTeamB}
              </span>
            </div>
            <span className="font-mono-num text-xs font-extrabold text-slate-900 tabular-nums shrink-0">
              {match ? match.scoreB : 0}
            </span>
          </div>
        </div>

        <div className="px-2.5 py-1 bg-slate-50 border-t border-slate-200/80 flex items-center justify-between text-[10px]">
          <span
            className={`font-semibold ${
              match?.status === 'live'
                ? 'text-emerald-600'
                : match?.status === 'completed'
                ? 'text-slate-500'
                : 'text-amber-600'
            }`}
          >
            {match ? MATCH_STATUS_LABELS[match.status] : 'Chờ vòng trước'}
          </span>
          {match && (
            <button
              type="button"
              onClick={() => onOpenRefereeForMatch(match.id)}
              className="font-bold text-orange-600 hover:text-orange-700 inline-flex items-center gap-1"
            >
              <Gavel className="w-3 h-3" />
              Chấm điểm →
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3 sm:p-5 space-y-3">
      {/* Clean Minimal Tree Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-200">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-orange-50 border border-orange-200 flex items-center justify-center shrink-0">
            <GitBranch className="w-4 h-4 text-orange-600" />
          </div>
          <div className="min-w-0">
            <h3 className="font-display text-sm sm:text-lg font-bold tracking-tight text-slate-900 uppercase truncate">
              {division ? `SƠ ĐỒ CÂY NHÁNH ĐẤU · ${division}` : 'SƠ ĐỒ CÂY NHÁNH ĐẤU'}
            </h3>
            <p className="text-[11px] text-slate-500">
              Chụm/tách 2 ngón tay hoặc chạm đúp trực tiếp trên sơ đồ để thu phóng
            </p>
          </div>
        </div>

        {isAdmin && division && (
          <button
            type="button"
            onClick={() => onSyncKnockoutFromGroups(division)}
            className="min-h-[36px] px-3 py-1.5 text-xs font-semibold text-white bg-orange-600 hover:bg-orange-700 rounded-lg transition-colors inline-flex items-center gap-1.5 shrink-0"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Đồng bộ nhánh</span>
          </button>
        )}
      </div>

      {/* Direct Pinch / Wheel / Double-Tap Interactive Tree Diagram Canvas */}
      <div
        ref={viewportRef}
        onWheel={handleWheel}
        onDoubleClick={handleToggleDirectZoom}
        onTouchEnd={handleTouchTapEnd}
        style={{ touchAction: 'pan-x pan-y' }}
        className="w-full overflow-auto rounded-xl bg-slate-50/70 border border-slate-200 p-2 select-none"
      >
        <div
          style={{
            width: `${scaledWidth}px`,
            height: `${scaledHeight}px`,
          }}
          className="relative mx-auto"
        >
          <div
            style={{
              width: `${BASE_TREE_WIDTH}px`,
              height: `${BASE_TREE_HEIGHT}px`,
              transform: `scale(${zoom})`,
              transformOrigin: 'top left',
            }}
            className="relative"
          >
            {/* Subtle Tree Stage Column Headers */}
            <div className="absolute top-0 left-4 w-[220px] text-center text-[11px] font-bold uppercase tracking-wider text-slate-500">
              {hasQuarterfinals ? 'Tứ kết' : 'Đội vào nhánh'}
            </div>
            <div className="absolute top-0 left-[286px] w-[220px] text-center text-[11px] font-bold uppercase tracking-wider text-slate-700">
              Bán kết
            </div>
            <div className="absolute top-0 left-[556px] w-[220px] text-center text-[11px] font-bold uppercase tracking-wider text-orange-600">
              Chung kết
            </div>
            <div className="absolute top-0 left-[812px] w-[136px] text-center text-[11px] font-bold uppercase tracking-wider text-amber-700">
              Vinh danh
            </div>

            {/* Orthogonal SVG Tree Connectors (Exact Pixel Alignment) */}
            <svg
              width={BASE_TREE_WIDTH}
              height={BASE_TREE_HEIGHT}
              viewBox={`0 0 ${BASE_TREE_WIDTH} ${BASE_TREE_HEIGHT}`}
              className="absolute inset-0 pointer-events-none"
              fill="none"
            >
              {/* Branch 1: Top pair (y=57 & y=145) -> Semi 1 (y=101) */}
              <path
                d="M 236 57 H 261 V 101 H 286"
                stroke={highlightSeed === '1A' ? '#EA580C' : '#CBD5E1'}
                strokeWidth={highlightSeed === '1A' ? 2.8 : 2}
                strokeLinejoin="round"
              />
              <path
                d="M 236 145 H 261 V 101"
                stroke={highlightSeed === '2B' ? '#059669' : '#CBD5E1'}
                strokeWidth={highlightSeed === '2B' ? 2.8 : 2}
                strokeLinejoin="round"
              />

              {/* Branch 2: Bottom pair (y=257 & y=345) -> Semi 2 (y=301) */}
              <path
                d="M 236 257 H 261 V 301 H 286"
                stroke={highlightSeed === '1B' ? '#059669' : '#CBD5E1'}
                strokeWidth={highlightSeed === '1B' ? 2.8 : 2}
                strokeLinejoin="round"
              />
              <path
                d="M 236 345 H 261 V 301"
                stroke={highlightSeed === '2A' ? '#EA580C' : '#CBD5E1'}
                strokeWidth={highlightSeed === '2A' ? 2.8 : 2}
                strokeLinejoin="round"
              />

              {/* Branch 3: Semi 1 (y=101) & Semi 2 (y=301) -> Final (y=201) */}
              <path
                d="M 506 101 H 531 V 201 H 556"
                stroke={
                  semi1?.winnerSide || highlightSeed === 'W-BK1' ? '#EA580C' : '#94A3B8'
                }
                strokeWidth={2.4}
                strokeLinejoin="round"
              />
              <path
                d="M 506 301 H 531 V 201"
                stroke={
                  semi2?.winnerSide || highlightSeed === 'W-BK2' ? '#EA580C' : '#94A3B8'
                }
                strokeWidth={2.4}
                strokeLinejoin="round"
              />

              {/* Branch 4: Final (y=201) -> Champion Card (y=201) */}
              <path
                d="M 776 201 H 812"
                stroke="#EA580C"
                strokeWidth={2.6}
              />

              {/* Branch 5: Third Place (y=358) -> Bronze Card (y=358) */}
              <path
                d="M 776 358 H 812"
                stroke="#CBD5E1"
                strokeWidth={2}
                strokeDasharray="4 4"
              />
            </svg>

            {/* LEVEL 1: Quarterfinals (if 4 QFs exist) OR 4 Seeded Branch Leaves */}
            {hasQuarterfinals ? (
              <>
                {renderQuarterfinalNode(quarterfinals[0], 'Tứ kết 1', 16)}
                {renderQuarterfinalNode(quarterfinals[1], 'Tứ kết 2', 104)}
                {renderQuarterfinalNode(quarterfinals[2], 'Tứ kết 3', 216)}
                {renderQuarterfinalNode(quarterfinals[3], 'Tứ kết 4', 304)}
              </>
            ) : (
              <>
                {renderLeafTeamCard('1A', seed1AName, groupA[0]?.club, 24)}
                {renderLeafTeamCard('2B', seed2BName, groupB[1]?.club, 112)}
                {renderLeafTeamCard('1B', seed1BName, groupB[0]?.club, 224)}
                {renderLeafTeamCard('2A', seed2AName, groupA[1]?.club, 312)}
              </>
            )}

            {/* LEVEL 2: Semifinals */}
            {renderMatchTreeCard(
              semi1,
              'Bán kết 1',
              hasQuarterfinals ? 'W-TK1' : '1A',
              hasQuarterfinals ? 'W-TK2' : '2B',
              seed1AName,
              seed2BName,
              'semi',
              286,
              44,
              220,
              114,
            )}
            {renderMatchTreeCard(
              semi2,
              'Bán kết 2',
              hasQuarterfinals ? 'W-TK3' : '1B',
              hasQuarterfinals ? 'W-TK4' : '2A',
              seed1BName,
              seed2AName,
              'semi',
              286,
              244,
              220,
              114,
            )}

            {/* LEVEL 3: Grand Final & Third Place */}
            {renderMatchTreeCard(
              finalMatch,
              'Chung kết',
              'W-BK1',
              'W-BK2',
              'Thắng Bán kết 1',
              'Thắng Bán kết 2',
              'final',
              556,
              140,
              220,
              122,
            )}

            {renderMatchTreeCard(
              thirdPlaceMatch,
              'Tranh Hạng Ba',
              'L-BK1',
              'L-BK2',
              'Thua Bán kết 1',
              'Thua Bán kết 2',
              'bronze',
              556,
              300,
              220,
              116,
            )}

            {/* LEVEL 4: Champion & Bronze Honors */}
            <div
              style={{ left: '812px', top: '155px', width: '136px', height: '92px' }}
              className="absolute rounded-xl border border-amber-400 bg-amber-50/70 p-2.5 flex flex-col items-center justify-center text-center gap-1"
            >
              <div className="w-7 h-7 rounded-lg bg-orange-600 text-white flex items-center justify-center shrink-0">
                <Crown className="w-4 h-4" />
              </div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-orange-700">
                Vô địch
              </div>
              <div className="text-[11px] font-extrabold text-slate-900 truncate w-full">
                {championName}
              </div>
            </div>

            <div
              style={{ left: '812px', top: '320px', width: '136px', height: '76px' }}
              className="absolute rounded-xl border border-slate-200 bg-white p-2.5 flex flex-col items-center justify-center text-center gap-1"
            >
              <Award className="w-4 h-4 text-amber-700 shrink-0" />
              <div className="text-[10px] font-semibold text-slate-500">Hạng Ba</div>
              <div className="text-[11px] font-bold text-slate-900 truncate w-full">
                {bronzeName}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
