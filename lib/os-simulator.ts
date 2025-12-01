import { OSState, Process, DeviceType, Interrupt, LogEntry, SimulationMetrics, GanttEntry } from "./types";
import { ProcessManager } from "./process-manager";
import { MemoryManager } from "./memory-manager";
import { IOManager } from "./io-manager";
import { Scheduler } from "./scheduler";
import { Dispatcher } from "./dispatcher";

export class OSSimulator {
  private processManager: ProcessManager;
  private memoryManager: MemoryManager;
  private ioManager: IOManager;
  private scheduler: Scheduler;
  private dispatcher: Dispatcher;

  private tiempoSimulacion: number = 0;
  private erroresTotal: number = 0;
  private logs: LogEntry[] = [];
  private ultimoLogId: number = 0;
  private readonly MAX_LOGS = 500;
  private rngFormulas: string[] = [
    "Size = 2^ceil(log2(random(32KB, 512KB)))",
    "Burst = random(5, 20)",
    "IO_Duration = random(5, 20)",
    "Error = random() < 0.005",
  ];

  // Module 2: Gantt Chart
  private ganttChart: GanttEntry[] = [];
  private readonly MAX_GANTT_ENTRIES = 1000;

  // Module 1: Metrics tracking
  private idleTime: number = 0;

  private agregarLog(tipo: LogEntry["tipo"], mensaje: string, pid?: number) {
    this.logs.push({
      id: ++this.ultimoLogId,
      tiempo: this.tiempoSimulacion,
      tipo,
      mensaje,
      pid,
    });
    // Mantener solo los últimos MAX_LOGS
    if (this.logs.length > this.MAX_LOGS) {
      this.logs.shift();
    }
  }

  constructor() {
    this.processManager = new ProcessManager();
    this.memoryManager = new MemoryManager();
    this.ioManager = new IOManager();
    this.scheduler = new Scheduler();
    this.dispatcher = new Dispatcher();
  }

  public getState(): OSState {
    const metrics = this.calculateMetrics();
    const deadlockStatus = this.detectDeadlock();

    return {
      procesos: this.processManager.getAll(),
      colaNew: this.processManager.getNew(),
      colaReady: this.scheduler.getQueue(),
      colaRunning: this.dispatcher.getRunning(),
      colaBlocked: this.processManager.getAll().filter(p => p.estado === 'blocked'),
      colaTerminated: this.processManager.getTerminated(),
      colasDispositivos: this.ioManager.getDeviceQueues(),
      memoria: this.memoryManager.getMemoryState(),
      interrupcionesActivas: this.ioManager.getActiveInterrupts(),
      scheduler: this.scheduler.getAlgorithm(),
      apropiativo: this.scheduler.isApropiativo(),
      quantum: this.scheduler.getQuantum(),
      memoryStrategy: this.memoryManager.getStrategy(),
      ultimoPID: this.processManager.getLastPID(),
      tiempoSimulacion: this.tiempoSimulacion,
      cambiosContextoTotal: this.dispatcher.getTotalContextSwitches(),
      erroresTotal: this.erroresTotal,
      interrupcionesTotal: this.ioManager.getTotalInterrupts(),
      fragmentation: this.memoryManager.getFragmentation(this.processManager.getAll()),
      rngFormulas: this.rngFormulas,
      logs: [...this.logs].reverse(), // Mostrar los más recientes primero
      metrics,
      ganttChart: this.ganttChart,
      deadlockStatus,
    };
  }

  public ejecutarTick() {
    this.tiempoSimulacion++;

    // 1. I/O
    const finishedIO = this.ioManager.verificarInterrupciones();
    finishedIO.forEach(p => {
      this.agregarLog("io", `I/O completado para PID ${p.pid}`, p.pid);
      this.agregarLog("process_state", `PID ${p.pid} desbloqueado, movido a Ready`, p.pid);
      this.scheduler.add(p);
    });

    // 2. Admit
    const procesosAdmitidos = this.processManager.getNew();
    this.processManager.admitirProcesos(this.memoryManager, this.scheduler);
    const nuevosAdmitidos = this.processManager.getNew();
    procesosAdmitidos.forEach(p => {
      if (!nuevosAdmitidos.find(np => np.pid === p.pid)) {
        this.agregarLog("memory", `PID ${p.pid} admitido a memoria (${(p.tamanio / 1024).toFixed(0)} KB)`, p.pid);
        this.agregarLog("process_state", `PID ${p.pid} cambió de New a Ready`, p.pid);
      }
    });

    // 3. Scheduler/Dispatcher
    if (!this.dispatcher.getRunning()) {
      const next = this.scheduler.getNext();
      if (next) {
        this.dispatcher.dispatch(next, this.tiempoSimulacion);
        this.agregarLog("context_switch", `Cambio de contexto: PID ${next.pid} ahora en ejecución`, next.pid);
        this.agregarLog("scheduler", `Planificador seleccionó PID ${next.pid} (${this.scheduler.getAlgorithm()})`, next.pid);

        // Module 2: Track context switch in Gantt
        this.addGanttEntry({ tiempo: this.tiempoSimulacion, pid: next.pid, tipo: "context_switch" });
      } else {
        // CPU is idle
        this.idleTime++;
        // Module 2: Track idle in Gantt
        this.addGanttEntry({ tiempo: this.tiempoSimulacion, pid: null, tipo: "idle" });
      }
    } else {
      const running = this.dispatcher.getRunning()!;

      // Module 2: Track execution in Gantt
      this.addGanttEntry({ tiempo: this.tiempoSimulacion, pid: running.pid, tipo: "execute" });

      // Random Error (0.5%)
      if (Math.random() < 0.005) {
        running.errores++;
        this.erroresTotal++;
        this.agregarLog("error", `Error detectado en PID ${running.pid}. Proceso terminado.`, running.pid);
        // Requirement: Cancel process on error
        const p = this.dispatcher.preempt();
        if (p) {
          // Log error or mark as error state? Terminated is fine.
          this.processManager.terminarProceso(p, this.tiempoSimulacion, this.memoryManager);
          return; // End tick for this process
        }
      }

      // Tick
      running.programCounter++;
      running.tiempoRestante--;
      running.porcentajeProcesado = ((running.burstTime - running.tiempoRestante) / running.burstTime) * 100;

      // Terminate
      if (running.tiempoRestante <= 0) {
        const p = this.dispatcher.preempt(); // Remove from running
        if (p) {
          this.agregarLog("process_state", `PID ${p.pid} terminado exitosamente`, p.pid);
          this.processManager.terminarProceso(p, this.tiempoSimulacion, this.memoryManager);
        }
      }
      // Quantum
      else if (this.scheduler.checkQuantum(running)) {
        const p = this.dispatcher.preempt();
        if (p) {
          this.agregarLog("context_switch", `Quantum agotado para PID ${p.pid}. Movido a cola Ready`, p.pid);
          this.scheduler.add(p);
        }
      }
      // Preempt
      else if (this.scheduler.debeExpropiar(running)) {
        const p = this.dispatcher.preempt();
        if (p) {
          this.agregarLog("context_switch", `PID ${p.pid} expropiado por planificador`, p.pid);
          this.scheduler.add(p);
        }
      }
      // I/O Chance
      // Requirement: 5-20 interrupts total.
      // Probability = (Remaining Interrupts) / (Remaining Time) ?
      // Or just a fixed prob that is high enough.
      else if (running.interrupciones < running.maxInterrupciones && Math.random() < 0.05) {
        const devices: DeviceType[] = ["disk", "printer", "monitor", "network"];
        const device = devices[Math.floor(Math.random() * devices.length)];

        const p = this.dispatcher.preempt();
        if (p) {
          p.estado = "blocked";
          this.agregarLog("process_state", `PID ${p.pid} bloqueado por I/O (${device})`, p.pid);
          this.agregarLog("io", `Solicitud de I/O: PID ${p.pid} → ${device}`, p.pid);
          this.ioManager.solicitarIO(p, device);
        }
      }
    }

    // Update waiting time and ready time (for aging)
    this.scheduler.getQueue().forEach(p => {
      p.tiempoEspera++;
      p.tiempoEsperaEnReady++;
    });

    // Module 4: Apply aging if using Priority scheduler
    if (this.scheduler.getAlgorithm() === "Prioridades") {
      this.applyAging();
    }
  }

  // Module 2: Add entry to Gantt chart
  private addGanttEntry(entry: GanttEntry): void {
    this.ganttChart.push(entry);
    // Keep only last MAX_GANTT_ENTRIES to prevent memory issues
    if (this.ganttChart.length > this.MAX_GANTT_ENTRIES) {
      this.ganttChart.shift();
    }
  }

  // Module 4: Apply aging to processes in ready queue
  private applyAging(): void {
    const STARVATION_THRESHOLD = 10; // ticks without execution
    const readyQueue = this.scheduler.getQueue();

    readyQueue.forEach(p => {
      if (p.tiempoEsperaEnReady >= STARVATION_THRESHOLD) {
        // Decrease priority (lower number = higher priority)
        if (p.prioridad > 0) {
          p.prioridad--;
          p.tiempoEsperaEnReady = 0; // Reset counter after aging
          this.agregarLog("scheduler", `Aging aplicado a PID ${p.pid}: prioridad aumentada a ${p.prioridad}`, p.pid);
        }
      }
    });
  }

  public crearProceso(
    size?: number,
    burstTime?: number,
    prioridad?: number,
    maxInterrupciones?: number,
    porcentajeDatos?: number,
    porcentajeVariable?: number
  ) {
    const proceso = this.processManager.crearProceso(
      this.tiempoSimulacion,
      size,
      burstTime,
      prioridad,
      maxInterrupciones,
      porcentajeDatos,
      porcentajeVariable
    );
    this.agregarLog("process_state", `Nuevo proceso creado: PID ${proceso.pid}`, proceso.pid);
    return proceso;
  }
  public generarProcesosIniciales(n: number) { for (let i = 0; i < n; i++) this.crearProceso(); }
  public resolverInterrupcionManual(id: number, accion: "continuar" | "cancelar") {
    const p = this.ioManager.resolverInterrupcionManual(id, accion);
    if (p) {
      this.agregarLog("interrupt", `Interrupción de teclado resuelta: ${accion} para PID ${p.pid}`, p.pid);
      this.agregarLog("process_state", `PID ${p.pid} desbloqueado después de I/O manual`, p.pid);
      this.scheduler.add(p);
    }
  }

  public setScheduler(s: "FCFS" | "SJF" | "RoundRobin" | "Prioridades") {
    this.scheduler.setAlgorithm(s);
    this.agregarLog("scheduler", `Política de planificación cambiada a: ${s}`);
  }
  public setApropiativo(b: boolean) {
    this.scheduler.setApropiativo(b);
    this.agregarLog("scheduler", `Modo apropiativo ${b ? "activado" : "desactivado"}`);
  }
  public setQuantum(n: number) {
    this.scheduler.setQuantum(n);
    this.agregarLog("scheduler", `Quantum actualizado a: ${n}`);
  }
  public setMemoryStrategy(s: "FirstFit" | "BestFit" | "WorstFit") {
    this.memoryManager.setStrategy(s);
    this.agregarLog("memory", `Estrategia de memoria cambiada a: ${s}`);
  }

  public editarProceso(
    pid: number,
    updates: {
      tamanio?: number;
      burstTime?: number;
      prioridad?: number;
      porcentajeDatos?: number;
      porcentajeVariable?: number;
      maxInterrupciones?: number;
    }
  ): boolean {
    const resultado = this.processManager.editarProceso(pid, updates, this.memoryManager);
    if (resultado) {
      this.agregarLog("process_state", `Proceso PID ${pid} editado`, pid);
    }
    return resultado;
  }

  public eliminarProceso(pid: number): boolean {
    const resultado = this.processManager.eliminarProceso(
      pid,
      this.memoryManager,
      this.scheduler,
      this.dispatcher,
      this.ioManager
    );
    if (resultado) {
      this.agregarLog("process_state", `Proceso PID ${pid} eliminado`, pid);
    }
    return resultado;
  }

  // Module 1: Calculate simulation metrics
  private calculateMetrics(): SimulationMetrics {
    const completedProcesses = this.processManager.getTerminated();
    const totalProcesses = this.processManager.getAll().length;
    const completedCount = completedProcesses.length;

    if (completedCount === 0) {
      return {
        avgWaitingTime: 0,
        avgTurnaroundTime: 0,
        avgResponseTime: 0,
        throughput: 0,
        cpuUtilization: 0,
        totalProcesses,
        completedProcesses: 0,
        idleTime: this.idleTime,
      };
    }

    // Calculate averages
    const totalWaitingTime = completedProcesses.reduce((sum, p) => sum + p.tiempoEspera, 0);
    const totalTurnaroundTime = completedProcesses.reduce((sum, p) => sum + p.tiempoTurnaround, 0);
    const totalResponseTime = completedProcesses.reduce((sum, p) => sum + (p.tiempoRespuesta >= 0 ? p.tiempoRespuesta : 0), 0);

    const avgWaitingTime = totalWaitingTime / completedCount;
    const avgTurnaroundTime = totalTurnaroundTime / completedCount;
    const avgResponseTime = totalResponseTime / completedCount;

    // Throughput: processes completed per unit time
    const throughput = this.tiempoSimulacion > 0 ? completedCount / this.tiempoSimulacion : 0;

    // CPU Utilization: % time CPU was not idle
    const cpuUtilization = this.tiempoSimulacion > 0
      ? ((this.tiempoSimulacion - this.idleTime) / this.tiempoSimulacion) * 100
      : 0;

    return {
      avgWaitingTime,
      avgTurnaroundTime,
      avgResponseTime,
      throughput,
      cpuUtilization,
      totalProcesses,
      completedProcesses: completedCount,
      idleTime: this.idleTime,
    };
  }

  // Module 4: Detect deadlock (simplified version)
  private detectDeadlock() {
    // Simple deadlock detection: check if all processes are blocked waiting for I/O
    // and no I/O operations are completing
    const allProcesses = this.processManager.getAll();
    const blockedProcesses = allProcesses.filter(p => p.estado === 'blocked');

    // Basic deadlock: all non-terminated processes are blocked and there are no active interrupts finishing soon
    const nonTerminated = allProcesses.filter(p => p.estado !== 'terminated');
    const allBlocked = nonTerminated.length > 0 && blockedProcesses.length === nonTerminated.length;

    if (allBlocked && nonTerminated.length > 1) {
      return {
        detected: true,
        affectedProcesses: blockedProcesses.map(p => p.pid),
        cycle: `Todos los procesos (${blockedProcesses.map(p => `P${p.pid}`).join(', ')}) están bloqueados esperando I/O`,
        timestamp: this.tiempoSimulacion,
      };
    }

    return {
      detected: false,
      affectedProcesses: [],
      cycle: "",
      timestamp: 0,
    };
  }

  // Module 3: Compact memory
  public compactarMemoria(): { success: boolean; message: string } {
    const result = this.memoryManager.compactarMemoria();

    if (result.success) {
      // Update dirBase for all processes after compaction
      const allProcesses = this.processManager.getAll();
      const memoryBlocks = this.memoryManager.getMemoryState();

      memoryBlocks.forEach(block => {
        if (block.ocupado && block.pid !== null) {
          const proceso = allProcesses.find(p => p.pid === block.pid);
          if (proceso) {
            proceso.dirBase = block.direccionInicio;
            // Recalculate pointers
            const dataSize = Math.floor(proceso.tamanio * (proceso.porcentajeDatos / 100));
            proceso.heapPointer = proceso.dirBase + dataSize;
            proceso.stackPointer = proceso.dirBase + proceso.tamanio - 1;
          }
        }
      });

      this.agregarLog("memory", result.message);
    }

    return result;
  }

  // Module 5: Clear logs
  public clearLogs(): void {
    this.logs = [];
    this.agregarLog("scheduler", "Logs limpiados");
  }
}
