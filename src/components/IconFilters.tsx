export default function IconFilters({ size, strokeWidth }: {
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
            strokeWidth={strokeWidth}
            viewBox="0 0 24 24"
            width={size}
        >
            <path d="M4 7h4M13 7h7M4 12h9M18 12h2M4 17h2M11 17h9" />
            <circle cx="10.5" cy="7" r="2.2" />
            <circle cx="15.5" cy="12" r="2.2" />
            <circle cx="8.5" cy="17" r="2.2" />
        </svg>
    );
}
