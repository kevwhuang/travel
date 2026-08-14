const BRAND_HEIGHT = 18;
const BRAND_WIDTH = 12;

export default function BrandMark() {
    return (
        <svg
            className="text-pink"
            aria-hidden="true"
            fill="currentColor"
            height={BRAND_HEIGHT}
            viewBox="8 4 16 24"
            width={BRAND_WIDTH}
        >
            <polygon points="16,6 22,26 16,21 10,26" />
        </svg>
    );
}
