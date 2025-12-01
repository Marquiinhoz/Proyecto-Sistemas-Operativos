"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { runStrategyComparison, type ComparisonResult, type StrategyMetrics } from "@/lib/comparison-util"
import type { OSState } from "@/lib/types"

interface StrategyComparisonProps {
    open: boolean;
    onClose: () => void;
    currentState: OSState;
}

export default function StrategyComparison({
    open,
    onClose,
    currentState
}: StrategyComparisonProps) {
    const [comparison, setComparison] = useState<ComparisonResult | null>(null);
    const [loading, setLoading] = useState(false);

    // Run comparison when modal opens
    useEffect(() => {
        if (open && !comparison) {
            setLoading(true);
            // Run in setTimeout to avoid blocking UI
            setTimeout(() => {
                try {
                    const result = runStrategyComparison(currentState, 200);
                    setComparison(result);
                } catch (error) {
                    console.error("Error running comparison:", error);
                } finally {
                    setLoading(false);
                }
            }, 100);
        }
    }, [open]);

    // Reset when modal closes
    useEffect(() => {
        if (!open) {
            setComparison(null);
        }
    }, [open]);

    if (loading) {
        return (
            <Dialog open={open} onOpenChange={onClose}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Ejecutando Comparación</DialogTitle>
                    </DialogHeader>
                    <div className="flex flex-col items-center justify-center p-8 space-y-4">
                        <div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full"></div>
                        <div className="text-center space-y-2">
                            <p className="font-semibold">Ejecutando comparación de estrategias...</p>
                            <p className="text-sm text-muted-foreground">
                                Simulando FirstFit, BestFit y WorstFit
                            </p>
                            <p className="text-xs text-muted-foreground">
                                Esto puede tomar unos segundos
                            </p>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        );
    }

    if (!comparison) return null;

    const comparisonData = comparison.strategies.map(s => ({
        strategy: s.strategy,
        color: s.strategy === "FirstFit" ? "bg-blue-500" :
            s.strategy === "BestFit" ? "bg-green-500" : "bg-orange-500",
        metrics: {
            fragExternal: Number(s.fragExternal.toFixed(1)),
            fragInterna: Number(s.fragInterna.toFixed(1)),
            huecos: s.huecos,
            rechazos: s.rechazos,
            utilizacion: Number(s.utilizacion.toFixed(1)),
            tiempoAsignacion: Number((s.avgTurnaroundTime / 1000).toFixed(2)),
            avgWaiting: Number((s.avgWaitingTime / 1000).toFixed(2)),
            completedProcesses: s.completedProcesses,
            totalTicks: s.totalTicks
        }
    }));

    const getBestBadge = (metric: string) => {
        const values = comparisonData.map((d, idx) => {
            switch (metric) {
                case 'fragExternal': return { val: d.metrics.fragExternal, idx };
                case 'fragInterna': return { val: d.metrics.fragInterna, idx };
                case 'huecos': return { val: d.metrics.huecos, idx };
                case 'rechazos': return { val: d.metrics.rechazos, idx };
                case 'utilizacion': return { val: d.metrics.utilizacion, idx };
                case 'tiempoAsignacion': return { val: d.metrics.tiempoAsignacion, idx };
                case 'avgWaiting': return { val: d.metrics.avgWaiting, idx };
                default: return { val: 0, idx };
            }
        });

        const bestIndex = metric === 'utilizacion'
            ? values.reduce((best, curr) => curr.val > best.val ? curr : best).idx
            : values.reduce((best, curr) => curr.val < best.val ? curr : best).idx;

        return bestIndex;
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-5xl max-h-[90vh]">
                <DialogHeader>
                    <DialogTitle className="text-2xl">📊 Comparativa de Estrategias de Asignación</DialogTitle>
                </DialogHeader>

                <ScrollArea className="max-h-[75vh] pr-4">
                    <div className="space-y-6">
                        <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                            <p className="text-sm font-medium">
                                ✨ Comparación en tiempo real con tu configuración actual
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                                Scheduler: <strong>{currentState.scheduler}</strong> |
                                Quantum: <strong>{currentState.quantum}</strong> |
                                Procesos analizados: <strong>{currentState.procesos.filter(p => p.estado !== 'terminated').length}</strong>
                            </p>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b-2 border-border">
                                        <th className="text-left p-3 font-bold">Métrica</th>
                                        <th className="text-center p-3 font-bold text-blue-600">FirstFit</th>
                                        <th className="text-center p-3 font-bold text-green-600">BestFit</th>
                                        <th className="text-center p-3 font-bold text-orange-600">WorstFit</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr className="border-b border-border hover:bg-muted/50">
                                        <td className="p-3 font-medium">Fragmentación Externa (%)</td>
                                        {comparisonData.map((data, idx) => (
                                            <td key={idx} className="text-center p-3">
                                                {data.metrics.fragExternal}%
                                                {getBestBadge('fragExternal') === idx && <Badge className="ml-2 bg-green-500 text-xs">✓ Mejor</Badge>}
                                            </td>
                                        ))}
                                    </tr>
                                    <tr className="border-b border-border hover:bg-muted/50">
                                        <td className="p-3 font-medium">Fragmentación Interna (%)</td>
                                        {comparisonData.map((data, idx) => (
                                            <td key={idx} className="text-center p-3">
                                                {data.metrics.fragInterna}%
                                                {getBestBadge('fragInterna') === idx && <Badge className="ml-2 bg-green-500 text-xs">✓ Mejor</Badge>}
                                            </td>
                                        ))}
                                    </tr>
                                    <tr className="border-b border-border hover:bg-muted/50">
                                        <td className="p-3 font-medium">Huecos Dispersos</td>
                                        {comparisonData.map((data, idx) => (
                                            <td key={idx} className="text-center p-3">
                                                {data.metrics.huecos}
                                                {getBestBadge('huecos') === idx && <Badge className="ml-2 bg-green-500 text-xs">✓ Mejor</Badge>}
                                            </td>
                                        ))}
                                    </tr>
                                    <tr className="border-b border-border hover:bg-muted/50">
                                        <td className="p-3 font-medium">Rechazos por Fragmentación</td>
                                        {comparisonData.map((data, idx) => (
                                            <td key={idx} className="text-center p-3">
                                                {data.metrics.rechazos}
                                                {getBestBadge('rechazos') === idx && <Badge className="ml-2 bg-green-500 text-xs">✓ Mejor</Badge>}
                                            </td>
                                        ))}
                                    </tr>
                                    <tr className="border-b border-border hover:bg-muted/50">
                                        <td className="p-3 font-medium">Utilización de Memoria (%)</td>
                                        {comparisonData.map((data, idx) => (
                                            <td key={idx} className="text-center p-3">
                                                {data.metrics.utilizacion}%
                                                {getBestBadge('utilizacion') === idx && <Badge className="ml-2 bg-green-500 text-xs">✓ Mejor</Badge>}
                                            </td>
                                        ))}
                                    </tr>
                                    <tr className="border-b border-border hover:bg-muted/50">
                                        <td className="p-3 font-medium">Tiempo Promedio Turnaround (s)</td>
                                        {comparisonData.map((data, idx) => (
                                            <td key={idx} className="text-center p-3">
                                                {data.metrics.tiempoAsignacion}s
                                                {getBestBadge('tiempoAsignacion') === idx && <Badge className="ml-2 bg-green-500 text-xs">✓ Mejor</Badge>}
                                            </td>
                                        ))}
                                    </tr>
                                    <tr className="border-b border-border hover:bg-muted/50">
                                        <td className="p-3 font-medium">Tiempo Promedio Espera (s)</td>
                                        {comparisonData.map((data, idx) => (
                                            <td key={idx} className="text-center p-3">
                                                {data.metrics.avgWaiting}s
                                                {getBestBadge('avgWaiting') === idx && <Badge className="ml-2 bg-green-500 text-xs">✓ Mejor</Badge>}
                                            </td>
                                        ))}
                                    </tr>
                                    <tr className="border-b border-border hover:bg-muted/50">
                                        <td className="p-3 font-medium">Procesos Completados</td>
                                        {comparisonData.map((data, idx) => (
                                            <td key={idx} className="text-center p-3">
                                                {data.metrics.completedProcesses}
                                            </td>
                                        ))}
                                    </tr>
                                    <tr className="border-b border-border hover:bg-muted/50">
                                        <td className="p-3 font-medium">Ticks Ejecutados</td>
                                        {comparisonData.map((data, idx) => (
                                            <td key={idx} className="text-center p-3">
                                                {data.metrics.totalTicks}
                                            </td>
                                        ))}
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <h3 className="font-semibold text-sm">Fragmentación Total (menor es mejor)</h3>
                                <div className="space-y-2">
                                    {comparisonData.map((data, idx) => {
                                        const totalFrag = data.metrics.fragExternal + data.metrics.fragInterna;
                                        return (
                                            <div key={idx}>
                                                <div className="flex items-center gap-2 text-xs mb-1">
                                                    <span className="w-20 font-medium">{data.strategy}</span>
                                                    <span className="text-muted-foreground">{totalFrag.toFixed(1)}%</span>
                                                </div>
                                                <div className="h-6 bg-muted rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full ${data.color} transition-all`}
                                                        style={{ width: `${Math.min((totalFrag / 50) * 100, 100)}%` }}
                                                    ></div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <h3 className="font-semibold text-sm">Utilización de Memoria (mayor es mejor)</h3>
                                <div className="space-y-2">
                                    {comparisonData.map((data, idx) => (
                                        <div key={idx}>
                                            <div className="flex items-center gap-2 text-xs mb-1">
                                                <span className="w-20 font-medium">{data.strategy}</span>
                                                <span className="text-muted-foreground">{data.metrics.utilizacion}%</span>
                                            </div>
                                            <div className="h-6 bg-muted rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full ${data.color} transition-all`}
                                                    style={{ width: `${data.metrics.utilizacion}%` }}
                                                ></div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="p-4 bg-blue-50 dark:bg-blue-950/20 border-2 border-blue-500 rounded-lg">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="text-2xl">⚡</span>
                                    <h3 className="font-bold text-blue-700 dark:text-blue-300">Ganador en Performance</h3>
                                </div>
                                <div className="space-y-2 text-sm">
                                    <div className="flex items-center gap-2">
                                        <Badge className={
                                            comparison.bestPerformance === "FirstFit" ? "bg-blue-500" :
                                                comparison.bestPerformance === "BestFit" ? "bg-green-500" : "bg-orange-500"
                                        }>
                                            {comparison.bestPerformance}
                                        </Badge>
                                        <span className="font-semibold">
                                            {comparisonData.find(d => d.strategy === comparison.bestPerformance)?.metrics.tiempoAsignacion}s turnaround
                                        </span>
                                    </div>
                                    <p className="text-muted-foreground">
                                        <strong>{comparison.bestPerformance}</strong> tiene el menor tiempo promedio de turnaround,
                                        completando procesos más rápidamente.
                                    </p>
                                </div>
                            </div>

                            <div className="p-4 bg-green-50 dark:bg-green-950/20 border-2 border-green-500 rounded-lg">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="text-2xl">🏆</span>
                                    <h3 className="font-bold text-green-700 dark:text-green-300">Ganador en Optimización</h3>
                                </div>
                                <div className="space-y-2 text-sm">
                                    <div className="flex items-center gap-2">
                                        <Badge className={
                                            comparison.bestOptimization === "FirstFit" ? "bg-blue-500" :
                                                comparison.bestOptimization === "BestFit" ? "bg-green-500" : "bg-orange-500"
                                        }>
                                            {comparison.bestOptimization}
                                        </Badge>
                                        <span className="font-semibold">
                                            {(() => {
                                                const data = comparisonData.find(d => d.strategy === comparison.bestOptimization);
                                                return data ? (data.metrics.fragExternal + data.metrics.fragInterna).toFixed(1) : 0;
                                            })()}% fragmentación total
                                        </span>
                                    </div>
                                    <p className="text-muted-foreground">
                                        <strong>{comparison.bestOptimization}</strong> minimiza la fragmentación y maximiza
                                        la utilización de memoria. <strong>Estrategia óptima</strong> para este escenario.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="p-4 bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-950/20 dark:to-blue-950/20 border-2 border-green-500 rounded-lg">
                            <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
                                <span>🎯</span>
                                Conclusión para Tu Configuración
                            </h3>
                            <div className="space-y-2 text-sm">
                                <p>
                                    Con <strong>{currentState.procesos.filter(p => p.estado !== 'terminated').length} procesos</strong> y
                                    scheduler <strong>{currentState.scheduler}</strong>:
                                </p>
                                <ul className="list-disc list-inside space-y-1 ml-2 text-muted-foreground">
                                    <li>
                                        <strong>Mejor Performance:</strong> {comparison.bestPerformance}
                                        ({comparisonData.find(d => d.strategy === comparison.bestPerformance)?.metrics.tiempoAsignacion}s turnaround)
                                    </li>
                                    <li>
                                        <strong>Mejor Optimización:</strong> {comparison.bestOptimization}
                                        ({(() => {
                                            const data = comparisonData.find(d => d.strategy === comparison.bestOptimization);
                                            return data ? (data.metrics.fragExternal + data.metrics.fragInterna).toFixed(1) : 0;
                                        })()}% fragmentación)
                                    </li>
                                    <li>
                                        <strong>Procesos completados:</strong> {comparisonData[0].metrics.completedProcesses} de {currentState.procesos.filter(p => p.estado !== 'terminated').length}
                                    </li>
                                </ul>
                                {comparison.bestPerformance === comparison.bestOptimization ? (
                                    <p className="mt-3 pt-3 border-t border-green-300 dark:border-green-700 font-semibold text-green-700 dark:text-green-300">
                                        ✅ <strong>{comparison.bestPerformance}</strong> es la mejor estrategia en ambos aspectos para esta configuración.
                                    </p>
                                ) : (
                                    <p className="mt-3 pt-3 border-t border-green-300 dark:border-green-700">
                                        <strong>Trade-off:</strong> {comparison.bestPerformance} es más rápido,
                                        pero {comparison.bestOptimization} optimiza mejor la memoria.
                                    </p>
                                )}
                            </div>
                        </div>

                        <div className="text-xs text-muted-foreground p-3 bg-muted rounded border border-border">
                            <strong>Metodología:</strong> Resultados obtenidos ejecutando 3 simulaciones separadas (FirstFit, BestFit, WorstFit)
                            con configuración idéntica: {currentState.procesos.filter(p => p.estado !== 'terminated').length} procesos,
                            Scheduler {currentState.scheduler}, Quantum {currentState.quantum}.
                            Simulaciones ejecutadas por hasta 200 ticks o hasta completar todos los procesos.
                        </div>
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
}
