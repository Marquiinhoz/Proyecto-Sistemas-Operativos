declare module 'lucide-react' {
    import { FC, SVGProps } from 'react';

    export type LucideIcon = FC<SVGProps<SVGSVGElement>>;

    // Common icons - add more as needed
    export const Play: LucideIcon;
    export const Pause: LucideIcon;
    export const SkipForward: LucideIcon;
    export const Plus: LucideIcon;
    export const Trash2: LucideIcon;
    export const Cpu: LucideIcon;
    export const HardDrive: LucideIcon;
    export const Activity: LucideIcon;
    export const BarChart: LucideIcon;
    export const Settings: LucideIcon;
    export const Info: LucideIcon;
    export const X: LucideIcon;
    export const Check: LucideIcon;
    export const AlertCircle: LucideIcon;
    export const AlertTriangle: LucideIcon;
    export const ChevronDown: LucideIcon;
    export const ChevronUp: LucideIcon;
    export const ChevronLeft: LucideIcon;
    export const ChevronRight: LucideIcon;
    export const Download: LucideIcon;
    export const Upload: LucideIcon;
    export const File: LucideIcon;
    export const Folder: LucideIcon;
    export const Save: LucideIcon;
    export const Edit: LucideIcon;
    export const Search: LucideIcon;
    export const Filter: LucideIcon;
    export const RefreshCw: LucideIcon;
    export const Clock: LucideIcon;
    export const Calendar: LucideIcon;
    export const TrendingUp: LucideIcon;
    export const TrendingDown: LucideIcon;
    export const Zap: LucideIcon;
    export const Timer: LucideIcon;

    // Export all icons
    const icons: Record<string, LucideIcon>;
    export default icons;
}
