'use client';

import React, { useState } from 'react';
import { Wrench, Calendar, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export function MaintenanceBanner() {
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.3 }}
        className="mx-auto max-w-6xl px-4 pt-4 sm:pt-6"
      >
        <div className="relative overflow-hidden rounded-2xl border-2 border-[#FFE899] bg-[#FFFBEB] p-4 shadow-[0_8px_24px_rgba(245,158,11,0.1)] sm:p-5">
          {/* Sombra sutil / adorno de fondo */}
          <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-[#FFD500]/20 blur-xl" />

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
            <div className="flex items-start gap-3.5">
              <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#FFE480] text-[#7A5B00] shadow-sm ring-1 ring-[#FFC200]/40">
                <Wrench className="h-5 w-5 animate-pulse" />
              </div>

              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-display text-base font-bold text-[#4A3800]">
                    🐣 Mantenimiento programado en la plataforma
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#FFE899] px-2.5 py-0.5 text-xs font-bold text-[#6B5000] border border-[#FFD500]/50">
                    <Calendar className="h-3 w-3" />
                    Hasta el 23 de agosto
                  </span>
                </div>
                <p className="text-xs sm:text-sm font-medium leading-relaxed text-[#5C4500]">
                  Estamos realizando optimizaciones y ajustes técnicos en nuestros servicios. Por este motivo, es posible que algunas secciones, datos de la comunidad o contenidos de la web tarden en cargar o tengan disponibilidad limitada temporalmente. ¡Gracias por la paciencia y comprensión, pollitos! 💛
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsVisible(false)}
              className="self-end sm:self-center shrink-0 rounded-xl p-2 text-[#7A5B00] hover:bg-[#FFE899] transition-colors cursor-pointer"
              aria-label="Cerrar aviso"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
