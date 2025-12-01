"use client"

import { useState, useEffect, useRef } from "react"
import { OSSimulator } from "@/lib/os-simulator"
import { ScenarioManager } from "@/lib/scenario-manager"
import ProcessPanel from "./panels/process-panel"
import MemoryPanel from "./panels/memory-panel"
import SchedulerPanel from "./panels/scheduler-panel"
import InterruptsPanel from "./panels/interrupts-panel"
import DevicesPanel from "./panels/devices-panel"
import StatsPanel from "./panels/stats-panel"
import LogsPanel from "./panels/logs-panel"
import MetricsDashboard from "./panels/metrics-dashboard"
import GanttChart from "./panels/gantt-chart"
import DeadlockAlert from "./panels/deadlock-alert"
import StateDiagram from "./panels/state-diagram"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Download, Upload } from "lucide-react"

export default function OSSimulatorComponent() {
  const simulatorRef = useRef<OSSimulator | null>(null)
  const [state, setState] = useState<any>(null)
  const [running, setRunning] = useState(false)
  const [speed, setSpeed] = useState(100)
  const [keyboardModalOpen, setKeyboardModalOpen] = useState(false)
  const [pendingKeyboardIrq, setPendingKeyboardIrq] = useState<number | null>(null)
  const [deadlockDetected, setDeadlockDetected] = useState(false)

  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    simulatorRef.current = new OSSimulator()
    simulatorRef.current.generarProcesosIniciales(5)
    setState(simulatorRef.current.getState())
  }, [])

  useEffect(() => {
    if (running && simulatorRef.current) {
      intervalRef.current = setInterval(
        () => {
          if (!simulatorRef.current) return

          simulatorRef.current.ejecutarTick()
          const newState = { ...simulatorRef.current.getState() }
          setState(newState)

          // Check for deadlock
          if (newState.deadlockStatus?.detected && !deadlockDetected) {
            setDeadlockDetected(true)
            setRunning(false) // Pause simulation
          }

          // Check for manual keyboard interrupts
          const manualIrq = newState.interrupcionesActivas.find((i: any) => i.esManual && i.estado === "active")
          if (manualIrq && !keyboardModalOpen) {
            setPendingKeyboardIrq(manualIrq.id)
            setKeyboardModalOpen(true)
            setRunning(false) // Pause for user input
          }
        },
        Math.max(10, 200 - speed),
      )
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current)
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [running, speed, keyboardModalOpen, deadlockDetected])

  const handleKeyboardAction = (action: "continuar" | "cancelar") => {
    if (simulatorRef.current && pendingKeyboardIrq) {
      simulatorRef.current.resolverInterrupcionManual(pendingKeyboardIrq, action)
      setState({ ...simulatorRef.current.getState() })
      setKeyboardModalOpen(false)
      setPendingKeyboardIrq(null)
      setRunning(true) // Resume
    }
  }

  const crearProceso = (
    tamanio?: number,
    burstTime?: number,
    prioridad?: number,
    maxInterrupciones?: number,
    porcentajeDatos?: number,
    porcentajeVariable?: number
  ) => {
    if (simulatorRef.current) {
      simulatorRef.current.crearProceso(tamanio, burstTime, prioridad, maxInterrupciones, porcentajeDatos, porcentajeVariable)
      setState({ ...simulatorRef.current.getState() })
    }
  }

  const editarProceso = (
    pid: number,
    updates: {
      tamanio?: number;
      burstTime?: number;
      prioridad?: number;
      porcentajeDatos?: number;
      porcentajeVariable?: number;
      maxInterrupciones?: number;
    }
  ) => {
    if (simulatorRef.current) {
      simulatorRef.current.editarProceso(pid, updates)
      setState({ ...simulatorRef.current.getState() })
    }
  }

  const eliminarProceso = (pid: number) => {
    if (simulatorRef.current) {
      simulatorRef.current.eliminarProceso(pid)
      setState({ ...simulatorRef.current.getState() })
    }
  }

  // Export scenario
  const handleExportScenario = () => {
    if (simulatorRef.current) {
      const currentState = simulatorRef.current.getState();
      const scenario = ScenarioManager.exportScenario(currentState);
      ScenarioManager.downloadScenario(scenario);
    }
  }

  // Import scenario
  const handleImportScenario = async () => {
    const scenario = await ScenarioManager.loadScenarioFromFile();
    if (!scenario || !simulatorRef.current) return;

    // Reset simulator
    simulatorRef.current = new OSSimulator();

    // Apply scheduler configuration
    simulatorRef.current.setScheduler(scenario.scheduler.algorithm);
    simulatorRef.current.setApropiativo(scenario.scheduler.apropiativo);
    simulatorRef.current.setQuantum(scenario.scheduler.quantum);
    simulatorRef.current.setMemoryStrategy(scenario.memoryStrategy);

    // Create processes from scenario
    scenario.processes.forEach(pConfig => {
      simulatorRef.current!.crearProceso(
        pConfig.tamanio,
        pConfig.burstTime,
        pConfig.prioridad,
        pConfig.maxInterrupciones,
        pConfig.porcentajeDatos,
        pConfig.porcentajeVariable
      );
    });

    setState(simulatorRef.current.getState());
    setRunning(false);
  }

  // Export logs
  const handleExportLogs = () => {
    if (state?.logs) {
      ScenarioManager.exportLogs(state.logs);
    }
  }

  // Handle deadlock resolution
  const handleDeadlockResolve = (action: "cancel_process" | "ignore", pid?: number) => {
    if (action === "cancel_process" && pid && simulatorRef.current) {
      simulatorRef.current.eliminarProceso(pid);
      setState({ ...simulatorRef.current.getState() });
    }
    setDeadlockDetected(false);
  }

  if (!state) return <div className="p-4">Inicializando...</div>

  return (
    <div className="w-full h-full bg-background text-foreground overflow-auto">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-card border-b border-border p-4 space-y-3 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-bold">Simulador de Procesos</h1>
          <div className="flex items-center gap-2">
            <Button onClick={() => setRunning(!running)} variant={running ? "destructive" : "default"}>
              {running ? "Pausar" : "Ejecutar"}
            </Button>
            <Button
              onClick={() => {
                if (simulatorRef.current) {
                  simulatorRef.current.ejecutarTick();
                  setState({ ...simulatorRef.current.getState() });
                }
              }}
              variant="outline"
              size="sm"
              title="Ejecutar un solo tick de simulación"
              disabled={running}
            >
              ▶ Ejecutar 1 Tick
            </Button>
            <Button
              onClick={() => {
                simulatorRef.current = new OSSimulator()
                simulatorRef.current.generarProcesosIniciales(5)
                setState(simulatorRef.current.getState())
                setRunning(false)
              }}
              variant="outline"
            >
              Reiniciar
            </Button>
            <Button
              onClick={handleExportScenario}
              variant="outline"
              size="sm"
              title="Exportar configuración actual"
            >
              <Download className="h-4 w-4 mr-1" />
              Exportar
            </Button>
            <Button
              onClick={handleImportScenario}
              variant="outline"
              size="sm"
              title="Importar configuración desde archivo"
            >
              <Upload className="h-4 w-4 mr-1" />
              Importar
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">Velocidad:</label>
          <input
            type="range"
            min="0"
            max="190"
            step="5"
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
            className="w-48"
          />
          <span className="text-xs text-muted-foreground w-20">
            {speed === 0 ? "Muy Lenta" : speed < 50 ? "Lenta" : speed < 100 ? "Media" : speed < 150 ? "Rápida" : "Muy Rápida"}
          </span>
        </div>
      </div>

      {/* Main Grid */}
      <div className="p-4 space-y-4">
        {/* Row 1: Scheduler & Processes */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-1">
            <SchedulerPanel
              state={state}
              simulator={simulatorRef.current}
              onStateChange={() => setState({ ...simulatorRef.current!.getState() })}
            />
          </div>
          <div className="lg:col-span-2">
            <ProcessPanel
              state={state}
              onCreate={crearProceso}
              onEdit={editarProceso}
              onDelete={eliminarProceso}
              simulator={simulatorRef.current}
            />
          </div>
        </div>

        {/* Row 2: Metrics Dashboard */}
        <div>
          <MetricsDashboard metrics={state.metrics} />
        </div>

        {/* Row 3: Gantt Chart */}
        <div>
          <GanttChart ganttChart={state.ganttChart} procesos={state.procesos} />
        </div>

        {/* Row 4: State Diagram */}
        <div>
          <StateDiagram procesos={state.procesos} />
        </div>

        {/* Row 5: Memory & Interrupts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <MemoryPanel state={state} simulator={simulatorRef.current} />
          <InterruptsPanel state={state} simulator={simulatorRef.current} />
        </div>

        {/* Row 6: Devices */}
        <div>
          <DevicesPanel state={state} />
        </div>

        {/* Row 7: Stats & Logs */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <StatsPanel state={state} />
          <LogsPanel state={state} simulator={simulatorRef.current} />
        </div>
      </div>

      {/* Keyboard Modal */}
      <Dialog open={keyboardModalOpen} onOpenChange={() => { }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Interrupción de Teclado</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            Un proceso ha solicitado entrada de teclado. ¿Desea continuar o cancelar la operación?
          </div>
          <DialogFooter>
            <Button variant="destructive" onClick={() => handleKeyboardAction("cancelar")}>
              Cancelar
            </Button>
            <Button onClick={() => handleKeyboardAction("continuar")}>
              Continuar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deadlock Alert Modal */}
      {state?.deadlockStatus && (
        <DeadlockAlert
          deadlockInfo={state.deadlockStatus}
          onResolve={handleDeadlockResolve}
          onClose={() => setDeadlockDetected(false)}
        />
      )}
    </div>
  )
}
