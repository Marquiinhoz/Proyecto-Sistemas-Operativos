"use client"
import { Card } from "@/components/ui/card"

export default function StatsPanel({ state }: any) {
  if (!state) return null

  // El tamaño total de memoria es fijo: 2MB (2097152 bytes)
  const MEMORY_SIZE = 2 * 1024 * 1024; // 2MB = 2097152 bytes
  const totalMemory = MEMORY_SIZE
  
  // Calcular memoria usada: suma de bloques ocupados usando el tamaño del bloque
  const usedMemory = state.memoria.reduce(
    (sum: number, block: any) => sum + (block.ocupado && block.tamanio ? block.tamanio : 0),
    0,
  )
  
  // Asegurar que usedMemory no exceda totalMemory
  const validUsedMemory = Math.min(usedMemory, totalMemory)
  
  // Calcular porcentaje de uso (asegurarse de que no exceda 100%)
  const memoryUsagePercent = totalMemory > 0 
    ? Math.min(Math.max(0, (validUsedMemory / totalMemory) * 100), 100) 
    : 0
  
  const freeBlocks = state.memoria.filter((b: any) => !b.ocupado).length
  const occupiedBlocks = state.memoria.filter((b: any) => b.ocupado).length
  
  // Calcular uso de CPU basado en procesos corriendo vs totales
  const totalProcesos = state.procesos.length
  const procesosRunning = state.colaRunning ? 1 : 0
  const cpuUsage = totalProcesos > 0 
    ? Math.min((procesosRunning / totalProcesos) * 100, 100)
    : 0

  return (
    <Card className="p-4 border border-border">
      <h2 className="text-lg font-bold mb-4">Estadísticas en Tiempo Real</h2>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-3 bg-muted rounded text-center">
          <div className="text-2xl font-bold text-blue-400">{state.procesos.length}</div>
          <div className="text-xs text-muted-foreground">Procesos Totales</div>
        </div>

        <div className="p-3 bg-muted rounded text-center">
          <div className="text-2xl font-bold text-green-400">{state.colaReady.length}</div>
          <div className="text-xs text-muted-foreground">En Ready</div>
        </div>

        <div className="p-3 bg-muted rounded text-center">
          <div className="text-2xl font-bold text-yellow-400">{state.colaTerminated.length}</div>
          <div className="text-xs text-muted-foreground">Terminados</div>
        </div>

        <div className="p-3 bg-muted rounded text-center">
          <div className="text-2xl font-bold text-red-400">{state.cambiosContextoTotal}</div>
          <div className="text-xs text-muted-foreground">Cambios Contexto</div>
        </div>

        <div className="p-3 bg-muted rounded text-center">
          <div className="text-2xl font-bold text-purple-400">{state.erroresTotal}</div>
          <div className="text-xs text-muted-foreground">Errores</div>
        </div>

        <div className="p-3 bg-muted rounded text-center">
          <div className="text-2xl font-bold text-cyan-400">{state.interrupcionesTotal}</div>
          <div className="text-xs text-muted-foreground">Interrupciones</div>
        </div>
      </div>

      {/* Métricas de memoria y CPU */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="p-3 bg-muted rounded">
          <div className="text-sm font-semibold mb-2">Uso de Memoria</div>
          <div className="text-xs mb-2">
            {memoryUsagePercent.toFixed(1)}% ({(validUsedMemory / 1024).toFixed(1)}/{(totalMemory / 1024).toFixed(0)} KB)
          </div>
          <div className="w-full bg-background rounded h-2">
            <div 
              className="bg-blue-500 h-full rounded transition-all" 
              style={{ width: `${Math.min(memoryUsagePercent, 100)}%` }} 
            />
          </div>
          <div className="text-xs text-muted-foreground mt-2">
            Bloques: <span className="text-blue-600">{occupiedBlocks} ocupados</span> / <span className="text-green-600">{freeBlocks} libres</span>
          </div>
        </div>

        <div className="p-3 bg-muted rounded">
          <div className="text-sm font-semibold mb-2">Uso de CPU</div>
          <div className="text-xs mb-2">{cpuUsage.toFixed(1)}%</div>
          <div className="w-full bg-background rounded h-2">
            <div 
              className="bg-green-500 h-full rounded transition-all" 
              style={{ width: `${Math.min(cpuUsage, 100)}%` }} 
            />
          </div>
          <div className="text-xs text-muted-foreground mt-2">
            {state.colaRunning ? `Ejecutando: PID ${state.colaRunning.pid}` : "CPU Ociosa"}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {procesosRunning} de {totalProcesos} procesos activos
          </div>
        </div>
      </div>
    </Card>
  )
}
