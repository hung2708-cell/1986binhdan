import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import { Activity, Clock } from 'lucide-react';
import type { Match } from '../types/tournament';

interface MatchDensityD3ChartProps {
  matches: Match[];
  courtsCount: number;
}

type BucketResolution = '60m' | '30m';

interface TimeSlotDatum {
  key: string;
  label: string;
  rangeLabel: string;
  startMinutes: number;
  totalMatches: number;
  liveCount: number;
  scheduledCount: number;
  completedCount: number;
  activeCourts: number[];
  loadRatio: number;
}

function parseMinutesFromTime(timeStr: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec((timeStr || '').trim());
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (Number.isNaN(h) || Number.isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) {
    return null;
  }
  return h * 60 + m;
}

function formatMinutesLabel(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

export const MatchDensityD3Chart: React.FC<MatchDensityD3ChartProps> = ({
  matches,
  courtsCount,
}) => {
  const [resolution, setResolution] = useState<BucketResolution>('60m');
  const [hoveredSlot, setHoveredSlot] = useState<{
    datum: TimeSlotDatum;
    x: number;
    y: number;
  } | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>(640);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    setContainerWidth(el.clientWidth || 640);

    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      const nextWidth = entries[0]?.contentRect.width;
      if (nextWidth && nextWidth > 0) {
        setContainerWidth(nextWidth);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const stepMinutes = resolution === '60m' ? 60 : 30;
  const safeCourtsCount = Math.max(1, courtsCount || 1);
  // Ideal capacity per slot: ~2 matches/court/hour or 1 match/court/30m
  const slotCapacity = resolution === '60m' ? safeCourtsCount * 2 : safeCourtsCount;

  const slotData = useMemo<TimeSlotDatum[]>(() => {
    const parsedTimes = matches
      .map((m) => parseMinutesFromTime(m.scheduledTime))
      .filter((t): t is number => t !== null);

    const minMatchHour =
      parsedTimes.length > 0 ? Math.floor(Math.min(...parsedTimes) / 60) : 7;
    const maxMatchHour =
      parsedTimes.length > 0 ? Math.floor(Math.max(...parsedTimes) / 60) : 18;

    const startHour = Math.min(7, minMatchHour);
    const endHour = Math.max(19, maxMatchHour);
    const startMin = startHour * 60;
    const endMin = (endHour + 1) * 60;

    const buckets = new Map<number, Match[]>();
    for (let t = startMin; t < endMin; t += stepMinutes) {
      buckets.set(t, []);
    }

    matches.forEach((m) => {
      const mins = parseMinutesFromTime(m.scheduledTime);
      if (mins === null) return;
      const bucketStart = Math.floor(mins / stepMinutes) * stepMinutes;
      const existing = buckets.get(bucketStart) || [];
      existing.push(m);
      buckets.set(bucketStart, existing);
    });

    return Array.from(buckets.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([bucketStart, slotMatches]) => {
        const label =
          resolution === '60m'
            ? `${Math.floor(bucketStart / 60).toString().padStart(2, '0')}h`
            : formatMinutesLabel(bucketStart);
        const rangeLabel = `${formatMinutesLabel(bucketStart)} – ${formatMinutesLabel(
          bucketStart + stepMinutes,
        )}`;
        const liveCount = slotMatches.filter((m) => m.status === 'live').length;
        const scheduledCount = slotMatches.filter((m) => m.status === 'scheduled').length;
        const completedCount = slotMatches.filter((m) => m.status === 'completed').length;
        const activeCourts = Array.from(
          new Set(slotMatches.map((m) => m.courtNumber).filter((c) => c > 0)),
        ).sort((a, b) => a - b);

        return {
          key: String(bucketStart),
          label,
          rangeLabel,
          startMinutes: bucketStart,
          totalMatches: slotMatches.length,
          liveCount,
          scheduledCount,
          completedCount,
          activeCourts,
          loadRatio: slotCapacity > 0 ? slotMatches.length / slotCapacity : 0,
        };
      });
  }, [matches, resolution, stepMinutes, slotCapacity]);

  const summary = useMemo(() => {
    const activeSlots = slotData.filter((s) => s.totalMatches > 0);
    const peakSlot = activeSlots.reduce<TimeSlotDatum | null>((best, curr) => {
      if (!best || curr.totalMatches > best.totalMatches) return curr;
      return best;
    }, null);
    const avgPerActiveSlot =
      activeSlots.length > 0
        ? (matches.length / activeSlots.length).toFixed(1)
        : '0.0';
    const overloadedCount = slotData.filter((s) => s.totalMatches > slotCapacity).length;

    return {
      peakSlot,
      activeWindowCount: activeSlots.length,
      avgPerActiveSlot,
      overloadedCount,
    };
  }, [slotData, matches.length, slotCapacity]);

  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl) return;

    const width = Math.max(320, containerWidth);
    const height = 276;
    const margin = { top: 22, right: 18, bottom: 38, left: 40 };
    const innerWidth = Math.max(120, width - margin.left - margin.right);
    const innerHeight = Math.max(100, height - margin.top - margin.bottom);

    const svg = d3.select(svgEl);
    svg.selectAll('*').remove();
    svg.attr('viewBox', `0 0 ${width} ${height}`).attr('width', width).attr('height', height);

    const root = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const xScale = d3
      .scaleBand<string>()
      .domain(slotData.map((d) => d.label))
      .range([0, innerWidth])
      .padding(0.24);

    const maxMatches = d3.max(slotData, (d) => d.totalMatches) || 0;
    const yMax = Math.max(slotCapacity + 1, maxMatches + 1, 4);

    const yScale = d3.scaleLinear().domain([0, yMax]).nice().range([innerHeight, 0]);

    // Horizontal gridlines
    const yTicks = yScale.ticks(Math.min(6, yMax));
    root
      .append('g')
      .attr('class', 'grid-lines')
      .selectAll('line')
      .data(yTicks)
      .join('line')
      .attr('x1', 0)
      .attr('x2', innerWidth)
      .attr('y1', (d) => yScale(d))
      .attr('y2', (d) => yScale(d))
      .attr('stroke', '#E2E8F0')
      .attr('stroke-dasharray', '3,3');

    // Court capacity reference threshold line
    if (slotCapacity <= yMax) {
      const capY = yScale(slotCapacity);
      root
        .append('line')
        .attr('x1', 0)
        .attr('x2', innerWidth)
        .attr('y1', capY)
        .attr('y2', capY)
        .attr('stroke', '#EA580C')
        .attr('stroke-width', 1.5)
        .attr('stroke-dasharray', '5,4');

      root
        .append('text')
        .attr('x', innerWidth - 4)
        .attr('y', Math.max(10, capY - 5))
        .attr('text-anchor', 'end')
        .attr('fill', '#C2410C')
        .attr('font-size', '10px')
        .attr('font-weight', '600')
        .text(`Ngưỡng tải ${safeCourtsCount} sân (${slotCapacity} trận)`);
    }

    // Color scale based on court load ratio
    const getBarFill = (d: TimeSlotDatum) => {
      if (d.totalMatches === 0) return '#E2E8F0';
      if (d.totalMatches > slotCapacity) return '#DC2626'; // Over capacity
      if (d.loadRatio >= 0.65) return '#EA580C'; // Peak/optimal busy
      return '#0EA5E9'; // Light/moderate
    };

    // Draw density bars
    root
      .selectAll<SVGRectElement, TimeSlotDatum>('rect.density-bar')
      .data(slotData)
      .join('rect')
      .attr('class', 'density-bar')
      .attr('x', (d) => xScale(d.label) ?? 0)
      .attr('y', (d) => (d.totalMatches > 0 ? yScale(d.totalMatches) : innerHeight - 2))
      .attr('width', xScale.bandwidth())
      .attr('height', (d) =>
        d.totalMatches > 0 ? Math.max(4, innerHeight - yScale(d.totalMatches)) : 2,
      )
      .attr('rx', 4)
      .attr('fill', (d) => getBarFill(d))
      .attr('opacity', (d) => (d.totalMatches === 0 ? 0.5 : 0.92))
      .style('cursor', 'pointer')
      .on('mouseenter', function (event, d) {
        d3.select(this).attr('opacity', 1);
        const bounds = containerRef.current?.getBoundingClientRect();
        const relX = bounds ? event.clientX - bounds.left : 0;
        const relY = bounds ? event.clientY - bounds.top : 0;
        setHoveredSlot({ datum: d, x: relX, y: relY });
      })
      .on('mousemove', function (event, d) {
        const bounds = containerRef.current?.getBoundingClientRect();
        const relX = bounds ? event.clientX - bounds.left : 0;
        const relY = bounds ? event.clientY - bounds.top : 0;
        setHoveredSlot({ datum: d, x: relX, y: relY });
      })
      .on('mouseleave', function (_event, d) {
        d3.select(this).attr('opacity', d.totalMatches === 0 ? 0.5 : 0.92);
        setHoveredSlot(null);
      })
      .on('click', function (event, d) {
        const bounds = containerRef.current?.getBoundingClientRect();
        const relX = bounds ? event.clientX - bounds.left : 0;
        const relY = bounds ? event.clientY - bounds.top : 0;
        setHoveredSlot((prev) =>
          prev?.datum.key === d.key ? null : { datum: d, x: relX, y: relY },
        );
      });

    // Value labels above non-zero bars
    root
      .selectAll<SVGTextElement, TimeSlotDatum>('text.bar-value')
      .data(slotData.filter((d) => d.totalMatches > 0))
      .join('text')
      .attr('class', 'bar-value')
      .attr('x', (d) => (xScale(d.label) ?? 0) + xScale.bandwidth() / 2)
      .attr('y', (d) => yScale(d.totalMatches) - 5)
      .attr('text-anchor', 'middle')
      .attr('fill', '#0F172A')
      .attr('font-size', '10px')
      .attr('font-weight', '700')
      .style('font-variant-numeric', 'tabular-nums')
      .text((d) => String(d.totalMatches));

    // X-axis (thin ticks on dense 30m mode if narrow screen)
    const tickFilterStep =
      resolution === '30m' ? (width < 640 ? 4 : 2) : width < 480 ? 2 : 1;
    const xAxis = d3
      .axisBottom(xScale)
      .tickValues(
        slotData
          .filter((_, idx) => idx % tickFilterStep === 0)
          .map((d) => d.label),
      )
      .tickSizeOuter(0);

    const xAxisG = root
      .append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(xAxis);

    xAxisG.select('.domain').attr('stroke', '#CBD5E1');
    xAxisG.selectAll('.tick line').attr('stroke', '#CBD5E1');
    xAxisG
      .selectAll('.tick text')
      .attr('fill', '#475569')
      .attr('font-size', '11px')
      .style('font-variant-numeric', 'tabular-nums');

    // Y-axis
    const yAxis = d3
      .axisLeft(yScale)
      .ticks(Math.min(6, yMax))
      .tickFormat((v) => `${Number(v)}`)
      .tickSizeOuter(0);

    const yAxisG = root.append('g').call(yAxis);
    yAxisG.select('.domain').attr('stroke', '#CBD5E1');
    yAxisG.selectAll('.tick line').attr('stroke', '#CBD5E1');
    yAxisG
      .selectAll('.tick text')
      .attr('fill', '#475569')
      .attr('font-size', '11px')
      .style('font-variant-numeric', 'tabular-nums');
  }, [slotData, containerWidth, resolution, slotCapacity, safeCourtsCount]);

  return (
    <div className="border border-slate-200 rounded-xl p-4 sm:p-5 space-y-4 print-break-inside-avoid">
      {/* Header + Granularity Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-orange-50 border border-orange-200 flex items-center justify-center shrink-0 mt-0.5">
            <Activity className="w-4 h-4 text-orange-600" />
          </div>
          <div>
            <h3 className="font-display text-base font-bold text-slate-900 uppercase">
              BIỂU ĐỒ D3 MẬT ĐỘ TRẬN ĐẤU THEO KHUNG GIỜ TRONG NGÀY
            </h3>
            <p className="text-xs text-slate-500">
              Theo dõi phân bổ tải lượng sân theo giờ để BTC điều phối sân thi đấu hợp lý
            </p>
          </div>
        </div>

        <div className="flex items-center bg-slate-100 p-1 rounded-lg text-xs shrink-0 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setResolution('60m')}
            className={`px-3 py-1.5 rounded-md font-semibold transition-colors ${
              resolution === '60m'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Theo giờ (1h)
          </button>
          <button
            type="button"
            onClick={() => setResolution('30m')}
            className={`px-3 py-1.5 rounded-md font-semibold transition-colors ${
              resolution === '30m'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Theo ca (30 phút)
          </button>
        </div>
      </div>

      {/* Court Load Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
        <div className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-200/80">
          <div className="text-slate-500">Khung giờ cao điểm</div>
          <div className="mt-0.5 font-mono-num font-bold text-slate-900">
            {summary.peakSlot
              ? `${summary.peakSlot.label} (${summary.peakSlot.totalMatches} trận)`
              : 'Chưa có'}
          </div>
        </div>

        <div className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-200/80">
          <div className="text-slate-500">Khung giờ có lịch</div>
          <div className="mt-0.5 font-mono-num font-bold text-slate-900">
            {summary.activeWindowCount} khung giờ
          </div>
        </div>

        <div className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-200/80">
          <div className="text-slate-500">Mật độ TB / khung giờ</div>
          <div className="mt-0.5 font-mono-num font-bold text-orange-600">
            {summary.avgPerActiveSlot} trận
          </div>
        </div>

        <div className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-200/80">
          <div className="text-slate-500">Khung vượt tải sân</div>
          <div
            className={`mt-0.5 font-mono-num font-bold ${
              summary.overloadedCount > 0 ? 'text-rose-600' : 'text-emerald-600'
            }`}
          >
            {summary.overloadedCount} khung giờ
          </div>
        </div>
      </div>

      {/* D3 SVG Container */}
      <div ref={containerRef} className="relative w-full">
        <svg ref={svgRef} className="w-full h-auto block overflow-visible" />

        {matches.length === 0 && (
          <div className="mt-2 py-2.5 px-3 rounded-lg bg-slate-50 border border-slate-200/80 text-center text-xs text-slate-500 flex items-center justify-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>
              Chưa có trận đấu nào được xếp lịch. Biểu đồ mật độ D3 sẽ tự động hiển thị theo khung giờ ngay khi có lịch đấu.
            </span>
          </div>
        )}

        {/* Interactive D3 Hover Tooltip */}
        {hoveredSlot && (
          <div
            style={{
              left: `${Math.min(Math.max(12, hoveredSlot.x + 10), Math.max(12, containerWidth - 220))}px`,
              top: `${Math.max(8, hoveredSlot.y - 84)}px`,
            }}
            className="pointer-events-none absolute z-20 w-52 bg-slate-900 text-white rounded-lg px-3 py-2 text-[11px] shadow-lg border border-slate-700 space-y-1"
          >
            <div className="font-mono-num font-bold text-orange-400">
              Khung giờ {hoveredSlot.datum.rangeLabel}
            </div>
            <div className="flex items-center justify-between font-mono-num">
              <span className="text-slate-300">Số trận đấu:</span>
              <span className="font-bold text-white">{hoveredSlot.datum.totalMatches} trận</span>
            </div>
            <div className="flex items-center justify-between font-mono-num text-[10px] text-slate-300">
              <span>Đang đấu / Sắp / Xong:</span>
              <span>
                {hoveredSlot.datum.liveCount} / {hoveredSlot.datum.scheduledCount} /{' '}
                {hoveredSlot.datum.completedCount}
              </span>
            </div>
            {hoveredSlot.datum.activeCourts.length > 0 && (
              <div className="text-[10px] text-slate-300 pt-0.5 border-t border-slate-700/80">
                Sân hoạt động: {hoveredSlot.datum.activeCourts.map((c) => `Sân ${c}`).join(', ')}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Density Legend */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[11px] text-slate-600 pt-1 border-t border-slate-100">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-xs bg-sky-500 inline-block" />
          Tải nhẹ (dưới 65% sức chứa)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-xs bg-orange-600 inline-block" />
          Cao điểm hợp lý (65–100%)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-xs bg-rose-600 inline-block" />
          Vượt ngưỡng tải sân (&gt;100%)
        </span>
      </div>
    </div>
  );
};
