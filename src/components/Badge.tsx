import IconCategory from '@components/IconCategory';
import { getAccentBorder, getAccentForeground, getAccentSurface, getCategoryColor } from '@lib/utils';

const CLASS_BADGE = 'inline-flex items-center h-[24px] max-w-full min-w-0 gap-[6px] px-[10px] border rounded-full font-mono text-[10px] tracking-[0.12em] uppercase';

export default function Badge({ categoryId, label }: {
    categoryId: string;
    label: string;
}) {
    const color = getCategoryColor(categoryId);

    const foreground = getAccentForeground(color);

    return (
        <span
            className={CLASS_BADGE}
            style={{
                background: getAccentSurface(color),
                borderColor: getAccentBorder(color),
                color: foreground,
            }}
            title={label}
        >
            <span className="inline-flex relative shrink-0 top-[-0.14em]">
                <IconCategory categoryId={categoryId} color={foreground} size={12} />
            </span>
            <span className="overflow-hidden text-ellipsis whitespace-nowrap">{label}</span>
        </span>
    );
}
