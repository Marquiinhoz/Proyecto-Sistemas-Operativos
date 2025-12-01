"use client"

import { Card } from "@/components/ui/card"
import { Zap } from "lucide-react"
import type { SystemInterrupt } from "@/lib/types"

const INTERRUPT_LABELS: Record<string, string> = {
  timer: "Timer",
  io_request: "I/O Request",
  io_completion: "I/O Completion",
  process_end: "Process End",
  error: "Error",
};

export default function InterruptsPanel({ state }: any) {
  if (!state) return null

  // Combine pending and history, sort by tick descending (newest first)
  const allInterrupts = state.interrupcionesSistema || [];
  
  // Helper to get last N interrupts of a type
  const getRecent = (type: string, limit: number = 50) => {
    return allInterrupts
      .filter((i: SystemInterrupt) => i.tipo === type)
      .sort((a: SystemInterrupt, b: SystemInterrupt) => b.tick - a.tick) // Newest first
      .slice(0, limit);
  };

  const pendientesPorTipo = {
    timer: getRecent("timer"),
    io_request: getRecent("io_request"),
    io_completion: getRecent("io_completion"),
    process_end: getRecent("process_end"),
    error: getRecent("error"),
  };

  const historial = allInterrupts.filter((i: SystemInterrupt) => i.procesada);

  const renderInterruptSection = (tipo: string, interrupciones: SystemInterrupt[]) => (
    <div key={tipo} className="space-y-2">
      <h3 className="text-sm font-bold">{INTERRUPT_LABELS[tipo]}</h3>
      <div className="max-h-[120px] overflow-y-auto pr-2 border rounded-md p-2 bg-muted/10">
        {interrupciones.length === 0 ? (
          <div className="text-xs text-muted-foreground italic">
            Sin interrupciones
          </div>
        ) : (
          interrupciones.map((irq: SystemInterrupt) => (
            <div
              key={irq.id}
              className="flex items-center justify-between py-1 border-b last:border-b-0"
            >
              <div className="flex items-center gap-2">
                <span className="font-bold text-[10px]">{INTERRUPT_LABELS[tipo].toUpperCase()}</span>
                <span className="text-muted-foreground text-[10px]">PID {irq.pidAsociado}</span>
              </div>
              <span className="text-[10px] text-muted-foreground">Tick {irq.tick}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );

  return (
    <Card className="p-4 border border-border flex flex-col gap-4">
      <div className="flex justify-between items-start">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Zap className="w-5 h-5 text-yellow-500" />
          Interrupciones del Sistema
        </h2>
      </div>

      {/* I/O en Progreso */}
      {state.interrupcionesActivas.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-bold">I/O en Progreso</h3>
          {state.interrupcionesActivas.map((irq: any) => (
            <div key={irq.id} className="flex items-center justify-between py-2 border-b last:border-b-0">
              <div className="flex items-center gap-2">
                <span className="font-bold text-xs">{irq.dispositivo.toUpperCase()}</span>
                <span className="text-muted-foreground text-xs">PID {irq.pidAsociado}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-32 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-blue-500" 
                    style={{ width: `${(irq.tiempoRestante / irq.duracion) * 100}%` }}
                  />
                </div>
                <span className="text-xs text-muted-foreground w-10 text-right">{irq.tiempoRestante}ms</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 5 Secciones de Interrupciones */}
      <div className="grid grid-cols-1 gap-4">
        {renderInterruptSection("timer", pendientesPorTipo.timer)}
        {renderInterruptSection("io_request", pendientesPorTipo.io_request)}
        {renderInterruptSection("io_completion", pendientesPorTipo.io_completion)}
        {renderInterruptSection("process_end", pendientesPorTipo.process_end)}
        {renderInterruptSection("error", pendientesPorTipo.error)}
      </div>

      {/* Estadísticas Totales */}
      <div className="space-y-2 pt-2 border-t">
        <h3 className="text-sm font-bold">Estadísticas Totales</h3>
        <div className="grid grid-cols-5 gap-2 text-center text-[10px]">
          {Object.entries(INTERRUPT_LABELS).map(([tipo, label]) => {
            const count = historial.filter((i: SystemInterrupt) => i.tipo === tipo).length;
            return (
              <div key={tipo} className="flex flex-col items-center p-2 bg-background border border-border rounded">
                <span className="font-bold text-2xl">{count}</span>
                <span className="text-muted-foreground text-[9px] mt-1">{label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  )
}
