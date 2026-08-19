'use client';

import { useState, useEffect, useRef } from 'react';

type Announcement = {
  id: string;
  title: string;
  content?: string | null;
};

type AnnouncementTickerProps = {
  serverAnnouncements: Announcement[];
  globalAnnounceDurationMs?: number;
  setSelectedAnnouncement: (ann: Announcement) => void;
  setIsAnnouncementModalOpen: (open: boolean) => void;
};

export function AnnouncementTicker({
  serverAnnouncements,
  globalAnnounceDurationMs = 4000,
  setSelectedAnnouncement,
  setIsAnnouncementModalOpen,
}: AnnouncementTickerProps) {
  const [currentAnnounceIndex, setCurrentAnnounceIndex] = useState(0);
  const touchStartXRef = useRef(0);
  const touchEndXRef = useRef(0);

  useEffect(() => {
    if (serverAnnouncements.length <= 1) return;

    const timeout = setTimeout(() => {
      setCurrentAnnounceIndex((prev) => (prev + 1) % serverAnnouncements.length);
    }, globalAnnounceDurationMs);

    return () => clearTimeout(timeout);
  }, [serverAnnouncements, currentAnnounceIndex, globalAnnounceDurationMs]);

  if (serverAnnouncements.length === 0) return null;

  const ann = serverAnnouncements[currentAnnounceIndex];
  if (!ann) return null;

  return (
    <div
      className="flex flex-col border-b border-primary/20 shrink-0 overflow-hidden relative"
      style={{ minHeight: '48px' }}
    >
      <div
        className="absolute inset-0 bg-gradient-to-r from-primary/10 via-surface-container-high to-secondary/10 pt-2 pb-3 px-4 flex items-center gap-3 animate-in fade-in zoom-in-95 duration-500 cursor-pointer hover:bg-surface-variant/30 transition-colors"
        onTouchStart={(e) => {
          touchStartXRef.current = e.touches[0].clientX;
        }}
        onTouchEnd={(e) => {
          touchEndXRef.current = e.changedTouches[0].clientX;
          const diff = touchStartXRef.current - touchEndXRef.current;
          if (diff > 50) {
            setCurrentAnnounceIndex((prev) => (prev + 1) % serverAnnouncements.length);
          } else if (diff < -50) {
            setCurrentAnnounceIndex(
              (prev) => (prev - 1 + serverAnnouncements.length) % serverAnnouncements.length
            );
          }
        }}
        onClick={() => {
          if (Math.abs(touchStartXRef.current - touchEndXRef.current) < 10) {
            setSelectedAnnouncement(ann);
            setIsAnnouncementModalOpen(true);
          }
        }}
      >
        <span className="bg-primary/20 text-primary border border-primary/30 px-2 py-0.5 rounded shadow-sm text-[10px] font-bold shrink-0">
          공지
        </span>
        <div className="text-sm font-semibold text-zinc-100 flex-1 truncate flex items-center gap-2">
          <span className="text-secondary/90 tracking-tight truncate">{ann.title}</span>
          {ann.content && (
            <span className="text-xs text-on-surface-variant font-normal whitespace-pre-wrap truncate hidden sm:block pointer-events-none">
              - {ann.content}
            </span>
          )}
        </div>
        <div className="text-[10px] text-zinc-500 bg-surface-variant/30 px-1.5 py-0.5 rounded-full shrink-0 relative z-10">
          {currentAnnounceIndex + 1} / {serverAnnouncements.length}
        </div>
      </div>

      {/* 하단 페이지네이션 닷 (Dots) */}
      {serverAnnouncements.length > 1 && (
        <div className="absolute bottom-1 left-0 right-0 flex justify-center items-center gap-1.5 pointer-events-none">
          {serverAnnouncements.map((_, idx) => (
            <div
              key={idx}
              className={`h-1.5 rounded-full shadow-sm transition-all duration-300 ${
                idx === currentAnnounceIndex ? 'w-4 bg-primary' : 'w-1.5 bg-zinc-600/60'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
