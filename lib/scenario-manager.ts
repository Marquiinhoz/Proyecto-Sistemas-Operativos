import { Scenario, ProcessConfig, OSState } from "./types";

export class ScenarioManager {
    private static readonly VERSION = "1.0.0";

    /**
     * Export current simulation state as a scenario
     */
    public static exportScenario(state: OSState): Scenario {
        // Extract process configurations from current processes
        const processConfigs: ProcessConfig[] = state.procesos
            .filter(p => p.estado !== 'terminated') // Only export active processes
            .map(p => ({
                tamanio: p.tamanio,
                burstTime: p.burstTime,
                prioridad: p.prioridad,
                maxInterrupciones: p.maxInterrupciones,
                porcentajeDatos: p.porcentajeDatos,
                porcentajeVariable: p.porcentajeVariable,
            }));

        return {
            version: this.VERSION,
            timestamp: Date.now(),
            scheduler: {
                algorithm: state.scheduler,
                apropiativo: state.apropiativo,
                quantum: state.quantum,
            },
            memoryStrategy: state.memoryStrategy,
            processes: processConfigs,
        };
    }

    /**
     * Download scenario as JSON file
     */
    public static downloadScenario(scenario: Scenario, filename?: string): void {
        const json = JSON.stringify(scenario, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.download = filename || `os-scenario-${Date.now()}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    /**
     * Validate scenario structure
     */
    public static validateScenario(scenario: any): { valid: boolean; error?: string } {
        if (!scenario || typeof scenario !== 'object') {
            return { valid: false, error: 'Escenario inválido: no es un objeto JSON' };
        }

        if (!scenario.version) {
            return { valid: false, error: 'Escenario inválido: falta versión' };
        }

        if (!scenario.scheduler || !scenario.scheduler.algorithm) {
            return { valid: false, error: 'Escenario inválido: falta configuración de scheduler' };
        }

        const validAlgorithms = ['FCFS', 'SJF', 'RoundRobin', 'Prioridades'];
        if (!validAlgorithms.includes(scenario.scheduler.algorithm)) {
            return { valid: false, error: `Algoritmo inválido: ${scenario.scheduler.algorithm}` };
        }

        if (!scenario.memoryStrategy) {
            return { valid: false, error: 'Escenario inválido: falta estrategia de memoria' };
        }

        const validStrategies = ['FirstFit', 'BestFit', 'WorstFit'];
        if (!validStrategies.includes(scenario.memoryStrategy)) {
            return { valid: false, error: `Estrategia de memoria inválida: ${scenario.memoryStrategy}` };
        }

        if (!Array.isArray(scenario.processes)) {
            return { valid: false, error: 'Escenario inválido: procesos debe ser un array' };
        }

        // Validate each process
        for (let i = 0; i < scenario.processes.length; i++) {
            const p = scenario.processes[i];
            if (!p.tamanio || !p.burstTime || p.prioridad === undefined) {
                return { valid: false, error: `Proceso ${i}: faltan campos requeridos` };
            }
            if (p.tamanio < 32 * 1024 || p.tamanio > 2 * 1024 * 1024) {
                return { valid: false, error: `Proceso ${i}: tamaño fuera de rango (32KB - 2MB)` };
            }
            if (p.burstTime < 1 || p.burstTime > 100) {
                return { valid: false, error: `Proceso ${i}: burstTime fuera de rango (1-100)` };
            }
        }

        return { valid: true };
    }

    /**
     * Load scenario from JSON file
     */
    public static async loadScenarioFromFile(): Promise<Scenario | null> {
        return new Promise((resolve) => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';

            input.onchange = async (e: any) => {
                const file = e.target.files[0];
                if (!file) {
                    resolve(null);
                    return;
                }

                try {
                    const text = await file.text();
                    const scenario = JSON.parse(text);

                    const validation = this.validateScenario(scenario);
                    if (!validation.valid) {
                        alert(`Error al cargar escenario: ${validation.error}`);
                        resolve(null);
                        return;
                    }

                    resolve(scenario);
                } catch (error) {
                    alert(`Error al parsear archivo: ${error}`);
                    resolve(null);
                }
            };

            input.click();
        });
    }

    /**
     * Export logs to CSV format
     */
    public static exportLogs(logs: any[]): void {
        const headers = ['ID', 'Tiempo', 'Tipo', 'PID', 'Mensaje'];
        const rows = logs.map(log => [
            log.id,
            log.tiempo,
            log.tipo,
            log.pid || '',
            `"${log.mensaje.replace(/"/g, '""')}"` // Escape quotes
        ]);

        const csv = [
            headers.join(','),
            ...rows.map(row => row.join(','))
        ].join('\n');

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.download = `os-logs-${Date.now()}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }
}
