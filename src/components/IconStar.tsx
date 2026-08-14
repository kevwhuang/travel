const OUTLINE_WIDTH = 2.6;
const STAR_PATH = 'M12 3.5l2.7 5.47 6.04.88-4.37 4.26 1.03 6.01L12 17.28l-5.4 2.84 1.03-6.01-4.37-4.26 6.04-.88z';
const STAR_SIZE = 16;

export default function IconStar({ color, hasOutline = false, size = STAR_SIZE }: {
    color: string;
    hasOutline?: boolean;
    size?: number;
}) {
    return (
        <svg
            className="duration-[var(--duration-fast)] ease-[ease] transition-[fill]"
            aria-hidden="true"
            fill={color}
            height={size}
            paintOrder={hasOutline ? 'stroke' : undefined}
            stroke={hasOutline ? 'var(--color-snow)' : undefined}
            strokeLinejoin={hasOutline ? 'round' : undefined}
            strokeWidth={hasOutline ? OUTLINE_WIDTH : undefined}
            viewBox="0 0 24 24"
            width={size}
        >
            <path d={STAR_PATH} />
        </svg>
    );
}
