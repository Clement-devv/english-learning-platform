import { studioText } from './studioLanguage';
import { ArrowUpRight, Building2, Search } from 'lucide-react';

export function StudioIntro({ eyebrow, title, children, aside }) {
  return <section className="tm-section-intro"><div><span className="tm-eyebrow">{studioText(eyebrow)}</span><h2>{studioText(title)}</h2><p>{typeof children === "string" ? studioText(children) : children}</p></div>{aside && <div className="tm-intro-aside">{aside}</div>}</section>;
}
export function StudioEmpty({ icon: Icon = Building2, title, children, action, onAction }) {
  return <div className="tm-section-empty"><span className="tm-empty-icon"><Icon size={25} strokeWidth={1.4} /></span><h3>{studioText(title)}</h3><p>{typeof children === "string" ? studioText(children) : children}</p>{action && <button onClick={onAction}>{studioText(action)}<ArrowUpRight size={15} /></button>}</div>;
}
export function StudioSearch({ value, onChange, label, placeholder }) {
  return <label className="tm-search"><span className="tm-sr-only">{label}</span><Search size={16} /><input type="search" value={value} onChange={e => onChange(e.target.value)} placeholder={studioText(placeholder)} /></label>;
}
export function CenterHint({ center, onChoose }) {
  return <div className={`tm-center-hint ${!center || center.archived ? 'needs-center' : ''}`}><Building2 size={15} /><span>{!center ? 'Choose a managed center above to add a record.' : center.archived ? `${center.name} is archived. Choose an active center.` : <>Adding to <strong>{center.name}</strong></>}</span>{!center && onChoose && <button type="button" onClick={onChoose}>Manage centers<ArrowUpRight size={13} /></button>}</div>;
}
export function PanelHeading({ icon: Icon, eyebrow, title, children }) {
  return <div className="tm-form-heading">{Icon && <span className="tm-round-icon"><Icon size={18} /></span>}<div>{eyebrow && <span className="tm-eyebrow">{studioText(eyebrow)}</span>}<h3>{studioText(title)}</h3>{children && <p>{typeof children === "string" ? studioText(children) : children}</p>}</div></div>;
}
