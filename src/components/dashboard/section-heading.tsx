import Link from "next/link";

export function SectionHeading({
  icon,
  title,
  href,
  linkLabel,
}: {
  icon: React.ReactNode;
  title: string;
  href: string;
  linkLabel: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2.5">
        {icon}
        <h2 className="truncate text-[17px] font-bold text-white">{title}</h2>
      </div>
      <Link
        href={href}
        className="flex shrink-0 items-center gap-1 text-[13px] font-medium text-[#1be67a] transition hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1be67a]"
      >
        <span>{linkLabel}</span>
        <span aria-hidden="true">→</span>
      </Link>
    </div>
  );
}
