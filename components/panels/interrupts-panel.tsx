"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AlertCircle } from "lucide-react"

export default function InterruptsPanel({ state, simulator }: any) {
  if (!state) return null

  // Find manual interrupts (Keyboard) that are waiting
  const manualInterrupt = state.interrupcionesActivas.find((i: any) => i.esManual && i.estado === "active")

  const handleManualAction = (id: number, action: "continuar" | "cancelar") => {
    simulator?.resolverInterrupcionManual(id, action)
  }

  return (
    <Card className="p-4 border border-border flex flex-col gap-4">
      <div className="flex justify-between items-start">
        <h2 className="text-lg font-bold">Interrupciones</h2>
      </div>

      {/* Manual Intervention Area */}
      {manualInterrupt && (
        <div className="bg-yellow-500/20 border border-yellow-500 p-3 rounded-lg animate-pulse">
          <div className="flex items-center gap-2 mb-2 text-yellow-700 font-bold text-sm">
            <AlertCircle className="w-4 h-4" />
            Interrupción de Teclado (PID {manualInterrupt.pidAsociado})
          </div>
          <div className="flex gap-2">
            <Button 
              size="sm" 
              variant="default" 
              className="w-full bg-green-600 hover:bg-green-700"
              onClick={() => handleManualAction(manualInterrupt.id, "continuar")}
            >
              Continuar
            </Button>
            <Button 
              size="sm" 
              variant="destructive" 
              className="w-full"
              onClick={() => handleManualAction(manualInterrupt.id, "cancelar")}
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {/* Active Interrupts List */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Interrupciones Activas</h3>
        {state.interrupcionesActivas.length === 0 ? (
          <div className="text-xs text-muted-foreground italic">Ninguna interrupción activa</div>
        ) : (
          state.interrupcionesActivas.map((irq: any) => (
            <div key={irq.id} className="text-xs p-2 bg-background border border-border rounded flex justify-between items-center">
              <div>
                <span className="font-bold uppercase mr-2">{irq.dispositivo}</span>
                <span className="text-muted-foreground">PID {irq.pidAsociado}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-blue-500" 
                    style={{ width: `${(irq.tiempoRestante / irq.duracion) * 100}%` }}
                  />
                </div>
                <span className="w-8 text-right">{irq.tiempoRestante}ms</span>
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  )
}
