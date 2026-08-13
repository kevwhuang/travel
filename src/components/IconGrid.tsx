export default function IconGrid({ size, strokeWidth }: {
    size: number;
    strokeWidth: number;
}) {
    return (
        <svg
            aria-hidden="true"
            fill="none"
            height={size}
            stroke="currentColor"
            strokeWidth={strokeWidth}
            viewBox="0 0 24 24"
            width={size}
        >
            <rect height="7" rx="1.4" width="7" x="4" y="4" />
            <rect height="7" rx="1.4" width="7" x="13" y="4" />
            <rect height="7" rx="1.4" width="7" x="4" y="13" />
            <rect height="7" rx="1.4" width="7" x="13" y="13" />
        </svg>
    );
}
