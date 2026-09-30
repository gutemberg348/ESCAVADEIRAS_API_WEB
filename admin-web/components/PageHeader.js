import Link from "next/link";
import { ArrowRight } from "lucide-react";
export default function PageHeader({
  eyebrow,
  title,
  description,
  action,
  href,
  icon: Icon,
}) {
  const target =
    href || (action === "Nova escavadeira" ? "/admin/machines/new" : null);
  const content = (
    <>
      {Icon && <Icon size={16} />}
      <span>{action}</span>
      <ArrowRight size={15} />
    </>
  );
  return (
    <header className="page-header">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action &&
        (target ? (
          <Link className="primary-action" href={target}>
            {content}
          </Link>
        ) : (
          <button className="primary-action">{content}</button>
        ))}
    </header>
  );
}
export function PanelHeader({ eyebrow, title, action, href }) {
  return (
    <div className="panel-header">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
      </div>
      {action &&
        (href ? (
          <Link href={href}>
            {action}
            <ArrowRight size={14} />
          </Link>
        ) : (
          <button>
            {action}
            <ArrowRight size={14} />
          </button>
        ))}
    </div>
  );
}
