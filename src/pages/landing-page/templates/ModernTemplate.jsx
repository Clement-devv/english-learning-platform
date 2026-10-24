// Modern template — a dark "studio" website, the opposite of Classic's ivory paper:
// midnight background, a glowing mesh in the center's two colours, floating pill
// header, geometric sans headings, bento grids, a scrolling ticker and a giant
// wordmark footer.
//
// Uses the same content as Classic (Super admin → Websites), so a center can switch
// templates without retyping anything. Sections with no content are hidden.
// Layout uses container queries, so the editor's phone preview shows the real
// phone layout.
import { useEffect, useRef, useState } from 'react';
import { resolveDesign, sortedTeachers, SOCIAL_ICONS, SOCIAL_LABELS } from '../utils.jsx';
import { onColor, on, items, CountUp, Icon, useReveal, useScrolledIn, useDocTitle, useDocLang, useLightboxKeys, splitHeadline } from './shared.jsx';
import { siteText, siteFont, SiteTextCtx, useSiteText } from '../siteText.js';

const DISPLAY = "'Space Grotesk', 'Inter', system-ui, sans-serif";
const pad2 = (n) => String(n).padStart(2, '0');

export default function ModernTemplate({ center, lp }) {
  const D = resolveDesign(lp.design);
  const rootRef = useRef(null);
  useReveal(rootRef, 'md');
  useDocTitle(lp.seo?.title || center.centerName);
  const T = siteText(lp.language);
  useDocLang(T.lang);

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
    showAbout && { label: T.about, href: '#about' },
    programs.length > 0 && { label: T.programs, href: '#programs' },
    teachers.length > 0 && { label: T.teachers, href: '#teachers' },
    testimonials.length > 0 && { label: T.reviews, href: '#testimonials' },
    faq.length > 0 && { label: T.faq, href: '#faq' },
    showContact && { label: T.contact, href: '#contact' },
  ].filter(Boolean);

  const vars = {
    '--p': D.primary, '--a': D.accent, '--p-on': onColor(D.primary),
    '--font': siteFont(D, T.lang), '--display': DISPLAY,
  };
  const cta = { text: lp.hero?.ctaText || T.getStarted, url: lp.hero?.ctaUrl || urls.student };

  return (
    <SiteTextCtx.Provider value={T}>
    <div ref={rootRef} className="md" style={vars} lang={T.lang}>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&display=swap" />
      <style>{CSS}</style>

      {lp.topBar?.enabled && lp.topBar.text && <TopBar text={lp.topBar.text} contact={lp.contact} />}
      <Header center={center} nav={nav} urls={urls} cta={cta} />
      <Hero center={center} lp={lp} D={D} stats={stats} testimonials={testimonials} ticker={[...programs.map(p => p.title), ...features.map(f => f.title)].filter(Boolean)} />
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
      <Footer center={center} lp={lp} nav={nav} urls={urls} />
    </div>
    </SiteTextCtx.Provider>
  );
}

/* ── Top bar ─────────────────────────────────────────────────────────────── */
function TopBar({ text, contact }) {
  return (
    <div className="md-top">
      <span className="md-top-dot" aria-hidden />
      <span>{text}</span>
      {contact?.phone && <a href={`tel:${contact.phone}`} className="md-top-link"><Icon name="phone" size={13} /> {contact.phone}</a>}
    </div>
  );
}

/* ── Header: a floating glass pill ───────────────────────────────────────── */
function Header({ center, nav, urls, cta }) {
  const T = useSiteText();
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
    <header className={`md-header${scrolled ? ' is-scrolled' : ''}`}>
      <div className="md-pill">
        <a href="#home" className="md-brand" aria-label={center.centerName}>
          {center.logo ? <img src={center.logo} alt="" /> : <span className="md-mark" aria-hidden>{center.centerName.charAt(0).toUpperCase()}</span>}
          <span className="md-brand-name">{center.centerName}</span>
        </a>
        <nav className="md-nav" aria-label={T.mainNav}>
          {nav.map(l => <a key={l.href} href={l.href}>{l.label}</a>)}
        </nav>
        <div className="md-actions">
          <div className="md-login" onClick={e => e.stopPropagation()}>
            <button type="button" className="md-btn md-btn-ghost md-btn-sm" onClick={() => setLogin(v => !v)} aria-expanded={login}>
              {T.logIn} <Icon name="chevron" size={14} />
            </button>
            {login && (
              <div className="md-login-menu" role="menu">
                {[[T.student, T.hintStudent, urls.student, 'cap'], [T.teacher, T.hintTeacher, urls.teacher, 'board'], [T.parent, T.hintParent, urls.parent, 'users']].map(([who, hint, href, ic]) => (
                  <a key={href} href={href} role="menuitem">
                    <span className="md-login-ic"><Icon name={ic} size={16} /></span>
                    <span><strong>{who}</strong><small>{hint}</small></span>
                  </a>
                ))}
                <a href={urls.admin} className="md-login-admin" role="menuitem">{T.schoolAdmin}</a>
              </div>
            )}
          </div>
          <a href={cta.url} className="md-btn md-btn-primary md-btn-sm md-hide-sm">{cta.text}</a>
          <button type="button" className="md-burger" aria-label={T.menu} aria-expanded={menu} onClick={() => setMenu(v => !v)}>
            <Icon name={menu ? 'close' : 'menu'} size={20} />
          </button>
        </div>
      </div>
      {menu && (
        <div className="md-sheet">
          {nav.map(l => <a key={l.href} href={l.href} onClick={() => setMenu(false)}>{l.label}<Icon name="arrow" size={16} /></a>)}
          <div className="md-sheet-logins">
            <a href={urls.student}>{T.student}</a><a href={urls.teacher}>{T.teacher}</a><a href={urls.parent}>{T.parent}</a>
          </div>
          <a href={cta.url} className="md-btn md-btn-primary" onClick={() => setMenu(false)}>{cta.text} <Icon name="arrow" size={16} /></a>
        </div>
      )}
    </header>
  );
}

/* ── Hero ────────────────────────────────────────────────────────────────── */
function Hero({ center, lp, D, stats, testimonials, ticker }) {
  const T = useSiteText();
  const h = lp.hero || {};
  const image = h.image || D.heroImage;
  const headline = h.headline || T.heroHeadline(center.centerName);
  const sub = h.subheadline || center.description || T.heroSub;
  const [before, word, after] = splitHeadline(headline);
  const faces = testimonials.filter(t => t.photo).slice(0, 4);
  const rating = testimonials.length ? testimonials.reduce((s, t) => s + (t.rating || 5), 0) / testimonials.length : null;
  return (
    <section id="home" className="md-hero">
      <div className="md-hero-bg" aria-hidden>
        <span className="md-glow g1" /><span className="md-glow g2" /><span className="md-glow g3" />
        <span className="md-gridlines" />
      </div>

      <div className="md-wrap md-hero-copy">
        {h.badge && <span className="md-badge md-rise"><span className="md-live" />{h.badge}</span>}
        <h1 className="md-rise md-d1">
          {before}{before && ' '}{word && <span className="md-grad">{word}</span>}{after && ' '}{after}
        </h1>
        <p className="md-rise md-d2">{sub}</p>
        <div className="md-ctas md-rise md-d3">
          <a href={h.ctaUrl || '/student/login'} className="md-btn md-btn-primary md-btn-lg">
            {h.ctaText || T.getStarted} <span className="md-btn-arrow"><Icon name="arrow" size={16} /></span>
          </a>
          {h.secondaryCtaText && <a href={h.secondaryCtaUrl || '#about'} className="md-btn md-btn-ghost md-btn-lg">{h.secondaryCtaText}</a>}
        </div>
        {(rating || stats[0]) && (
          <div className="md-trust md-rise md-d4">
            {faces.length > 0 && <span className="md-faces">{faces.map((t, i) => <img key={i} src={t.photo} alt="" />)}</span>}
            {rating && <span className="md-trust-rate"><Icon name="star-fill" size={14} /> <b>{rating.toFixed(1)}</b> {T.rating}</span>}
            {stats[0] && <span className="md-trust-stat"><b>{stats[0].value}</b> {stats[0].label.toLowerCase()}</span>}
          </div>
        )}
      </div>

      <div className="md-wrap md-stage md-rise md-d3">
        <div className="md-frame">
          <div className="md-frame-bar" aria-hidden><i /><i /><i /><span>{center.centerName}</span></div>
          <div className="md-frame-media">
            {image ? <img src={image} alt="" fetchpriority="high" /> : <div className="md-frame-ph"><Icon name="cap" size={64} /></div>}
          </div>
        </div>
        {stats[1] && (
          <div className="md-chip md-chip-a">
            <span className="md-chip-ic"><Icon name="award" size={18} /></span>
            <span><strong>{stats[1].value}</strong><small>{stats[1].label}</small></span>
          </div>
        )}
        {stats[2] && (
          <div className="md-chip md-chip-b">
            <strong className="md-grad">{stats[2].value}</strong><small>{stats[2].label}</small>
          </div>
        )}
      </div>

      {ticker.length > 2 && (
        <div className="md-ticker" aria-label={T.whatWeTeach}>
          {/* the list twice, so the loop is seamless; the copy is hidden from screen readers */}
          <div className="md-ticker-track">
            {[0, 1].map(copy => (
              <span key={copy} className="md-ticker-set" aria-hidden={copy === 1}>
                {ticker.map((t, i) => <span key={i}>{t}<Icon name="spark" size={14} /></span>)}
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

/* ── Stats ───────────────────────────────────────────────────────────────── */
function Stats({ stats }) {
  return (
    <section className="md-section md-section-tight">
      <div className="md-wrap md-stats" style={{ '--n': Math.min(stats.length, 4) }}>
        {stats.map((s, i) => (
          <div key={i} className="md-card md-stat md-reveal" style={{ transitionDelay: `${i * 70}ms` }}>
            <strong className="md-grad"><CountUp value={s.value} /></strong>
            <span>{s.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ── About: a bento of story, photo, badge and checklist ─────────────────── */
function About({ about, cta }) {
  const T = useSiteText();
  const points = (about.points || []).filter(Boolean);
  return (
    <section id="about" className="md-section">
      <div className={`md-wrap md-about${about.image ? '' : ' no-image'}`}>
        {about.image && (
          <div className="md-card md-about-photo md-reveal"><img src={about.image} alt="" loading="lazy" /></div>
        )}
        <div className="md-card md-about-story md-reveal">
          <Eyebrow>{about.subtitle || T.aboutUs}</Eyebrow>
          <h2 className="md-h2">{about.title || T.aboutTitle}</h2>
          {about.body && <p className="md-lead">{about.body}</p>}
          {cta?.ctaText && <a href={cta.ctaUrl || '/student/login'} className="md-link">{cta.ctaText} <Icon name="arrow" size={15} /></a>}
        </div>
        {about.badgeValue && (
          <div className={`md-card md-about-badge md-reveal${about.image2 ? ' has-photo' : ''}`}>
            {about.image2 && <img src={about.image2} alt="" loading="lazy" />}
            <strong className="md-grad">{about.badgeValue}</strong>
            <span>{about.badgeLabel || T.yearsExp}</span>
          </div>
        )}
        {points.length > 0 && (
          <div className="md-card md-about-points md-reveal">
            <ul>{points.map((p, i) => <li key={i}><span><Icon name="check" size={13} /></span>{p}</li>)}</ul>
          </div>
        )}
      </div>
    </section>
  );
}

/* ── Programs: cards that become a swipe row on phones ───────────────────── */
function Programs({ sec, list }) {
  const T = useSiteText();
  return (
    <section id="programs" className="md-section">
      <div className="md-wrap">
        <SectionHead eyebrow={T.programs} title={sec.title || T.programsTitle} subtitle={sec.subtitle} />
        <div className="md-programs">
          {list.map((p, i) => (
            <article key={i} className="md-card md-program md-reveal" style={{ transitionDelay: `${(i % 3) * 70}ms` }}>
              <div className="md-program-img">
                {p.image ? <img src={p.image} alt="" loading="lazy" /> : <div className="md-frame-ph"><Icon name="book" size={36} /></div>}
                {p.level && <span className="md-tag">{p.level}</span>}
                <span className="md-program-no" aria-hidden>{pad2(i + 1)}</span>
              </div>
              <div className="md-program-body">
                <h3>{p.title}</h3>
                {p.text && <p>{p.text}</p>}
                <div className="md-program-foot">
                  <span className="md-program-meta">
                    {p.duration && <span><Icon name="clock" size={13} /> {p.duration}</span>}
                    {p.price && <b>{p.price}</b>}
                  </span>
                  <a href={p.ctaUrl || '#contact'} className="md-round" aria-label={`${p.ctaText || T.learnMore}: ${p.title}`}><Icon name="arrow" size={16} /></a>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Why us: bento tiles, the first and sixth ones wide ──────────────────── */
function Features({ sec, list }) {
  const T = useSiteText();
  return (
    <section className="md-section">
      <div className="md-wrap">
        <SectionHead eyebrow={T.whyUsShort} title={sec.title || T.featuresTitle} subtitle={sec.subtitle} />
        <div className="md-bento">
          {list.map((f, i) => (
            <div key={i} className={`md-card md-feature md-reveal${i % 6 === 0 || i % 6 === 5 ? ' is-wide' : ''}`} style={{ transitionDelay: `${(i % 3) * 70}ms` }}>
              <span className="md-feature-ic"><Icon name={f.icon || 'star'} size={20} /></span>
              <h3>{f.title}</h3>
              {f.text && <p>{f.text}</p>}
              <span className="md-feature-no" aria-hidden>{pad2(i + 1)}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Teachers ────────────────────────────────────────────────────────────── */
function Teachers({ list }) {
  const T = useSiteText();
  return (
    <section id="teachers" className="md-section">
      <div className="md-wrap">
        <SectionHead eyebrow={T.teachers} title={T.teachersTitleModern} />
        <div className="md-teachers">
          {list.map((t, i) => (
            <article key={i} className="md-card md-teacher md-reveal" style={{ transitionDelay: `${(i % 4) * 60}ms` }}>
              <div className="md-teacher-photo">
                {t.photo ? <img src={t.photo} alt={t.name} loading="lazy" /> : <span>{t.name.charAt(0).toUpperCase()}</span>}
                <div className="md-teacher-name"><h3>{t.name}</h3>{t.title && <small>{t.title}</small>}</div>
              </div>
              {t.bio && <p>{t.bio}</p>}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Testimonials: masonry columns, the first one glowing ────────────────── */
function Testimonials({ sec, list }) {
  const T = useSiteText();
  return (
    <section id="testimonials" className="md-section">
      <div className="md-wrap">
        <SectionHead eyebrow={T.reviews} title={sec.title || T.testimonialsTitleModern} subtitle={sec.subtitle} />
        <div className="md-quotes">
          {list.map((t, i) => (
            <figure key={i} className={`md-card md-quote md-reveal${i === 0 && list.length >= 3 ? ' is-feature' : ''}`}>
              <div className="md-stars" aria-label={T.outOf5(t.rating || 5)}>
                {Array.from({ length: 5 }, (_, s) => <Icon key={s} name="star-fill" size={14} className={s < (t.rating || 5) ? '' : 'off'} />)}
              </div>
              <blockquote>{t.quote}</blockquote>
              <figcaption>
                {t.photo ? <img src={t.photo} alt="" loading="lazy" /> : <span className="md-av">{(t.name || '?').charAt(0).toUpperCase()}</span>}
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
  const T = useSiteText();
  const [open, setOpen] = useState(null);
  useLightboxKeys(open, setOpen, list.length);
  return (
    <section className="md-section">
      <div className="md-wrap">
        <SectionHead eyebrow={T.gallery} title={sec.title || T.galleryTitle} subtitle={sec.subtitle} />
        <div className="md-gallery">
          {list.map((g, i) => (
            <button key={i} type="button" className="md-gallery-item md-reveal" onClick={() => setOpen(i)} aria-label={g.caption || T.photoN(i + 1)}>
              <img src={g.image} alt={g.caption || ''} loading="lazy" />
              {g.caption && <span>{g.caption}</span>}
            </button>
          ))}
        </div>
      </div>
      {open !== null && list[open] && (
        <div className="md-lightbox" onClick={() => setOpen(null)} role="dialog" aria-label={T.photo}>
          <img src={list[open].image} alt={list[open].caption || ''} onClick={e => e.stopPropagation()} />
          {list[open].caption && <p>{list[open].caption}</p>}
          <button type="button" className="md-lightbox-btn close" aria-label={T.close} onClick={() => setOpen(null)}><Icon name="close" size={20} /></button>
          {list.length > 1 && (
            <>
              <button type="button" className="md-lightbox-btn prev" aria-label={T.prev} onClick={e => { e.stopPropagation(); setOpen(i => (i - 1 + list.length) % list.length); }}><Icon name="chevron" size={20} /></button>
              <button type="button" className="md-lightbox-btn next" aria-label={T.next} onClick={e => { e.stopPropagation(); setOpen(i => (i + 1) % list.length); }}><Icon name="chevron" size={20} /></button>
            </>
          )}
        </div>
      )}
    </section>
  );
}

/* ── Enrolment banner ────────────────────────────────────────────────────── */
function Banner({ cta, fallbackUrl }) {
  const T = useSiteText();
  return (
    <section className="md-section md-section-tight">
      <div className="md-wrap">
        <div className="md-banner md-reveal">
          {cta.image && <img className="md-banner-img" src={cta.image} alt="" loading="lazy" />}
          <div className="md-banner-in">
            <span className="md-badge md-badge-light"><span className="md-live" />{T.enrolOpen}</span>
            <h2>{cta.title}</h2>
            {cta.text && <p>{cta.text}</p>}
            <a href={cta.buttonUrl || fallbackUrl} className="md-btn md-btn-white md-btn-lg">{cta.buttonText || T.enroll} <span className="md-btn-arrow"><Icon name="arrow" size={16} /></span></a>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── FAQ ─────────────────────────────────────────────────────────────────── */
function Faq({ sec, list, contact }) {
  const T = useSiteText();
  return (
    <section id="faq" className="md-section">
      <div className="md-wrap md-faq">
        <div className="md-reveal">
          <Eyebrow>{T.faq}</Eyebrow>
          <h2 className="md-h2">{sec.title || T.faqTitleModern}</h2>
          <p className="md-lead">{sec.subtitle || T.faqSub}</p>
          {contact?.enabled && <a href="#contact" className="md-btn md-btn-ghost">{T.contactUs} <Icon name="arrow" size={15} /></a>}
        </div>
        <div className="md-faq-list md-reveal">
          {list.map((f, i) => (
            <details key={i} className="md-faq-item" open={i === 0}>
              <summary>{f.q}<span className="md-faq-plus"><Icon name="plus" size={16} /></span></summary>
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
  const T = useSiteText();
  const cards = [
    contact.address && { icon: 'pin', label: T.visit, value: contact.address, href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(contact.address)}`, ext: true },
    contact.phone && { icon: 'phone', label: T.call, value: contact.phone, href: `tel:${contact.phone}` },
    contact.email && { icon: 'mail', label: T.email, value: contact.email, href: `mailto:${contact.email}` },
    contact.hours && { icon: 'clock', label: T.hours, value: contact.hours },
  ].filter(Boolean);
  const socials = Object.keys(SOCIAL_ICONS).filter(k => links?.[k]);
  return (
    <section id="contact" className="md-section">
      <div className="md-wrap">
        <SectionHead eyebrow={T.contact} title={T.contactTitleModern} subtitle={T.contactSubModern} />
        <div className="md-contacts">
          {cards.map((c, i) => {
            const body = (
              <>
                <span className="md-contact-ic"><Icon name={c.icon} size={20} /></span>
                <small>{c.label}</small>
                <strong>{c.value}</strong>
                {c.href && <span className="md-contact-go" aria-hidden><Icon name="arrow" size={14} /></span>}
              </>
            );
            return c.href
              ? <a key={i} href={c.href} className="md-card md-contact md-reveal" {...(c.ext ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>{body}</a>
              : <div key={i} className="md-card md-contact md-reveal">{body}</div>;
          })}
        </div>
        {socials.length > 0 && (
          <div className="md-socials">
            {socials.map(k => { const S = SOCIAL_ICONS[k]; return <a key={k} href={links[k]} target="_blank" rel="noopener noreferrer" className="md-btn md-btn-ghost md-btn-sm"><S size={15} /> {SOCIAL_LABELS[k]}</a>; })}
          </div>
        )}
      </div>
    </section>
  );
}

/* ── Footer with a giant wordmark ────────────────────────────────────────── */
function Footer({ center, lp, nav, urls }) {
  const T = useSiteText();
  const socials = Object.keys(SOCIAL_ICONS).filter(k => lp.links?.[k]);
  const c = lp.contact || {};
  return (
    <footer className="md-footer">
      <div className="md-wrap md-footer-grid">
        <div>
          <div className="md-brand">
            {center.logo ? <img src={center.logo} alt="" /> : <span className="md-mark" aria-hidden>{center.centerName.charAt(0).toUpperCase()}</span>}
            <span className="md-brand-name">{center.centerName}</span>
          </div>
          <p>{lp.footer?.about || center.description || T.footerAbout}</p>
          {socials.length > 0 && (
            <div className="md-footer-socials">
              {socials.map(k => { const S = SOCIAL_ICONS[k]; return <a key={k} href={lp.links[k]} target="_blank" rel="noopener noreferrer" aria-label={SOCIAL_LABELS[k]}><S size={16} /></a>; })}
            </div>
          )}
        </div>
        {nav.length > 0 && (
          <div>
            <h4>{T.explore}</h4>
            {nav.map(l => <a key={l.href} href={l.href}>{l.label}</a>)}
          </div>
        )}
        <div>
          <h4>{T.logIn}</h4>
          <a href={urls.student}>{T.students}</a><a href={urls.teacher}>{T.teachersPl}</a><a href={urls.parent}>{T.parents}</a>
        </div>
        {(c.phone || c.email || c.address) && (
          <div>
            <h4>{T.contact}</h4>
            {c.phone && <a href={`tel:${c.phone}`}>{c.phone}</a>}
            {c.email && <a href={`mailto:${c.email}`}>{c.email}</a>}
            {c.address && <span>{c.address}</span>}
          </div>
        )}
      </div>
      <div className="md-wordmark" aria-hidden style={{ '--len': Math.max(center.centerName.length, 6) }}>{center.centerName}</div>
      <div className="md-wrap md-footer-bottom">
        <span>© {new Date().getFullYear()} {center.centerName}.{center.partnershipText && <em> {center.partnershipText}</em>}</span>
        <span>{T.poweredBy}</span>
      </div>
    </footer>
  );
}

/* ── Small pieces ────────────────────────────────────────────────────────── */
function Eyebrow({ children }) {
  return <span className="md-eyebrow"><span className="md-eyebrow-dot" aria-hidden />{children}</span>;
}

function SectionHead({ eyebrow, title, subtitle }) {
  return (
    <div className="md-head md-reveal">
      <div><Eyebrow>{eyebrow}</Eyebrow><h2 className="md-h2">{title}</h2></div>
      {subtitle && <p className="md-lead">{subtitle}</p>}
    </div>
  );
}

/* ── Styles ──────────────────────────────────────────────────────────────── */
const CSS = `
/* ══ Modern — a dark studio look ══════════════════════════════════════════════
   Midnight surfaces, the center's two colours as light (glows, gradient text,
   gradient borders), geometric display type and bento grids. Motion: short
   ease-out reveals, an ambient drifting glow, a ticker; hover only on real
   pointers; reduced-motion users get none of the movement. */
.md { --bg: #07080d; --bg-2: #0c0e16; --card: rgba(255,255,255,.035); --card-2: rgba(255,255,255,.06);
  --line: rgba(255,255,255,.09); --line-2: rgba(255,255,255,.16);
  --ink: #f4f5fa; --ink-2: #a5abbd; --ink-3: #6c7287;
  --p-t: color-mix(in oklab, var(--p) 62%, #fff); --a-t: color-mix(in oklab, var(--a) 70%, #fff);
  --grad: linear-gradient(100deg, var(--p-t), var(--a-t));
  --ease: cubic-bezier(0.23, 1, 0.32, 1);
  container-type: inline-size; font-family: var(--font); color: var(--ink); background: var(--bg);
  min-height: 100vh; overflow-x: clip; line-height: 1.6; -webkit-font-smoothing: antialiased; color-scheme: dark; }
.md *, .md *::before, .md *::after { box-sizing: border-box; }
:where(.md) a { color: inherit; text-decoration: none; }
.md img { display: block; max-width: 100%; }
.md .lp-ic { flex-shrink: 0; }
.md ::selection { background: color-mix(in oklab, var(--p) 55%, transparent); color: #fff; }
.md-wrap { width: 100%; max-width: 1180px; margin: 0 auto; padding: 0 24px; position: relative; }
.md-grad { background: var(--grad); -webkit-background-clip: text; background-clip: text; color: transparent; }
.md-h2 { font-family: var(--display); font-weight: 600; font-size: clamp(2rem, 4.6cqi, 3.2rem); line-height: 1.05; letter-spacing: -0.035em; margin: 14px 0 0; text-wrap: balance; }
.md-lead { color: var(--ink-2); font-size: 1.05rem; margin: 18px 0 24px; white-space: pre-line; text-wrap: pretty; }
.md-eyebrow { display: inline-flex; align-items: center; gap: 9px; font-size: 12.5px; font-weight: 600; letter-spacing: .14em; text-transform: uppercase; color: var(--ink-2); }
.md-eyebrow-dot { width: 7px; height: 7px; border-radius: 2px; background: var(--grad); box-shadow: 0 0 12px var(--p); }
.md-section { padding: 112px 0; position: relative; }
.md-section-tight { padding: 40px 0; }
.md-head { display: grid; grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr); gap: 32px; align-items: end; margin-bottom: 52px; }
.md-head .md-lead { margin: 0; }
.md-card { background: var(--card); border: 1px solid var(--line); border-radius: 24px; position: relative; overflow: hidden;
  transition: transform .35s var(--ease), border-color .35s ease, background-color .35s ease; }

/* Buttons — feedback on press for every input; lift only with a mouse */
.md-btn { display: inline-flex; align-items: center; justify-content: center; gap: 10px; padding: 12px 22px; border-radius: 999px; font-weight: 600; font-size: 15px;
  border: 1px solid transparent; cursor: pointer; font-family: inherit; white-space: nowrap; touch-action: manipulation; -webkit-tap-highlight-color: transparent; user-select: none;
  transition: transform .18s var(--ease), background-color .2s ease, border-color .2s ease, box-shadow .25s var(--ease); }
.md-btn:active { transform: scale(.97); }
.md-btn-sm { padding: 9px 16px; font-size: 14px; }
.md-btn-lg { padding: 15px 18px 15px 28px; font-size: 16px; }
.md-btn-primary { background: var(--p); color: var(--p-on); box-shadow: 0 10px 40px -12px var(--p), inset 0 1px 0 rgba(255,255,255,.25); }
.md-btn-ghost { background: var(--card-2); border-color: var(--line); color: var(--ink); }
.md-btn-white { background: #fff; color: #0b0c12; }
.md-btn-arrow { width: 30px; height: 30px; border-radius: 50%; display: grid; place-items: center; background: rgba(0,0,0,.18); transition: transform .25s var(--ease); }
.md-btn-ghost.md-btn-lg { padding: 15px 28px; }
.md-link { display: inline-flex; align-items: center; gap: 8px; font-weight: 600; color: var(--p-t); }
.md-link svg { transition: transform .2s var(--ease); }
.md-round { width: 42px; height: 42px; border-radius: 50%; display: grid; place-items: center; border: 1px solid var(--line-2); color: var(--ink); flex-shrink: 0;
  transition: background-color .2s ease, color .2s ease, transform .18s var(--ease); }
.md-round:active { transform: scale(.94); }

/* Top bar */
.md-top { display: flex; align-items: center; justify-content: center; gap: 10px; flex-wrap: wrap; padding: 9px 16px; font-size: 13px; color: var(--ink-2);
  background: linear-gradient(90deg, transparent, color-mix(in oklab, var(--p) 22%, transparent), transparent); border-bottom: 1px solid var(--line); text-align: center; }
.md-top-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--a); box-shadow: 0 0 10px var(--a); }
.md-top-link { display: inline-flex; align-items: center; gap: 6px; color: var(--ink); font-weight: 500; }

/* Header — sticky, zero height, so the pill floats over the hero */
.md-header { position: sticky; top: 0; z-index: 60; height: 0; }
.md-pill { position: relative; top: 14px; margin: 0 auto; width: min(1132px, calc(100% - 24px)); display: flex; align-items: center; gap: 12px;
  padding: 7px 7px 7px 10px; border-radius: 999px; border: 1px solid var(--line); background: rgba(12,14,22,.55);
  -webkit-backdrop-filter: blur(18px) saturate(150%); backdrop-filter: blur(18px) saturate(150%); transition: background-color .3s ease, border-color .3s ease, box-shadow .3s ease; }
.md-header.is-scrolled .md-pill { background: rgba(12,14,22,.85); border-color: var(--line-2); box-shadow: 0 18px 40px -20px rgba(0,0,0,.8); }
.md-brand { display: flex; align-items: center; gap: 10px; min-width: 0; }
.md-brand img { height: 34px; width: auto; max-width: 140px; object-fit: contain; border-radius: 10px; }
.md-mark { width: 34px; height: 34px; border-radius: 11px; display: grid; place-items: center; font-family: var(--display); font-weight: 700; font-size: 17px;
  background: var(--grad); color: #0b0c12; flex-shrink: 0; }
/* long names wrap to two lines rather than being cut off */
.md-brand-name { font-family: var(--display); font-weight: 600; font-size: 16.5px; line-height: 1.12; letter-spacing: -0.02em; max-width: 230px;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; text-wrap: balance; }
.md-nav { display: flex; gap: 2px; margin: 0 auto; }
.md-nav a { padding: 8px 14px; white-space: nowrap; border-radius: 999px; font-size: 14px; color: var(--ink-2); transition: color .2s ease, background-color .2s ease; }
.md-actions { display: flex; align-items: center; gap: 6px; margin-left: auto; }
.md-nav + .md-actions { margin-left: 0; }
.md-login { position: relative; }
.md-login-menu { position: absolute; right: 0; top: calc(100% + 12px); width: 270px; padding: 8px; border-radius: 20px; background: #121522; border: 1px solid var(--line-2);
  box-shadow: 0 30px 60px -20px rgba(0,0,0,.8); animation: md-pop .22s var(--ease); transform-origin: top right; z-index: 5; }
.md-login-menu a { display: flex; gap: 12px; align-items: center; padding: 10px; border-radius: 14px; transition: background-color .15s ease; }
.md-login-menu strong { display: block; font-size: 14px; }
.md-login-menu small { color: var(--ink-3); font-size: 12.5px; }
.md-login-ic { width: 36px; height: 36px; border-radius: 11px; display: grid; place-items: center; background: color-mix(in oklab, var(--p) 22%, transparent); color: var(--p-t); }
.md-login-admin { justify-content: center; color: var(--ink-3); font-size: 13px; border-top: 1px solid var(--line); border-radius: 0 0 14px 14px !important; margin-top: 4px; }
@keyframes md-pop { from { opacity: 0; transform: scale(.96) translateY(-4px); } }
.md-burger { display: none; width: 42px; height: 42px; border-radius: 50%; border: 1px solid var(--line); background: var(--card-2); color: var(--ink); place-items: center; cursor: pointer; touch-action: manipulation; }
.md-burger:active { transform: scale(.94); }
.md-sheet { position: relative; top: 22px; margin: 0 auto; width: min(1132px, calc(100% - 24px)); padding: 10px; border-radius: 26px; background: #10131e; border: 1px solid var(--line-2);
  box-shadow: 0 30px 60px -20px rgba(0,0,0,.85); display: flex; flex-direction: column; gap: 2px; animation: md-pop .24s var(--ease); transform-origin: top center; }
.md-sheet > a:not(.md-btn) { display: flex; justify-content: space-between; align-items: center; padding: 14px 14px; border-radius: 14px; font-size: 16px; font-weight: 500; }
.md-sheet > a:not(.md-btn) svg { color: var(--ink-3); }
.md-sheet-logins { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin: 8px 0; }
.md-sheet-logins a { text-align: center; padding: 11px 6px; border-radius: 14px; background: var(--card-2); font-size: 14px; font-weight: 500; }
.md-sheet .md-btn { margin-top: 4px; padding: 14px; }

/* Hero */
.md-hero { position: relative; padding: 148px 0 0; overflow: hidden; isolation: isolate; }
.md-hero-bg { position: absolute; inset: 0; z-index: -1; pointer-events: none; }
.md-glow { position: absolute; border-radius: 50%; will-change: transform; }
.md-glow.g1 { width: 62cqi; height: 62cqi; left: -14cqi; top: -22cqi; background: radial-gradient(closest-side, color-mix(in oklab, var(--p) 60%, transparent), transparent); animation: md-drift 22s ease-in-out infinite alternate; }
.md-glow.g2 { width: 54cqi; height: 54cqi; right: -16cqi; top: -6cqi; background: radial-gradient(closest-side, color-mix(in oklab, var(--a) 42%, transparent), transparent); animation: md-drift 26s ease-in-out -8s infinite alternate-reverse; }
.md-glow.g3 { width: 70cqi; height: 40cqi; left: 15cqi; top: 52%; background: radial-gradient(closest-side, color-mix(in oklab, var(--p) 34%, transparent), transparent); animation: md-drift 30s ease-in-out -4s infinite alternate; }
@keyframes md-drift { to { transform: translate3d(6cqi, 4cqi, 0) scale(1.08); } }
.md-gridlines { position: absolute; inset: 0; background-image: linear-gradient(var(--line) 1px, transparent 1px), linear-gradient(90deg, var(--line) 1px, transparent 1px);
  background-size: 64px 64px; -webkit-mask-image: radial-gradient(ellipse 70% 55% at 50% 30%, #000 30%, transparent 75%); mask-image: radial-gradient(ellipse 70% 55% at 50% 30%, #000 30%, transparent 75%); opacity: .55; }
.md-hero-copy { text-align: center; max-width: 980px; }
.md-badge { display: inline-flex; align-items: center; gap: 10px; padding: 7px 16px 7px 12px; border-radius: 999px; border: 1px solid var(--line-2); background: var(--card-2);
  font-size: 13.5px; font-weight: 500; color: var(--ink); -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px); }
.md-badge-light { background: rgba(255,255,255,.14); border-color: rgba(255,255,255,.3); color: #fff; }
.md-live { position: relative; width: 8px; height: 8px; border-radius: 50%; background: var(--a); flex-shrink: 0; }
.md-live::after { content: ""; position: absolute; inset: -4px; border-radius: 50%; border: 1.5px solid var(--a); animation: md-ping 2.2s var(--ease) infinite; }
@keyframes md-ping { from { transform: scale(.6); opacity: .9; } to { transform: scale(1.8); opacity: 0; } }
.md-hero h1 { font-family: var(--display); font-weight: 600; font-size: clamp(2.6rem, 7.4cqi, 5.6rem); line-height: .98; letter-spacing: -0.045em; margin: 26px auto 24px; text-wrap: balance; }
.md-hero-copy > p { color: var(--ink-2); font-size: clamp(1.05rem, 1.7cqi, 1.22rem); max-width: 640px; margin: 0 auto 36px; text-wrap: pretty; }
.md-ctas { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }
.md-trust { display: flex; align-items: center; justify-content: center; gap: 10px 18px; flex-wrap: wrap; margin-top: 30px; font-size: 14px; color: var(--ink-2); }
.md-trust b { color: var(--ink); font-weight: 600; }
.md-faces { display: flex; }
.md-faces img { width: 32px; height: 32px; border-radius: 50%; object-fit: cover; border: 2px solid var(--bg); margin-left: -9px; }
.md-faces img:first-child { margin-left: 0; }
.md-trust-rate { display: inline-flex; align-items: center; gap: 5px; }
.md-trust-rate svg { color: var(--a-t); }
.md-trust-stat { padding-left: 18px; border-left: 1px solid var(--line-2); }

.md-stage { margin-top: 64px; max-width: 1100px; }
.md-frame { border-radius: 28px; padding: 8px; position: relative;
  background: linear-gradient(var(--bg-2), var(--bg-2)) padding-box, linear-gradient(140deg, color-mix(in oklab, var(--p) 80%, #fff), transparent 35%, transparent 65%, color-mix(in oklab, var(--a) 70%, #fff)) border-box;
  border: 1px solid transparent; box-shadow: 0 60px 140px -50px color-mix(in oklab, var(--p) 70%, transparent), 0 30px 60px -30px rgba(0,0,0,.9); }
.md-frame-bar { display: flex; align-items: center; gap: 7px; padding: 8px 10px 14px; }
.md-frame-bar i { width: 10px; height: 10px; border-radius: 50%; background: var(--line-2); }
.md-frame-bar span { margin: 0 auto; transform: translateX(-24px); font-size: 12.5px; color: var(--ink-3); padding: 4px 16px; border-radius: 999px; background: var(--card-2); }
.md-frame-media { border-radius: 20px; overflow: hidden; aspect-ratio: 16 / 8; background: var(--card); }
.md-frame-media img { width: 100%; height: 100%; object-fit: cover; }
.md-frame-ph { width: 100%; height: 100%; min-height: 200px; display: grid; place-items: center; color: var(--p-t);
  background: radial-gradient(circle at 30% 30%, color-mix(in oklab, var(--p) 40%, transparent), transparent 60%), radial-gradient(circle at 70% 70%, color-mix(in oklab, var(--a) 30%, transparent), transparent 60%); }
.md-chip { position: absolute; display: flex; align-items: center; gap: 12px; padding: 14px 18px; border-radius: 20px; background: rgba(16,19,30,.78); border: 1px solid var(--line-2);
  -webkit-backdrop-filter: blur(14px); backdrop-filter: blur(14px); box-shadow: 0 24px 50px -20px rgba(0,0,0,.85); animation: md-float 7s ease-in-out infinite alternate; }
.md-chip strong { display: block; font-family: var(--display); font-weight: 600; font-size: 22px; line-height: 1.1; letter-spacing: -0.02em; }
.md-chip small { display: block; font-size: 12.5px; color: var(--ink-2); }
.md-chip-a { left: 0; /* the stage has 24px side padding, so the chip still hangs past the frame but never off-screen */ top: 28%; }
.md-chip-b { right: 0; bottom: 14%; flex-direction: column; align-items: flex-start; gap: 0; animation-delay: -3.5s; }
.md-chip-b strong { font-size: 30px; }
.md-chip-ic { width: 40px; height: 40px; border-radius: 13px; display: grid; place-items: center; background: var(--grad); color: #0b0c12; }
@keyframes md-float { to { transform: translateY(-10px); } }

.md-ticker { margin-top: 72px; border-block: 1px solid var(--line); padding: 20px 0; overflow: hidden;
  -webkit-mask-image: linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent); mask-image: linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent); }
.md-ticker-track { display: flex; width: max-content; animation: md-marquee 48s linear infinite; }
.md-ticker-set { display: flex; }
.md-ticker-set > span { display: inline-flex; align-items: center; gap: 28px; padding-right: 28px; font-family: var(--display); font-size: 20px; font-weight: 500; letter-spacing: -0.01em; color: var(--ink-2); white-space: nowrap; }
.md-ticker-set svg { color: var(--a-t); }
@keyframes md-marquee { to { transform: translateX(-50%); } }

/* Stats */
.md-stats { display: grid; grid-template-columns: repeat(var(--n), minmax(0, 1fr)); gap: 14px; }
.md-stat { padding: 30px 26px; }
.md-stat::before { content: ""; position: absolute; left: 26px; right: 26px; top: 0; height: 1px; background: linear-gradient(90deg, transparent, var(--p-t), transparent); opacity: .7; }
.md-stat strong { display: block; font-family: var(--display); font-weight: 600; font-size: clamp(2.4rem, 5cqi, 3.6rem); line-height: 1; letter-spacing: -0.04em; font-variant-numeric: tabular-nums; }
.md-stat > span { display: block; margin-top: 10px; color: var(--ink-2); font-size: 14.5px; }

/* About bento */
.md-about { display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); grid-auto-rows: minmax(0, auto); gap: 14px; }
.md-about-photo { grid-column: span 5; grid-row: span 2; min-height: 420px; }
.md-about-photo img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.md-about-story { grid-column: span 7; padding: 40px; }
.md-about-story .md-lead { margin-bottom: 20px; }
.md-about-badge { grid-column: span 3; padding: 28px; display: flex; flex-direction: column; justify-content: flex-end; min-height: 200px; }
.md-about-badge img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; opacity: .38; }
.md-about-badge.has-photo::after { content: ""; position: absolute; inset: 0; background: linear-gradient(to top, var(--bg-2) 10%, transparent); }
.md-about-badge strong, .md-about-badge span { position: relative; z-index: 1; }
.md-about-badge strong { font-family: var(--display); font-weight: 600; font-size: clamp(3rem, 6cqi, 4.4rem); line-height: 1; letter-spacing: -0.05em; }
.md-about-badge span { color: var(--ink-2); font-size: 14px; margin-top: 6px; }
.md-about-points { grid-column: span 4; padding: 28px; }
.md-about-points ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 14px; }
.md-about-points li { display: flex; gap: 12px; align-items: flex-start; font-size: 15px; }
.md-about-points li > span { width: 22px; height: 22px; border-radius: 7px; display: grid; place-items: center; flex-shrink: 0; margin-top: 1px; background: color-mix(in oklab, var(--a) 22%, transparent); color: var(--a-t); }
.md-about-badge:not(:has(~ .md-about-points)) { grid-column: span 7; }
.md-about-story + .md-about-points { grid-column: span 7; }
.md-about.no-image > * { grid-column: span 12; }
.md-about.no-image .md-about-badge, .md-about.no-image .md-about-points { grid-column: span 6; }

/* Programs */
.md-programs { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
.md-program { display: flex; flex-direction: column; padding: 8px; }
.md-program-img { position: relative; aspect-ratio: 4 / 3; border-radius: 18px; overflow: hidden; background: var(--card-2); }
.md-program-img img { width: 100%; height: 100%; object-fit: cover; transition: transform .7s var(--ease); }
.md-tag { position: absolute; left: 12px; top: 12px; padding: 6px 12px; border-radius: 999px; font-size: 12.5px; font-weight: 600; color: #fff;
  background: rgba(10,12,20,.55); border: 1px solid rgba(255,255,255,.2); -webkit-backdrop-filter: blur(10px); backdrop-filter: blur(10px); }
.md-program-no { position: absolute; right: 14px; bottom: 6px; font-family: var(--display); font-weight: 700; font-size: 54px; line-height: 1; letter-spacing: -0.05em; color: rgba(255,255,255,.9);
  text-shadow: 0 6px 30px rgba(0,0,0,.6); }
.md-program-body { padding: 18px 14px 12px; display: flex; flex-direction: column; flex: 1; }
.md-program-body h3 { font-family: var(--display); font-weight: 600; font-size: 21px; letter-spacing: -0.02em; margin: 0 0 8px; }
.md-program-body p { color: var(--ink-2); font-size: 14.5px; margin: 0 0 18px; }
.md-program-foot { margin-top: auto; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding-top: 14px; border-top: 1px solid var(--line); }
.md-program-meta { display: flex; flex-direction: column; gap: 3px; font-size: 13px; color: var(--ink-3); }
.md-program-meta span { display: inline-flex; align-items: center; gap: 6px; }
.md-program-meta b { font-size: 15px; color: var(--ink); font-weight: 600; }

/* Why-us bento */
.md-bento { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; grid-auto-flow: dense; }
.md-feature { padding: 30px 28px 28px; min-height: 230px; display: flex; flex-direction: column; }
.md-feature.is-wide { grid-column: span 2; background: radial-gradient(120% 140% at 0% 0%, color-mix(in oklab, var(--p) 24%, transparent), transparent 55%), var(--card); }
.md-feature-ic { width: 46px; height: 46px; border-radius: 15px; display: grid; place-items: center; color: var(--p-t); margin-bottom: auto;
  background: color-mix(in oklab, var(--p) 16%, transparent); border: 1px solid color-mix(in oklab, var(--p) 35%, transparent); }
.md-feature.is-wide .md-feature-ic { background: var(--grad); color: #0b0c12; border-color: transparent; }
.md-feature h3 { font-family: var(--display); font-weight: 600; font-size: 20px; letter-spacing: -0.02em; margin: 28px 0 8px; }
.md-feature p { color: var(--ink-2); font-size: 14.5px; margin: 0; max-width: 46ch; }
.md-feature-no { position: absolute; right: 22px; top: 18px; font-family: var(--display); font-size: 13px; font-weight: 600; color: var(--ink-3); letter-spacing: .04em; }

/* Teachers */
.md-teachers { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; }
.md-teacher { padding: 8px; }
.md-teacher-photo { position: relative; aspect-ratio: 4 / 5; border-radius: 18px; overflow: hidden; background: var(--card-2); }
.md-teacher-photo img { width: 100%; height: 100%; object-fit: cover; transition: transform .7s var(--ease); }
.md-teacher-photo > span { position: absolute; inset: 0; display: grid; place-items: center; font-family: var(--display); font-size: 64px; font-weight: 600; color: var(--p-t); }
.md-teacher-name { position: absolute; left: 0; right: 0; bottom: 0; padding: 40px 16px 14px; background: linear-gradient(to top, rgba(7,8,13,.92), transparent); }
.md-teacher-name h3 { font-family: var(--display); font-weight: 600; font-size: 18px; margin: 0; letter-spacing: -0.01em; }
.md-teacher-name small { font-size: 12.5px; color: var(--a-t); font-weight: 500; }
.md-teacher > p { color: var(--ink-2); font-size: 14px; margin: 0; padding: 14px 10px 8px; }

/* Testimonials — the featured review is a tall card beside the others */
.md-quotes { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; align-items: start; grid-auto-flow: dense; }
.md-quote { margin: 0; padding: 28px; }
.md-quote.is-feature { grid-row: span 2; align-self: stretch; display: flex; flex-direction: column; padding: 36px;
  background: linear-gradient(var(--bg-2), var(--bg-2)) padding-box, linear-gradient(140deg, var(--p-t), transparent 45%, var(--a-t)) border-box; border: 1px solid transparent;
  box-shadow: 0 30px 80px -40px var(--p); }
.md-quote.is-feature blockquote { font-family: var(--display); font-size: clamp(1.3rem, 2.3cqi, 1.65rem); line-height: 1.35; letter-spacing: -0.015em; color: var(--ink); margin-bottom: auto; padding-bottom: 28px; }
.md-stars { display: flex; gap: 3px; color: var(--a-t); margin-bottom: 16px; }
.md-stars .off { color: var(--line-2); }
.md-quote blockquote { margin: 0 0 22px; font-size: 15.5px; color: var(--ink); line-height: 1.65; }
.md-quote figcaption { display: flex; align-items: center; gap: 12px; }
.md-quote figcaption img, .md-av { width: 42px; height: 42px; border-radius: 50%; object-fit: cover; flex-shrink: 0; }
.md-av { display: grid; place-items: center; background: var(--grad); color: #0b0c12; font-weight: 700; }
.md-quote strong { display: block; font-size: 14.5px; }
.md-quote small { color: var(--ink-3); font-size: 13px; }

/* Gallery bento */
.md-gallery { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); grid-auto-rows: 220px; gap: 14px; }
.md-gallery-item { position: relative; border: 0; padding: 0; border-radius: 22px; overflow: hidden; cursor: zoom-in; background: var(--card); touch-action: manipulation; }
.md-gallery-item:first-child { grid-column: span 2; grid-row: span 2; }
.md-gallery-item img { width: 100%; height: 100%; object-fit: cover; transition: transform .7s var(--ease); }
.md-gallery-item span { position: absolute; left: 12px; bottom: 12px; padding: 6px 12px; border-radius: 999px; font-size: 13px; color: #fff;
  background: rgba(10,12,20,.6); -webkit-backdrop-filter: blur(10px); backdrop-filter: blur(10px); }
.md-gallery-item:active img { transform: scale(.98); }
.md-lightbox { position: fixed; inset: 0; z-index: 200; background: rgba(4,5,9,.92); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; padding: 24px;
  animation: md-fade .2s ease; overscroll-behavior: contain; }
.md-lightbox img { max-width: min(1100px, 100%); max-height: 80vh; border-radius: 18px; object-fit: contain; animation: md-pop .3s var(--ease); }
.md-lightbox p { color: var(--ink-2); margin: 0; }
.md-lightbox-btn { position: absolute; width: 46px; height: 46px; border-radius: 50%; border: 1px solid var(--line-2); background: rgba(255,255,255,.08); color: #fff; display: grid; place-items: center; cursor: pointer; }
.md-lightbox-btn.close { top: 18px; right: 18px; }
.md-lightbox-btn.prev { left: 18px; top: 50%; transform: translateY(-50%) rotate(90deg); }
.md-lightbox-btn.next { right: 18px; top: 50%; transform: translateY(-50%) rotate(-90deg); }
@keyframes md-fade { from { opacity: 0; } }

/* Enrolment banner */
.md-banner { position: relative; overflow: hidden; border-radius: 32px; padding: 88px 40px; text-align: center; isolation: isolate;
  background: radial-gradient(80% 120% at 0% 0%, color-mix(in oklab, var(--a) 55%, transparent), transparent 60%), linear-gradient(135deg, var(--p), color-mix(in oklab, var(--p) 55%, #05060a)); }
.md-banner::after { content: ""; position: absolute; inset: 0; z-index: -1; background-image: radial-gradient(rgba(255,255,255,.22) 1px, transparent 1px); background-size: 22px 22px;
  -webkit-mask-image: radial-gradient(ellipse at center, #000, transparent 70%); mask-image: radial-gradient(ellipse at center, #000, transparent 70%); opacity: .5; }
.md-banner-img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; z-index: -2; opacity: .22; mix-blend-mode: luminosity; }
.md-banner-in { max-width: 720px; margin: 0 auto; color: #fff; }
.md-banner h2 { font-family: var(--display); font-weight: 600; font-size: clamp(2.2rem, 5.4cqi, 3.8rem); line-height: 1.02; letter-spacing: -0.04em; margin: 22px 0 16px; text-wrap: balance; }
.md-banner p { font-size: 1.08rem; color: rgba(255,255,255,.82); margin: 0 0 32px; }

/* FAQ */
.md-faq { display: grid; grid-template-columns: minmax(0, .9fr) minmax(0, 1.3fr); gap: 56px; align-items: start; }
.md-faq-list { display: grid; gap: 10px; }
.md-faq-item { border: 1px solid var(--line); border-radius: 20px; background: var(--card); transition: border-color .25s ease, background-color .25s ease; }
.md-faq-item[open] { border-color: color-mix(in oklab, var(--p) 45%, transparent); background: color-mix(in oklab, var(--p) 8%, transparent); }
.md-faq-item summary { list-style: none; cursor: pointer; display: flex; justify-content: space-between; align-items: center; gap: 16px; padding: 20px 22px; font-weight: 600; font-size: 16px; touch-action: manipulation; user-select: none; }
.md-faq-item summary::-webkit-details-marker { display: none; }
.md-faq-plus { width: 32px; height: 32px; border-radius: 50%; display: grid; place-items: center; flex-shrink: 0; background: var(--card-2); transition: transform .3s var(--ease), background-color .2s ease, color .2s ease; }
.md-faq-item[open] .md-faq-plus { transform: rotate(45deg); background: var(--p); color: var(--p-on); }
.md-faq-item p { margin: 0; padding: 0 22px 22px; color: var(--ink-2); font-size: 15px; }

/* Contact */
.md-contacts { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; }
.md-contact { padding: 26px; display: flex; flex-direction: column; gap: 4px; min-height: 190px; }
.md-contact-ic { width: 44px; height: 44px; border-radius: 14px; display: grid; place-items: center; margin-bottom: auto; background: color-mix(in oklab, var(--a) 18%, transparent); color: var(--a-t); }
.md-contact small { margin-top: 24px; color: var(--ink-3); font-size: 12.5px; text-transform: uppercase; letter-spacing: .12em; font-weight: 600; }
.md-contact strong { font-weight: 500; font-size: 15.5px; overflow-wrap: anywhere; }
.md-contact-go { position: absolute; right: 20px; top: 22px; width: 34px; height: 34px; border-radius: 50%; display: grid; place-items: center; border: 1px solid var(--line-2); color: var(--ink-2);
  transform: rotate(-45deg); transition: transform .3s var(--ease), background-color .2s ease, color .2s ease; }
.md-contact:active { transform: scale(.98); }
.md-socials { display: flex; justify-content: center; gap: 8px; flex-wrap: wrap; margin-top: 28px; }

/* Footer */
.md-footer { border-top: 1px solid var(--line); padding: 72px 0 0; overflow: hidden; background: linear-gradient(to bottom, transparent, color-mix(in oklab, var(--p) 10%, transparent)); }
.md-footer-grid { display: grid; grid-template-columns: minmax(0, 1.6fr) repeat(3, minmax(0, 1fr)); gap: 40px; }
.md-footer-grid > div:first-child p { color: var(--ink-2); font-size: 14.5px; max-width: 340px; margin: 16px 0 18px; }
.md-footer h4 { font-size: 12.5px; text-transform: uppercase; letter-spacing: .14em; color: var(--ink-3); font-weight: 600; margin: 6px 0 16px; }
.md-footer-grid > div:not(:first-child) { display: flex; flex-direction: column; gap: 10px; font-size: 14.5px; color: var(--ink-2); }
.md-footer-grid a { transition: color .2s ease; overflow-wrap: anywhere; }
.md-footer-socials { display: flex; gap: 8px; }
.md-footer-socials a { width: 38px; height: 38px; border-radius: 50%; display: grid; place-items: center; border: 1px solid var(--line-2); color: var(--ink-2); transition: color .2s ease, border-color .2s ease; }
.md-wordmark { font-family: var(--display); font-weight: 700; font-size: min(13rem, 15cqi, calc(176cqi / var(--len))); line-height: .9; letter-spacing: -0.06em; text-align: center; white-space: nowrap;
  margin: 64px 0 -0.12em; padding: 0 12px; background: linear-gradient(to bottom, color-mix(in oklab, var(--p-t) 55%, transparent), transparent 85%); -webkit-background-clip: text; background-clip: text; color: transparent;
  overflow: hidden; text-overflow: clip; user-select: none; }
.md-footer-bottom { display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; padding: 22px 24px 28px; border-top: 1px solid var(--line); font-size: 13px; color: var(--ink-3); }
.md-footer-bottom em { font-style: normal; }

/* Hover — only for real pointers, so taps never leave a stuck state */
@media (hover: hover) and (pointer: fine) {
  .md-btn-primary:hover { box-shadow: 0 16px 50px -10px var(--p), inset 0 1px 0 rgba(255,255,255,.3); transform: translateY(-1px); }
  .md-btn-ghost:hover { border-color: var(--line-2); background: rgba(255,255,255,.09); }
  .md-btn-white:hover { background: #f1f2f6; }
  .md-btn:hover .md-btn-arrow { transform: translateX(3px); }
  .md-btn:active { transform: scale(.97); }
  .md-nav a:hover { color: var(--ink); background: var(--card-2); }
  .md-login-menu a:hover { background: var(--card-2); }
  .md-link:hover svg { transform: translateX(4px); }
  .md-card:hover { border-color: var(--line-2); }
  .md-program:hover, .md-teacher:hover, .md-feature:hover { transform: translateY(-4px); }
  .md-program:hover .md-program-img img, .md-teacher:hover .md-teacher-photo img, .md-gallery-item:hover img { transform: scale(1.05); }
  .md-program:hover .md-round { background: var(--p); border-color: var(--p); color: var(--p-on); }
  .md-contact:hover .md-contact-go { transform: none; background: var(--p); border-color: var(--p); color: var(--p-on); }
  .md-faq-item:not([open]):hover { border-color: var(--line-2); }
  .md-faq-item summary:hover .md-faq-plus { background: rgba(255,255,255,.12); }
  .md-footer-grid a:hover, .md-footer-socials a:hover { color: var(--ink); }
  .md-ticker:hover .md-ticker-track { animation-play-state: paused; }
}

/* Entrance + scroll reveal (opacity and transform only — cheap to animate) */
.md-rise { animation: md-rise .9s var(--ease) both; }
.md-d1 { animation-delay: .08s; } .md-d2 { animation-delay: .16s; } .md-d3 { animation-delay: .24s; } .md-d4 { animation-delay: .32s; }
@keyframes md-rise { from { opacity: 0; transform: translateY(18px); } }
.md-anim .md-reveal { opacity: 0; transform: translateY(22px); transition: opacity .8s var(--ease), transform .8s var(--ease), border-color .35s ease, background-color .35s ease; }
.md-anim .md-reveal.in { opacity: 1; transform: none; }
@media (prefers-reduced-motion: reduce) {
  .md-rise, .md-glow, .md-chip, .md-live::after, .md-login-menu, .md-sheet, .md-lightbox, .md-lightbox img { animation: none !important; }
  .md-ticker-track { animation: none; flex-wrap: wrap; width: auto; justify-content: center; }
  .md-ticker-set[aria-hidden="true"] { display: none; }
  .md-ticker-set { flex-wrap: wrap; justify-content: center; row-gap: 10px; }
  .md-anim .md-reveal { opacity: 1; transform: none; transition: none; }
  .md-card, .md-btn, .md-program-img img, .md-teacher-photo img, .md-gallery-item img { transition: none; }
}

/* Tablet */
@container (max-width: 1020px) {
  .md-nav { display: none; }
  .md-actions { margin-left: auto !important; }
  .md-burger { display: grid; }
  .md-head { grid-template-columns: 1fr; gap: 0; }
  .md-head .md-lead { margin-top: 16px; }
  .md-about-photo { grid-column: span 12; grid-row: auto; min-height: 340px; }
  .md-about-story { grid-column: span 12; }
  .md-about-badge, .md-about-points, .md-about-story + .md-about-points, .md-about-badge:not(:has(~ .md-about-points)) { grid-column: span 6; }
  .md-programs { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .md-bento { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .md-feature.is-wide { grid-column: span 2; }
  .md-teachers { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .md-quotes { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .md-quote.is-feature { grid-column: 1 / -1; grid-row: auto; }
  .md-gallery { grid-template-columns: repeat(3, minmax(0, 1fr)); grid-auto-rows: 190px; }
  .md-faq { grid-template-columns: 1fr; gap: 28px; }
  .md-contacts { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .md-footer-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .md-chip-a { left: 8px; } .md-chip-b { right: 8px; }
}

/* Phone */
@container (max-width: 640px) {
  .md-login { display: none; }   /* phone: the menu sheet has all three logins — the name gets the room */
  .md-brand-name { max-width: none; }
  .md-wrap { padding: 0 16px; }
  .md-section { padding: 76px 0; }
  .md-section-tight { padding: 24px 0; }
  .md-hide-sm { display: none !important; }
  .md-brand-name { font-size: 15.5px; }
  .md-hero { padding-top: 116px; }
  .md-hero h1 { font-size: clamp(2.35rem, 11.5cqi, 3.2rem); margin: 22px auto 18px; }
  .md-ctas .md-btn { width: 100%; }
  .md-trust-stat { padding-left: 0; border-left: 0; }
  .md-stage { margin-top: 44px; }
  .md-frame { border-radius: 22px; padding: 6px; }
  .md-frame-bar { padding: 6px 8px 10px; }
  .md-frame-bar span { display: none; }
  .md-frame-media { aspect-ratio: 4 / 3.4; border-radius: 16px; }
  .md-chip { padding: 10px 12px; border-radius: 16px; gap: 10px; }
  .md-chip strong { font-size: 17px; } .md-chip-b strong { font-size: 22px; }
  .md-chip small { font-size: 11.5px; }
  .md-chip-ic { width: 32px; height: 32px; border-radius: 10px; }
  .md-chip-a { top: auto; bottom: -18px; left: 14px; }
  .md-chip-b { top: 52px; bottom: auto; right: 14px; }
  .md-ticker { margin-top: 56px; padding: 16px 0; }
  .md-ticker-set > span { font-size: 17px; gap: 20px; padding-right: 20px; }
  .md-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
  .md-stat { padding: 22px 18px; }
  .md-stat::before { left: 18px; right: 18px; }
  .md-about > *, .md-about .md-about-badge, .md-about .md-about-points, .md-about .md-about-story + .md-about-points, .md-about .md-about-badge:not(:has(~ .md-about-points)) { grid-column: span 12; }
  .md-about-photo { min-height: 280px; }
  .md-about-story { padding: 28px 22px; }
  /* programs become a native swipe row with snap points */
  .md-programs { display: flex; gap: 12px; overflow-x: auto; scroll-snap-type: x mandatory; margin: 0 -16px; padding: 0 16px 6px; scroll-padding: 0 16px;
    overscroll-behavior-x: contain; scrollbar-width: none; }
  .md-programs::-webkit-scrollbar { display: none; }
  .md-program { flex: 0 0 84%; scroll-snap-align: start; }
  .md-bento { grid-template-columns: 1fr; }
  .md-feature, .md-feature.is-wide { grid-column: auto; min-height: 0; }
  .md-feature h3 { margin-top: 22px; }
  .md-teachers { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
  .md-teacher-name { padding: 30px 12px 10px; }
  .md-teacher-name h3 { font-size: 15.5px; }
  .md-teacher > p { font-size: 13.5px; padding: 10px 6px 6px; }
  .md-quotes { grid-template-columns: 1fr; gap: 10px; }
  .md-quote, .md-quote.is-feature { padding: 22px; }
  .md-gallery { grid-template-columns: repeat(2, minmax(0, 1fr)); grid-auto-rows: 150px; gap: 10px; }
  .md-banner { padding: 60px 22px; border-radius: 26px; }
  .md-banner .md-btn { width: 100%; }
  .md-faq-item summary { padding: 18px; font-size: 15.5px; }
  .md-faq-item p { padding: 0 18px 18px; }
  .md-contacts { grid-template-columns: 1fr; gap: 10px; }
  .md-contact { min-height: 0; }
  .md-footer-grid { grid-template-columns: 1fr 1fr; gap: 28px; }
  .md-footer-grid > div:first-child { grid-column: 1 / -1; }
  .md-footer-bottom { padding: 18px 16px 24px; }
  .md-lightbox-btn.prev, .md-lightbox-btn.next { top: auto; bottom: 22px; }
}
`;
