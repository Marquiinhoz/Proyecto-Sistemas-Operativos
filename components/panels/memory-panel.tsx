"use client"

import { Card } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { AlertTriangle } from "lucide-react"
import { useState } from "react"

export default function MemoryPanel({ state, simulator }: any) {
  if (!state) return null
  const [isCompacting, setIsCompacting] = useState(false);

  // El tamaño total de memoria es fijo: 2MB
  const MEMORY_SIZE = 2 * 1024 * 1024; // 2MB
  const totalMem = MEMORY_SIZE

  // Calcular memoria usada: suma de bloques ocupados
  const usedMem = state.memoria.reduce((acc: number, b: any) => acc + (b.ocupado ? b.tamanio : 0), 0)

  // Calcular porcentaje de uso (asegurarse de que no exceda 100%)
  const usagePct = totalMem > 0 ? Math.min((usedMem / totalMem) * 100, 100) : 0

  // Calcular fragmentación usando los valores del estado
  const fragmentation = state.fragmentation || { internal: 0, external: 0, externalHoles: 0, largestHole: 0 }
  const internalFragKB = fragmentation.internal / 1024
  const externalFragKB = fragmentation.external / 1024
  const externalFragPct = totalMem > 0 ? (fragmentation.external / totalMem) * 100 : 0

  const freeBlocks = state.memoria.filter((b: any) => !b.ocupado).length

  // High fragmentation warning threshold
  const isHighFragmentation = externalFragPct > 30 && fragmentation.externalHoles > 2;

  const handleCompaction = async () => {
    if (!simulator) return;
    setIsCompacting(true);
    try {
      simulator.compactarMemoria();
    } finally {
      setTimeout(() => setIsCompacting(false), 500);
    }
  };

  return (
    <Card className="p-4 border border-border h-[400px] flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-bold">Gestión de Memoria</h2>
        <div className="flex items-center gap-2">
          <div className="text-xs text-muted-foreground text-right">
            <div>Total: {(totalMem / 1024).toFixed(0)} KB</div>
            <div>Uso: {usagePct.toFixed(1)}%</div>
            <div>Bloques Libres: {freeBlocks}</div>
          </div>
          {simulator && fragmentation.externalHoles > 1 && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              onClick={handleCompaction}
              disabled={isCompacting}
            >
              {isCompacting ? "Compactando..." : "Compactar"}
            </Button>
          )}
        </div>
      </div>

      {/* High Fragmentation Warning */}
      {isHighFragmentation && (
        <div className="mb-3 p-2 bg-yellow-500/10 border border-yellow-500 rounded flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-yellow-500" />
          <span className="text-xs text-yellow-700">
            Alta fragmentación externa detectada ({externalFragKB.toFixed(1)} KB en {fragmentation.externalHoles} huecos)
          </span>
        </div>
      )}

      <div className="flex-1 relative bg-muted rounded-lg overflow-hidden border border-border">
        <ScrollArea className="h-full w-full">
          <div className="flex flex-wrap content-start p-1 gap-0.5">
            {state.memoria.map((bloque: any, idx: number) => {
              const sizeKB = bloque.tamanio / 1024
              // Identify unusable small holes (< 32KB and free)
              const isUnusableHole = !bloque.ocupado && bloque.tamanio < 32 * 1024;

              return (
                <div
                  key={idx}
                  className={`
                    h-16 border rounded flex flex-col items-center justify-center text-[10px] relative overflow-hidden transition-all
                    ${bloque.ocupado
                      ? "bg-blue-500/20 border-blue-500 text-blue-700"
                      : isUnusableHole
                        ? "bg-red-500/20 border-red-500 text-red-700 animate-pulse"
                        : "bg-green-500/10 border-green-500 text-green-700"
                    }
                  `}
                  style={{
                    width: `calc(${(bloque.tamanio / totalMem) * 100}% - 2px)`,
                    minWidth: "40px"
                  }}
                  title={`Addr: ${bloque.direccionInicio} - ${bloque.direccionFin} | Size: ${sizeKB}KB${isUnusableHole ? " (Muy pequeño)" : ""}`}
                >
                  <span className="font-bold">{sizeKB} KB</span>
                  {bloque.ocupado ? (
                    <span className="text-xs font-bold">PID {bloque.pid}</span>
                  ) : (
                    <span className="opacity-50">
                      {isUnusableHole ? "Hueco" : "Free"}
                    </span>
                  )}
                  <div className="absolute bottom-0 right-1 text-[8px] opacity-50">
                    0x{bloque.direccionInicio.toString(16).toUpperCase()}
                  </div>
                </div>
              )
            })}
          </div>
        </ScrollArea>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-4 text-xs">
        <div className="p-2 bg-muted rounded">
          <span className="font-bold block mb-1">Fragmentación Externa</span>
          <div>{externalFragKB.toFixed(1)} KB</div>
          <div className="text-[10px] opacity-70">{fragmentation.externalHoles} huecos</div>
        </div>
        <div className="p-2 bg-muted rounded">
          <span className="font-bold block mb-1">Hueco Más Grande</span>
          <div>{(fragmentation.largestHole / 1024).toFixed(1)} KB</div>
        </div>
        <div className="p-2 bg-muted rounded">
          <span className="font-bold block mb-1">Frag. Interna</span>
          <div>{internalFragKB.toFixed(1)} KB</div>
        </div>
      </div>
    </Card>
  )
}
