import { Process } from "./types";

export class Dispatcher {
  private colaRunning: Process | null = null;
  private cambiosContextoTotal: number = 0;

  public getRunning() {
    return this.colaRunning;
  }

  public getTotalContextSwitches() {
    return this.cambiosContextoTotal;
  }

  public dispatch(proceso: Process, tiempoSimulacion: number) {
    this.colaRunning = proceso;
    proceso.estado = "running";
    
    if (proceso.tiempoRespuesta === -1) {
      proceso.tiempoRespuesta = tiempoSimulacion - proceso.tiempoLlegada;
    }
    
    proceso.cambiosContexto++;
    this.cambiosContextoTotal++;
  }

  public preempt(): Process | null {
    if (!this.colaRunning) return null;
    const p = this.colaRunning;
    this.colaRunning = null;
    return p;
  }
}
