import { Process, SystemInterrupt, DeviceType, LogEntry } from "./types";
import { MemoryManager } from "./memory-manager";
import { Scheduler } from "./scheduler";
import { Dispatcher } from "./dispatcher";
import { IOManager } from "./io-manager";
import { InterruptManager } from "./interrupt-manager";

export class ProcessManager {
  private procesos: Process[];
  private colaNew: Process[];
  private colaTerminated: Process[];
  private ultimoPID: number = 0;
  private readonly MIN_BLOCK_SIZE = 32 * 1024;

  // Dependencies
  private scheduler: Scheduler;
  private dispatcher: Dispatcher;

  constructor(scheduler: Scheduler, dispatcher: Dispatcher) {
    this.procesos = [];
    this.colaNew = [];
    this.colaTerminated = [];
    this.scheduler = scheduler;
    this.dispatcher = dispatcher;
  }

  public getAll() { return this.procesos; }
  public getNew() { return this.colaNew; }
  public getTerminated() { return this.colaTerminated; }
  public getLastPID() { return this.ultimoPID; }

  public crearProceso(
    tiempoSimulacion: number, 
    tamanioSolicitado?: number,
    burstTimeSolicitado?: number,
    prioridadSolicitada?: number,
    maxInterrupcionesSolicitadas?: number,
    porcentajeDatosSolicitado?: number,
    porcentajeVariableSolicitado?: number
  ): Process {
    const pid = ++this.ultimoPID;

    let tamanio = tamanioSolicitado || 0;
    if (!tamanio) {
      const minExp = 15; // 32KB
      const maxExp = 19; // 512KB
      const exp = Math.floor(Math.random() * (maxExp - minExp + 1)) + minExp;
      tamanio = Math.pow(2, exp);
    } else {
      tamanio = Math.pow(2, Math.ceil(Math.log2(tamanio)));
      if (tamanio < this.MIN_BLOCK_SIZE) tamanio = this.MIN_BLOCK_SIZE;
    }

    const burstTime = burstTimeSolicitado ?? (Math.floor(Math.random() * 15) + 5);
    const prioridad = prioridadSolicitada ?? (Math.floor(Math.random() * 4));
    const pctDatos = porcentajeDatosSolicitado ?? (Math.floor(Math.random() * 30) + 10);
    const pctVariable = porcentajeVariableSolicitado ?? (Math.floor(Math.random() * 20) + 5);

    const proceso: Process = {
      pid,
      estado: "new",
      programCounter: 0,
      burstTime,
      tiempoRestante: burstTime,
      tiempoLlegada: tiempoSimulacion,
      tiempoEspera: 0,
      tiempoRespuesta: -1,
      tiempoTurnaround: 0,
      prioridad,
      tamanio,
      dirBase: -1,
      porcentajeDatos: pctDatos,
      porcentajeVariable: pctVariable,
      stackPointer: 0,
      heapPointer: 0,
      interrupciones: 0,
      maxInterrupciones: maxInterrupcionesSolicitadas ?? (Math.floor(Math.random() * 16) + 5), // 5 to 20
      errores: 0,
      cambiosContexto: 0,
      porcentajeProcesado: 0,
      ioType: null,
      ioTimeRemaining: 0,
    };

    this.procesos.push(proceso);
    this.colaNew.push(proceso);
    return proceso;
  }

  public admitirProcesos(memoria: MemoryManager, onLog: (msg: string, pid: number) => void) {
    const porAdmitir = [...this.colaNew];
    for (const proceso of porAdmitir) {
      if (memoria.asignarMemoria(proceso)) {
        proceso.estado = "ready";
        const dataSize = Math.floor(proceso.tamanio * (proceso.porcentajeDatos / 100));
        proceso.heapPointer = proceso.dirBase + dataSize;
        proceso.stackPointer = proceso.dirBase + proceso.tamanio - 1;

        this.scheduler.add(proceso);
        this.colaNew = this.colaNew.filter((p) => p.pid !== proceso.pid);
        
        onLog(`PID ${proceso.pid} admitido a memoria (${(proceso.tamanio / 1024).toFixed(0)} KB)`, proceso.pid);
        onLog(`PID ${proceso.pid} cambió de New a Ready`, proceso.pid);
      }
    }
  }

  public terminarProceso(proceso: Process, tiempoSimulacion: number, memoria: MemoryManager) {
    proceso.tiempoTurnaround = tiempoSimulacion - proceso.tiempoLlegada;
    proceso.estado = "terminated";
    this.colaTerminated.push(proceso);
    memoria.liberarMemoria(proceso.pid);
  }

  public getProcess(pid: number): Process | undefined {
    return this.procesos.find(p => p.pid === pid);
  }

  // --- New Logic: Interrupt Handling ---

  public handleInterrupt(
    interrupcion: SystemInterrupt, 
    ioManager: IOManager, 
    memoria: MemoryManager,
    tiempoSimulacion: number,
    onLog: (type: LogEntry["tipo"], msg: string, pid: number) => void
  ) {
    const proceso = this.getProcess(interrupcion.pidAsociado);
    if (!proceso) return;

    onLog("interrupt", interrupcion.mensaje, proceso.pid);

    switch (interrupcion.tipo) {
      case "timer":
        // RUNNING -> READY
        if (proceso.estado === "running") {
          const p = this.dispatcher.preempt();
          if (p) {
            onLog("context_switch", `Quantum agotado para PID ${p.pid}. Movido a Ready`, p.pid);
            this.scheduler.add(p);
          }
        }
        break;

      case "io_completion":
        // BLOCKED -> READY
        if (proceso.estado === "blocked") {
          proceso.estado = "ready";
          onLog("process_state", `PID ${proceso.pid} desbloqueado, movido a Ready`, proceso.pid);
          this.scheduler.add(proceso);
        }
        break;

      case "process_end":
        // RUNNING -> TERMINATED
        if (proceso.estado === "running") {
          const p = this.dispatcher.preempt();
          if (p) {
            onLog("process_state", `PID ${p.pid} terminado exitosamente`, p.pid);
            this.terminarProceso(p, tiempoSimulacion, memoria);
          }
        }
        break;

      case "io_request":
        // RUNNING -> BLOCKED
        if (proceso.estado === "running" && interrupcion.dispositivo) {
          const p = this.dispatcher.preempt();
          if (p) {
            p.estado = "blocked";
            onLog("process_state", `PID ${p.pid} bloqueado por I/O (${interrupcion.dispositivo})`, p.pid);
            ioManager.solicitarIO(p, interrupcion.dispositivo);
          }
        }
        break;

      case "error":
        // RUNNING -> TERMINATED
        if (proceso.estado === "running") {
          const p = this.dispatcher.preempt();
          if (p) {
            proceso.errores++;
            onLog("error", `Error detectado en PID ${p.pid}. Proceso terminado.`, p.pid);
            this.terminarProceso(p, tiempoSimulacion, memoria);
          }
        }
        break;
    }
  }

  // --- New Logic: Running Process Execution ---

  public executeRunningProcess(
    tiempoSimulacion: number,
    interruptManager: InterruptManager,
    onLog: (type: LogEntry["tipo"], msg: string, pid?: number) => void
  ) {
    const running = this.dispatcher.getRunning();
    if (!running) {
      // Try to schedule next
      const next = this.scheduler.getNext();
      if (next) {
        this.dispatcher.dispatch(next, tiempoSimulacion);
        onLog("context_switch", `Cambio de contexto: PID ${next.pid} ahora en ejecución`, next.pid);
        onLog("scheduler", `Planificador seleccionó PID ${next.pid} (${this.scheduler.getAlgorithm()})`, next.pid);
      }
      return;
    }

    // Execute running process logic
    
    // 1. Random Error (0.5%)
    if (Math.random() < 0.005) {
      interruptManager.generarInterrupcion(
        "error",
        tiempoSimulacion,
        running.pid,
        "running",
        "terminated",
        `Error aleatorio detectado en PID ${running.pid}`
      );
      return;
    }

    // 2. Execute instructions
    running.programCounter++;
    running.tiempoRestante--;
    running.porcentajeProcesado = ((running.burstTime - running.tiempoRestante) / running.burstTime) * 100;

    // 3. Check Burst End
    if (running.tiempoRestante <= 0) {
      interruptManager.generarInterrupcion(
        "process_end",
        tiempoSimulacion,
        running.pid,
        "running",
        "terminated",
        `Proceso PID ${running.pid} completó su burst time`
      );
      return;
    }

    // 4. Check Quantum (Round Robin)
    if (this.scheduler.checkQuantum(running)) {
      interruptManager.generarInterrupcion(
        "timer",
        tiempoSimulacion,
        running.pid,
        "running",
        "ready",
        `Quantum agotado para PID ${running.pid}`
      );
      return;
    }

    // 5. Check Preemption
    if (this.scheduler.debeExpropiar(running)) {
      const p = this.dispatcher.preempt();
      if (p) {
        onLog("context_switch", `PID ${p.pid} expropiado por planificador`, p.pid);
        this.scheduler.add(p);
      }
      return;
    }

    // 6. Random I/O Request
    if (running.interrupciones < running.maxInterrupciones && Math.random() < 0.2) {
      const devices: DeviceType[] = ["disk", "printer", "monitor", "network"];
      const device = devices[Math.floor(Math.random() * devices.length)];
      
      interruptManager.generarInterrupcion(
        "io_request",
        tiempoSimulacion,
        running.pid,
        "running",
        "blocked",
        `Solicitud de I/O: PID ${running.pid} → ${device}`,
        device
      );
      return;
    }
  }

  public updateWaitingTimes() {
    this.scheduler.getQueue().forEach(p => p.tiempoEspera++);
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
    },
    memoria: MemoryManager
  ): boolean {
    const proceso = this.getProcess(pid);
    if (!proceso) return false;

    // Si se cambia el tamaño, necesitamos reasignar memoria
    if (updates.tamanio !== undefined && updates.tamanio !== proceso.tamanio) {
      const nuevoTamanio = Math.pow(2, Math.ceil(Math.log2(updates.tamanio)));
      if (nuevoTamanio < this.MIN_BLOCK_SIZE) return false;

      // Liberar memoria actual
      if (proceso.dirBase !== -1) {
        memoria.liberarMemoria(proceso.pid);
      }
      proceso.dirBase = -1;
      proceso.estado = "new";
      
      // Actualizar tamaño
      proceso.tamanio = nuevoTamanio;
      
      // Intentar reasignar memoria
      if (!memoria.asignarMemoria(proceso)) {
        return false; // No hay memoria disponible
      }
      
      // Recalcular punteros
      const dataSize = Math.floor(proceso.tamanio * (proceso.porcentajeDatos / 100));
      proceso.heapPointer = proceso.dirBase + dataSize;
      proceso.stackPointer = proceso.dirBase + proceso.tamanio - 1;
    }

    // Actualizar otros campos
    if (updates.burstTime !== undefined) {
      proceso.burstTime = updates.burstTime;
      // Ajustar tiempo restante proporcionalmente si el proceso está corriendo
      if (proceso.estado === "running" || proceso.tiempoRestante > 0) {
        const ratio = proceso.tiempoRestante / (proceso.burstTime || 1);
        proceso.tiempoRestante = Math.max(0, Math.floor(updates.burstTime * ratio));
      } else {
        proceso.tiempoRestante = updates.burstTime;
      }
      proceso.porcentajeProcesado = proceso.burstTime > 0 
        ? ((proceso.burstTime - proceso.tiempoRestante) / proceso.burstTime) * 100 
        : 0;
    }
    
    if (updates.prioridad !== undefined) {
      proceso.prioridad = Math.max(0, Math.min(3, updates.prioridad));
    }
    
    if (updates.porcentajeDatos !== undefined) {
      proceso.porcentajeDatos = Math.min(100, Math.max(0, updates.porcentajeDatos));
      if (proceso.dirBase !== -1) {
        const dataSize = Math.floor(proceso.tamanio * (proceso.porcentajeDatos / 100));
        proceso.heapPointer = proceso.dirBase + dataSize;
      }
    }
    
    if (updates.porcentajeVariable !== undefined) {
      proceso.porcentajeVariable = Math.min(100, Math.max(0, updates.porcentajeVariable));
    }
    
    if (updates.maxInterrupciones !== undefined) {
      proceso.maxInterrupciones = Math.max(1, Math.min(20, updates.maxInterrupciones));
    }

    return true;
  }

  public eliminarProceso(
    pid: number,
    memoria: MemoryManager,
    ioManager: any
  ): boolean {
    const proceso = this.getProcess(pid);
    if (!proceso) return false;

    // Si está corriendo, expropiarlo
    if (proceso.estado === "running") {
      const running = this.dispatcher.getRunning();
      if (running && running.pid === pid) {
        this.dispatcher.preempt();
      }
    }

    // Remover de todas las colas
    this.colaNew = this.colaNew.filter(p => p.pid !== pid);
    
    // Remover de cola ready (scheduler)
    const readyQueue = this.scheduler.getQueue();
    const readyIndex = readyQueue.findIndex(p => p.pid === pid);
    if (readyIndex !== -1) {
      readyQueue.splice(readyIndex, 1);
    }

    // Remover de colas de I/O
    if (ioManager && typeof ioManager.removerInterrupcionesProceso === 'function') {
      ioManager.removerInterrupcionesProceso(pid);
    }

    // Liberar memoria
    if (proceso.dirBase !== -1) {
      memoria.liberarMemoria(pid);
    }

    // Remover del array de procesos
    this.procesos = this.procesos.filter(p => p.pid !== pid);
    this.colaTerminated = this.colaTerminated.filter(p => p.pid !== pid);

    return true;
  }
}
