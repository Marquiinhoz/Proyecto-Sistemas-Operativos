import { Process } from "./types";

export class Scheduler {
  private colaReady: Process[];
  private algorithm: "FCFS" | "SJF" | "RoundRobin" | "Prioridades" = "FCFS";
  private apropiativo: boolean = false;
  private quantum: number = 5;

  constructor() {
    this.colaReady = [];
  }

  public getQueue() {
    return this.colaReady;
  }

  public getAlgorithm() { return this.algorithm; }
  public isApropiativo() { return this.apropiativo; }
  public getQuantum() { return this.quantum; }

  public setAlgorithm(algo: "FCFS" | "SJF" | "RoundRobin" | "Prioridades") {
    this.algorithm = algo;
  }

  public setApropiativo(apropiativo: boolean) {
    this.apropiativo = apropiativo;
  }

  public setQuantum(quantum: number) {
    this.quantum = quantum;
  }

  public add(proceso: Process) {
    proceso.estado = "ready";
    this.colaReady.push(proceso);
  }

  public getNext(): Process | undefined {
    if (this.colaReady.length === 0) return undefined;

    let selectedIdx = 0;

    switch (this.algorithm) {
      case "FCFS":
      case "RoundRobin":
        selectedIdx = 0;
        break;
      case "SJF":
        selectedIdx = this.findBestIndex((p) => p.burstTime);
        break;
      case "Prioridades":
        selectedIdx = this.findBestIndex((p) => p.prioridad);
        break;
    }

    const selected = this.colaReady[selectedIdx];
    this.colaReady.splice(selectedIdx, 1);
    return selected;
  }

  private findBestIndex(metric: (p: Process) => number): number {
    let bestIdx = 0;
    let bestVal = metric(this.colaReady[0]);

    for (let i = 1; i < this.colaReady.length; i++) {
      const val = metric(this.colaReady[i]);
      if (val < bestVal) {
        bestVal = val;
        bestIdx = i;
      }
    }
    return bestIdx;
  }

  public debeExpropiar(running: Process): boolean {
    if (!this.apropiativo) return false;
    if (this.colaReady.length === 0) return false;

    if (this.algorithm === "SJF") {
      return this.colaReady.some((p) => p.burstTime < running.tiempoRestante);
    }
    if (this.algorithm === "Prioridades") {
      return this.colaReady.some((p) => p.prioridad < running.prioridad);
    }
    return false;
  }

  public checkQuantum(running: Process): boolean {
    if (this.algorithm !== "RoundRobin") return false;
    return (running.burstTime - running.tiempoRestante) % this.quantum === 0;
  }
}
