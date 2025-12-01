import { OSState, Process, DeviceType, Interrupt, LogEntry } from "./types";
import { ProcessManager } from "./process-manager";
import { MemoryManager } from "./memory-manager";
import { IOManager } from "./io-manager";
import { Scheduler } from "./scheduler";
import { Dispatcher } from "./dispatcher";
import { ErrorManager, ErrorCode } from "./error-manager";

export class OSSimulator {
  private processManager: ProcessManager;
  private memoryManager: MemoryManager;
  private ioManager: IOManager;
  private scheduler: Scheduler;
  private dispatcher: Dispatcher;
  private errorManager: ErrorManager;

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

  constructor(initialQuantum: number = 3) {
    this.processManager = new ProcessManager();
    this.memoryManager = new MemoryManager();
    this.ioManager = new IOManager();
    this.scheduler = new Scheduler();
    this.dispatcher = new Dispatcher();
    this.errorManager = new ErrorManager();

    // Rigorous Requirement: Quantum configurable at start
    this.scheduler.setQuantum(initialQuantum);
  }

  public getState(): OSState {
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
      let next = this.scheduler.getNext();

      // Idle Process Logic
      if (!next) {
        // Check if we are already running idle? No, dispatcher is empty.
        // Create a temporary idle process if none exists or reuse one?
        // Ideally, we just say "CPU Idle" in logs, but requirements say "Process Idle PID 0"
        // Let's create a transient one or just log it. 
        // Better: The scheduler should return an Idle process if queue is empty?
        // Or we handle it here.
        // Let's instantiate one if needed.
        const idle = this.processManager.createIdleProcess();
        this.dispatcher.dispatch(idle, this.tiempoSimulacion);
        this.agregarLog("cpu", "CPU Idle (PID 0)", 0);
      } else {
        this.dispatcher.dispatch(next, this.tiempoSimulacion);
        this.agregarLog("context_switch", `PID ${next.pid} despachado a CPU`, next.pid);
        this.agregarLog("scheduler", `Planificador seleccionó PID ${next.pid} (${this.scheduler.getAlgorithm()})`, next.pid);
      }
    } else {
      const running = this.dispatcher.getRunning()!;

      // Check for Timer Interrupt (Quantum)
      if (this.scheduler.isApropiativo() && this.scheduler.checkQuantum(running)) {
        this.agregarLog("interrupt", `Interrupción de Timer (Quantum expirado) para PID ${running.pid}`, running.pid);
        this.dispatcher.preempt();
        running.estado = "ready";
        this.scheduler.add(running);

        // Immediate switch if possible
        const next = this.scheduler.getNext();
        if (next) {
          this.dispatcher.dispatch(next, this.tiempoSimulacion);
          this.agregarLog("context_switch", `PID ${next.pid} despachado a CPU (Preemption)`, next.pid);
        }
      }
      // Random Error (0.5%)
      else if (Math.random() < 0.005) {
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
      running.quantumElapsed++; // Increment quantum usage
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
      else if (running.interrupciones < running.maxInterrupciones && Math.random() < 0.2) {
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

    // Update waiting time
    this.scheduler.getQueue().forEach(p => p.tiempoEspera++);
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

    // Rigorous Requirement: Invoke scheduler/admission immediately
    this.processManager.admitirProcesos(this.memoryManager, this.scheduler);

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
}
