import { STAR_COLOR, STAR_LABEL, STAR_PATH, STAR_SIZE } from '@lib/constants';
import { accentForeground } from '@lib/utils';

export default function StarMark() {
    return (
        <span className="inline-flex items-center pl-[8px] align-middle">
            <svg
                aria-hidden="true"
                height={STAR_SIZE}
                style={{ fill: accentForeground(STAR_COLOR) }}
                viewBox="0 0 24 24"
                width={STAR_SIZE}
            >
                <path d={STAR_PATH} />
            </svg>
            <span className="sr-only">{STAR_LABEL}</span>
        </span>
    );
}
