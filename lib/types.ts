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

  // Metrics (Module 1)
  tiempoInicio: number; // Time when first executed (for response time)
  tiempoFinal: number; // Time when terminated (for turnaround)
  tiempoEsperaEnReady: number; // Time waiting in ready queue (for aging)
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
  tipo: "context_switch" | "scheduler" | "interrupt" | "process_state" | "error" | "memory" | "io";
  mensaje: string;
  pid?: number;
}

// Module 1: Simulation Metrics
export interface SimulationMetrics {
  avgWaitingTime: number; // Average waiting time
  avgTurnaroundTime: number; // Average turnaround time
  avgResponseTime: number; // Average response time
  throughput: number; // Processes completed per unit time
  cpuUtilization: number; // % time CPU was not idle
  totalProcesses: number;
  completedProcesses: number;
  idleTime: number; // Total time CPU was idle
}

// Module 2: Gantt Chart
export interface GanttEntry {
  tiempo: number;
  pid: number | null; // null = IDLE
  tipo: "execute" | "idle" | "context_switch";
}

// Module 3: Memory Fragmentation Info
export interface FragmentationInfo {
  internal: number; // Internal fragmentation in bytes
  external: number; // External fragmentation in bytes
  externalHoles: number; // Number of free holes
  largestHole: number; // Size of largest free hole in bytes
}

// Module 4: Deadlock Detection
export interface DeadlockInfo {
  detected: boolean;
  affectedProcesses: number[]; // PIDs involved in deadlock
  cycle: string; // Description of the cycle
  timestamp: number; // When deadlock was detected
}

// Module 5: Scenario Import/Export
export interface Scenario {
  version: string;
  timestamp: number;
  scheduler: {
    algorithm: "FCFS" | "SJF" | "RoundRobin" | "Prioridades";
    apropiativo: boolean;
    quantum: number;
  };
  memoryStrategy: "FirstFit" | "BestFit" | "WorstFit";
  processes: ProcessConfig[];
}

export interface ProcessConfig {
  tamanio: number;
  burstTime: number;
  prioridad: number;
  maxInterrupciones: number;
  porcentajeDatos: number;
  porcentajeVariable: number;
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
  fragmentation: FragmentationInfo;

  // RNG Formulas for display
  rngFormulas: string[];

  // Logs
  logs: LogEntry[];

  // Module 1: Metrics
  metrics: SimulationMetrics;

  // Module 2: Gantt Chart
  ganttChart: GanttEntry[];

  // Module 4: Deadlock Detection
  deadlockStatus: DeadlockInfo;
}
