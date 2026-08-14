import IconCategory from '@components/IconCategory';
import { accentBorder, accentForeground, accentSurface, categoryColor } from '@lib/utils';

export default function CategoryBadge({ category, label }: {
    category: string;
    label: string;
}) {
    const color = categoryColor(category);

    const foreground = accentForeground(color);

    return (
        <span
            className="inline-flex items-center h-[24px] max-w-full min-w-0 gap-[6px] px-[10px] border rounded-full font-mono text-[10px] tracking-[0.12em] uppercase"
            style={{
                background: accentSurface(color),
                borderColor: accentBorder(color),
                color: foreground,
            }}
            title={label}
        >
            <span className="inline-flex relative top-[-1px] shrink-0">
                <IconCategory
                    category={category}
                    color={foreground}
                    size={11}
                />
            </span>
            <span className="overflow-hidden text-ellipsis whitespace-nowrap">{label}</span>
        </span>
    );
}
