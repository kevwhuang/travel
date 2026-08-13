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
            className="atlas-label inline-flex items-center h-[24px] gap-[6px] px-[10px] border rounded-full text-[9px] tracking-[0.12em]"
            style={{
                background: accentSurface(color),
                borderColor: accentBorder(color),
                color: foreground,
            }}
        >
            <IconCategory
                category={category}
                color={foreground}
                size={11}
            />
            {label}
        </span>
    );
}
