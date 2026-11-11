import { useState } from 'react';
export default function SummaryPreview({ text = '', limit = 280 }) {
  const [expanded, setExpanded] = useState(false);
  const long = text.length > limit;
  return <div><p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{long && !expanded ? `${text.slice(0, limit)}…` : text}</p>{long && <button type="button" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>{expanded ? 'See less' : 'See more'}</button>}</div>;
}
