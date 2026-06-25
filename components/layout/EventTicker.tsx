'use client';

import { useState, useEffect } from 'react';

type Event = {
  id: string;
  title: string;
  description?: string | null;
  startDate?: string | Date | null;
  endDate?: string | Date | null;
  eventType: string;
};

type EventTickerProps = {
  activeEvents: Event[];
  globalAnnounceDurationMs?: number;
};

export function EventTicker({ activeEvents, globalAnnounceDurationMs = 4000 }: EventTickerProps) {
  const [currentEventIndex, setCurrentEventIndex] = useState(0);

  useEffect(() => {
    if (activeEvents.length <= 1) return;

    const timeout = setTimeout(() => {
      setCurrentEventIndex((prev) => (prev + 1) % activeEvents.length);
    }, globalAnnounceDurationMs);

    return () => clearTimeout(timeout);
  }, [activeEvents, currentEventIndex, globalAnnounceDurationMs]);

  if (activeEvents.length === 0) return null;

  const currentEvent = activeEvents[currentEventIndex];
  if (!currentEvent) return null;

  return (
    <div className="flex-1 mx-2 sm:mx-4 flex items-center h-full pointer-events-auto min-w-[100px]">
      <div className="bg-surface-container-low border border-outline-variant/30 rounded-lg px-2 sm:px-3 py-1 sm:py-1.5 flex items-center gap-1.5 sm:gap-2 overflow-hidden shadow-sm hover:bg-surface-container-high transition-colors max-w-md w-full border-dashed border-emerald-500/30">
        <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 sm:px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-bold shrink-0 whitespace-nowrap">
          🎁 이벤트
        </span>
        <div
          className="flex-1 flex flex-col justify-center animate-in fade-in slide-in-from-bottom-2 duration-500 overflow-hidden"
          key={`event-${currentEventIndex}`}
        >
          <div
            className="text-[10px] sm:text-xs font-bold text-zinc-300 truncate cursor-help"
            title={currentEvent.description || ''}
          >
            {currentEvent.title}
          </div>
          <div className="text-[8px] sm:text-[9px] text-emerald-500/70 truncate font-semibold">
            {currentEvent.startDate
              ? `${new Date(currentEvent.startDate).getMonth() + 1}/${new Date(
                  currentEvent.startDate
                ).getDate()}`
              : '상시'}
            {' ~ '}
            {currentEvent.endDate
              ? `${new Date(currentEvent.endDate).getMonth() + 1}/${new Date(
                  currentEvent.endDate
                ).getDate()}`
              : '종료 시까지'}
          </div>
        </div>
      </div>
    </div>
  );
}
