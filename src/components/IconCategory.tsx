const ICON_PATHS = {
    dining: ['M5.5 3v4a2.5 2.5 0 0 0 5 0V3', 'M8 9v12', 'M15.5 21V3c3 2.2 3.2 7 .2 9.2'],
    landmarks: ['M4 9l8-5 8 5', 'M5 9h14', 'M7 12v7M12 12v7M17 12v7', 'M4 21h16'],
    miscellaneous: ['M3.5 8.5h17l-1.7 10.4a2 2 0 0 1-2 1.6H7.2a2 2 0 0 1-2-1.6Z', 'M8.5 8.5L12 3.5l3.5 5', 'M9.8 12.5v4M14.2 12.5v4'],
    nature: ['M3 19L9.5 7l4 7', 'M11 19l4.5-8L21 19', 'M3 19h18'],
    urban: ['M4 21V9h6v12', 'M10 21V4h8v17', 'M3 21h18', 'M13 8h2M13 12h2M13 16h2'],
    wellness: ['M12 5c-2 2.5-2 6 0 8.5 2-2.5 2-6 0-8.5', 'M5 10c0 5 3 8 7 8', 'M19 10c0 5-3 8-7 8'],
} as const;

export default function IconCategory({ category, color, size }: {
    category: string;
    color: string;
    size: number;
}) {
    const paths = ICON_PATHS[category as keyof typeof ICON_PATHS] ?? [];

    return (
        <svg
            className="block shrink-0 duration-[var(--duration-fast)] ease-[ease] transition-[stroke]"
            aria-hidden="true"
            fill="none"
            height={size}
            stroke={color}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.9}
            viewBox="0 0 24 24"
            width={size}
        >
            {paths.map(pathData => <path d={pathData} key={pathData} />)}
        </svg>
    );
}
