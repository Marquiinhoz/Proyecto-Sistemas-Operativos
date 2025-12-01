import { DeviceType, Interrupt, Process } from "./types";

export class IOManager {
  private colasDispositivos: Record<DeviceType, Process[]>;
  private interrupcionesActivas: Interrupt[];
  private interrupcionesTotal: number = 0;

  constructor() {
    this.colasDispositivos = {
      keyboard: [],
      disk: [],
      printer: [],
      monitor: [],
      network: [],
    };
    this.interrupcionesActivas = [];
  }

  public getDeviceQueues() {
    return this.colasDispositivos;
  }

  public getActiveInterrupts() {
    return this.interrupcionesActivas;
  }

  public getTotalInterrupts() {
    return this.interrupcionesTotal;
  }

  public solicitarIO(proceso: Process, device: DeviceType) {
    this.colasDispositivos[device].push(proceso);
    proceso.ioType = device;

    // If device is idle, start processing
    const activeForDevice = this.interrupcionesActivas.find(
      (i) => i.dispositivo === device
    );
    if (!activeForDevice) {
      this.procesarSiguienteIO(device);
    }
  }

  private procesarSiguienteIO(device: DeviceType) {
    const queue = this.colasDispositivos[device];
    if (queue.length === 0) return;

    const proceso = queue[0]; // Peek

    // Requirement: Duration 5-20 depending on burst-time
    // Formula: Base 5 + (Burst/2) + Random(0-5), clamped to [5, 20]
    const duracion = Math.min(20, Math.max(5, Math.floor(5 + (proceso.burstTime / 2) + (Math.random() * 5))));

    const interrupt: Interrupt = {
      id: Math.random(),
      dispositivo: device,
      duracion,
      tiempoRestante: duracion,
      pidAsociado: proceso.pid,
      esManual: device === "keyboard",
      estado: "active",
    };

    this.interrupcionesActivas.push(interrupt);
    this.interrupcionesTotal++;
    proceso.interrupciones++;
  }

  public verificarInterrupciones(): Process[] {
    const completedProcesses: Process[] = [];

    for (let i = this.interrupcionesActivas.length - 1; i >= 0; i--) {
      const irq = this.interrupcionesActivas[i];

      if (irq.esManual && irq.estado === "waiting") continue;

      irq.tiempoRestante--;

      if (irq.tiempoRestante <= 0) {
        const p = this.finalizarIO(irq);
        if (p) completedProcesses.push(p);
      }
    }
    return completedProcesses;
  }

  private finalizarIO(irq: Interrupt): Process | null {
    this.interrupcionesActivas = this.interrupcionesActivas.filter(
      (i) => i.id !== irq.id
    );

    const queue = this.colasDispositivos[irq.dispositivo];
    const procIdx = queue.findIndex((p) => p.pid === irq.pidAsociado);

    let proceso: Process | null = null;

    if (procIdx !== -1) {
      proceso = queue.splice(procIdx, 1)[0];
      proceso.ioType = null;
    }

    this.procesarSiguienteIO(irq.dispositivo);
    return proceso;
  }

  public resolverInterrupcionManual(id: number, accion: "continuar" | "cancelar"): Process | null {
    const irq = this.interrupcionesActivas.find((i) => i.id === id);
    if (!irq) return null;

    if (accion === "continuar") {
      irq.estado = "active";
      irq.esManual = false;
      return null;
    } else {
      // Cancel: Finish immediately
      return this.finalizarIO(irq);
    }
  }

  public removerInterrupcionesProceso(pid: number) {
    // Remover de colas de dispositivos
    Object.keys(this.colasDispositivos).forEach((device: any) => {
      const queue = this.colasDispositivos[device as DeviceType];
      const index = queue.findIndex((p: Process) => p.pid === pid);
      if (index !== -1) {
        queue.splice(index, 1);
      }
    });

    // Remover interrupciones activas
    this.interrupcionesActivas = this.interrupcionesActivas.filter(irq => irq.pidAsociado !== pid);
  }
}
