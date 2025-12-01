"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { AlertTriangle } from "lucide-react"
import { DeadlockInfo } from "@/lib/types"

interface DeadlockAlertProps {
    deadlockInfo: DeadlockInfo;
    onResolve: (action: "cancel_process" | "ignore", pid?: number) => void;
    onClose: () => void;
}

export default function DeadlockAlert({ deadlockInfo, onResolve, onClose }: DeadlockAlertProps) {
    if (!deadlockInfo.detected) return null;

    const handleCancelProcess = () => {
        // Cancel the first affected process
        if (deadlockInfo.affectedProcesses.length > 0) {
            onResolve("cancel_process", deadlockInfo.affectedProcesses[0]);
        }
    };

    const handleIgnore = () => {
        onResolve("ignore");
        onClose();
    };

    return (
        <Dialog open={deadlockInfo.detected} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <div className="flex items-center gap-2">
                        <AlertTriangle className="h-6 w-6 text-red-500" />
                        <DialogTitle className="text-red-600">⚠️ Deadlock Detectado</DialogTitle>
                    </div>
                    <DialogDescription>
                        Se ha detectado un deadlock en el sistema. Todos los procesos activos están bloqueados esperando por recursos.
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4 space-y-4">
                    {/* Deadlock Info */}
                    <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded">
                        <div className="text-sm font-semibold mb-2">Descripción del Deadlock:</div>
                        <div className="text-sm text-muted-foreground">
                            {deadlockInfo.cycle}
                        </div>
                    </div>

                    {/* Affected Processes */}
                    <div>
                        <div className="text-sm font-semibold mb-2">Procesos Afectados:</div>
                        <div className="flex flex-wrap gap-2">
                            {deadlockInfo.affectedProcesses.map(pid => (
                                <div
                                    key={pid}
                                    className="px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-full text-sm font-medium"
                                >
                                    PID {pid}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Timestamp */}
                    <div className="text-xs text-muted-foreground">
                        Detectado en: Tick {deadlockInfo.timestamp}
                    </div>

                    {/* Resolution Options */}
                    <div className="p-3 bg-muted rounded">
                        <div className="text-sm font-semibold mb-2">Opciones de Resolución:</div>
                        <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                            <li><strong>Cancelar Proceso:</strong> Termina PID {deadlockInfo.affectedProcesses[0]} para liberar recursos</li>
                            <li><strong>Ignorar:</strong> Continuar simulación (algunos procesos pueden quedar bloqueados indefinidamente)</li>
                        </ul>
                    </div>
                </div>

                <DialogFooter className="flex gap-2">
                    <Button
                        variant="outline"
                        onClick={handleIgnore}
                    >
                        Ignorar y Continuar
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={handleCancelProcess}
                    >
                        Cancelar PID {deadlockInfo.affectedProcesses[0]}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
