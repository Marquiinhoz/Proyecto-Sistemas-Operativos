"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Edit, Trash2 } from "lucide-react"
import { DeviceType } from "@/lib/types"

export default function ProcessPanel({ state, onCreate, onEdit, onDelete, simulator }: any) {
  const [modalOpen, setModalOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editingPid, setEditingPid] = useState<number | null>(null)
  const [formData, setFormData] = useState({
    nombre: "",
    tamanio: "",
    burst: "",
    prioridad: "",
    dispositivoIO: "",
    maxInterrupciones: "",
    porcentajeDatos: "",
    porcentajeVariable: "",
  })
  const [editFormData, setEditFormData] = useState({
    tamanio: "",
    burst: "",
    prioridad: "",
    maxInterrupciones: "",
    porcentajeDatos: "",
    porcentajeVariable: "",
  })

  if (!state) return null

  const handleCreateProcess = () => {
    const tamanio = formData.tamanio ? parseInt(formData.tamanio) * 1024 : undefined // Convert KB to bytes
    const burst = formData.burst ? parseInt(formData.burst) : undefined
    const prioridad = formData.prioridad ? parseInt(formData.prioridad) : undefined
    const maxInterrupciones = formData.maxInterrupciones ? parseInt(formData.maxInterrupciones) : undefined
    const porcentajeDatos = formData.porcentajeDatos ? parseInt(formData.porcentajeDatos) : undefined
    const porcentajeVariable = formData.porcentajeVariable ? parseInt(formData.porcentajeVariable) : undefined

    onCreate(tamanio, burst, prioridad, maxInterrupciones, porcentajeDatos, porcentajeVariable)
    setModalOpen(false)
    setFormData({
      nombre: "",
      tamanio: "",
      burst: "",
      prioridad: "",
      dispositivoIO: "",
      maxInterrupciones: "",
      porcentajeDatos: "",
      porcentajeVariable: "",
    })
  }

  const handleEditClick = (pid: number) => {
    const proceso = state.procesos.find((p: any) => p.pid === pid)
    if (proceso) {
      setEditingPid(pid)
      setEditFormData({
        tamanio: (proceso.tamanio / 1024).toString(),
        burst: proceso.burstTime.toString(),
        prioridad: proceso.prioridad.toString(),
        maxInterrupciones: proceso.maxInterrupciones.toString(),
        porcentajeDatos: proceso.porcentajeDatos.toString(),
        porcentajeVariable: proceso.porcentajeVariable.toString(),
      })
      setEditModalOpen(true)
    }
  }

  const handleEditProcess = () => {
    if (editingPid === null) return

    const tamanio = editFormData.tamanio ? parseInt(editFormData.tamanio) * 1024 : undefined
    const burst = editFormData.burst ? parseInt(editFormData.burst) : undefined
    const prioridad = editFormData.prioridad ? parseInt(editFormData.prioridad) : undefined
    const maxInterrupciones = editFormData.maxInterrupciones ? parseInt(editFormData.maxInterrupciones) : undefined
    const porcentajeDatos = editFormData.porcentajeDatos ? parseInt(editFormData.porcentajeDatos) : undefined
    const porcentajeVariable = editFormData.porcentajeVariable ? parseInt(editFormData.porcentajeVariable) : undefined

    onEdit(editingPid, {
      tamanio,
      burstTime: burst,
      prioridad,
      maxInterrupciones,
      porcentajeDatos,
      porcentajeVariable,
    })
    setEditModalOpen(false)
    setEditingPid(null)
  }

  const handleDeleteClick = (pid: number) => {
    if (confirm(`¿Está seguro de eliminar el proceso PID ${pid}?`)) {
      onDelete(pid)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "running": return "bg-green-500"
      case "ready": return "bg-blue-500"
      case "blocked": return "bg-red-500"
      case "new": return "bg-yellow-500"
      case "terminated": return "bg-gray-500"
      default: return "bg-gray-500"
    }
  }

  return (
    <Card className="p-4 h-[500px] flex flex-col border-border overflow-hidden">
      <div className="flex justify-between items-center mb-4 flex-shrink-0">
        <h2 className="text-lg font-bold">Gestión de Procesos</h2>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => setModalOpen(true)}>
            <Plus className="w-4 h-4 mr-1" /> Nuevo Proceso
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-2 mb-2 text-xs font-semibold text-muted-foreground text-center flex-shrink-0">
        <div>PID / Estado</div>
        <div>Memoria</div>
        <div>CPU / Tiempos</div>
        <div>Contadores</div>
        <div>Segmentos</div>
      </div>

      <ScrollArea className="flex-1 min-h-0 overflow-y-auto">
        <div className="space-y-2 pr-4">
          {state.procesos.map((proc: any) => (
            <div
              key={proc.pid}
              className={`p-3 rounded-lg border ${
                proc.estado === "running" ? "border-green-500 bg-green-500/10" : "border-border bg-card"
              }`}
            >
              <div className="grid grid-cols-5 gap-2 text-xs items-center">
                {/* PID & Status */}
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-lg">#{proc.pid}</span>
                    <Badge variant="outline" className={`${getStatusColor(proc.estado)} text-white border-none`}>
                      {proc.estado.toUpperCase()}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1 mt-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0"
                      onClick={() => handleEditClick(proc.pid)}
                      title="Editar proceso"
                    >
                      <Edit className="w-3 h-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                      onClick={() => handleDeleteClick(proc.pid)}
                      title="Eliminar proceso"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    Prioridad: {proc.prioridad}
                  </span>
                </div>

                {/* Memory */}
                <div className="flex flex-col gap-1">
                  <div>Size: {(proc.tamanio / 1024).toFixed(0)} KB</div>
                  <div className="text-[10px] text-muted-foreground">
                    Base: {proc.dirBase === -1 ? "Pend." : `0x${proc.dirBase.toString(16).toUpperCase()}`}
                  </div>
                </div>

                {/* CPU */}
                <div className="flex flex-col gap-1 w-full">
                  <div className="flex justify-between text-[10px]">
                    <span>PC: {proc.programCounter}</span>
                    <span>{proc.porcentajeProcesado.toFixed(0)}%</span>
                  </div>
                  <Progress value={proc.porcentajeProcesado} className="h-1.5" />
                  <div className="text-[10px] text-muted-foreground mt-1">
                    Burst: {proc.burstTime} | Rest: {proc.tiempoRestante}
                  </div>
                </div>

                {/* Counters */}
                <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[10px]">
                  <div>Wait: {proc.tiempoEspera}</div>
                  <div>Turn: {proc.tiempoTurnaround}</div>
                  <div>Ctx: {proc.cambiosContexto}</div>
                  <div>I/O: {proc.interrupciones}</div>
                  <div className="text-red-500">Err: {proc.errores}</div>
                </div>

                {/* Segments */}
                <div className="flex flex-col gap-1 text-[10px]">
                  <div className="flex justify-between">
                    <span>Data: {proc.porcentajeDatos}%</span>
                    <span>Var: {proc.porcentajeVariable}%</span>
                  </div>
                  <div className="w-full bg-muted h-1.5 rounded-full overflow-hidden flex">
                    <div className="bg-blue-400 h-full" style={{ width: `${proc.porcentajeDatos}%` }} title="Data" />
                    <div className="bg-yellow-400 h-full" style={{ width: `${proc.porcentajeVariable}%` }} title="Variable" />
                    <div className="bg-gray-300 h-full flex-1" title="Code/Stack" />
                  </div>
                  <div className="flex justify-between text-[9px] text-muted-foreground mt-0.5">
                    <span>SP: {proc.stackPointer}</span>
                    <span>HP: {proc.heapPointer}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Modal de Creación de Proceso */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Crear Nuevo Proceso</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="nombre">Nombre del Proceso</Label>
              <Input
                id="nombre"
                value={formData.nombre}
                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                placeholder="Nombre (opcional)"
              />
            </div>
            <div>
              <Label htmlFor="tamanio">Tamaño (KB)</Label>
              <Input
                id="tamanio"
                type="number"
                min="32"
                max="512"
                value={formData.tamanio}
                onChange={(e) => setFormData({ ...formData, tamanio: e.target.value })}
                placeholder="32-512 KB"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Se ajustará a la potencia de 2 más cercana
              </p>
            </div>
            <div>
              <Label htmlFor="burst">Burst Time</Label>
              <Input
                id="burst"
                type="number"
                min="5"
                max="20"
                value={formData.burst}
                onChange={(e) => setFormData({ ...formData, burst: e.target.value })}
                placeholder="5-20"
              />
            </div>
            <div>
              <Label htmlFor="prioridad">Prioridad</Label>
              <Input
                id="prioridad"
                type="number"
                min="0"
                max="3"
                value={formData.prioridad}
                onChange={(e) => setFormData({ ...formData, prioridad: e.target.value })}
                placeholder="0-3 (menor = mayor prioridad)"
              />
            </div>
            <div>
              <Label htmlFor="dispositivoIO">Tipo de Dispositivo I/O</Label>
              <Select
                value={formData.dispositivoIO}
                onValueChange={(value) => setFormData({ ...formData, dispositivoIO: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar dispositivo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="disk">Disk</SelectItem>
                  <SelectItem value="printer">Printer</SelectItem>
                  <SelectItem value="monitor">Monitor</SelectItem>
                  <SelectItem value="network">Network</SelectItem>
                  <SelectItem value="keyboard">Keyboard</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                El dispositivo se asignará aleatoriamente si no se especifica
              </p>
            </div>
            <div>
              <Label htmlFor="maxInterrupciones">Máximo de Interrupciones</Label>
              <Input
                id="maxInterrupciones"
                type="number"
                min="5"
                max="20"
                value={formData.maxInterrupciones}
                onChange={(e) => setFormData({ ...formData, maxInterrupciones: e.target.value })}
                placeholder="5-20"
              />
            </div>
            <div>
              <Label htmlFor="porcentajeDatos">Porcentaje de Datos (%)</Label>
              <Input
                id="porcentajeDatos"
                type="number"
                min="10"
                max="40"
                value={formData.porcentajeDatos}
                onChange={(e) => setFormData({ ...formData, porcentajeDatos: e.target.value })}
                placeholder="10-40%"
              />
            </div>
            <div>
              <Label htmlFor="porcentajeVariable">Porcentaje Variable (%)</Label>
              <Input
                id="porcentajeVariable"
                type="number"
                min="5"
                max="25"
                value={formData.porcentajeVariable}
                onChange={(e) => setFormData({ ...formData, porcentajeVariable: e.target.value })}
                placeholder="5-25%"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateProcess}>
              Crear Proceso
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Edición de Proceso */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Proceso PID {editingPid}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="edit-tamanio">Tamaño (KB)</Label>
              <Input
                id="edit-tamanio"
                type="number"
                min="32"
                max="512"
                value={editFormData.tamanio}
                onChange={(e) => setEditFormData({ ...editFormData, tamanio: e.target.value })}
                placeholder="32-512 KB"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Se ajustará a la potencia de 2 más cercana
              </p>
            </div>
            <div>
              <Label htmlFor="edit-burst">Burst Time</Label>
              <Input
                id="edit-burst"
                type="number"
                min="5"
                max="20"
                value={editFormData.burst}
                onChange={(e) => setEditFormData({ ...editFormData, burst: e.target.value })}
                placeholder="5-20"
              />
            </div>
            <div>
              <Label htmlFor="edit-prioridad">Prioridad</Label>
              <Input
                id="edit-prioridad"
                type="number"
                min="0"
                max="3"
                value={editFormData.prioridad}
                onChange={(e) => setEditFormData({ ...editFormData, prioridad: e.target.value })}
                placeholder="0-3 (menor = mayor prioridad)"
              />
            </div>
            <div>
              <Label htmlFor="edit-maxInterrupciones">Máximo de Interrupciones</Label>
              <Input
                id="edit-maxInterrupciones"
                type="number"
                min="5"
                max="20"
                value={editFormData.maxInterrupciones}
                onChange={(e) => setEditFormData({ ...editFormData, maxInterrupciones: e.target.value })}
                placeholder="5-20"
              />
            </div>
            <div>
              <Label htmlFor="edit-porcentajeDatos">Porcentaje de Datos (%)</Label>
              <Input
                id="edit-porcentajeDatos"
                type="number"
                min="10"
                max="40"
                value={editFormData.porcentajeDatos}
                onChange={(e) => setEditFormData({ ...editFormData, porcentajeDatos: e.target.value })}
                placeholder="10-40%"
              />
            </div>
            <div>
              <Label htmlFor="edit-porcentajeVariable">Porcentaje Variable (%)</Label>
              <Input
                id="edit-porcentajeVariable"
                type="number"
                min="5"
                max="25"
                value={editFormData.porcentajeVariable}
                onChange={(e) => setEditFormData({ ...editFormData, porcentajeVariable: e.target.value })}
                placeholder="5-25%"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleEditProcess}>
              Guardar Cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
