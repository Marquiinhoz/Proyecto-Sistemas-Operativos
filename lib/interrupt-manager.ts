import { SystemInterrupt, InterruptType, ProcessState, DeviceType, Process } from "./types";

export class InterruptManager {
  private interrupcionesPendientes: SystemInterrupt[] = [];
  private historialInterrupciones: SystemInterrupt[] = [];
  private ultimoId: number = 0;
  private readonly MAX_HISTORIAL = 200;

  // Prioridades de interrupciones (1 = máxima, 5 = mínima)
  private readonly PRIORIDADES: Record<InterruptType, number> = {
    timer: 1,
    io_completion: 2,
    process_end: 3,
    io_request: 4,
    error: 5,
  };

  /**
   * Genera y encola una nueva interrupción del sistema
   */
  public generarInterrupcion(
    tipo: InterruptType,
    tick: number,
    pidAsociado: number,
    estadoAnterior: ProcessState,
    estadoNuevo: ProcessState,
    mensaje: string,
    dispositivo?: DeviceType
  ): SystemInterrupt {
    const interrupcion: SystemInterrupt = {
      id: ++this.ultimoId,
      tipo,
      prioridad: this.PRIORIDADES[tipo],
      tick,
      pidAsociado,
      dispositivo,
      estadoAnterior,
      estadoNuevo,
      procesada: false,
      mensaje,
    };

    this.interrupcionesPendientes.push(interrupcion);
    this.ordenarPorPrioridad();

    return interrupcion;
  }

  /**
   * Ordena las interrupciones pendientes por prioridad (menor número = mayor prioridad)
   */
  private ordenarPorPrioridad() {
    this.interrupcionesPendientes.sort((a, b) => {
      if (a.prioridad !== b.prioridad) {
        return a.prioridad - b.prioridad;
      }
      // Si tienen la misma prioridad, mantener orden FIFO (por ID)
      return a.id - b.id;
    });
  }

  /**
   * Obtiene la siguiente interrupción a procesar (mayor prioridad)
   */
  public obtenerSiguiente(): SystemInterrupt | null {
    if (this.interrupcionesPendientes.length === 0) return null;
    return this.interrupcionesPendientes[0];
  }

  /**
   * Marca una interrupción como procesada y la mueve al historial
   */
  public marcarProcesada(id: number) {
    const index = this.interrupcionesPendientes.findIndex((i) => i.id === id);
    if (index !== -1) {
      const interrupcion = this.interrupcionesPendientes.splice(index, 1)[0];
      interrupcion.procesada = true;
      this.historialInterrupciones.push(interrupcion);

      // Mantener límite del historial
      if (this.historialInterrupciones.length > this.MAX_HISTORIAL) {
        this.historialInterrupciones.shift();
      }
    }
  }

  /**
   * Procesa todas las interrupciones pendientes en orden de prioridad
   */
  public procesarTodas(callback: (interrupcion: SystemInterrupt) => void) {
    while (this.interrupcionesPendientes.length > 0) {
      const interrupcion = this.obtenerSiguiente();
      if (!interrupcion) break;

      callback(interrupcion);
      this.marcarProcesada(interrupcion.id);
    }
  }

  /**
   * Obtiene todas las interrupciones pendientes
   */
  public getPendientes(): SystemInterrupt[] {
    return [...this.interrupcionesPendientes];
  }

  /**
   * Obtiene el historial de interrupciones (últimas N)
   */
  public getHistorial(limit: number = 50): SystemInterrupt[] {
    return this.historialInterrupciones.slice(-limit);
  }

  /**
   * Obtiene interrupciones de un tick específico
   */
  public getInterrupcionesPorTick(tick: number): SystemInterrupt[] {
    return this.historialInterrupciones.filter((i) => i.tick === tick);
  }

  /**
   * Obtiene interrupciones de un proceso específico
   */
  public getInterrupcionesPorProceso(pid: number): SystemInterrupt[] {
    return this.historialInterrupciones.filter((i) => i.pidAsociado === pid);
  }

  /**
   * Limpia interrupciones pendientes de un proceso (cuando se elimina)
   */
  public limpiarProceso(pid: number) {
    this.interrupcionesPendientes = this.interrupcionesPendientes.filter(
      (i) => i.pidAsociado !== pid
    );
  }

  /**
   * Obtiene estadísticas de interrupciones
   */
  public getEstadisticas() {
    const porTipo: Record<InterruptType, number> = {
      timer: 0,
      io_request: 0,
      io_completion: 0,
      process_end: 0,
      error: 0,
    };

    this.historialInterrupciones.forEach((i) => {
      porTipo[i.tipo]++;
    });

    return {
      total: this.historialInterrupciones.length,
      pendientes: this.interrupcionesPendientes.length,
      porTipo,
    };
  }

  /**
   * Limpia todo el sistema de interrupciones (para reinicio)
   */
  public limpiar() {
    this.interrupcionesPendientes = [];
    this.historialInterrupciones = [];
    this.ultimoId = 0;
  }
}
