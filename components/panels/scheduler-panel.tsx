"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export default function SchedulerPanel({ state, simulator, onStateChange }: any) {
  const [quantum, setQuantum] = useState(state.quantum)

  const changeScheduler = (scheduler: any) => {
    simulator?.setScheduler(scheduler)
    onStateChange()
  }

  const toggleApropiativo = () => {
    simulator?.setApropiativo(!state.apropiativo)
    onStateChange()
  }

  const updateQuantum = (value: string) => {
    const numValue = parseInt(value, 10)
    if (!isNaN(numValue) && numValue > 0) {
      setQuantum(numValue)
      simulator?.setQuantum(numValue)
      onStateChange()
    }
  }

  const changeMemoryStrategy = (strategy: "FirstFit" | "BestFit" | "WorstFit") => {
    simulator?.setMemoryStrategy(strategy)
    onStateChange()
  }

  return (
    <Card className="p-4 border border-border">
      <h2 className="text-lg font-bold mb-4">Scheduler</h2>

      <div className="space-y-3">
        <div>
          <p className="text-sm font-semibold mb-2">Política Actual:</p>
          <div className="grid grid-cols-2 gap-2">
            {["FCFS", "SJF", "RoundRobin", "Prioridades"].map((sched) => (
              <Button
                key={sched}
                onClick={() => changeScheduler(sched)}
                variant={state.scheduler === sched ? "default" : "outline"}
                size="sm"
                className="text-xs"
              >
                {sched}
              </Button>
            ))}
          </div>
        </div>

        {state.scheduler === "RoundRobin" && (
          <div>
            <label className="text-sm font-semibold mb-2 block">Quantum:</label>
            <Input
              type="number"
              min="1"
              max="100"
              value={quantum}
              onChange={(e) => updateQuantum(e.target.value)}
              className="w-full"
              placeholder="Ingrese el quantum"
            />
          </div>
        )}

        <div>
          <p className="text-sm font-semibold mb-2">Estrategia de Memoria:</p>
          <div className="grid grid-cols-3 gap-2">
            {["FirstFit", "BestFit", "WorstFit"].map((strategy) => (
              <Button
                key={strategy}
                onClick={() => changeMemoryStrategy(strategy as "FirstFit" | "BestFit" | "WorstFit")}
                variant={state.memoryStrategy === strategy ? "default" : "outline"}
                size="sm"
                className="text-xs"
              >
                {strategy}
              </Button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between p-2 bg-muted rounded">
          <span className="text-sm">Modo Apropiativo</span>
          <button
            onClick={toggleApropiativo}
            className={`w-12 h-6 rounded-full transition ${state.apropiativo ? "bg-green-600" : "bg-gray-400"}`}
          >
            <div
              className={`w-5 h-5 bg-white rounded-full transition transform ${
                state.apropiativo ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>

        <div className="mt-4 p-3 bg-muted rounded text-xs space-y-1">
          <div>
            Procesos Total: <span className="font-bold">{state.procesos.length}</span>
          </div>
          <div>
            Cambios Contexto: <span className="font-bold">{state.cambiosContextoTotal}</span>
          </div>
        </div>
      </div>
    </Card>
  )
}
