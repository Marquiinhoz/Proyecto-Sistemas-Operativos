import { MemoryBlock, Process } from "./types";

export class MemoryManager {
  private memoria: MemoryBlock[];
  private strategyFit: "FirstFit" | "BestFit" | "WorstFit" = "FirstFit";
  private readonly MEMORY_SIZE = 2 * 1024 * 1024; // 2MB

  constructor() {
    this.memoria = [
      {
        direccionInicio: 0,
        direccionFin: this.MEMORY_SIZE,
        tamanio: this.MEMORY_SIZE,
        pid: null,
        ocupado: false,
        esBuddy: false,
      },
    ];
  }

  public getMemoryState(): MemoryBlock[] {
    return this.memoria;
  }

  public getStrategy(): "FirstFit" | "BestFit" | "WorstFit" {
    return this.strategyFit;
  }

  public setStrategy(strategy: "FirstFit" | "BestFit" | "WorstFit") {
    this.strategyFit = strategy;
  }

  public asignarMemoria(proceso: Process): boolean {
    const sizeNeeded = proceso.tamanio;
    const bloques = this.memoria;

    // Find candidate blocks
    let candidates: { index: number; block: MemoryBlock }[] = [];

    bloques.forEach((b, i) => {
      if (!b.ocupado && b.tamanio >= sizeNeeded) {
        candidates.push({ index: i, block: b });
      }
    });

    if (candidates.length === 0) return false;

    let selectedIdx = -1;

    if (this.strategyFit === "FirstFit") {
      selectedIdx = candidates[0].index;
    } else if (this.strategyFit === "BestFit") {
      candidates.sort((a, b) => a.block.tamanio - b.block.tamanio);
      selectedIdx = candidates[0].index;
    } else if (this.strategyFit === "WorstFit") {
      candidates.sort((a, b) => b.block.tamanio - a.block.tamanio);
      selectedIdx = candidates[0].index;
    }

    if (selectedIdx === -1) return false;

    // Split logic
    let currentIdx = selectedIdx;
    while (this.memoria[currentIdx].tamanio > sizeNeeded) {
      this.dividirBloque(currentIdx);
      // After split, we continue with the first block (usually lower address)
    }

    const bloqueFinal = this.memoria[currentIdx];
    bloqueFinal.ocupado = true;
    bloqueFinal.pid = proceso.pid;
    proceso.dirBase = bloqueFinal.direccionInicio;

    return true;
  }

  private dividirBloque(index: number) {
    const bloque = this.memoria[index];
    const nuevoTam = bloque.tamanio / 2;

    const buddy1: MemoryBlock = {
      ...bloque,
      tamanio: nuevoTam,
      direccionFin: bloque.direccionInicio + nuevoTam,
    };

    const buddy2: MemoryBlock = {
      direccionInicio: bloque.direccionInicio + nuevoTam,
      direccionFin: bloque.direccionFin,
      tamanio: nuevoTam,
      pid: null,
      ocupado: false,
      esBuddy: true,
    };

    this.memoria.splice(index, 1, buddy1, buddy2);
  }

  public liberarMemoria(pid: number) {
    const index = this.memoria.findIndex((b) => b.pid === pid);
    if (index === -1) return;

    this.memoria[index].pid = null;
    this.memoria[index].ocupado = false;

    this.combinarBloques();
  }

  private combinarBloques() {
    let merged = true;
    while (merged) {
      merged = false;
      for (let i = 0; i < this.memoria.length - 1; i++) {
        const b1 = this.memoria[i];
        const b2 = this.memoria[i + 1];

        if (!b1.ocupado && !b2.ocupado && b1.tamanio === b2.tamanio) {
          const combinedSize = b1.tamanio * 2;
          // Check alignment for buddy system
          if (b1.direccionInicio % combinedSize === 0) {
            const nuevoBloque: MemoryBlock = {
              direccionInicio: b1.direccionInicio,
              direccionFin: b2.direccionFin,
              tamanio: combinedSize,
              pid: null,
              ocupado: false,
              esBuddy: false,
            };
            this.memoria.splice(i, 2, nuevoBloque);
            merged = true;
            break;
          }
        }
      }
    }
  }

  public getFragmentation(procesos: Process[]): { internal: number; external: number } {
    let internal = 0;
    let external = 0;

    this.memoria.forEach((b) => {
      if (!b.ocupado) {
        external += b.tamanio;
      } else if (b.pid !== null) {
        const p = procesos.find((proc) => proc.pid === b.pid);
        if (p) {
          internal += (b.tamanio - p.tamanio);
        }
      }
    });

    return { internal, external };
  }
}
