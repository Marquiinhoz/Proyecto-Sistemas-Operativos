"use client"

import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"

export default function DevicesPanel({ state }: any) {
  if (!state) return null

  const devices = ["keyboard", "disk", "printer", "monitor", "network"]

  return (
    <Card className="p-4 border border-border">
      <h2 className="text-lg font-bold mb-4">Colas de Dispositivos (E/S)</h2>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        {devices.map((device) => {
          const queue = state.colasDispositivos[device] || []
          const active = state.interrupcionesActivas.find((i: any) => i.dispositivo === device)

          return (
            <div key={device} className="flex flex-col h-48 bg-muted rounded border border-border overflow-hidden">
              <div className="p-2 bg-card border-b border-border flex justify-between items-center">
                <span className="font-semibold capitalize text-sm">{device}</span>
                <Badge variant={active ? "default" : "secondary"} className="text-[10px]">
                  {active ? "BUSY" : "IDLE"}
                </Badge>
              </div>

              {/* Active Process */}
              <div className="p-2 bg-blue-500/10 border-b border-border min-h-[50px] flex items-center justify-center">
                {active ? (
                  <div className="text-center">
                    <div className="text-xs font-bold text-blue-600">Procesando PID {active.pidAsociado}</div>
                    <div className="text-[10px] text-muted-foreground">Restante: {active.tiempoRestante}ms</div>
                  </div>
                ) : (
                  <span className="text-[10px] text-muted-foreground">Esperando solicitud...</span>
                )}
              </div>

              {/* Queue */}
              <ScrollArea className="flex-1 p-2">
                <div className="space-y-1">
                  {queue.length === 0 ? (
                    <div className="text-[10px] text-center text-muted-foreground py-2">Cola vacía</div>
                  ) : (
                    queue.map((proc: any, idx: number) => (
                      <div key={proc.pid} className="text-[10px] p-1.5 bg-background rounded border border-border flex justify-between">
                        <span className="font-mono">#{idx + 1}</span>
                        <span className="font-bold">PID {proc.pid}</span>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
