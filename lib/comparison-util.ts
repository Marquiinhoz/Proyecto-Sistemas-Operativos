import { OSSimulator } from "./os-simulator";
import type { OSState } from "./types";

export interface StrategyMetrics {
    strategy: "FirstFit" | "BestFit" | "WorstFit";
    fragExternal: number; // %
    fragInterna: number; // %
    huecos: number;
    rechazos: number;
    utilizacion: number; // %
    avgTurnaroundTime: number;
    avgWaitingTime: number;
    completedProcesses: number;
    totalTicks: number;
}

export interface ComparisonResult {
    strategies: StrategyMetrics[];
    bestPerformance: "FirstFit" | "BestFit" | "WorstFit";
    bestOptimization: "FirstFit" | "BestFit" | "WorstFit";
}

/**
 * Run 3 simulations with different memory strategies
 * using the same initial configuration
 */
export function runStrategyComparison(
    currentState: OSState,
    maxTicks: number = 200
): ComparisonResult {
    const strategies: ("FirstFit" | "BestFit" | "WorstFit")[] = [
        "FirstFit",
        "BestFit",
        "WorstFit"
    ];

    const results: StrategyMetrics[] = strategies.map(strategy => {
        // Create new simulator
        const simulator = new OSSimulator();

        // Configure scheduler
        simulator.setScheduler(currentState.scheduler);
        simulator.setApropiativo(currentState.apropiativo);
        simulator.setQuantum(currentState.quantum);

        // Set memory strategy
        simulator.setMemoryStrategy(strategy);

        // Create same processes as current state (only non-terminated)
        const activeProcesses = currentState.procesos.filter(p => p.estado !== 'terminated');
        activeProcesses.forEach(p => {
            simulator.crearProceso(
                p.tamanio,
                p.burstTime,
                p.prioridad,
                p.maxInterrupciones,
                p.porcentajeDatos,
                p.porcentajeVariable
            );
        });

        // Run simulation
        let ticksExecuted = 0;
        for (let i = 0; i < maxTicks; i++) {
            simulator.ejecutarTick();
            ticksExecuted++;

            // Stop if all processes completed
            const state = simulator.getState();
            if (state.colaTerminated.length >= activeProcesses.length && activeProcesses.length > 0) {
                break;
            }
        }

        // Collect metrics
        const finalState = simulator.getState();
        const totalMemory = 2 * 1024 * 1024; // 2MB
        const occupiedMemory = finalState.memoria
            .filter(b => b.ocupado)
            .reduce((sum, b) => sum + b.tamanio, 0);

        return {
            strategy,
            fragExternal: totalMemory > 0 ? (finalState.fragmentation.external / totalMemory) * 100 : 0,
            fragInterna: totalMemory > 0 ? (finalState.fragmentation.internal / totalMemory) * 100 : 0,
            huecos: finalState.fragmentation.externalHoles,
            rechazos: finalState.fragmentation.rechazosFragmentacion,
            utilizacion: totalMemory > 0 ? (occupiedMemory / totalMemory) * 100 : 0,
            avgTurnaroundTime: finalState.metrics.avgTurnaroundTime,
            avgWaitingTime: finalState.metrics.avgWaitingTime,
            completedProcesses: finalState.metrics.completedProcesses,
            totalTicks: ticksExecuted
        };
    });

    // Determine best strategy for performance (lower turnaround time is better)
    const bestPerformance = results.reduce((best, curr) => {
        // If no processes completed, can't determine
        if (curr.completedProcesses === 0 && best.completedProcesses === 0) return best;
        if (curr.completedProcesses === 0) return best;
        if (best.completedProcesses === 0) return curr;

        return curr.avgTurnaroundTime < best.avgTurnaroundTime ? curr : best;
    }).strategy;

    // Determine best strategy for optimization (lower total fragmentation is better)
    const bestOptimization = results.reduce((best, curr) => {
        const currFrag = curr.fragExternal + curr.fragInterna;
        const bestFrag = best.fragExternal + best.fragInterna;
        return currFrag < bestFrag ? curr : best;
    }).strategy;

    return {
        strategies: results,
        bestPerformance,
        bestOptimization
    };
}
