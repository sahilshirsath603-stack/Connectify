import * as LucideIcons from "lucide-react";

export default function Icon({
    name,
    size = 18,
    strokeWidth = 1.8,
    className = "",
    ...props
}) {
    const LucideIcon = LucideIcons[name] || (typeof name === 'string' && LucideIcons[name.charAt(0).toUpperCase() + name.slice(1)]);

    if (!LucideIcon) return null;

    return (
        <LucideIcon
            size={size}
            strokeWidth={strokeWidth}
            className={`app-icon ${className}`}
            {...props}
        />
    );
}
