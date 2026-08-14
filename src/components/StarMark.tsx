import IconStar from '@components/IconStar';
import { STAR_COLOR, STAR_LABEL } from '@lib/constants';
import { accentForeground } from '@lib/utils';

export default function StarMark() {
    return (
        <span className="inline-flex items-center relative top-[-1.5px] pl-[8px] align-middle">
            <IconStar color={accentForeground(STAR_COLOR)} />
            <span className="sr-only">{STAR_LABEL}</span>
        </span>
    );
}
