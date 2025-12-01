import { Process } from "./types";
import { MemoryManager } from "./memory-manager";
import { Scheduler } from "./scheduler";

export class ProcessManager {
  private procesos: Process[];
  private colaNew: Process[];
  private colaTerminated: Process[];
  private ultimoPID: number = 0;
  private readonly MIN_BLOCK_SIZE = 32 * 1024;

  constructor() {
    this.procesos = [];
    this.colaNew = [];
    this.colaTerminated = [];
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
      maxInterrupciones: maxInterrupcionesSolicitadas ?? (Math.floor(Math.random() * 7) + 2), // 2 to 8 (reduced to decrease deadlock frequency)
      errores: 0,
      cambiosContexto: 0,
      porcentajeProcesado: 0,
      ioType: null,
      ioTimeRemaining: 0,
      // Metrics fields
      tiempoInicio: -1,
      tiempoFinal: -1,
      tiempoEsperaEnReady: 0,
    };

    this.procesos.push(proceso);
    this.colaNew.push(proceso);
    return proceso;
  }

  public admitirProcesos(memoria: MemoryManager, scheduler: Scheduler) {
    const porAdmitir = [...this.colaNew];
    for (const proceso of porAdmitir) {
      if (memoria.asignarMemoria(proceso)) {
        proceso.estado = "ready";
        const dataSize = Math.floor(proceso.tamanio * (proceso.porcentajeDatos / 100));
        proceso.heapPointer = proceso.dirBase + dataSize;
        proceso.stackPointer = proceso.dirBase + proceso.tamanio - 1;

        scheduler.add(proceso);
        this.colaNew = this.colaNew.filter((p) => p.pid !== proceso.pid);
      }
    }
  }

  public terminarProceso(proceso: Process, tiempoSimulacion: number, memoria: MemoryManager) {
    proceso.tiempoFinal = tiempoSimulacion;
    proceso.tiempoTurnaround = tiempoSimulacion - proceso.tiempoLlegada;
    proceso.estado = "terminated";
    this.colaTerminated.push(proceso);
    memoria.liberarMemoria(proceso.pid);
  }

  public getProcess(pid: number): Process | undefined {
    return this.procesos.find(p => p.pid === pid);
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
    scheduler: Scheduler,
    dispatcher: any,
    ioManager: any
  ): boolean {
    const proceso = this.getProcess(pid);
    if (!proceso) return false;

    // Si está corriendo, expropiarlo
    if (proceso.estado === "running" && dispatcher) {
      const running = dispatcher.getRunning();
      if (running && running.pid === pid) {
        dispatcher.preempt();
      }
    }

    // Remover de todas las colas
    this.colaNew = this.colaNew.filter(p => p.pid !== pid);

    // Remover de cola ready (scheduler)
    const readyQueue = scheduler.getQueue();
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
