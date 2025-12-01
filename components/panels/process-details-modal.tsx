"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Process } from "@/lib/types"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"

interface ProcessDetailsModalProps {
    process: Process | null;
    isOpen: boolean;
    onClose: () => void;
}

export default function ProcessDetailsModal({ process, isOpen, onClose }: ProcessDetailsModalProps) {
    if (!process) return null;

    const getStateColor = (estado: string) => {
        switch (estado) {
            case "new": return "bg-gray-500"
            case "ready": return "bg-blue-500"
            case "running": return "bg-green-500"
            case "blocked": return "bg-yellow-500"
            case "terminated": return "bg-red-500"
            default: return "bg-gray-500"
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl max-h-[80vh]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-3">
                        <span>Detalles del Proceso - PID {process.pid}</span>
                        <Badge className={`${getStateColor(process.estado)} text-white`}>
                            {process.estado.toUpperCase()}
                        </Badge>
                    </DialogTitle>
                </DialogHeader>

                <ScrollArea className="h-[60vh] pr-4">
                    <div className="space-y-4">
                        {/* Información Básica */}
                        <div className="p-4 bg-muted rounded-lg">
                            <h3 className="text-sm font-bold mb-3 text-primary">Información Básica</h3>
                            <div className="grid grid-cols-2 gap-3 text-sm">
                                <div>
                                    <span className="text-muted-foreground">PID:</span>
                                    <span className="ml-2 font-semibold">{process.pid}</span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Estado:</span>
                                    <span className="ml-2 font-semibold capitalize">{process.estado}</span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Prioridad:</span>
                                    <span className="ml-2 font-semibold">{process.prioridad}</span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Program Counter:</span>
                                    <span className="ml-2 font-semibold">{process.programCounter}</span>
                                </div>
                            </div>
                        </div>

                        {/* Tiempos de Ejecución */}
                        <div className="p-4 bg-muted rounded-lg">
                            <h3 className="text-sm font-bold mb-3 text-primary">Tiempos de Ejecución</h3>
                            <div className="grid grid-cols-2 gap-3 text-sm">
                                <div>
                                    <span className="text-muted-foreground">Burst Time:</span>
                                    <span className="ml-2 font-semibold">{process.burstTime} ticks</span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Tiempo Restante:</span>
                                    <span className="ml-2 font-semibold">{process.tiempoRestante} ticks</span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Tiempo de Llegada:</span>
                                    <span className="ml-2 font-semibold">t={process.tiempoLlegada}</span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Tiempo de Inicio:</span>
                                    <span className="ml-2 font-semibold">{process.tiempoInicio >= 0 ? `t=${process.tiempoInicio}` : "No iniciado"}</span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Tiempo Final:</span>
                                    <span className="ml-2 font-semibold">{process.tiempoFinal >= 0 ? `t=${process.tiempoFinal}` : "No terminado"}</span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Progreso:</span>
                                    <span className="ml-2 font-semibold">{process.porcentajeProcesado.toFixed(1)}%</span>
                                </div>
                            </div>

                            {/* Barra de Progreso */}
                            <div className="mt-3">
                                <div className="w-full bg-background rounded h-3">
                                    <div
                                        className="bg-gradient-to-r from-green-500 to-blue-500 h-full rounded transition-all"
                                        style={{ width: `${process.porcentajeProcesado}%` }}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Métricas de Rendimiento */}
                        <div className="p-4 bg-muted rounded-lg">
                            <h3 className="text-sm font-bold mb-3 text-primary">Métricas de Rendimiento</h3>
                            <div className="grid grid-cols-2 gap-3 text-sm">
                                <div>
                                    <span className="text-muted-foreground">Tiempo de Espera:</span>
                                    <span className="ml-2 font-semibold text-blue-600">{process.tiempoEspera} ticks</span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Tiempo de Respuesta:</span>
                                    <span className="ml-2 font-semibold text-purple-600">
                                        {process.tiempoRespuesta >= 0 ? `${process.tiempoRespuesta} ticks` : "N/A"}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Tiempo de Retorno:</span>
                                    <span className="ml-2 font-semibold text-green-600">
                                        {process.tiempoTurnaround >= 0 ? `${process.tiempoTurnaround} ticks` : "N/A"}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Cambios de Contexto:</span>
                                    <span className="ml-2 font-semibold">{process.cambiosContexto}</span>
                                </div>
                            </div>
                        </div>

                        {/* Gestión de Memoria */}
                        <div className="p-4 bg-muted rounded-lg">
                            <h3 className="text-sm font-bold mb-3 text-primary">Gestión de Memoria</h3>
                            <div className="grid grid-cols-2 gap-3 text-sm">
                                <div>
                                    <span className="text-muted-foreground">Tamaño:</span>
                                    <span className="ml-2 font-semibold">{(process.tamanio / 1024).toFixed(0)} KB</span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Dirección Base:</span>
                                    <span className="ml-2 font-mono text-xs">0x{process.dirBase.toString(16).toUpperCase()}</span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Stack Pointer:</span>
                                    <span className="ml-2 font-mono text-xs">0x{process.stackPointer.toString(16).toUpperCase()}</span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Heap Pointer:</span>
                                    <span className="ml-2 font-mono text-xs">0x{process.heapPointer.toString(16).toUpperCase()}</span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Datos:</span>
                                    <span className="ml-2 font-semibold">{process.porcentajeDatos}%</span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Variables:</span>
                                    <span className="ml-2 font-semibold">{process.porcentajeVariable}%</span>
                                </div>
                            </div>
                        </div>

                        {/* Interrupciones y Errores */}
                        <div className="p-4 bg-muted rounded-lg">
                            <h3 className="text-sm font-bold mb-3 text-primary">Interrupciones y Errores</h3>
                            <div className="grid grid-cols-2 gap-3 text-sm">
                                <div>
                                    <span className="text-muted-foreground">Interrupciones:</span>
                                    <span className="ml-2 font-semibold">{process.interrupciones} / {process.maxInterrupciones}</span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Errores:</span>
                                    <span className="ml-2 font-semibold text-red-600">{process.errores}</span>
                                </div>
                                {process.ioType && (
                                    <>
                                        <div>
                                            <span className="text-muted-foreground">Dispositivo I/O:</span>
                                            <span className="ml-2 font-semibold capitalize">{process.ioType}</span>
                                        </div>
                                        <div>
                                            <span className="text-muted-foreground">Tiempo I/O Restante:</span>
                                            <span className="ml-2 font-semibold">{process.ioTimeRemaining} ticks</span>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Fórmulas de Cálculo */}
                        <div className="p-4 bg-muted/50 rounded-lg border border-border">
                            <h3 className="text-xs font-bold mb-2 text-muted-foreground">Fórmulas de Cálculo</h3>
                            <div className="text-[10px] text-muted-foreground space-y-1">
                                <div>• <strong>Tiempo de Espera:</strong> Acumulado en cola Ready</div>
                                <div>• <strong>Tiempo de Respuesta:</strong> {process.tiempoInicio} - {process.tiempoLlegada} = {process.tiempoRespuesta >= 0 ? process.tiempoRespuesta : "N/A"}</div>
                                <div>• <strong>Tiempo de Retorno:</strong> {process.tiempoFinal >= 0 ? `${process.tiempoFinal} - ${process.tiempoLlegada} = ${process.tiempoTurnaround}` : "Pendiente"}</div>
                                <div>• <strong>Progreso:</strong> ({process.burstTime - process.tiempoRestante} / {process.burstTime}) × 100 = {process.porcentajeProcesado.toFixed(1)}%</div>
                            </div>
                        </div>
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    )
}
