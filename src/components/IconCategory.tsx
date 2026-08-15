const ICON_PATHS = {
    dining: ['M5.5 3v4a2.5 2.5 0 0 0 5 0V3', 'M8 9v12', 'M15.5 21V3c3 2.2 3.2 7 .2 9.2'],
    landmarks: ['M4 8.5l8-5 8 5', 'M5 8.5h14', 'M7 11.5v7M12 11.5v7M17 11.5v7', 'M4 20.5h16'],
    misc: ['M3.5 8.5h17l-1.7 10.4a2 2 0 0 1-2 1.6H7.2a2 2 0 0 1-2-1.6Z', 'M8.5 8.5L12 3.5l3.5 5', 'M9.8 12.5v4M14.2 12.5v4'],
    nature: ['M3 18L9.5 6l4 7', 'M11 18l4.5-8L21 18', 'M3 18h18'],
    urban: ['M4 20.5V8.5h6v12', 'M10 20.5V3.5h8v17', 'M3 20.5h18', 'M13 7.5h2M13 11.5h2M13 15.5h2'],
    wellness: ['M12 5.5c-2 2.5-2 6 0 8.5 2-2.5 2-6 0-8.5', 'M5 10.5c0 5 3 8 7 8', 'M19 10.5c0 5-3 8-7 8'],
} as const;

export default function IconCategory({ categoryId, color, size }: {
    categoryId: string;
    color: string;
    size: number;
}) {
    const paths = ICON_PATHS[categoryId as keyof typeof ICON_PATHS] ?? [];

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
