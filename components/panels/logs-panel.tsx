"use client"

import { Card } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { LogEntry } from "@/lib/types"

export default function LogsPanel({ state }: any) {
  if (!state || !state.logs) return null

  const getLogTypeColor = (tipo: LogEntry["tipo"]) => {
    switch (tipo) {
      case "context_switch": return "bg-blue-500/20 text-blue-700 border-blue-500"
      case "scheduler": return "bg-purple-500/20 text-purple-700 border-purple-500"
      case "interrupt": return "bg-yellow-500/20 text-yellow-700 border-yellow-500"
      case "process_state": return "bg-green-500/20 text-green-700 border-green-500"
      case "error": return "bg-red-500/20 text-red-700 border-red-500"
      case "memory": return "bg-cyan-500/20 text-cyan-700 border-cyan-500"
      case "io": return "bg-orange-500/20 text-orange-700 border-orange-500"
      default: return "bg-gray-500/20 text-gray-700 border-gray-500"
    }
  }

  const getLogTypeLabel = (tipo: LogEntry["tipo"]) => {
    switch (tipo) {
      case "context_switch": return "Cambio Contexto"
      case "scheduler": return "Planificador"
      case "interrupt": return "Interrupción"
      case "process_state": return "Estado Proceso"
      case "error": return "Error"
      case "memory": return "Memoria"
      case "io": return "I/O"
      default: return tipo
    }
  }

  return (
    <Card className="p-4 border border-border h-[400px] flex flex-col overflow-hidden">
      <div className="flex justify-between items-center mb-4 flex-shrink-0">
        <h2 className="text-lg font-bold">Logs del Simulador</h2>
        <div className="text-xs text-muted-foreground">
          Total: {state.logs.length} eventos
        </div>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="space-y-2 pr-4">
          {state.logs.length === 0 ? (
            <div className="text-sm text-muted-foreground italic text-center py-8">
              No hay eventos registrados aún
            </div>
          ) : (
            state.logs.map((log: LogEntry) => (
              <div
                key={log.id}
                className={`p-2 rounded border text-xs ${getLogTypeColor(log.tipo)}`}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={`text-[10px] ${getLogTypeColor(log.tipo)}`}>
                      {getLogTypeLabel(log.tipo)}
                    </Badge>
                    {log.pid && (
                      <span className="font-bold text-[10px]">PID {log.pid}</span>
                    )}
                  </div>
                  <span className="text-[10px] opacity-70">t={log.tiempo}</span>
                </div>
                <div className="text-[11px] font-medium">{log.mensaje}</div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </Card>
  )
}

