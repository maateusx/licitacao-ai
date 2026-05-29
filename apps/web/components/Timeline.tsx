'use client';

import { useMemo, useRef } from 'react';
import { addDays, differenceInCalendarDays, format, parseISO, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Licitacao } from '@/lib/types';
import { LicitacaoCard } from './LicitacaoCard';

interface TimelineProps {
  data: Licitacao[];
  onSelect: (id: string) => void;
}

const CARD_WIDTH = 200;
const CARD_HEIGHT = 96;
const LANE_GAP = 8;
const AXIS_HEIGHT = 32;
const TOP_PADDING = 8;
const SIDE_PADDING = 24;
const MIN_PX_PER_DAY = 28;

interface Placed {
  licitacao: Licitacao;
  x: number;
  lane: number;
  encerramento: Date;
}

/**
 * Layout: cada card é posicionado em X pela data de encerramento;
 * empilhamos em "lanes" verticais com algoritmo guloso pra evitar overlap.
 */
function packLanes(items: Licitacao[], origin: Date, pxPerDay: number): Placed[] {
  const sorted = items
    .filter((i): i is Licitacao & { data_encerramento: string } => !!i.data_encerramento)
    .map((i) => ({ item: i, date: startOfDay(parseISO(i.data_encerramento!)) }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  const laneEnds: number[] = []; // X final (px) do último card por lane
  const out: Placed[] = [];

  for (const { item, date } of sorted) {
    const x = differenceInCalendarDays(date, origin) * pxPerDay + SIDE_PADDING;
    let lane = laneEnds.findIndex((end) => end <= x);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(0);
    }
    laneEnds[lane] = x + CARD_WIDTH + LANE_GAP;
    out.push({ licitacao: item, x, lane, encerramento: date });
  }

  return out;
}

export function Timeline({ data, onSelect }: TimelineProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const layout = useMemo(() => {
    const today = startOfDay(new Date());
    const dates = data
      .map((d) => (d.data_encerramento ? startOfDay(parseISO(d.data_encerramento)) : null))
      .filter((d): d is Date => d != null);

    if (dates.length === 0) {
      return null;
    }

    const minDate = dates.reduce((a, b) => (a < b ? a : b));
    const maxDate = dates.reduce((a, b) => (a > b ? a : b));
    const origin = startOfDay(addDays(today < minDate ? today : minDate, -2));
    const end = startOfDay(addDays(today > maxDate ? today : maxDate, 3));
    const totalDays = Math.max(differenceInCalendarDays(end, origin), 7);

    const pxPerDay = MIN_PX_PER_DAY;
    const placed = packLanes(data, origin, pxPerDay);
    const totalLanes = placed.reduce((max, p) => Math.max(max, p.lane + 1), 1);

    const totalWidth = totalDays * pxPerDay + SIDE_PADDING * 2;
    const totalHeight =
      AXIS_HEIGHT + TOP_PADDING + totalLanes * (CARD_HEIGHT + LANE_GAP) + 24;

    const todayX =
      today >= origin && today <= end
        ? differenceInCalendarDays(today, origin) * pxPerDay + SIDE_PADDING
        : null;

    const ticks: Array<{ x: number; label: string; weekStart: boolean }> = [];
    for (let i = 0; i <= totalDays; i++) {
      const day = addDays(origin, i);
      const x = i * pxPerDay + SIDE_PADDING;
      const isMonday = day.getDay() === 1;
      const isFirstOfMonth = day.getDate() === 1;
      if (isMonday || isFirstOfMonth || i === 0 || i === totalDays) {
        ticks.push({
          x,
          label: format(day, "dd 'de' MMM", { locale: ptBR }),
          weekStart: isMonday || isFirstOfMonth,
        });
      }
    }

    return { placed, totalWidth, totalHeight, todayX, ticks, totalLanes };
  }, [data]);

  if (!layout) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-slate-400">
        Nenhuma licitação com data de encerramento para exibir.
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="timeline-scroll relative h-full overflow-auto bg-slate-50">
      <div
        className="relative"
        style={{ width: layout.totalWidth, height: layout.totalHeight }}
      >
        {/* Eixo X */}
        <div
          className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur"
          style={{ height: AXIS_HEIGHT, width: layout.totalWidth }}
        >
          {layout.ticks.map((tick, i) => (
            <div
              key={i}
              className="absolute top-0 flex h-full items-end pb-1 pl-1 text-[10px] uppercase tracking-wide text-slate-500"
              style={{ left: tick.x }}
            >
              <span className={tick.weekStart ? 'font-medium text-slate-700' : ''}>
                {tick.label}
              </span>
            </div>
          ))}
        </div>

        {/* Grid de semanas */}
        {layout.ticks
          .filter((t) => t.weekStart)
          .map((tick, i) => (
            <div
              key={`grid-${i}`}
              className="absolute top-0 z-0 w-px bg-slate-200/60"
              style={{ left: tick.x, height: layout.totalHeight }}
            />
          ))}

        {/* Marca "hoje" */}
        {layout.todayX != null && (
          <>
            <div
              className="absolute top-0 z-10 w-px bg-red-500"
              style={{ left: layout.todayX, height: layout.totalHeight }}
            />
            <div
              className="absolute z-10 -translate-x-1/2 rounded bg-red-500 px-1.5 py-0.5 text-[10px] font-medium text-white"
              style={{ left: layout.todayX, top: AXIS_HEIGHT - 14 }}
            >
              hoje
            </div>
          </>
        )}

        {/* Cards */}
        {layout.placed.map((p) => (
          <div
            key={p.licitacao.id}
            className="absolute z-10"
            style={{
              left: p.x,
              top: AXIS_HEIGHT + TOP_PADDING + p.lane * (CARD_HEIGHT + LANE_GAP),
              width: CARD_WIDTH,
              height: CARD_HEIGHT,
            }}
          >
            <LicitacaoCard licitacao={p.licitacao} onClick={() => onSelect(p.licitacao.id)} />
          </div>
        ))}
      </div>
    </div>
  );
}
