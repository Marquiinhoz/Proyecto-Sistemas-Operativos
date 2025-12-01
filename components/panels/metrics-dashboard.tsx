"use client"

import { Card } from "@/components/ui/card"
import { SimulationMetrics } from "@/lib/types"

interface MetricsDashboardProps {
    metrics: SimulationMetrics;
}

export default function MetricsDashboard({ metrics }: MetricsDashboardProps) {
    return (
        <Card className="p-4 border border-border">
            <h2 className="text-lg font-bold mb-4">Métricas de Rendimiento</h2>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                {/* Average Waiting Time */}
                <div className="p-3 bg-muted rounded text-center">
                    <div className="text-2xl font-bold text-blue-400">
                        {metrics.avgWaitingTime.toFixed(2)}
                    </div>
                    <div className="text-xs text-muted-foreground">Tiempo Espera Promedio</div>
                    <div className="text-[10px] text-muted-foreground mt-1">
                        (ticks)
                    </div>
                </div>

                {/* Average Turnaround Time */}
                <div className="p-3 bg-muted rounded text-center">
                    <div className="text-2xl font-bold text-green-400">
                        {metrics.avgTurnaroundTime.toFixed(2)}
                    </div>
                    <div className="text-xs text-muted-foreground">Tiempo Retorno Promedio</div>
                    <div className="text-[10px] text-muted-foreground mt-1">
                        (ticks)
                    </div>
                </div>

                {/* Average Response Time */}
                <div className="p-3 bg-muted rounded text-center">
                    <div className="text-2xl font-bold text-purple-400">
                        {metrics.avgResponseTime.toFixed(2)}
                    </div>
                    <div className="text-xs text-muted-foreground">Tiempo Respuesta Promedio</div>
                    <div className="text-[10px] text-muted-foreground mt-1">
                        (ticks)
                    </div>
                </div>

                {/* Throughput */}
                <div className="p-3 bg-muted rounded text-center">
                    <div className="text-2xl font-bold text-orange-400">
                        {metrics.throughput.toFixed(4)}
                    </div>
                    <div className="text-xs text-muted-foreground">Throughput</div>
                    <div className="text-[10px] text-muted-foreground mt-1">
                        (procesos/tick)
                    </div>
                </div>
            </div>

            {/* CPU Utilization Bar */}
            <div className="p-3 bg-muted rounded mb-3">
                <div className="flex justify-between items-center mb-2">
                    <div className="text-sm font-semibold">Uso de CPU</div>
                    <div className="text-sm font-bold text-cyan-400">
                        {metrics.cpuUtilization.toFixed(1)}%
                    </div>
                </div>
                <div className="w-full bg-background rounded h-3">
                    <div
                        className="bg-gradient-to-r from-cyan-500 to-blue-500 h-full rounded transition-all"
                        style={{ width: `${Math.min(metrics.cpuUtilization, 100)}%` }}
                    />
                </div>
                <div className="text-xs text-muted-foreground mt-2">
                    Tiempo activo: {metrics.completedProcesses > 0 ? (metrics.totalProcesses - metrics.idleTime) : 0} ticks |
                    Tiempo ocioso: {metrics.idleTime} ticks
                </div>
            </div>

            {/* Process Summary */}
            <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-muted rounded text-center">
                    <div className="text-xl font-bold text-yellow-400">
                        {metrics.completedProcesses}
                    </div>
                    <div className="text-xs text-muted-foreground">Procesos Completados</div>
                </div>

                <div className="p-3 bg-muted rounded text-center">
                    <div className="text-xl font-bold text-red-400">
                        {metrics.totalProcesses - metrics.completedProcesses}
                    </div>
                    <div className="text-xs text-muted-foreground">Procesos Activos</div>
                </div>
            </div>

            {/* Formulas Info */}
            {metrics.completedProcesses > 0 && (
                <div className="mt-4 p-3 bg-muted/50 rounded border border-border">
                    <div className="text-xs font-semibold mb-1 text-muted-foreground">Fórmulas:</div>
                    <div className="text-[10px] text-muted-foreground space-y-1">
                        <div>• Tiempo Espera = T_inicio - T_llegada - T_burst</div>
                        <div>• Tiempo Retorno = T_final - T_llegada</div>
                        <div>• Tiempo Respuesta = Primera ejecución en CPU</div>
                        <div>• Throughput = Procesos completados / Tiempo total</div>
                        <div>• Uso CPU = (Tiempo total - Tiempo ocioso) / Tiempo total</div>
                    </div>
                </div>
            )}

            {metrics.completedProcesses === 0 && (
                <div className="mt-4 text-center text-sm text-muted-foreground italic">
                    Las métricas se calcularán cuando los procesos comiencen a completarse
                </div>
            )}
        </Card>
    )
}
