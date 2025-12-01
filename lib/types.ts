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

export type InterruptType =
  | "Timer"
  | "Hardware"
  | "PageFault"
  | "IO_Request"
  | "IO_Complete"
  | "SystemCall";

export interface SystemInterrupt {
  type: InterruptType;
  pid?: number;
  description: string;
}

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
  tiempoFinalizacion?: number;
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

  // Scheduler state
  quantumElapsed: number;

  // Rigorous Requirements
  isIdle: boolean; // PID 0
  esProceSO: boolean; // Requisito 16: Campo explícito
  memoryAddress: string; // Hex representation of physical address
  pcbOffsets: { [key: string]: string }; // Hex offsets for fields
  archivosAbiertos: number; // Requisito 1: Recursos a liberar
  paginasMemoria: number[]; // Requisito 2: Falta de página

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
  tipo: "context_switch" | "scheduler" | "interrupt" | "process_state" | "error" | "memory" | "io" | "cpu";
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
