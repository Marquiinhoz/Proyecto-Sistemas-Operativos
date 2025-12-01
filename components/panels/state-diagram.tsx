"use client"

import { Card } from "@/components/ui/card"
import { Process, ProcessState } from "@/lib/types"
import { Badge } from "@/components/ui/badge"

interface StateDiagramProps {
    procesos: Process[];
}

export default function StateDiagram({ procesos }: StateDiagramProps) {
    // Contar procesos por estado
    const countByState = {
        new: procesos.filter(p => p.estado === "new").length,
        ready: procesos.filter(p => p.estado === "ready").length,
        running: procesos.filter(p => p.estado === "running").length,
        blocked: procesos.filter(p => p.estado === "blocked").length,
        terminated: procesos.filter(p => p.estado === "terminated").length,
    };

    // Obtener PIDs por estado
    const pidsByState = {
        new: procesos.filter(p => p.estado === "new").map(p => p.pid),
        ready: procesos.filter(p => p.estado === "ready").map(p => p.pid),
        running: procesos.filter(p => p.estado === "running").map(p => p.pid),
        blocked: procesos.filter(p => p.estado === "blocked").map(p => p.pid),
        terminated: procesos.filter(p => p.estado === "terminated").map(p => p.pid),
    };

    const StateBox = ({
        estado,
        color,
        count,
        pids
    }: {
        estado: string;
        color: string;
        count: number;
        pids: number[]
    }) => (
        <div className="flex flex-col items-center">
            <div
                className={`
          relative
          ${color} 
          border-2 border-${color.replace('bg-', 'border-')}
          rounded-lg p-4 w-32 text-center
          transition-all hover:scale-105 hover:shadow-lg
          group
        `}
            >
                <div className="font-bold text-white text-sm mb-1 uppercase">
                    {estado}
                </div>
                <div className="text-2xl font-bold text-white">
                    {count}
                </div>
                <div className="text-xs text-white/80 mt-1">
                    {count === 1 ? "proceso" : "procesos"}
                </div>

                {/* Tooltip con PIDs */}
                {count > 0 && (
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block z-10">
                        <div className="bg-black text-white text-xs px-3 py-2 rounded whitespace-nowrap shadow-lg">
                            <div className="font-semibold mb-1">PIDs:</div>
                            <div className="flex flex-wrap gap-1">
                                {pids.slice(0, 10).map(pid => (
                                    <Badge key={pid} variant="outline" className="text-white border-white">
                                        {pid}
                                    </Badge>
                                ))}
                                {pids.length > 10 && (
                                    <span className="text-white/60">+{pids.length - 10}</span>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );

    const Arrow = ({ direction = "right", label = "" }: { direction?: "right" | "down" | "up"; label?: string }) => (
        <div className={`flex items-center justify-center ${direction === "down" || direction === "up" ? "flex-col" : ""}`}>
            <div className="relative">
                {direction === "right" && (
                    <div className="flex items-center">
                        <div className="h-0.5 w-12 bg-muted-foreground"></div>
                        <div className="w-0 h-0 border-t-4 border-t-transparent border-b-4 border-b-transparent border-l-8 border-l-muted-foreground"></div>
                    </div>
                )}
                {direction === "down" && (
                    <div className="flex flex-col items-center">
                        <div className="w-0.5 h-12 bg-muted-foreground"></div>
                        <div className="w-0 h-0 border-l-4 border-l-transparent border-r-4 border-r-transparent border-t-8 border-t-muted-foreground"></div>
                    </div>
                )}
                {direction === "up" && (
                    <div className="flex flex-col items-center">
                        <div className="w-0 h-0 border-l-4 border-l-transparent border-r-4 border-r-transparent border-b-8 border-b-muted-foreground"></div>
                        <div className="w-0.5 h-12 bg-muted-foreground"></div>
                    </div>
                )}
                {label && (
                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-background px-2 py-0.5 text-[9px] text-muted-foreground whitespace-nowrap border border-border rounded">
                        {label}
                    </div>
                )}
            </div>
        </div>
    );

    return (
        <Card className="p-6 border border-border">
            <h2 className="text-lg font-bold mb-6">Diagrama de Estados de Procesos</h2>

            {/* Diagrama de Flujo */}
            <div className="flex flex-col items-center space-y-4">
                {/* Fila 1: NEW → READY */}
                <div className="flex items-center gap-4">
                    <StateBox
                        estado="NEW"
                        color="bg-gray-500"
                        count={countByState.new}
                        pids={pidsByState.new}
                    />
                    <Arrow label="admit" />
                    <StateBox
                        estado="READY"
                        color="bg-blue-500"
                        count={countByState.ready}
                        pids={pidsByState.ready}
                    />
                </div>

                {/* Fila 2: READY ↔ RUNNING */}
                <div className="flex items-center gap-4">
                    <div className="w-32"></div> {/* Spacer */}
                    <div className="flex flex-col items-center">
                        <Arrow direction="down" label="dispatch" />
                        <StateBox
                            estado="RUNNING"
                            color="bg-green-500"
                            count={countByState.running}
                            pids={pidsByState.running}
                        />
                        <Arrow direction="up" label="preempt" />
                    </div>
                </div>

                {/* Fila 3: RUNNING ↔ BLOCKED */}
                <div className="flex items-center gap-4">
                    <StateBox
                        estado="BLOCKED"
                        color="bg-yellow-500"
                        count={countByState.blocked}
                        pids={pidsByState.blocked}
                    />
                    <div className="flex flex-col items-center gap-2">
                        <Arrow direction="right" label="I/O wait" />
                        <Arrow direction="right" label="I/O complete" />
                    </div>
                    <div className="w-32"></div> {/* Spacer para running arriba */}
                </div>

                {/* Fila 4: RUNNING → TERMINATED */}
                <div className="flex items-center gap-4">
                    <div className="w-32"></div> {/* Spacer */}
                    <div className="flex flex-col items-center">
                        <Arrow direction="down" label="exit" />
                        <StateBox
                            estado="TERMINATED"
                            color="bg-red-500"
                            count={countByState.terminated}
                            pids={pidsByState.terminated}
                        />
                    </div>
                </div>
            </div>

            {/* Leyenda */}
            <div className="mt-6 pt-4 border-t border-border">
                <div className="text-xs font-semibold mb-2 text-muted-foreground">Transiciones:</div>
                <div className="grid grid-cols-2 gap-2 text-[10px] text-muted-foreground">
                    <div>• <strong>admit:</strong> Asignación de memoria</div>
                    <div>• <strong>dispatch:</strong> Selección por scheduler</div>
                    <div>• <strong>preempt:</strong> Quantum agotado o expropiación</div>
                    <div>• <strong>I/O wait:</strong> Solicitud de E/S</div>
                    <div>• <strong>I/O complete:</strong> Finalización de E/S</div>
                    <div>• <strong>exit:</strong> Proceso terminado</div>
                </div>
            </div>

            {/* Resumen */}
            <div className="mt-4 p-3 bg-muted rounded text-sm">
                <div className="font-semibold mb-1">Resumen:</div>
                <div className="text-xs text-muted-foreground">
                    Total de procesos: <strong>{procesos.length}</strong>
                    {" "}| Activos: <strong>{procesos.filter(p => p.estado !== "terminated").length}</strong>
                    {" "}| Completados: <strong>{countByState.terminated}</strong>
                </div>
            </div>
        </Card>
    )
}
