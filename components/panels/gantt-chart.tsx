"use client"

import { Card } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { GanttEntry } from "@/lib/types"
import { useEffect, useRef } from "react"

interface GanttChartProps {
    ganttChart: GanttEntry[];
    procesos: any[];
}

export default function GanttChart({ ganttChart, procesos }: GanttChartProps) {
    const scrollRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to the end when new entries are added
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
        }
    }, [ganttChart.length]);

    // Generate color for each PID
    const getColorForPid = (pid: number | null): string => {
        if (pid === null) return "bg-gray-700"; // IDLE

        const colors = [
            "bg-blue-500",
            "bg-green-500",
            "bg-yellow-500",
            "bg-purple-500",
            "bg-pink-500",
            "bg-indigo-500",
            "bg-red-500",
            "bg-teal-500",
            "bg-orange-500",
            "bg-cyan-500",
        ];
        return colors[pid % colors.length];
    };

    const getBorderColorForPid = (pid: number | null): string => {
        if (pid === null) return "border-gray-500";

        const colors = [
            "border-blue-600",
            "border-green-600",
            "border-yellow-600",
            "border-purple-600",
            "border-pink-600",
            "border-indigo-600",
            "border-red-600",
            "border-teal-600",
            "border-orange-600",
            "border-cyan-600",
        ];
        return colors[pid % colors.length];
    };

    // Get unique PIDs for legend
    const uniquePids = Array.from(new Set(ganttChart.filter(e => e.pid !== null).map(e => e.pid)));

    // Group consecutive entries with same PID for better visualization
    const groupedEntries: { pid: number | null; tipo: string; start: number; end: number }[] = [];
    ganttChart.forEach((entry, idx) => {
        const last = groupedEntries[groupedEntries.length - 1];
        if (last && last.pid === entry.pid && last.tipo === entry.tipo) {
            last.end = entry.tiempo;
        } else {
            groupedEntries.push({
                pid: entry.pid,
                tipo: entry.tipo,
                start: entry.tiempo,
                end: entry.tiempo,
            });
        }
    });

    return (
        <Card className="p-4 border border-border">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-bold">Diagrama de Gantt</h2>
                <div className="text-xs text-muted-foreground">
                    {ganttChart.length} eventos
                </div>
            </div>

            {/* Legend */}
            <div className="mb-3 flex flex-wrap gap-2">
                <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-gray-700 rounded border border-gray-500"></div>
                    <span className="text-[10px] text-muted-foreground">IDLE</span>
                </div>
                {uniquePids.slice(0, 10).map(pid => (
                    <div key={pid} className="flex items-center gap-1">
                        <div className={`w-3 h-3 ${getColorForPid(pid)} rounded ${getBorderColorForPid(pid)} border`}></div>
                        <span className="text-[10px] text-muted-foreground">P{pid}</span>
                    </div>
                ))}
                {uniquePids.length > 10 && (
                    <span className="text-[10px] text-muted-foreground italic">+{uniquePids.length - 10} más</span>
                )}
            </div>

            {/* Gantt Chart Timeline */}
            <ScrollArea className="w-full" ref={scrollRef}>
                <div className="min-w-max pb-2">
                    {ganttChart.length === 0 ? (
                        <div className="text-sm text-muted-foreground italic text-center py-8">
                            El diagrama de Gantt aparecerá cuando inicie la simulación
                        </div>
                    ) : (
                        <div className="flex items-center gap-0.5 min-h-[60px]">
                            {groupedEntries.map((group, idx) => {
                                const width = Math.max((group.end - group.start + 1) * 8, 8); // 8px per tick minimum
                                const isContextSwitch = group.tipo === "context_switch";
                                const isIdle = group.pid === null;

                                return (
                                    <div
                                        key={idx}
                                        className={`
                      ${getColorForPid(group.pid)} 
                      ${getBorderColorForPid(group.pid)}
                      ${isContextSwitch ? 'border-2 border-white' : 'border'}
                      ${isIdle ? 'opacity-40' : 'opacity-90'}
                      transition-all
                      flex items-center justify-center
                      relative group/item
                      h-12
                    `}
                                        style={{ width: `${width}px`, minWidth: '4px' }}
                                    >
                                        {/* Tooltip */}
                                        <div className="absolute bottom-full mb-1 hidden group-hover/item:block z-10 bg-black text-white text-[10px] px-2 py-1 rounded whitespace-nowrap">
                                            {isIdle ? "CPU IDLE" : `P${group.pid}`}
                                            {isContextSwitch && " (Context Switch)"}
                                            <div className="text-[9px] opacity-75">
                                                t={group.start}{group.end !== group.start && `-${group.end}`}
                                            </div>
                                        </div>

                                        {/* Label (only for wider blocks) */}
                                        {width > 20 && (
                                            <span className="text-[9px] font-bold text-white drop-shadow">
                                                {isIdle ? "·" : `P${group.pid}`}
                                            </span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </ScrollArea>

            {/* Time axis */}
            {ganttChart.length > 0 && (
                <div className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span>Tiempo:</span>
                    <span>0</span>
                    <div className="flex-1 border-t border-dashed border-muted-foreground/30"></div>
                    <span>{ganttChart[ganttChart.length - 1]?.tiempo || 0}</span>
                </div>
            )}
        </Card>
    )
}
