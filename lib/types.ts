export type ProcessState =
  | "new"
  | "ready"
  | "running"
  | "blocked"
  | "terminated";

export type DeviceType =
  | "keyboard"
  | "disk"
  | "printer"
  | "monitor"
  | "network";

export interface Process {
  pid: number;
  estado: ProcessState;
  programCounter: number;
  burstTime: number;
  tiempoRestante: number;
  tiempoLlegada: number;
  tiempoEspera: number;
  tiempoRespuesta: number;
  tiempoTurnaround: number;
  prioridad: number;

  // Memory
  tamanio: number; // Total size (power of 2)
  dirBase: number;
  porcentajeDatos: number;
  porcentajeVariable: number;
  stackPointer: number;
  heapPointer: number;

  // Stats
  interrupciones: number;
  maxInterrupciones: number; // Requirement: 5-20 interrupts
  errores: number;
  cambiosContexto: number;
  porcentajeProcesado: number;

  // I/O
  ioType: DeviceType | null;
  ioTimeRemaining: number;
}

export interface MemoryBlock {
  direccionInicio: number;
  direccionFin: number;
  tamanio: number;
  pid: number | null;
  ocupado: boolean;
  // For visualization/logic
  esBuddy: boolean;
}

export type InterruptType =
  | "timer"          // Quantum agotado - RUNNING → READY
  | "io_request"     // Solicitud I/O - RUNNING → BLOCKED
  | "io_completion"  // I/O completado - BLOCKED → READY
  | "process_end"    // Burst terminado - RUNNING → TERMINATED
  | "error";         // Error aleatorio - RUNNING → TERMINATED

export interface SystemInterrupt {
  id: number;
  tipo: InterruptType;
  prioridad: number;      // 1=máxima, 5=mínima
  tick: number;           // Tick donde ocurrió
  pidAsociado: number;
  dispositivo?: DeviceType;
  estadoAnterior: ProcessState;
  estadoNuevo: ProcessState;
  procesada: boolean;
  mensaje: string;
}

// Legacy interrupt structure for I/O (mantenido por compatibilidad)
export interface Interrupt {
  id: number;
  dispositivo: DeviceType;
  duracion: number;
  tiempoRestante: number;
  pidAsociado: number;
  esManual: boolean; // For keyboard cancel/continue
  estado: "waiting" | "active" | "completed";
}

export interface LogEntry {
  id: number;
  tiempo: number;
  tipo: "context_switch" | "scheduler" | "interrupt" | "process_state" | "error" | "memory" | "io";
  mensaje: string;
  pid?: number;
}

export interface OSState {
  procesos: Process[];
  colaNew: Process[];
  colaReady: Process[];
  colaRunning: Process | null;
  colaBlocked: Process[];
  colaTerminated: Process[];

  // Device Queues (Processes waiting for device)
  colasDispositivos: Record<DeviceType, Process[]>;

  memoria: MemoryBlock[];

  // Global Interrupts (Active I/O operations)
  interrupcionesActivas: Interrupt[];
  
  // System interrupts queue
  interrupcionesSistema: SystemInterrupt[];

  scheduler: "FCFS" | "SJF" | "RoundRobin" | "Prioridades";
  apropiativo: boolean;
  quantum: number;
  memoryStrategy: "FirstFit" | "BestFit" | "WorstFit";

  ultimoPID: number;
  tiempoSimulacion: number;
  cambiosContextoTotal: number;
  erroresTotal: number;
  interrupcionesTotal: number;
  fragmentation: { internal: number; external: number };

  // RNG Formulas for display
  rngFormulas: string[];

  // Logs
  logs: LogEntry[];
}
