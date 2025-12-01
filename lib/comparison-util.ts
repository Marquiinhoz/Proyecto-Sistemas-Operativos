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

        // Run simulation and track metrics during execution
        let ticksExecuted = 0;
        let maxOccupiedMemory = 0;
        let totalFragExternal = 0;
        let totalFragInternal = 0;
        let fragmentationSamples = 0;

        for (let i = 0; i < maxTicks; i++) {
            simulator.ejecutarTick();
            ticksExecuted++;

            // Collect metrics during execution
            const state = simulator.getState();
            const currentOccupied = state.memoria
                .filter(b => b.ocupado)
                .reduce((sum, b) => sum + b.tamanio, 0);

            maxOccupiedMemory = Math.max(maxOccupiedMemory, currentOccupied);

            // Sample fragmentation (only when there are active processes)
            if (state.procesos.filter(p => p.estado !== 'terminated').length > 0) {
                totalFragExternal += state.fragmentation.external;
                totalFragInternal += state.fragmentation.internal;
                fragmentationSamples++;
            }

            // Stop if all processes completed
            if (state.colaTerminated.length >= activeProcesses.length && activeProcesses.length > 0) {
                break;
            }
        }

        // Collect final metrics
        const finalState = simulator.getState();
        const totalMemory = 2 * 1024 * 1024; // 2MB

        // Use average fragmentation instead of final state
        const avgFragExternal = fragmentationSamples > 0 ? totalFragExternal / fragmentationSamples : finalState.fragmentation.external;
        const avgFragInternal = fragmentationSamples > 0 ? totalFragInternal / fragmentationSamples : finalState.fragmentation.internal;

        return {
            strategy,
            fragExternal: totalMemory > 0 ? (avgFragExternal / totalMemory) * 100 : 0,
            fragInterna: totalMemory > 0 ? (avgFragInternal / totalMemory) * 100 : 0,
            huecos: finalState.fragmentation.externalHoles,
            rechazos: finalState.fragmentation.rechazosFragmentacion,
            utilizacion: totalMemory > 0 ? (maxOccupiedMemory / totalMemory) * 100 : 0,
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
