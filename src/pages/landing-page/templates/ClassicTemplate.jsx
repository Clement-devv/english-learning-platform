// Classic template — a full education website: top bar, sticky header, photo hero,
// stats, about collage, programs, why-choose-us, teachers, testimonials, gallery,
// enrolment banner, FAQ, contact and a 4-column footer.
//
// Every text and image comes from lp (edited in Super admin → Websites). Sections
// with no content are hidden, so a half-filled site still looks finished.
// Layout uses container queries, so the editor's phone preview shows the real
// phone layout (media queries would only see the browser window).
import { useEffect, useRef, useState } from 'react';
import { resolveDesign, adjustHex, sortedTeachers, SOCIAL_ICONS, SOCIAL_LABELS } from '../utils.jsx';

const SERIF = "'Playfair Display', Georgia, 'Times New Roman', serif";

/** Black or white text, whichever reads better on `hex`. */
function onColor(hex = '#000000') {
  const c = hex.replace('#', '').padEnd(6, '0');
  const [r, g, b] = [0, 2, 4].map(i => parseInt(c.slice(i, i + 2), 16) / 255)
    .map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.45 ? '#111827' : '#ffffff';
}

const on = (sec) => !!sec && sec.enabled !== false;
const items = (sec) => (on(sec) && Array.isArray(sec.items) ? sec.items.filter(Boolean) : []);

export default function ClassicTemplate({ center, lp }) {
  const D = resolveDesign(lp.design);
  const rootRef = useRef(null);
  useReveal(rootRef);
  useDocTitle(lp.seo?.title || center.centerName);

  const urls = {
    student: lp.links?.studentLogin || '/student/login',
    teacher: lp.links?.teacherLogin || '/teacher/login',
    parent:  lp.links?.parentLogin  || '/parent/login',
    admin:   '/admin/login',
  };
  const programs = items(lp.programs);
  const features = items(lp.features);
  const stats = items(lp.stats);
  const testimonials = items(lp.testimonials);
  const gallery = items(lp.gallery);
  const faq = items(lp.faq);
  const teachers = sortedTeachers(lp.teachers || []);
  const showAbout = lp.about?.enabled !== false && !!(lp.about?.body || lp.about?.image);
  const showContact = !!lp.contact?.enabled;

  const nav = [
    { label: 'Home', href: '#home' },
    showAbout && { label: 'About', href: '#about' },
    programs.length > 0 && { label: lp.programs?.navLabel || 'Programs', href: '#programs' },
    teachers.length > 0 && { label: 'Teachers', href: '#teachers' },
    testimonials.length > 0 && { label: 'Reviews', href: '#testimonials' },
    faq.length > 0 && { label: 'FAQ', href: '#faq' },
    showContact && { label: 'Contact', href: '#contact' },
  ].filter(Boolean);

  const vars = {
    '--p': D.primary, '--p-dark': adjustHex(D.primary, -45), '--p-deep': `color-mix(in srgb, ${D.primary} 30%, #0b1120)`,
    '--p-on': onColor(D.primary), '--a': D.accent, '--a-on': onColor(D.accent),
    '--soft': `${D.primary}0d`, '--font': D.font, '--serif': SERIF,
  };

  return (
    <div ref={rootRef} className="ct" style={vars}>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700;800&display=swap" />
      <style>{CSS}</style>

      {lp.topBar?.enabled && (lp.topBar.text || lp.contact?.phone || lp.contact?.email) && (
        <TopBar text={lp.topBar.text} contact={lp.contact} links={lp.links} />
      )}
      <Header center={center} nav={nav} urls={urls} cta={{ text: lp.hero?.ctaText || 'Enroll now', url: lp.hero?.ctaUrl || urls.student }} />
      <Hero center={center} lp={lp} D={D} highlights={features.slice(0, 3)} />
      {stats.length > 0 && <Stats stats={stats} />}
      {showAbout && <About about={lp.about} cta={lp.hero} />}
      {programs.length > 0 && <Programs sec={lp.programs} list={programs} />}
      {features.length > 0 && <Features sec={lp.features} list={features} />}
      {teachers.length > 0 && <Teachers list={teachers} />}
      {testimonials.length > 0 && <Testimonials sec={lp.testimonials} list={testimonials} />}
      {gallery.length > 0 && <Gallery sec={lp.gallery} list={gallery} />}
      {on(lp.cta) && lp.cta?.title && <Banner cta={lp.cta} fallbackUrl={urls.student} />}
      {faq.length > 0 && <Faq sec={lp.faq} list={faq} contact={lp.contact} />}
      {showContact && <Contact contact={lp.contact} links={lp.links} />}
      <Footer center={center} lp={lp} nav={nav} programs={programs} urls={urls} />
    </div>
  );
}

/* ── Top bar ─────────────────────────────────────────────────────────────── */
function TopBar({ text, contact, links }) {
  const socials = Object.keys(SOCIAL_ICONS).filter(k => links?.[k]);
  return (
    <div className="ct-top">
      <div className="ct-wrap ct-top-in">
        <span className="ct-top-text">{text}</span>
        <span className="ct-top-right">
          {contact?.phone && <a href={`tel:${contact.phone}`}><Icon name="phone" size={14} /> {contact.phone}</a>}
          {contact?.email && <a href={`mailto:${contact.email}`} className="ct-hide-sm"><Icon name="mail" size={14} /> {contact.email}</a>}
          {socials.map(k => { const S = SOCIAL_ICONS[k]; return <a key={k} href={links[k]} target="_blank" rel="noopener noreferrer" aria-label={SOCIAL_LABELS[k]}><S size={14} /></a>; })}
        </span>
      </div>
    </div>
  );
}

/* ── Header ──────────────────────────────────────────────────────────────── */
function Header({ center, nav, urls, cta }) {
  const [menu, setMenu] = useState(false);
  const [login, setLogin] = useState(false);
  const scrolled = useScrolledIn();
  useEffect(() => {
    if (!login) return undefined;
    const close = () => setLogin(false);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [login]);

  return (
    <header className={`ct-header${scrolled ? ' is-scrolled' : ''}`}>
      <div className="ct-wrap ct-header-in">
        <a href="#home" className="ct-brand" aria-label={center.centerName}>
          {center.logo
            ? <img src={center.logo} alt="" />
            : <span className="ct-mark" aria-hidden>{center.centerName.charAt(0).toUpperCase()}</span>}
          <span className="ct-brand-name">{center.centerName}</span>
        </a>

        <nav className="ct-nav" aria-label="Main">
          {nav.map(l => <a key={l.href} href={l.href}>{l.label}</a>)}
        </nav>

        <div className="ct-header-actions">
          <div className="ct-login" onClick={e => e.stopPropagation()}>
            <button type="button" className="ct-btn ct-btn-ghost" onClick={() => setLogin(v => !v)} aria-expanded={login}>
              Login <Icon name="chevron" size={14} />
            </button>
            {login && (
              <div className="ct-login-menu" role="menu">
                {[['Student', 'Join your classes', urls.student], ['Teacher', 'Manage your lessons', urls.teacher], ['Parent', "Follow your child's progress", urls.parent]].map(([who, hint, href]) => (
                  <a key={who} href={href} role="menuitem">
                    <span className="ct-login-ic"><Icon name={who === 'Teacher' ? 'board' : who === 'Parent' ? 'users' : 'cap'} size={16} /></span>
                    <span><strong>{who} login</strong><small>{hint}</small></span>
                  </a>
                ))}
                <a href={urls.admin} className="ct-login-admin" role="menuitem">School admin login</a>
              </div>
            )}
          </div>
          <a href={cta.url} className="ct-btn ct-btn-accent ct-hide-sm">{cta.text}</a>
          <button type="button" className="ct-burger" aria-label="Menu" aria-expanded={menu} onClick={() => setMenu(v => !v)}>
            <Icon name={menu ? 'close' : 'menu'} size={22} />
          </button>
        </div>
      </div>

      {menu && (
        <div className="ct-mobile-menu">
          {nav.map(l => <a key={l.href} href={l.href} onClick={() => setMenu(false)}>{l.label}</a>)}
          <hr />
          <a href={urls.student}>Student login</a>
          <a href={urls.teacher}>Teacher login</a>
          <a href={urls.parent}>Parent login</a>
          <a href={cta.url} className="ct-btn ct-btn-accent" style={{ marginTop: 8, justifyContent: 'center' }}>{cta.text}</a>
        </div>
      )}
    </header>
  );
}

/* ── Hero ────────────────────────────────────────────────────────────────── */
function Hero({ center, lp, D, highlights }) {
  const h = lp.hero || {};
  const image = h.image || (D.heroStyle === 'image' ? D.heroImage : null) || D.heroImage;
  const headline = h.headline || `Learn English with confidence at ${center.centerName}`;
  const sub = h.subheadline || center.description || 'Expert teachers, small classes and a clear path from your first words to fluent conversation.';
  return (
    <section id="home" className={`ct-hero${image ? ' has-image' : ''}${highlights.length ? ' has-hl' : ''}`} style={image ? { backgroundImage: `url("${encodeURI(image)}")` } : undefined}>
      <div className="ct-hero-shade" aria-hidden />
      <div className="ct-wrap ct-hero-in">
        {h.badge && <span className="ct-hero-badge ct-rise">{h.badge}</span>}
        <h1 className="ct-rise ct-d1">{headline}</h1>
        <p className="ct-rise ct-d2">{sub}</p>
        <div className="ct-hero-ctas ct-rise ct-d3">
          <a href={h.ctaUrl || '/student/login'} className="ct-btn ct-btn-accent ct-btn-lg">{h.ctaText || 'Enroll now'} <Icon name="arrow" size={16} /></a>
          {h.secondaryCtaText && <a href={h.secondaryCtaUrl || '#about'} className="ct-btn ct-btn-outline-light ct-btn-lg">{h.secondaryCtaText}</a>}
        </div>
      </div>
      {highlights.length > 0 && (
        <div className="ct-wrap ct-highlights">
          {highlights.map((f, i) => (
            <div key={i} className="ct-highlight ct-reveal" style={{ transitionDelay: `${i * 90}ms` }}>
              <span className="ct-highlight-ic"><Icon name={f.icon || 'star'} size={22} /></span>
              <div><h3>{f.title}</h3>{f.text && <p>{f.text}</p>}</div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/* ── Stats ───────────────────────────────────────────────────────────────── */
function Stats({ stats }) {
  return (
    <section className="ct-stats">
      <div className="ct-wrap ct-stats-in" style={{ '--n': Math.min(stats.length, 4) }}>
        {stats.map((s, i) => (
          <div key={i} className="ct-stat ct-reveal">
            <strong>{s.value}</strong>
            <span>{s.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ── About ───────────────────────────────────────────────────────────────── */
function About({ about, cta }) {
  const points = (about.points || []).filter(Boolean);
  const hasImages = about.image || about.image2;
  return (
    <section id="about" className="ct-section">
      <div className={`ct-wrap ct-about${hasImages ? '' : ' no-images'}`}>
        {hasImages && (
          <div className="ct-about-media ct-reveal">
            {about.image && <img className="ct-about-main" src={about.image} alt="" loading="lazy" />}
            {about.image2 && <img className="ct-about-second" src={about.image2} alt="" loading="lazy" />}
            {about.badgeValue && (
              <div className="ct-about-badge">
                <strong>{about.badgeValue}</strong>
                <span>{about.badgeLabel || 'Years of experience'}</span>
              </div>
            )}
          </div>
        )}
        <div className="ct-reveal">
          <Eyebrow>{about.subtitle || 'About us'}</Eyebrow>
          <h2 className="ct-h2">{about.title || 'A school built around every learner'}</h2>
          {about.body && <p className="ct-lead">{about.body}</p>}
          {points.length > 0 && (
            <ul className="ct-checks">
              {points.map((p, i) => <li key={i}><span><Icon name="check" size={14} /></span>{p}</li>)}
            </ul>
          )}
          {cta?.ctaText && <a href={cta.ctaUrl || '/student/login'} className="ct-btn ct-btn-primary">{cta.ctaText} <Icon name="arrow" size={16} /></a>}
        </div>
      </div>
    </section>
  );
}

/* ── Programs ────────────────────────────────────────────────────────────── */
function Programs({ sec, list }) {
  return (
    <section id="programs" className="ct-section ct-tinted">
      <div className="ct-wrap">
        <SectionHead eyebrow="Our programs" title={sec.title || 'Courses for every goal'} subtitle={sec.subtitle} />
        <div className="ct-grid ct-grid-3">
          {list.map((p, i) => (
            <article key={i} className="ct-card ct-program ct-reveal" style={{ transitionDelay: `${(i % 3) * 80}ms` }}>
              <div className="ct-program-img">
                {p.image ? <img src={p.image} alt="" loading="lazy" /> : <div className="ct-program-ph"><Icon name="book" size={40} /></div>}
                {p.level && <span className="ct-chip">{p.level}</span>}
              </div>
              <div className="ct-program-body">
                <h3>{p.title}</h3>
                {p.text && <p>{p.text}</p>}
                {(p.duration || p.price) && (
                  <div className="ct-program-meta">
                    {p.duration && <span><Icon name="clock" size={14} /> {p.duration}</span>}
                    {p.price && <span className="ct-price">{p.price}</span>}
                  </div>
                )}
                <a href={p.ctaUrl || '#contact'} className="ct-link">{p.ctaText || 'Learn more'} <Icon name="arrow" size={14} /></a>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Why choose us ───────────────────────────────────────────────────────── */
function Features({ sec, list }) {
  return (
    <section className="ct-section">
      <div className="ct-wrap">
        <SectionHead eyebrow="Why choose us" title={sec.title || 'Everything you need to succeed'} subtitle={sec.subtitle} />
        <div className="ct-grid ct-grid-3">
          {list.map((f, i) => (
            <div key={i} className="ct-feature ct-reveal" style={{ transitionDelay: `${(i % 3) * 80}ms` }}>
              <span className="ct-feature-ic"><Icon name={f.icon || 'star'} size={26} /></span>
              <h3>{f.title}</h3>
              {f.text && <p>{f.text}</p>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Teachers ────────────────────────────────────────────────────────────── */
function Teachers({ list }) {
  return (
    <section id="teachers" className="ct-section ct-tinted">
      <div className="ct-wrap">
        <SectionHead eyebrow="Our teachers" title="Learn from experienced educators" />
        <div className="ct-grid ct-grid-4">
          {list.map((t, i) => (
            <article key={i} className="ct-card ct-teacher ct-reveal" style={{ transitionDelay: `${(i % 4) * 70}ms` }}>
              <div className="ct-teacher-photo">
                {t.photo ? <img src={t.photo} alt={t.name} loading="lazy" /> : <span>{t.name.charAt(0).toUpperCase()}</span>}
              </div>
              <div className="ct-teacher-body">
                <h3>{t.name}</h3>
                {t.title && <span className="ct-teacher-role">{t.title}</span>}
                {t.bio && <p>{t.bio}</p>}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Testimonials ────────────────────────────────────────────────────────── */
function Testimonials({ sec, list }) {
  return (
    <section id="testimonials" className="ct-section">
      <div className="ct-wrap">
        <SectionHead eyebrow="Testimonials" title={sec.title || 'What our students and parents say'} subtitle={sec.subtitle} />
        <div className="ct-grid ct-grid-3">
          {list.map((t, i) => (
            <figure key={i} className="ct-card ct-quote ct-reveal" style={{ transitionDelay: `${(i % 3) * 80}ms` }}>
              <span className="ct-quote-mark" aria-hidden>“</span>
              <div className="ct-stars" aria-label={`${t.rating || 5} out of 5`}>
                {Array.from({ length: 5 }, (_, s) => <Icon key={s} name="star-fill" size={15} className={s < (t.rating || 5) ? '' : 'off'} />)}
              </div>
              <blockquote>{t.quote}</blockquote>
              <figcaption>
                {t.photo ? <img src={t.photo} alt="" loading="lazy" /> : <span className="ct-quote-av">{(t.name || '?').charAt(0).toUpperCase()}</span>}
                <span><strong>{t.name}</strong>{t.role && <small>{t.role}</small>}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Gallery ─────────────────────────────────────────────────────────────── */
function Gallery({ sec, list }) {
  const [open, setOpen] = useState(null);
  useEffect(() => {
    if (open === null) return undefined;
    const key = (e) => {
      if (e.key === 'Escape') setOpen(null);
      if (e.key === 'ArrowRight') setOpen(i => (i + 1) % list.length);
      if (e.key === 'ArrowLeft') setOpen(i => (i - 1 + list.length) % list.length);
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [open, list.length]);

  return (
    <section className="ct-section ct-tinted">
      <div className="ct-wrap">
        <SectionHead eyebrow="Gallery" title={sec.title || 'Life at our school'} subtitle={sec.subtitle} />
        <div className="ct-gallery">
          {list.map((g, i) => (
            <button key={i} type="button" className="ct-gallery-item ct-reveal" onClick={() => setOpen(i)} aria-label={g.caption || `Photo ${i + 1}`}>
              <img src={g.image} alt={g.caption || ''} loading="lazy" />
              {g.caption && <span>{g.caption}</span>}
            </button>
          ))}
        </div>
      </div>
      {open !== null && list[open] && (
        <div className="ct-lightbox" onClick={() => setOpen(null)} role="dialog" aria-label="Photo">
          <img src={list[open].image} alt={list[open].caption || ''} onClick={e => e.stopPropagation()} />
          {list[open].caption && <p>{list[open].caption}</p>}
          <button type="button" className="ct-lightbox-close" aria-label="Close" onClick={() => setOpen(null)}><Icon name="close" size={22} /></button>
          {list.length > 1 && (
            <>
              <button type="button" className="ct-lightbox-nav prev" aria-label="Previous" onClick={e => { e.stopPropagation(); setOpen(i => (i - 1 + list.length) % list.length); }}><Icon name="chevron" size={22} /></button>
              <button type="button" className="ct-lightbox-nav next" aria-label="Next" onClick={e => { e.stopPropagation(); setOpen(i => (i + 1) % list.length); }}><Icon name="chevron" size={22} /></button>
            </>
          )}
        </div>
      )}
    </section>
  );
}

/* ── Enrolment banner ────────────────────────────────────────────────────── */
function Banner({ cta, fallbackUrl }) {
  return (
    <section className={`ct-banner${cta.image ? ' has-image' : ''}`} style={cta.image ? { backgroundImage: `url("${encodeURI(cta.image)}")` } : undefined}>
      <div className="ct-banner-shade" aria-hidden />
      <div className="ct-wrap ct-banner-in ct-reveal">
        <div>
          <h2>{cta.title}</h2>
          {cta.text && <p>{cta.text}</p>}
        </div>
        <a href={cta.buttonUrl || fallbackUrl} className="ct-btn ct-btn-accent ct-btn-lg">{cta.buttonText || 'Enroll now'} <Icon name="arrow" size={16} /></a>
      </div>
    </section>
  );
}

/* ── FAQ ─────────────────────────────────────────────────────────────────── */
function Faq({ sec, list, contact }) {
  return (
    <section id="faq" className="ct-section">
      <div className="ct-wrap ct-faq">
        <div className="ct-reveal">
          <Eyebrow>FAQ</Eyebrow>
          <h2 className="ct-h2">{sec.title || 'Frequently asked questions'}</h2>
          <p className="ct-lead">{sec.subtitle || "Can't find your answer? We're happy to help."}</p>
          {contact?.enabled && <a href="#contact" className="ct-btn ct-btn-primary">Contact us <Icon name="arrow" size={16} /></a>}
        </div>
        <div className="ct-faq-list ct-reveal">
          {list.map((f, i) => (
            <details key={i} className="ct-faq-item" open={i === 0}>
              <summary>{f.q}<span className="ct-faq-plus" aria-hidden /></summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Contact ─────────────────────────────────────────────────────────────── */
function Contact({ contact, links }) {
  const cards = [
    contact.address && { icon: 'pin', label: 'Visit us', value: contact.address, href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(contact.address)}`, ext: true, more: 'Open in Google Maps' },
    contact.phone && { icon: 'phone', label: 'Call us', value: contact.phone, href: `tel:${contact.phone}` },
    contact.email && { icon: 'mail', label: 'Email us', value: contact.email, href: `mailto:${contact.email}` },
    contact.hours && { icon: 'clock', label: 'Opening hours', value: contact.hours },
  ].filter(Boolean);
  const socials = Object.keys(SOCIAL_ICONS).filter(k => links?.[k]);
  return (
    <section id="contact" className="ct-section ct-tinted">
      <div className="ct-wrap">
        <SectionHead eyebrow="Contact" title="Get in touch" subtitle="Questions about classes, levels or prices? Reach out — we reply quickly." />
        <div className="ct-grid ct-grid-4">
          {cards.map((c, i) => {
            const body = (
              <>
                <span className="ct-contact-ic"><Icon name={c.icon} size={22} /></span>
                <small>{c.label}</small>
                <strong>{c.value}</strong>
                {c.more && <em>{c.more} <Icon name="arrow" size={12} /></em>}
              </>
            );
            return c.href
              ? <a key={i} href={c.href} className="ct-card ct-contact ct-reveal" {...(c.ext ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>{body}</a>
              : <div key={i} className="ct-card ct-contact ct-reveal">{body}</div>;
          })}
        </div>
        {socials.length > 0 && (
          <div className="ct-socials-row">
            {socials.map(k => { const S = SOCIAL_ICONS[k]; return <a key={k} href={links[k]} target="_blank" rel="noopener noreferrer" className="ct-btn ct-btn-ghost"><S size={16} /> {SOCIAL_LABELS[k]}</a>; })}
          </div>
        )}
      </div>
    </section>
  );
}

/* ── Footer ──────────────────────────────────────────────────────────────── */
function Footer({ center, lp, nav, programs, urls }) {
  const socials = Object.keys(SOCIAL_ICONS).filter(k => lp.links?.[k]);
  const c = lp.contact || {};
  return (
    <footer className="ct-footer">
      <div className="ct-wrap ct-footer-grid">
        <div>
          <div className="ct-brand ct-brand-footer">
            {center.logo ? <img src={center.logo} alt="" /> : <span className="ct-mark" aria-hidden>{center.centerName.charAt(0).toUpperCase()}</span>}
            <span className="ct-brand-name">{center.centerName}</span>
          </div>
          <p>{lp.footer?.about || center.description || 'Quality English education for children and adults, online and in class.'}</p>
          {socials.length > 0 && (
            <div className="ct-footer-socials">
              {socials.map(k => { const S = SOCIAL_ICONS[k]; return <a key={k} href={lp.links[k]} target="_blank" rel="noopener noreferrer" aria-label={SOCIAL_LABELS[k]}><S size={16} /></a>; })}
            </div>
          )}
        </div>
        <div>
          <h4>Explore</h4>
          {nav.map(l => <a key={l.href} href={l.href}>{l.label}</a>)}
        </div>
        <div>
          <h4>{programs.length ? 'Programs' : 'Portals'}</h4>
          {programs.length
            ? programs.slice(0, 6).map((p, i) => <a key={i} href="#programs">{p.title}</a>)
            : <><a href={urls.student}>Student login</a><a href={urls.teacher}>Teacher login</a><a href={urls.parent}>Parent login</a></>}
        </div>
        <div>
          <h4>Contact</h4>
          {c.address && <span><Icon name="pin" size={14} /> {c.address}</span>}
          {c.phone && <a href={`tel:${c.phone}`}><Icon name="phone" size={14} /> {c.phone}</a>}
          {c.email && <a href={`mailto:${c.email}`}><Icon name="mail" size={14} /> {c.email}</a>}
          {c.hours && <span><Icon name="clock" size={14} /> {c.hours}</span>}
          {!c.address && !c.phone && !c.email && <a href={urls.student}>Student login</a>}
        </div>
      </div>
      <div className="ct-wrap ct-footer-bottom">
        <span>© {new Date().getFullYear()} {center.centerName}. All rights reserved.{center.partnershipText && <em> {center.partnershipText}</em>}</span>
        <span>Powered by Clemify</span>
      </div>
    </footer>
  );
}

/* ── Small pieces ────────────────────────────────────────────────────────── */
function Eyebrow({ children }) {
  return <span className="ct-eyebrow"><span aria-hidden />{children}</span>;
}

function SectionHead({ eyebrow, title, subtitle }) {
  return (
    <div className="ct-head ct-reveal">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="ct-h2">{title}</h2>
      {subtitle && <p className="ct-lead">{subtitle}</p>}
    </div>
  );
}

const PATHS = {
  arrow: <><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></>,
  chevron: <polyline points="6 9 12 15 18 9" />,
  check: <polyline points="20 6 9 17 4 12" />,
  menu: <><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></>,
  close: <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>,
  phone: <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />,
  mail: <><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></>,
  pin: <><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></>,
  clock: <><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></>,
  book: <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></>,
  cap: <><path d="M22 10 12 5 2 10l10 5 10-5z" /><path d="M6 12v5c3 2 9 2 12 0v-5" /></>,
  users: <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>,
  board: <><rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" /></>,
  globe: <><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></>,
  award: <><circle cx="12" cy="8" r="7" /><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" /></>,
  video: <><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" /></>,
  chat: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />,
  star: <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />,
  target: <><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></>,
  laptop: <><rect x="3" y="4" width="18" height="12" rx="2" /><line x1="2" y1="20" x2="22" y2="20" /></>,
  heart: <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z" />,
  shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
  calendar: <><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></>,
};
// Icon names offered in the editor: landing-page/classicContent.js (CLASSIC_FEATURE_ICONS)

function Icon({ name, size = 18, className = '' }) {
  if (name === 'star-fill') {
    return <svg className={`ct-ic ${className}`} width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>{PATHS.star}</svg>;
  }
  return (
    <svg className={`ct-ic ${className}`} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {PATHS[name] || PATHS.star}
    </svg>
  );
}

/* ── Hooks ───────────────────────────────────────────────────────────────── */
// Sections fade up as they scroll into view. Without IntersectionObserver
// (or before it fires) everything stays visible.
function useReveal(rootRef) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root || typeof IntersectionObserver === 'undefined') return undefined;
    root.classList.add('ct-anim');
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    root.querySelectorAll('.ct-reveal').forEach(el => io.observe(el));
    return () => io.disconnect();
  });
}

// Scroll position of the page — or of the editor preview's scroll box
function useScrolledIn() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const fn = (e) => {
      const t = e.target === document ? document.scrollingElement : e.target;
      setScrolled((t?.scrollTop || window.scrollY) > 24);
    };
    window.addEventListener('scroll', fn, { passive: true, capture: true });
    return () => window.removeEventListener('scroll', fn, { capture: true });
  }, []);
  return scrolled;
}

function useDocTitle(title) {
  useEffect(() => { if (title) document.title = title; }, [title]);
}

/* ── Styles ──────────────────────────────────────────────────────────────── */
const CSS = `
.ct { container-type: inline-size; font-family: var(--font); color: #1f2937; background: #fff; min-height: 100vh; overflow-x: hidden; -webkit-font-smoothing: antialiased; line-height: 1.6; }
.ct *, .ct *::before, .ct *::after { box-sizing: border-box; }
/* :where() = zero specificity, so classed links/buttons keep their own colours */
:where(.ct) a { color: inherit; text-decoration: none; }
.ct img { display: block; max-width: 100%; }
.ct-wrap { width: 100%; max-width: 1200px; margin: 0 auto; padding: 0 24px; }
.ct-ic { flex-shrink: 0; }
.ct-h2 { font-family: var(--serif); font-size: clamp(1.85rem, 4cqi, 2.75rem); line-height: 1.15; font-weight: 700; color: #0f172a; margin: 14px 0 16px; letter-spacing: -0.01em; }
.ct-lead { font-size: 1.05rem; color: #4b5563; margin: 0 0 24px; white-space: pre-line; }
.ct-eyebrow { display: inline-flex; align-items: center; gap: 10px; font-size: 13px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; color: var(--p); }
.ct-eyebrow > span { width: 28px; height: 2px; background: var(--a); display: inline-block; }
.ct-section { padding: 96px 0; }
.ct-tinted { background: var(--soft); }
.ct-head { text-align: center; max-width: 720px; margin: 0 auto 52px; }
.ct-head .ct-eyebrow { justify-content: center; }
.ct-head .ct-lead { margin-bottom: 0; }
.ct-grid { display: grid; gap: 28px; }
.ct-grid-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.ct-grid-4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }
.ct-card { background: #fff; border-radius: 18px; box-shadow: 0 1px 2px rgba(15,23,42,.04), 0 10px 30px rgba(15,23,42,.06); overflow: hidden; transition: transform .25s ease, box-shadow .25s ease; }
.ct-card:hover { transform: translateY(-6px); box-shadow: 0 2px 4px rgba(15,23,42,.05), 0 22px 48px rgba(15,23,42,.12); }

/* Buttons */
.ct-btn { display: inline-flex; align-items: center; gap: 8px; padding: 11px 22px; border-radius: 999px; font-weight: 700; font-size: 14.5px; border: 2px solid transparent; cursor: pointer; font-family: inherit; transition: transform .2s ease, box-shadow .2s ease, background .2s ease, color .2s ease; white-space: nowrap; }
.ct-btn:hover { transform: translateY(-2px); }
.ct-btn-lg { padding: 15px 30px; font-size: 15.5px; }
.ct-btn-accent { background: var(--a); color: var(--a-on); box-shadow: 0 10px 24px -8px var(--a); }
.ct-btn-primary { background: var(--p); color: var(--p-on); box-shadow: 0 10px 24px -10px var(--p); }
.ct-btn-ghost { background: transparent; border-color: #e5e7eb; color: #1f2937; }
.ct-btn-ghost:hover { border-color: var(--p); color: var(--p); }
.ct-btn-outline-light { border-color: rgba(255,255,255,.75); color: #fff; }
.ct-btn-outline-light:hover { background: #fff; color: #0f172a; }
.ct-link { display: inline-flex; align-items: center; gap: 6px; font-weight: 700; color: var(--p); font-size: 14.5px; }
.ct-link:hover { gap: 10px; }

/* Top bar + header */
.ct-top { background: var(--p-deep); color: rgba(255,255,255,.85); font-size: 13px; }
.ct-top-in { display: flex; justify-content: space-between; align-items: center; gap: 16px; min-height: 40px; }
.ct-top-right { display: flex; align-items: center; gap: 18px; }
.ct-top a { display: inline-flex; align-items: center; gap: 6px; color: rgba(255,255,255,.85); }
.ct-top a:hover { color: #fff; }
.ct-header { position: sticky; top: 0; z-index: 50; background: rgba(255,255,255,.96); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border-bottom: 1px solid transparent; transition: box-shadow .25s, border-color .25s; }
.ct-header.is-scrolled { box-shadow: 0 8px 28px rgba(15,23,42,.08); border-bottom-color: #eef0f3; }
.ct-header-in { display: flex; align-items: center; gap: 24px; height: 78px; }
.ct-brand { display: flex; align-items: center; gap: 12px; min-width: 0; }
.ct-brand img { height: 46px; width: auto; object-fit: contain; }
.ct-mark { width: 44px; height: 44px; border-radius: 12px; display: grid; place-items: center; background: var(--p); color: var(--p-on); font-family: var(--serif); font-size: 24px; font-weight: 800; flex-shrink: 0; }
.ct-brand-name { font-family: var(--serif); font-size: 21px; font-weight: 700; color: #0f172a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ct-nav { display: flex; gap: 4px; margin-left: auto; }
.ct-nav a { padding: 8px 14px; border-radius: 8px; font-weight: 600; font-size: 15px; color: #374151; position: relative; }
.ct-nav a::after { content: ''; position: absolute; left: 14px; right: 14px; bottom: 2px; height: 2px; background: var(--a); transform: scaleX(0); transition: transform .2s; }
.ct-nav a:hover { color: var(--p); }
.ct-nav a:hover::after { transform: scaleX(1); }
.ct-header-actions { display: flex; align-items: center; gap: 10px; }
.ct-login { position: relative; }
.ct-login .ct-btn { padding: 9px 16px; }
.ct-login-menu { position: absolute; right: 0; top: calc(100% + 10px); width: 260px; background: #fff; border-radius: 16px; box-shadow: 0 24px 60px rgba(15,23,42,.18); border: 1px solid #f1f5f9; padding: 8px; z-index: 60; }
.ct-login-menu a { display: flex; align-items: center; gap: 12px; padding: 10px 12px; border-radius: 10px; }
.ct-login-menu a:hover { background: var(--soft); }
.ct-login-menu strong { display: block; font-size: 14px; color: #0f172a; }
.ct-login-menu small { display: block; font-size: 12px; color: #6b7280; }
.ct-login-ic { width: 36px; height: 36px; border-radius: 10px; display: grid; place-items: center; background: var(--soft); color: var(--p); flex-shrink: 0; }
.ct-login-admin { font-size: 12.5px; color: #6b7280 !important; border-top: 1px solid #f1f5f9; margin-top: 4px; border-radius: 0 0 10px 10px !important; }
.ct-burger { display: none; background: none; border: none; padding: 6px; cursor: pointer; color: #0f172a; }
.ct-mobile-menu { display: flex; flex-direction: column; padding: 8px 24px 20px; border-top: 1px solid #f1f5f9; background: #fff; }
.ct-mobile-menu a { padding: 11px 4px; font-weight: 600; color: #1f2937; }
.ct-mobile-menu hr { border: 0; border-top: 1px solid #f1f5f9; margin: 6px 0; width: 100%; }

/* Hero */
.ct-hero { position: relative; color: #fff; background: linear-gradient(135deg, var(--p-deep) 0%, var(--p-dark) 55%, var(--p) 100%); background-size: cover; background-position: center; padding: 120px 0 0; }
.ct-hero:not(.has-image)::before { content: ''; position: absolute; inset: 0; background-image: radial-gradient(rgba(255,255,255,.09) 1px, transparent 1px); background-size: 22px 22px; }
.ct-hero-shade { position: absolute; inset: 0; background: linear-gradient(90deg, rgba(8,14,32,.9) 0%, rgba(8,14,32,.7) 45%, rgba(8,14,32,.25) 100%); }
.ct-hero:not(.has-image) .ct-hero-shade { background: radial-gradient(circle at 85% 20%, color-mix(in srgb, var(--a) 35%, transparent), transparent 45%); }
.ct-hero-in { position: relative; max-width: 1200px; padding-bottom: 120px; }
.ct-hero-in > * { max-width: 680px; }
.ct-hero-badge { display: inline-block; padding: 7px 16px; border-radius: 999px; background: color-mix(in srgb, var(--a) 22%, transparent); border: 1px solid color-mix(in srgb, var(--a) 60%, transparent); color: #fff; font-size: 13px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; margin-bottom: 22px; }
.ct-hero h1 { font-family: var(--serif); font-size: clamp(2.4rem, 6.2cqi, 4.3rem); line-height: 1.08; font-weight: 800; margin: 0 0 22px; letter-spacing: -0.015em; text-wrap: balance; }
.ct-hero p { font-size: clamp(1.02rem, 1.8cqi, 1.2rem); color: rgba(255,255,255,.86); margin: 0 0 34px; white-space: pre-line; }
.ct-hero-ctas { display: flex; flex-wrap: wrap; gap: 14px; }
.ct-highlights { position: relative; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0; margin-bottom: -70px; z-index: 2; }
.ct-highlight { display: flex; gap: 16px; align-items: flex-start; background: #fff; color: #1f2937; padding: 28px 26px; box-shadow: 0 24px 50px rgba(15,23,42,.14); }
.ct-highlight:first-child { border-radius: 18px 0 0 18px; }
.ct-highlight:last-child { border-radius: 0 18px 18px 0; }
.ct-highlight:nth-child(2) { background: var(--p); color: var(--p-on); }
.ct-highlight:nth-child(2) .ct-highlight-ic { background: rgba(255,255,255,.16); color: inherit; }
.ct-highlight:nth-child(2) p { color: inherit; opacity: .85; }
.ct-highlight-ic { width: 52px; height: 52px; border-radius: 14px; display: grid; place-items: center; background: var(--soft); color: var(--p); flex-shrink: 0; }
.ct-highlight h3 { font-family: var(--serif); font-size: 1.2rem; margin: 2px 0 6px; }
.ct-highlight p { margin: 0; font-size: .95rem; color: #6b7280; }
.ct-hero.has-hl + .ct-stats, .ct-hero.has-hl + .ct-section { padding-top: 150px; }

/* Stats */
.ct-stats { background: #fff; padding: 72px 0 32px; }
.ct-stats-in { display: grid; grid-template-columns: repeat(var(--n), minmax(0, 1fr)); gap: 0; }
.ct-stat { text-align: center; padding: 8px 16px; border-left: 1px solid #eef0f3; }
.ct-stat:first-child { border-left: none; }
.ct-stat strong { display: block; font-family: var(--serif); font-size: clamp(2.2rem, 5cqi, 3.2rem); color: var(--p); line-height: 1.1; }
.ct-stat span { display: block; color: #6b7280; font-weight: 600; margin-top: 6px; }
.ct-stats + .ct-section { padding-top: 72px; }

/* About */
.ct-about { display: grid; grid-template-columns: 1fr 1fr; gap: 72px; align-items: center; }
.ct-about.no-images { grid-template-columns: 1fr; max-width: 820px; }
.ct-about-media { position: relative; padding: 0 48px 56px 0; }
.ct-about-main { width: 100%; aspect-ratio: 4 / 4.4; object-fit: cover; border-radius: 22px; box-shadow: 0 30px 60px rgba(15,23,42,.18); }
.ct-about-second { position: absolute; right: 0; bottom: 0; width: 48%; aspect-ratio: 1; object-fit: cover; border-radius: 18px; border: 8px solid #fff; box-shadow: 0 20px 44px rgba(15,23,42,.2); }
.ct-about-badge { position: absolute; left: -18px; bottom: 30px; background: var(--a); color: var(--a-on); border-radius: 18px; padding: 18px 22px; box-shadow: 0 18px 40px -12px var(--a); max-width: 180px; }
.ct-about-badge strong { display: block; font-family: var(--serif); font-size: 2.3rem; line-height: 1; }
.ct-about-badge span { display: block; font-weight: 700; font-size: 13px; margin-top: 4px; }
.ct-checks { list-style: none; padding: 0; margin: 0 0 30px; display: grid; grid-template-columns: 1fr 1fr; gap: 12px 20px; }
.ct-checks li { display: flex; align-items: flex-start; gap: 10px; font-weight: 600; color: #1f2937; }
.ct-checks li > span { width: 24px; height: 24px; border-radius: 50%; display: grid; place-items: center; background: var(--p); color: var(--p-on); flex-shrink: 0; margin-top: 1px; }

/* Programs */
.ct-program { display: flex; flex-direction: column; }
.ct-program-img { position: relative; aspect-ratio: 16 / 10; overflow: hidden; background: var(--soft); }
.ct-program-img img { width: 100%; height: 100%; object-fit: cover; transition: transform .5s ease; }
.ct-program:hover .ct-program-img img { transform: scale(1.06); }
.ct-program-ph { width: 100%; height: 100%; display: grid; place-items: center; color: var(--p); background: linear-gradient(135deg, var(--soft), color-mix(in srgb, var(--a) 18%, transparent)); }
.ct-chip { position: absolute; left: 16px; top: 16px; background: var(--a); color: var(--a-on); font-size: 12px; font-weight: 800; padding: 5px 12px; border-radius: 999px; letter-spacing: .03em; }
.ct-program-body { padding: 24px 24px 26px; display: flex; flex-direction: column; flex: 1; }
.ct-program-body h3 { font-family: var(--serif); font-size: 1.35rem; margin: 0 0 10px; color: #0f172a; }
.ct-program-body p { color: #4b5563; margin: 0 0 18px; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.ct-program-meta { display: flex; justify-content: space-between; align-items: center; padding: 14px 0; border-top: 1px solid #f1f5f9; margin-top: auto; margin-bottom: 14px; color: #6b7280; font-size: 14px; font-weight: 600; }
.ct-program-meta span { display: inline-flex; align-items: center; gap: 6px; }
.ct-price { color: var(--p) !important; font-size: 1.05rem; font-weight: 800; }
.ct-program-body > .ct-link { margin-top: auto; }
.ct-program-meta + .ct-link { margin-top: 0; }

/* Features */
.ct-feature { padding: 34px 30px; border-radius: 18px; border: 1px solid #eef0f3; background: #fff; transition: border-color .25s, box-shadow .25s, transform .25s; }
.ct-feature:hover { border-color: transparent; box-shadow: 0 22px 48px rgba(15,23,42,.1); transform: translateY(-4px); }
.ct-feature-ic { width: 62px; height: 62px; border-radius: 18px; display: grid; place-items: center; background: var(--soft); color: var(--p); margin-bottom: 22px; transition: background .25s, color .25s; }
.ct-feature:hover .ct-feature-ic { background: var(--p); color: var(--p-on); }
.ct-feature h3 { font-family: var(--serif); font-size: 1.3rem; margin: 0 0 10px; color: #0f172a; }
.ct-feature p { margin: 0; color: #4b5563; }

/* Teachers */
.ct-teacher-photo { aspect-ratio: 4 / 4.6; background: linear-gradient(135deg, var(--p), var(--p-deep)); overflow: hidden; display: grid; place-items: center; }
.ct-teacher-photo img { width: 100%; height: 100%; object-fit: cover; transition: transform .5s ease; }
.ct-teacher:hover .ct-teacher-photo img { transform: scale(1.05); }
.ct-teacher-photo span { font-family: var(--serif); font-size: 64px; color: var(--p-on); font-weight: 800; }
.ct-teacher-body { padding: 20px 22px 24px; text-align: center; }
.ct-teacher-body h3 { font-family: var(--serif); font-size: 1.25rem; margin: 0 0 4px; color: #0f172a; }
.ct-teacher-role { display: block; color: var(--p); font-weight: 700; font-size: 13.5px; margin-bottom: 10px; }
.ct-teacher-body p { margin: 0; color: #6b7280; font-size: 14px; }

/* Testimonials */
.ct-quote { margin: 0; padding: 34px 30px 28px; position: relative; display: flex; flex-direction: column; }
.ct-quote-mark { position: absolute; right: 24px; top: 4px; font-family: var(--serif); font-size: 110px; line-height: 1; color: var(--soft); color: color-mix(in srgb, var(--p) 12%, transparent); }
.ct-stars { display: flex; gap: 3px; color: #f59e0b; margin-bottom: 16px; }
.ct-stars .off { color: #e5e7eb; }
.ct-quote blockquote { margin: 0 0 24px; font-size: 1.04rem; color: #374151; font-style: italic; position: relative; flex: 1; }
.ct-quote figcaption { display: flex; align-items: center; gap: 12px; padding-top: 18px; border-top: 1px solid #f1f5f9; }
.ct-quote figcaption img, .ct-quote-av { width: 50px; height: 50px; border-radius: 50%; object-fit: cover; flex-shrink: 0; }
.ct-quote-av { display: grid; place-items: center; background: var(--p); color: var(--p-on); font-weight: 800; font-size: 20px; }
.ct-quote figcaption strong { display: block; color: #0f172a; }
.ct-quote figcaption small { display: block; color: #6b7280; font-size: 13px; }

/* Gallery */
.ct-gallery { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); grid-auto-rows: 200px; gap: 14px; }
.ct-gallery-item { position: relative; border: 0; padding: 0; cursor: zoom-in; overflow: hidden; border-radius: 16px; background: #e5e7eb; }
.ct-gallery-item:first-child { grid-column: span 2; grid-row: span 2; }
.ct-gallery-item img { width: 100%; height: 100%; object-fit: cover; transition: transform .5s ease; }
.ct-gallery-item:hover img { transform: scale(1.07); }
.ct-gallery-item span { position: absolute; left: 0; right: 0; bottom: 0; padding: 26px 14px 12px; color: #fff; font-weight: 600; font-size: 14px; text-align: left; background: linear-gradient(transparent, rgba(0,0,0,.65)); opacity: 0; transition: opacity .25s; }
.ct-gallery-item:hover span { opacity: 1; }
.ct-lightbox { position: fixed; inset: 0; z-index: 400; background: rgba(5,8,18,.92); display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px; }
.ct-lightbox img { max-width: min(1100px, 100%); max-height: 80vh; border-radius: 12px; object-fit: contain; }
.ct-lightbox p { color: #fff; margin: 16px 0 0; font-weight: 600; }
.ct-lightbox-close, .ct-lightbox-nav { position: absolute; background: rgba(255,255,255,.12); color: #fff; border: 0; width: 46px; height: 46px; border-radius: 50%; display: grid; place-items: center; cursor: pointer; }
.ct-lightbox-close { top: 20px; right: 20px; }
.ct-lightbox-nav { top: 50%; transform: translateY(-50%); }
.ct-lightbox-nav.prev { left: 20px; } .ct-lightbox-nav.prev svg { transform: rotate(90deg); }
.ct-lightbox-nav.next { right: 20px; } .ct-lightbox-nav.next svg { transform: rotate(-90deg); }

/* Banner */
.ct-banner { position: relative; background: linear-gradient(120deg, var(--p-deep), var(--p)); background-size: cover; background-position: center; color: #fff; padding: 88px 0; }
.ct-banner-shade { position: absolute; inset: 0; background: linear-gradient(90deg, color-mix(in srgb, var(--p-deep) 92%, transparent), color-mix(in srgb, var(--p) 70%, transparent)); }
.ct-banner:not(.has-image) .ct-banner-shade { background: radial-gradient(circle at 90% 50%, color-mix(in srgb, var(--a) 35%, transparent), transparent 50%); }
.ct-banner-in { position: relative; display: flex; align-items: center; justify-content: space-between; gap: 32px; }
.ct-banner h2 { font-family: var(--serif); font-size: clamp(1.8rem, 4cqi, 2.6rem); margin: 0 0 10px; line-height: 1.15; max-width: 680px; }
.ct-banner p { margin: 0; color: rgba(255,255,255,.86); font-size: 1.08rem; max-width: 640px; }

/* FAQ */
.ct-faq { display: grid; grid-template-columns: 5fr 7fr; gap: 64px; align-items: start; }
.ct-faq-list { display: flex; flex-direction: column; gap: 14px; }
.ct-faq-item { border: 1px solid #eef0f3; border-radius: 14px; background: #fff; transition: box-shadow .2s, border-color .2s; }
.ct-faq-item[open] { border-color: transparent; box-shadow: 0 16px 40px rgba(15,23,42,.08); }
.ct-faq-item summary { list-style: none; cursor: pointer; padding: 20px 22px; font-weight: 700; color: #0f172a; display: flex; justify-content: space-between; gap: 16px; align-items: center; font-size: 1.02rem; }
.ct-faq-item summary::-webkit-details-marker { display: none; }
.ct-faq-plus { width: 28px; height: 28px; border-radius: 50%; background: var(--soft); position: relative; flex-shrink: 0; transition: background .2s; }
.ct-faq-plus::before, .ct-faq-plus::after { content: ''; position: absolute; left: 50%; top: 50%; width: 12px; height: 2px; background: var(--p); transform: translate(-50%, -50%); transition: transform .2s, background .2s; }
.ct-faq-plus::after { transform: translate(-50%, -50%) rotate(90deg); }
.ct-faq-item[open] .ct-faq-plus { background: var(--p); }
.ct-faq-item[open] .ct-faq-plus::before, .ct-faq-item[open] .ct-faq-plus::after { background: var(--p-on); }
.ct-faq-item[open] .ct-faq-plus::after { transform: translate(-50%, -50%) rotate(0deg); }
.ct-faq-item p { margin: 0; padding: 0 22px 22px; color: #4b5563; white-space: pre-line; }

/* Contact */
.ct-contact { padding: 30px 24px; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 6px; }
.ct-contact-ic { width: 58px; height: 58px; border-radius: 50%; display: grid; place-items: center; background: var(--p); color: var(--p-on); margin-bottom: 10px; }
.ct-contact small { color: #6b7280; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; font-size: 12px; }
.ct-contact strong { color: #0f172a; font-size: 1rem; word-break: break-word; }
.ct-contact em { font-style: normal; color: var(--p); font-weight: 700; font-size: 13px; display: inline-flex; align-items: center; gap: 4px; margin-top: 4px; }
.ct-socials-row { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; margin-top: 36px; }

/* Footer */
.ct-footer { background: #0b1120; color: rgba(255,255,255,.7); padding: 80px 0 0; }
.ct-footer-grid { display: grid; grid-template-columns: 1.6fr 1fr 1fr 1.3fr; gap: 40px; padding-bottom: 56px; }
.ct-footer h4 { color: #fff; font-family: var(--serif); font-size: 1.15rem; margin: 6px 0 18px; }
.ct-footer-grid > div > a, .ct-footer-grid > div > span { display: flex; align-items: flex-start; gap: 8px; padding: 5px 0; font-size: 14.5px; color: rgba(255,255,255,.7); }
.ct-footer-grid > div > a:hover { color: #fff; }
.ct-footer-grid .ct-ic { margin-top: 4px; color: var(--a); }
.ct-brand-footer { margin-bottom: 18px; }
.ct-brand-footer .ct-brand-name { color: #fff; }
.ct-brand-footer img { filter: brightness(0) invert(1); }
.ct-footer p { margin: 0 0 20px; font-size: 14.5px; max-width: 340px; }
.ct-footer-socials { display: flex; gap: 10px; }
.ct-footer-socials a { width: 38px; height: 38px; border-radius: 50%; display: grid; place-items: center; background: rgba(255,255,255,.08); color: #fff; transition: background .2s, color .2s; }
.ct-footer-socials a:hover { background: var(--a); color: var(--a-on); }
.ct-footer-bottom { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 10px; padding-top: 22px; padding-bottom: 26px; border-top: 1px solid rgba(255,255,255,.08); font-size: 13px; color: rgba(255,255,255,.5); }
.ct-footer-bottom em { font-style: italic; }

/* Motion */
@keyframes ctRise { from { opacity: 0; transform: translateY(22px); } to { opacity: 1; transform: none; } }
.ct-rise { animation: ctRise .7s cubic-bezier(.2,.7,.2,1) both; }
.ct-d1 { animation-delay: .08s; } .ct-d2 { animation-delay: .18s; } .ct-d3 { animation-delay: .28s; }
.ct-anim .ct-reveal { opacity: 0; transform: translateY(26px); transition: opacity .7s ease, transform .7s cubic-bezier(.2,.7,.2,1); }
.ct-anim .ct-reveal.in { opacity: 1; transform: none; }
@media (prefers-reduced-motion: reduce) {
  .ct-rise { animation: none; }
  .ct-anim .ct-reveal { opacity: 1; transform: none; transition: none; }
  .ct-card:hover, .ct-btn:hover, .ct-feature:hover { transform: none; }
}

/* Tablet */
@container (max-width: 1020px) {
  .ct-nav, .ct-hide-sm { display: none; }
  .ct-burger { display: inline-grid; place-items: center; }
  .ct-header-actions { margin-left: auto; }
  .ct-grid-4 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .ct-grid-3 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .ct-about { gap: 48px; }
  .ct-footer-grid { grid-template-columns: 1fr 1fr; }
  .ct-gallery { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
/* Phone */
@container (max-width: 700px) {
  .ct-wrap { padding: 0 18px; }
  .ct-section { padding: 68px 0; }
  .ct-header-in { height: 66px; gap: 12px; }
  .ct-brand img { height: 38px; }
  .ct-brand-name { font-size: 18px; }
  .ct-mark { width: 38px; height: 38px; font-size: 20px; }
  .ct-top-text { display: none; }
  .ct-top-in { justify-content: center; }
  .ct-hero { padding-top: 72px; }
  .ct-hero-in { padding-bottom: 72px; }
  .ct-highlights { grid-template-columns: 1fr; margin-bottom: -40px; }
  .ct-highlight:first-child { border-radius: 18px 18px 0 0; }
  .ct-highlight:last-child { border-radius: 0 0 18px 18px; }
  .ct-highlight:only-child { border-radius: 18px; }
  .ct-hero.has-hl + .ct-stats, .ct-hero.has-hl + .ct-section { padding-top: 100px; }
  .ct-stats-in { grid-template-columns: repeat(2, minmax(0, 1fr)); row-gap: 28px; }
  .ct-stat:nth-child(odd) { border-left: none; }
  .ct-grid-3, .ct-grid-4 { grid-template-columns: 1fr; }
  .ct-about { grid-template-columns: 1fr; }
  .ct-about-media { padding: 0 24px 40px 0; }
  .ct-about-badge { left: 10px; bottom: 14px; padding: 14px 16px; }
  .ct-checks { grid-template-columns: 1fr; }
  .ct-gallery { grid-template-columns: repeat(2, minmax(0, 1fr)); grid-auto-rows: 150px; }
  .ct-banner-in { flex-direction: column; align-items: flex-start; }
  .ct-faq { grid-template-columns: 1fr; gap: 32px; }
  .ct-footer-grid { grid-template-columns: 1fr; gap: 28px; }
  .ct-lightbox { padding: 16px; }
  .ct-login-menu { right: -60px; }
}
`;
