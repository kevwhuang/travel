export default function IconClose({ size }: { size: number }) {
    return (
        <svg
            aria-hidden="true"
            fill="none"
            height={size}
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth={2}
            viewBox="0 0 24 24"
            width={size}
        >
            <path d="M6 6l12 12M18 6L6 18" />
        </svg>
    );
}
