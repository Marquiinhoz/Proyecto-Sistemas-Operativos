import { OSState, Process, DeviceType, Interrupt, LogEntry, SystemInterrupt, InterruptType } from "./types";
import { ProcessManager } from "./process-manager";
import { MemoryManager } from "./memory-manager";
import { IOManager } from "./io-manager";
import { Scheduler } from "./scheduler";
import { Dispatcher } from "./dispatcher";
import { InterruptManager } from "./interrupt-manager";

// Interfaz para el snapshot completo del simulador
interface SimulatorSnapshot {
  processManagerState: string; // JSON serializado
  memoryManagerState: string;
  ioManagerState: string;
  schedulerState: string;
  dispatcherState: string;
  tiempoSimulacion: number;
  erroresTotal: number;
  logs: LogEntry[];
  ultimoLogId: number;
}

export class OSSimulator {
  private processManager: ProcessManager;
  private memoryManager: MemoryManager;
  private ioManager: IOManager;
  private scheduler: Scheduler;
  private dispatcher: Dispatcher;
  private interruptManager: InterruptManager;

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
  
  // Sistema de historial para retroceder ticks
  private historialEstados: SimulatorSnapshot[] = [];
  private readonly MAX_HISTORIAL = 100; // Mantener los últimos 100 ticks

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

  /**
   * Guarda un snapshot del estado actual del simulador
   */
  private guardarSnapshot() {
    const snapshot: SimulatorSnapshot = {
      processManagerState: JSON.stringify(this.processManager),
      memoryManagerState: JSON.stringify(this.memoryManager),
      ioManagerState: JSON.stringify(this.ioManager),
      schedulerState: JSON.stringify(this.scheduler),
      dispatcherState: JSON.stringify(this.dispatcher),
      tiempoSimulacion: this.tiempoSimulacion,
      erroresTotal: this.erroresTotal,
      logs: JSON.parse(JSON.stringify(this.logs)), // Deep clone
      ultimoLogId: this.ultimoLogId,
    };
    
    this.historialEstados.push(snapshot);
    
    // Mantener solo los últimos MAX_HISTORIAL snapshots
    if (this.historialEstados.length > this.MAX_HISTORIAL) {
      this.historialEstados.shift();
    }
  }

  /**
   * Restaura el simulador al snapshot anterior
   */
  private restaurarSnapshot(snapshot: SimulatorSnapshot) {
    // Restaurar cada manager desde su estado serializado
    Object.assign(this.processManager, JSON.parse(snapshot.processManagerState));
    Object.assign(this.memoryManager, JSON.parse(snapshot.memoryManagerState));
    Object.assign(this.ioManager, JSON.parse(snapshot.ioManagerState));
    Object.assign(this.scheduler, JSON.parse(snapshot.schedulerState));
    Object.assign(this.dispatcher, JSON.parse(snapshot.dispatcherState));
    
    // Restaurar propiedades privadas
    this.tiempoSimulacion = snapshot.tiempoSimulacion;
    this.erroresTotal = snapshot.erroresTotal;
    this.logs = JSON.parse(JSON.stringify(snapshot.logs)); // Deep clone
    this.ultimoLogId = snapshot.ultimoLogId;
  }

  constructor() {
    this.scheduler = new Scheduler();
    this.dispatcher = new Dispatcher();
    this.processManager = new ProcessManager(this.scheduler, this.dispatcher);
    this.memoryManager = new MemoryManager();
    this.ioManager = new IOManager();
    this.interruptManager = new InterruptManager();
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
      interrupcionesSistema: [
        ...this.interruptManager.getPendientes(),
        ...this.interruptManager.getHistorial(20)
      ],
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
    // Guardar snapshot ANTES de ejecutar el tick
    this.guardarSnapshot();
    
    this.tiempoSimulacion++;

    // ========== 1. PROCESAR INTERRUPCIONES PENDIENTES (por prioridad) ==========
    this.interruptManager.procesarTodas((interrupcion) => {
      this.processManager.handleInterrupt(
        interrupcion,
        this.ioManager,
        this.memoryManager,
        this.tiempoSimulacion,
        (type, msg, pid) => this.agregarLog(type, msg, pid)
      );
    });

    // ========== 2. I/O - Avanzar dispositivos y detectar finalizaciones ==========
    this.ioManager.verificarInterrupciones(this.interruptManager, this.tiempoSimulacion);

    // ========== 3. ADMIT - Admitir procesos new → ready ==========
    this.processManager.admitirProcesos(this.memoryManager, (msg, pid) => {
      // Helper to map simple log messages to typed logs
      if (msg.includes("admitido a memoria")) {
        this.agregarLog("memory", msg, pid);
      } else {
        this.agregarLog("process_state", msg, pid);
      }
    });

    // ========== 4. EXECUTE RUNNING / SCHEDULE NEXT ==========
    this.processManager.executeRunningProcess(
      this.tiempoSimulacion,
      this.interruptManager,
      (type, msg, pid) => this.agregarLog(type, msg, pid)
    );
    
    // ========== 5. ACTUALIZAR TIEMPOS DE ESPERA ==========
    this.processManager.updateWaitingTimes();
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
  public generarProcesosIniciales(n: number) { for(let i=0; i<n; i++) this.crearProceso(); }
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
      this.ioManager
    );
    if (resultado) {
      this.agregarLog("process_state", `Proceso PID ${pid} eliminado`, pid);
      // Limpiar interrupciones pendientes del proceso
      this.interruptManager.limpiarProceso(pid);
    }
    return resultado;
  }

  /**
   * Retrocede el simulador un tick hacia atrás
   * @returns true si se pudo retroceder, false si no hay historial
   */
  public retrocederTick(): boolean {
    if (this.historialEstados.length === 0) {
      return false;
    }
    
    // Obtener el snapshot anterior (y eliminarlo del historial)
    const snapshot = this.historialEstados.pop()!;
    
    // Restaurar el estado
    this.restaurarSnapshot(snapshot);
    
    return true;
  }

  /**
   * Verifica si es posible retroceder un tick
   */
  public puedeRetroceder(): boolean {
    return this.historialEstados.length > 0;
  }

  /**
   * Obtiene el número de ticks que se pueden retroceder
   */
  public getHistorialDisponible(): number {
    return this.historialEstados.length;
  }
}
