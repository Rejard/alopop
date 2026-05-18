"use client";

import React, { createContext, useContext, useState, ReactNode, useCallback } from "react";
import { AlertTriangle, Info, CheckCircle2 } from "lucide-react";

export type ConfirmType = "info" | "danger" | "success";

interface ConfirmOptions {
  title?: string;
  message: string;
  type?: ConfirmType;
  confirmText?: string;
  cancelText?: string;
}

interface ConfirmContextType {
  confirm: (options: ConfirmOptions | string) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextType | undefined>(undefined);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions>({ message: "" });
  const [resolver, setResolver] = useState<(value: boolean) => void>();
  const [isClosing, setIsClosing] = useState(false);

  const confirm = useCallback((opts: ConfirmOptions | string) => {
    return new Promise<boolean>((resolve) => {
      const parsedOpts = typeof opts === "string" ? { message: opts } : opts;
      setOptions({
        title: parsedOpts.title,
        message: parsedOpts.message,
        type: parsedOpts.type || "info",
        confirmText: parsedOpts.confirmText || "확인",
        cancelText: parsedOpts.cancelText || "취소",
      });
      setResolver(() => resolve);
      setIsClosing(false);
      setIsOpen(true);
    });
  }, []);

  const handleClose = (result: boolean) => {
    setIsClosing(true);
    setTimeout(() => {
      setIsOpen(false);
      if (resolver) resolver(result);
    }, 200); // Wait for fade-out animation
  };

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          {/* Backdrop */}
          <div 
            className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-200 ${isClosing ? 'opacity-0' : 'opacity-100 animate-in fade-in'}`}
            onClick={() => handleClose(false)}
          ></div>
          
          {/* Modal */}
          <div 
            className={`relative w-full max-w-sm bg-[#14101d]/95 backdrop-blur-xl border border-white/10 rounded-[32px] p-6 shadow-[0_18px_42px_rgba(9,7,13,0.7)] flex flex-col gap-5 transition-all duration-200 ${isClosing ? 'opacity-0 scale-95' : 'opacity-100 scale-100 animate-in zoom-in-95 fade-in'}`}
          >
            <div className="flex flex-col items-center text-center gap-3">
              {/* Icon */}
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${
                options.type === 'danger' ? 'bg-red-500/10 text-red-400' :
                options.type === 'success' ? 'bg-emerald-500/10 text-emerald-400' :
                'bg-[#9c48ea]/10 text-[#62fae3]'
              }`}>
                {options.type === 'danger' && <AlertTriangle size={28} strokeWidth={2.5} />}
                {options.type === 'success' && <CheckCircle2 size={28} strokeWidth={2.5} />}
                {options.type === 'info' && <Info size={28} strokeWidth={2.5} />}
              </div>

              {/* Text */}
              <div>
                {options.title && <h3 className="text-xl font-bold text-white mb-2 tracking-tight">{options.title}</h3>}
                <p className="text-[15px] font-medium text-white/70 leading-relaxed break-keep">
                  {options.message.split('\n').map((line, i) => (
                    <React.Fragment key={i}>
                      {line}
                      <br />
                    </React.Fragment>
                  ))}
                </p>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex gap-3 mt-2">
              <button
                onClick={() => handleClose(false)}
                className="flex-1 py-3.5 bg-white/5 hover:bg-white/10 text-white/70 font-bold text-[15px] rounded-2xl transition-colors active:scale-[0.98]"
              >
                {options.cancelText}
              </button>
              <button
                onClick={() => handleClose(true)}
                className={`flex-1 py-3.5 font-bold text-[15px] rounded-2xl transition-transform active:scale-[0.98] ${
                  options.type === 'danger' 
                    ? 'bg-gradient-to-br from-rose-500 to-red-600 text-white shadow-lg shadow-red-500/20' 
                    : 'bg-gradient-to-br from-[#9c48ea] to-[#62fae3] text-[#09070d] shadow-lg shadow-[#9c48ea]/20'
                }`}
              >
                {options.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const context = useContext(ConfirmContext);
  if (context === undefined) {
    throw new Error("useConfirm must be used within a ConfirmProvider");
  }
  return context.confirm;
}
