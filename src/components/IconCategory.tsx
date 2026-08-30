const ICON_PATHS = {
    cafes: ['M4.5 9.5h11v6.5a4.5 4.5 0 0 1-4.5 4.5H9a4.5 4.5 0 0 1-4.5-4.5z', 'M15.5 11h1.5a2.5 2.5 0 0 1 0 5h-1.5', 'M8 7c-1-1.3 1-2.2 0-4M12 7c-1-1.3 1-2.2 0-4'],
    dining: ['M5.5 3v4a2.5 2.5 0 0 0 5 0V3', 'M8 9v12', 'M15.5 21V3c3 2.2 3.2 7 .2 9.2'],
    landmarks: ['M4 8.5l8-5 8 5', 'M5 8.5h14', 'M7 11.5v7M12 11.5v7M17 11.5v7', 'M4 20.5h16'],
    lodging: ['M3.5 19.5V5.5', 'M3.5 16.5h17v3', 'M3.5 12.5h13a4 4 0 0 1 4 4', 'M5.5 12.5v-2a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2'],
    misc: ['M3.5 8.5h17l-1.7 10.4a2 2 0 0 1-2 1.6H7.2a2 2 0 0 1-2-1.6Z', 'M8.5 8.5L12 3.5l3.5 5', 'M9.8 12.5v4M14.2 12.5v4'],
    nature: ['M3 18L9.5 6l4 7', 'M11 18l4.5-8L21 18', 'M3 18h18'],
    shopping: ['M5.5 8.5h13v10a2.5 2.5 0 0 1-2.5 2.5H8a2.5 2.5 0 0 1-2.5-2.5z', 'M9 8.5V6.5a3 3 0 0 1 6 0v2'],
    transit: ['M21 3.5L3.5 10.8l6.3 2.6 2.6 6.3z', 'M21 3.5l-11.2 9.9'],
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
