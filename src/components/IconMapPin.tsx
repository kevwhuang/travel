export default function IconMapPin({ size, strokeWidth }: {
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
            <path d="M12 21c-4.2-3.8-6.3-7-6.3-9.7a6.3 6.3 0 1 1 12.6 0C18.3 14 16.2 17.2 12 21z" />
            <circle cx="12" cy="11.2" r="2.2" />
        </svg>
    );
}
