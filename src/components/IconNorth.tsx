export default function IconNorth({ size, strokeWidth }: {
    size: number;
    strokeWidth: number;
}) {
    return (
        <svg
            aria-hidden="true"
            fill="none"
            height={size}
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={strokeWidth}
            viewBox="0 0 24 24"
            width={size}
        >
            <path d="M12 20V7" />
            <path d="M8.5 10.5L12 4l3.5 6.5" />
        </svg>
    );
}
