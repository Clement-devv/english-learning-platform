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
import { onColor, on, items, CountUp, Icon, useReveal, useScrolledIn, useDocTitle, useDocLang, splitHeadline } from './shared.jsx';
import { siteText, siteFont, SiteTextCtx, useSiteText } from '../siteText.js';

const SERIF = "'Playfair Display', Georgia, 'Times New Roman', serif";

export default function ClassicTemplate({ center, lp }) {
  const D = resolveDesign(lp.design);
  const rootRef = useRef(null);
  useReveal(rootRef, 'ct');
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
    { label: T.home, href: '#home' },
    showAbout && { label: T.about, href: '#about' },
    programs.length > 0 && { label: lp.programs?.navLabel || T.programs, href: '#programs' },
    teachers.length > 0 && { label: T.teachers, href: '#teachers' },
    testimonials.length > 0 && { label: T.reviews, href: '#testimonials' },
    faq.length > 0 && { label: T.faq, href: '#faq' },
    showContact && { label: T.contact, href: '#contact' },
  ].filter(Boolean);

  const vars = {
    '--p': D.primary, '--p-dark': adjustHex(D.primary, -45), '--p-deep': `color-mix(in srgb, ${D.primary} 30%, #0b1120)`,
    '--p-on': onColor(D.primary), '--a': D.accent, '--a-on': onColor(D.accent),
    '--soft': `${D.primary}0d`, '--font': siteFont(D, T.lang), '--serif': SERIF,
  };

  return (
    <SiteTextCtx.Provider value={T}>
    <div ref={rootRef} className="ct" style={vars} lang={T.lang}>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700;800&display=swap" />
      <style>{CSS}</style>

      {lp.topBar?.enabled && (lp.topBar.text || lp.contact?.phone || lp.contact?.email) && (
        <TopBar text={lp.topBar.text} contact={lp.contact} links={lp.links} />
      )}
      <Header center={center} nav={nav} urls={urls} cta={{ text: lp.hero?.ctaText || T.enroll, url: lp.hero?.ctaUrl || urls.student }} />
      <Hero center={center} lp={lp} D={D} highlights={features.slice(0, 3)} stats={stats} testimonials={testimonials} />
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
    </SiteTextCtx.Provider>
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
    <header className={`ct-header${scrolled ? ' is-scrolled' : ''}`}>
      <div className="ct-wrap ct-header-in">
        <a href="#home" className="ct-brand" aria-label={center.centerName}>
          {center.logo
            ? <img src={center.logo} alt="" />
            : <span className="ct-mark" aria-hidden>{center.centerName.charAt(0).toUpperCase()}</span>}
          <span className="ct-brand-name">{center.centerName}</span>
        </a>

        <nav className="ct-nav" aria-label={T.mainNav}>
          {/* the logo already links home, so the header menu skips Home */}
          {nav.filter(l => l.href !== '#home').map(l => <a key={l.href} href={l.href}>{l.label}</a>)}
        </nav>

        <div className="ct-header-actions">
          <div className="ct-login" onClick={e => e.stopPropagation()}>
            <button type="button" className="ct-btn ct-btn-ghost" onClick={() => setLogin(v => !v)} aria-expanded={login}>
              {T.login} <Icon name="chevron" size={14} />
            </button>
            {login && (
              <div className="ct-login-menu" role="menu">
                {[[T.studentLogin, T.hintStudent, urls.student, 'cap'], [T.teacherLogin, T.hintTeacher, urls.teacher, 'board'], [T.parentLogin, T.hintParent, urls.parent, 'users']].map(([who, hint, href, ic]) => (
                  <a key={href} href={href} role="menuitem">
                    <span className="ct-login-ic"><Icon name={ic} size={16} /></span>
                    <span><strong>{who}</strong><small>{hint}</small></span>
                  </a>
                ))}
                <a href={urls.admin} className="ct-login-admin" role="menuitem">{T.adminLogin}</a>
              </div>
            )}
          </div>
          <a href={cta.url} className="ct-btn ct-btn-accent ct-hide-sm">{cta.text}</a>
          <button type="button" className="ct-burger" aria-label={T.menu} aria-expanded={menu} onClick={() => setMenu(v => !v)}>
            <Icon name={menu ? 'close' : 'menu'} size={22} />
          </button>
        </div>
      </div>

      {menu && (
        <div className="ct-mobile-menu">
          {nav.map(l => <a key={l.href} href={l.href} onClick={() => setMenu(false)}>{l.label}</a>)}
          <hr />
          <a href={urls.student}>{T.studentLogin}</a>
          <a href={urls.teacher}>{T.teacherLogin}</a>
          <a href={urls.parent}>{T.parentLogin}</a>
          <a href={cta.url} className="ct-btn ct-btn-accent" style={{ marginTop: 8, justifyContent: 'center' }}>{cta.text}</a>
        </div>
      )}
    </header>
  );
}

/* ── Hero ────────────────────────────────────────────────────────────────── */
// The headline's longest word gets the classic treatment: italic, accent colour and a
// hand-drawn underline ("Speak English with *confidence* — …").
function Hero({ center, lp, D, highlights, stats, testimonials }) {
  const T = useSiteText();
  const h = lp.hero || {};
  const image = h.image || (D.heroStyle === 'image' ? D.heroImage : null) || D.heroImage;
  const headline = h.headline || T.heroHeadline(center.centerName);
  const sub = h.subheadline || center.description || T.heroSub;
  const [before, word, after] = splitHeadline(headline);
  const trust = stats[0];
  const faces = testimonials.filter(t => t.photo).slice(0, 3);
  const rating = testimonials.length ? (testimonials.reduce((s, t) => s + (t.rating || 5), 0) / testimonials.length) : null;
  return (
    <section id="home" className={`ct-hero${image ? ' has-image' : ''}${highlights.length ? ' has-hl' : ''}`}>
      <div className="ct-hero-paper" aria-hidden>
        <span className="ct-hero-monogram">{center.centerName.charAt(0).toUpperCase()}</span>
      </div>
      <div className="ct-wrap ct-hero-in">
        <div className="ct-hero-copy">
          {h.badge && <span className="ct-hero-badge ct-rise"><Ornament />{h.badge}</span>}
          <h1 className="ct-rise ct-d1">
            {before}{before && ' '}
            {word && <em className="ct-swash">{word}<svg viewBox="0 0 200 18" preserveAspectRatio="none" aria-hidden><path d="M3 13 C 50 3, 120 3, 197 9" /></svg></em>}
            {after && ' '}{after}
          </h1>
          <p className="ct-rise ct-d2">{sub}</p>
          <div className="ct-hero-ctas ct-rise ct-d3">
            <a href={h.ctaUrl || '/student/login'} className="ct-btn ct-btn-accent ct-btn-lg">{h.ctaText || T.enroll} <Icon name="arrow" size={16} /></a>
            {h.secondaryCtaText && <a href={h.secondaryCtaUrl || '#about'} className="ct-btn ct-btn-outline ct-btn-lg">{h.secondaryCtaText}</a>}
          </div>
          {(trust || faces.length > 0) && (
            <div className="ct-hero-trust ct-rise ct-d4">
              {faces.length > 0 && <span className="ct-faces">{faces.map((t, i) => <img key={i} src={t.photo} alt="" />)}</span>}
              <span>
                {rating && <span className="ct-trust-stars" aria-label={T.rated(rating.toFixed(1))}>{Array.from({ length: 5 }, (_, s) => <Icon key={s} name="star-fill" size={13} />)} <b>{rating.toFixed(1)}</b></span>}
                {trust && <small><b>{trust.value}</b> {trust.label.toLowerCase()}</small>}
              </span>
            </div>
          )}
        </div>

        <div className="ct-hero-art ct-rise ct-d2" aria-hidden={!image}>
          <div className="ct-arch-outline" />
          <div className="ct-arch">
            {image ? <img src={image} alt="" fetchpriority="high" /> : <div className="ct-arch-fill"><Icon name="cap" size={72} /></div>}
          </div>
          {stats[2] && (
            <div className="ct-float ct-float-a">
              <strong>{stats[2].value}</strong><span>{stats[2].label}</span>
            </div>
          )}
          {stats[1] && (
            <div className="ct-float ct-float-b">
              <span className="ct-float-ic"><Icon name="award" size={18} /></span>
              <span><strong>{stats[1].value}</strong><small>{stats[1].label}</small></span>
            </div>
          )}
          <svg className="ct-hero-sparkle" viewBox="0 0 24 24" aria-hidden><path d="M12 0 L14 10 L24 12 L14 14 L12 24 L10 14 L0 12 L10 10 Z" /></svg>
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
          <div key={i} className="ct-stat ct-reveal" style={{ transitionDelay: `${i * 80}ms` }}>
            <strong><CountUp value={s.value} /></strong>
            <span>{s.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ── About ───────────────────────────────────────────────────────────────── */
function About({ about, cta }) {
  const T = useSiteText();
  const badgeLabel = about.badgeLabel || T.yearsExp;
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
              <div className="ct-about-badge" aria-label={`${about.badgeValue} ${badgeLabel}`}>
                {/* circular seal: label runs round the ring, the number sits in the middle */}
                <svg className="ct-seal-ring" viewBox="0 0 120 120" aria-hidden>
                  <defs><path id="ct-seal-path" d="M60,60 m-46,0 a46,46 0 1,1 92,0 a46,46 0 1,1 -92,0" /></defs>
                  <text><textPath href="#ct-seal-path" startOffset="0">{`${badgeLabel.toUpperCase()} • ${badgeLabel.toUpperCase()} • `}</textPath></text>
                </svg>
                <strong>{about.badgeValue}</strong>
              </div>
            )}
          </div>
        )}
        <div className="ct-reveal">
          <Eyebrow>{about.subtitle || T.aboutUs}</Eyebrow>
          <h2 className="ct-h2">{about.title || T.aboutTitle}</h2>
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
  const T = useSiteText();
  return (
    <section id="programs" className="ct-section ct-tinted">
      <div className="ct-wrap">
        <SectionHead eyebrow={T.ourPrograms} title={sec.title || T.programsTitle} subtitle={sec.subtitle} />
        <div className="ct-grid ct-grid-3">
          {list.map((p, i) => (
            <article key={i} className="ct-card ct-program ct-reveal" style={{ transitionDelay: `${(i % 3) * 80}ms` }}>
              <div className="ct-program-img">
                {p.image ? <img src={p.image} alt="" loading="lazy" /> : <div className="ct-program-ph"><Icon name="book" size={40} /></div>}
                {p.level && <span className="ct-chip">{p.level}</span>}
              </div>
              <div className="ct-program-body">
                <span className="ct-program-no">{T.programNo(String(i + 1).padStart(2, '0'))}</span>
                <h3>{p.title}</h3>
                {p.text && <p>{p.text}</p>}
                {(p.duration || p.price) && (
                  <div className="ct-program-meta">
                    {p.duration && <span><Icon name="clock" size={14} /> {p.duration}</span>}
                    {p.price && <span className="ct-price">{p.price}</span>}
                  </div>
                )}
                <a href={p.ctaUrl || '#contact'} className="ct-link">{p.ctaText || T.learnMore} <Icon name="arrow" size={14} /></a>
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
  const T = useSiteText();
  return (
    <section className="ct-section">
      <div className="ct-wrap">
        <SectionHead eyebrow={T.whyUs} title={sec.title || T.featuresTitle} subtitle={sec.subtitle} />
        {/* editorial numbered list — 01, 02, 03 … in large outlined serif numerals */}
        <ol className="ct-features">
          {list.map((f, i) => (
            <li key={i} className="ct-feature ct-reveal" style={{ transitionDelay: `${(i % 3) * 80}ms` }}>
              <span className="ct-feature-num" aria-hidden>{String(i + 1).padStart(2, '0')}</span>
              <div>
                <h3><span className="ct-feature-ic"><Icon name={f.icon || 'star'} size={18} /></span>{f.title}</h3>
                {f.text && <p>{f.text}</p>}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ── Teachers ────────────────────────────────────────────────────────────── */
function Teachers({ list }) {
  const T = useSiteText();
  return (
    <section id="teachers" className="ct-section ct-tinted">
      <div className="ct-wrap">
        <SectionHead eyebrow={T.ourTeachers} title={T.teachersTitle} />
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
  const T = useSiteText();
  return (
    <section id="testimonials" className="ct-section">
      <div className="ct-wrap">
        <SectionHead eyebrow={T.testimonials} title={sec.title || T.testimonialsTitle} subtitle={sec.subtitle} />
        <div className={`ct-quotes${list.length >= 3 ? ' has-feature' : ''}`}>
          {list.map((t, i) => (
            <figure key={i} className={`ct-card ct-quote ct-reveal${i === 0 && list.length >= 3 ? ' is-feature' : ''}`} style={{ transitionDelay: `${(i % 3) * 80}ms` }}>
              <span className="ct-quote-mark" aria-hidden>“</span>
              <div className="ct-stars" aria-label={T.outOf5(t.rating || 5)}>
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
  const T = useSiteText();
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
        <SectionHead eyebrow={T.gallery} title={sec.title || T.galleryTitle} subtitle={sec.subtitle} />
        <div className="ct-gallery">
          {list.map((g, i) => (
            <button key={i} type="button" className="ct-gallery-item ct-reveal" onClick={() => setOpen(i)} aria-label={g.caption || T.photoN(i + 1)}>
              <img src={g.image} alt={g.caption || ''} loading="lazy" />
              {g.caption && <span>{g.caption}</span>}
            </button>
          ))}
        </div>
      </div>
      {open !== null && list[open] && (
        <div className="ct-lightbox" onClick={() => setOpen(null)} role="dialog" aria-label={T.photo}>
          <img src={list[open].image} alt={list[open].caption || ''} onClick={e => e.stopPropagation()} />
          {list[open].caption && <p>{list[open].caption}</p>}
          <button type="button" className="ct-lightbox-close" aria-label={T.close} onClick={() => setOpen(null)}><Icon name="close" size={22} /></button>
          {list.length > 1 && (
            <>
              <button type="button" className="ct-lightbox-nav prev" aria-label={T.prev} onClick={e => { e.stopPropagation(); setOpen(i => (i - 1 + list.length) % list.length); }}><Icon name="chevron" size={22} /></button>
              <button type="button" className="ct-lightbox-nav next" aria-label={T.next} onClick={e => { e.stopPropagation(); setOpen(i => (i + 1) % list.length); }}><Icon name="chevron" size={22} /></button>
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
    <section className={`ct-banner${cta.image ? ' has-image' : ''}`} style={cta.image ? { backgroundImage: `url("${encodeURI(cta.image)}")` } : undefined}>
      <div className="ct-banner-shade" aria-hidden />
      <div className="ct-wrap ct-banner-in ct-reveal">
        <div>
          <span className="ct-banner-eyebrow"><Ornament /> {T.enrolOpen} <Ornament /></span>
          <h2>{cta.title}</h2>
          {cta.text && <p>{cta.text}</p>}
        </div>
        <a href={cta.buttonUrl || fallbackUrl} className="ct-btn ct-btn-accent ct-btn-lg">{cta.buttonText || T.enroll} <Icon name="arrow" size={16} /></a>
      </div>
    </section>
  );
}

/* ── FAQ ─────────────────────────────────────────────────────────────────── */
function Faq({ sec, list, contact }) {
  const T = useSiteText();
  return (
    <section id="faq" className="ct-section">
      <div className="ct-wrap ct-faq">
        <div className="ct-reveal">
          <Eyebrow>{T.faq}</Eyebrow>
          <h2 className="ct-h2">{sec.title || T.faqTitle}</h2>
          <p className="ct-lead">{sec.subtitle || T.faqSub}</p>
          {contact?.enabled && <a href="#contact" className="ct-btn ct-btn-primary">{T.contactUs} <Icon name="arrow" size={16} /></a>}
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
  const T = useSiteText();
  const cards = [
    contact.address && { icon: 'pin', label: T.visitUs, value: contact.address, href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(contact.address)}`, ext: true, more: T.openMaps },
    contact.phone && { icon: 'phone', label: T.callUs, value: contact.phone, href: `tel:${contact.phone}` },
    contact.email && { icon: 'mail', label: T.emailUs, value: contact.email, href: `mailto:${contact.email}` },
    contact.hours && { icon: 'clock', label: T.openingHours, value: contact.hours },
  ].filter(Boolean);
  const socials = Object.keys(SOCIAL_ICONS).filter(k => links?.[k]);
  return (
    <section id="contact" className="ct-section ct-tinted">
      <div className="ct-wrap">
        <SectionHead eyebrow={T.contact} title={T.contactTitle} subtitle={T.contactSub} />
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
  const T = useSiteText();
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
          <p>{lp.footer?.about || center.description || T.footerAbout}</p>
          {socials.length > 0 && (
            <div className="ct-footer-socials">
              {socials.map(k => { const S = SOCIAL_ICONS[k]; return <a key={k} href={lp.links[k]} target="_blank" rel="noopener noreferrer" aria-label={SOCIAL_LABELS[k]}><S size={16} /></a>; })}
            </div>
          )}
        </div>
        <div>
          <h4>{T.explore}</h4>
          {nav.map(l => <a key={l.href} href={l.href}>{l.label}</a>)}
        </div>
        <div>
          <h4>{programs.length ? T.programs : T.portals}</h4>
          {programs.length
            ? programs.slice(0, 6).map((p, i) => <a key={i} href="#programs">{p.title}</a>)
            : <><a href={urls.student}>{T.studentLogin}</a><a href={urls.teacher}>{T.teacherLogin}</a><a href={urls.parent}>{T.parentLogin}</a></>}
        </div>
        <div>
          <h4>{T.contact}</h4>
          {c.address && <span><Icon name="pin" size={14} /> {c.address}</span>}
          {c.phone && <a href={`tel:${c.phone}`}><Icon name="phone" size={14} /> {c.phone}</a>}
          {c.email && <a href={`mailto:${c.email}`}><Icon name="mail" size={14} /> {c.email}</a>}
          {c.hours && <span><Icon name="clock" size={14} /> {c.hours}</span>}
          {!c.address && !c.phone && !c.email && <a href={urls.student}>{T.studentLogin}</a>}
        </div>
      </div>
      <div className="ct-wrap ct-footer-bottom">
        <span>© {new Date().getFullYear()} {center.centerName}. {T.rights}{center.partnershipText && <em> {center.partnershipText}</em>}</span>
        <span>{T.poweredBy}</span>
      </div>
    </footer>
  );
}

/* ── Small pieces ────────────────────────────────────────────────────────── */
function Eyebrow({ children }) {
  return <span className="ct-eyebrow"><span className="ct-eyebrow-rule" aria-hidden /><Ornament />{children}<Ornament /><span className="ct-eyebrow-rule" aria-hidden /></span>;
}

/** Small diamond ornament (classic print detail) */
function Ornament() {
  return <svg className="ct-orn" width="8" height="8" viewBox="0 0 8 8" aria-hidden><path d="M4 0 L8 4 L4 8 L0 4 Z" /></svg>;
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

/* ── Styles ──────────────────────────────────────────────────────────────── */
const CSS = `
/* ══ Classic — an editorial school-prospectus look ═══════════════════════════════
   Warm ivory "paper", ink text, the center's colour for emphasis, serif headings,
   fine double rules, arches and diamond ornaments. Motion: short ease-out reveals,
   hover only on real pointers, no movement for reduced-motion users. */
.ct { --paper: #fbf7f0; --paper-2: #f4ecdf; --rule: #e6d9c4; --ink: #1c1917; --ink-2: #57534e; --ink-3: #8a817a;
  --ease: cubic-bezier(0.23, 1, 0.32, 1);
  container-type: inline-size; font-family: var(--font); color: var(--ink); background: var(--paper); min-height: 100vh; overflow-x: hidden;
  -webkit-font-smoothing: antialiased; line-height: 1.65; }
.ct *, .ct *::before, .ct *::after { box-sizing: border-box; }
:where(.ct) a { color: inherit; text-decoration: none; }
.ct img { display: block; max-width: 100%; }
.ct-wrap { width: 100%; max-width: 1200px; margin: 0 auto; padding: 0 28px; }
.ct .lp-ic { flex-shrink: 0; }
.ct-orn { fill: var(--a); flex-shrink: 0; }
.ct-h2 { font-family: var(--serif); font-size: clamp(1.95rem, 4.2cqi, 2.9rem); line-height: 1.12; font-weight: 700; color: var(--ink); margin: 16px 0 16px; letter-spacing: -0.015em; text-wrap: balance; }
.ct-lead { font-size: 1.06rem; color: var(--ink-2); margin: 0 0 26px; white-space: pre-line; text-wrap: pretty; }
.ct-eyebrow { display: inline-flex; align-items: center; gap: 10px; font-size: 12px; font-weight: 800; letter-spacing: .2em; text-transform: uppercase; color: var(--p); }
.ct-eyebrow-rule { width: 26px; height: 1px; background: currentColor; opacity: .45; }
.ct-section { padding: 104px 0; position: relative; }
.ct-tinted { background: var(--paper-2); }
/* a fine double rule between sections — a classic print detail */
.ct-section + .ct-section::before, .ct-stats + .ct-section::before { content: ""; position: absolute; left: 50%; top: 0; width: min(1144px, calc(100% - 56px)); height: 4px; transform: translateX(-50%);
  border-top: 1px solid var(--rule); border-bottom: 1px solid var(--rule); }
.ct-tinted + .ct-section::before, .ct-section + .ct-tinted::before { display: none; }
.ct-head { text-align: center; max-width: 740px; margin: 0 auto 56px; }
.ct-head .ct-eyebrow { justify-content: center; }
.ct-head .ct-lead { margin-bottom: 0; }
.ct-grid { display: grid; gap: 28px; }
.ct-grid-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.ct-grid-4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }
.ct-card { background: #fffdf9; border: 1px solid var(--rule); border-radius: 20px; overflow: hidden;
  box-shadow: 0 1px 0 rgba(255,255,255,.8) inset, 0 12px 30px -18px rgba(60, 40, 20, .25);
  transition: transform .3s var(--ease), box-shadow .3s var(--ease), border-color .3s ease; }

/* Buttons — press feedback on every input; lift only with a mouse */
.ct-btn { display: inline-flex; align-items: center; gap: 8px; padding: 12px 24px; border-radius: 999px; font-weight: 700; font-size: 14.5px; letter-spacing: .01em;
  border: 1.5px solid transparent; cursor: pointer; font-family: inherit; white-space: nowrap;
  transition: transform .2s var(--ease), box-shadow .2s var(--ease), background-color .2s ease, color .2s ease, border-color .2s ease; }
.ct-btn:active { transform: scale(.97); }
.ct-btn-lg { padding: 16px 30px; font-size: 15.5px; }
.ct-btn-accent { background: var(--a); color: var(--a-on); box-shadow: 0 14px 28px -12px var(--a), inset 0 -2px 0 rgba(0,0,0,.12); }
.ct-btn-primary { background: var(--p); color: var(--p-on); box-shadow: 0 14px 28px -14px var(--p); }
.ct-btn-ghost { background: transparent; border-color: var(--rule); color: var(--ink); }
.ct-btn-outline { background: transparent; border-color: color-mix(in srgb, var(--ink) 28%, transparent); color: var(--ink); }
.ct-btn-outline-light { border-color: rgba(255,255,255,.75); color: #fff; }
.ct-link { display: inline-flex; align-items: center; gap: 6px; font-weight: 700; color: var(--p); font-size: 14.5px; transition: gap .2s var(--ease); }
.ct-btn svg, .ct-link svg { transition: transform .2s var(--ease); }

/* Top bar + header */
.ct-top { background: var(--ink); color: rgba(255,255,255,.78); font-size: 13px; letter-spacing: .01em; }
.ct-top-in { display: flex; justify-content: space-between; align-items: center; gap: 16px; min-height: 40px; }
.ct-top-text::before { content: "✦"; color: var(--a); margin-right: 10px; }
.ct-top-right { display: flex; align-items: center; gap: 18px; }
.ct-top a { display: inline-flex; align-items: center; gap: 6px; color: rgba(255,255,255,.78); transition: color .15s ease; }
.ct-header { position: sticky; top: 0; z-index: 50; background: color-mix(in srgb, var(--paper) 92%, transparent); backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
  border-bottom: 1px solid transparent; transition: box-shadow .3s ease, border-color .3s ease; }
.ct-header.is-scrolled { box-shadow: 0 10px 30px -18px rgba(60, 40, 20, .35); border-bottom-color: var(--rule); }
.ct-header-in { display: flex; align-items: center; gap: 24px; height: 80px; }
.ct-brand { display: flex; align-items: center; gap: 12px; min-width: 0; }
.ct-brand img { height: 46px; width: auto; object-fit: contain; }
.ct-mark { width: 44px; height: 44px; border-radius: 50% 50% 12px 12px; display: grid; place-items: center; background: var(--p); color: var(--p-on);
  font-family: var(--serif); font-size: 23px; font-weight: 800; flex-shrink: 0; box-shadow: inset 0 0 0 3px var(--paper), 0 0 0 1.5px var(--p); }
/* long names ("Trung tâm Anh ngữ …") wrap to two lines rather than being cut off */
.ct-brand-name { font-family: var(--serif); font-size: 21px; font-weight: 700; color: var(--ink); line-height: 1.15; max-width: 250px; letter-spacing: -.01em;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; text-wrap: balance; }
.ct-nav { display: flex; gap: 2px; margin-left: auto; }
.ct-nav a { padding: 8px 14px; white-space: nowrap; font-weight: 600; font-size: 14.5px; color: var(--ink-2); position: relative; transition: color .15s ease; }
.ct-nav a::after { content: ''; position: absolute; left: 50%; bottom: 2px; width: 5px; height: 5px; background: var(--a); transform: translateX(-50%) rotate(45deg) scale(0); transition: transform .25s var(--ease); }
.ct-header-actions { display: flex; align-items: center; gap: 10px; }
.ct-login { position: relative; }
.ct-login .ct-btn { padding: 10px 16px; }
.ct-login-menu { position: absolute; right: 0; top: calc(100% + 10px); width: 268px; background: #fffdf9; border-radius: 18px; box-shadow: 0 28px 60px -20px rgba(40, 25, 10, .35);
  border: 1px solid var(--rule); padding: 8px; z-index: 60; transform-origin: top right; animation: ctPop .18s var(--ease) both; }
@keyframes ctPop { from { opacity: 0; transform: scale(.96) translateY(-4px); } }
.ct-login-menu a { display: flex; align-items: center; gap: 12px; padding: 10px 12px; border-radius: 12px; transition: background-color .15s ease; }
.ct-login-menu strong { display: block; font-size: 14px; color: var(--ink); }
.ct-login-menu small { display: block; font-size: 12px; color: var(--ink-3); }
.ct-login-ic { width: 36px; height: 36px; border-radius: 10px; display: grid; place-items: center; background: var(--soft); color: var(--p); flex-shrink: 0; }
.ct-login-admin { font-size: 12.5px; color: var(--ink-3) !important; border-top: 1px solid var(--rule); margin-top: 4px; border-radius: 0 0 12px 12px !important; }
.ct-burger { display: none; background: none; border: none; padding: 6px; cursor: pointer; color: var(--ink); }
.ct-mobile-menu { display: flex; flex-direction: column; padding: 8px 24px 20px; border-top: 1px solid var(--rule); background: var(--paper); }
.ct-mobile-menu a { padding: 12px 4px; font-weight: 600; color: var(--ink); border-bottom: 1px solid color-mix(in srgb, var(--rule) 60%, transparent); }
.ct-mobile-menu hr { border: 0; margin: 4px 0; }

/* ── Hero: ivory page, copy left, arched photo right ── */
.ct-hero { position: relative; padding: 88px 0 0; }
.ct-hero-paper { position: absolute; inset: 0; pointer-events: none; overflow: hidden;   /* clips the monogram, not the strip below */
  background:
    radial-gradient(48% 60% at 88% 18%, color-mix(in srgb, var(--a) 22%, transparent) 0%, transparent 70%),
    radial-gradient(40% 55% at 6% 90%, color-mix(in srgb, var(--p) 12%, transparent) 0%, transparent 70%); }
.ct-hero-paper::after { content: ""; position: absolute; inset: 0; opacity: .5;
  background-image: radial-gradient(color-mix(in srgb, var(--ink) 9%, transparent) 1px, transparent 1px); background-size: 26px 26px;
  -webkit-mask-image: linear-gradient(180deg, #000 0%, transparent 75%); mask-image: linear-gradient(180deg, #000 0%, transparent 75%); }
.ct-hero-monogram { position: absolute; right: -2cqi; bottom: -14cqi; font-family: var(--serif); font-weight: 800; font-size: 46cqi; line-height: 1;
  color: transparent; -webkit-text-stroke: 1.5px color-mix(in srgb, var(--p) 14%, transparent); user-select: none; }
.ct-hero-in { position: relative; display: grid; grid-template-columns: minmax(0, 1.08fr) minmax(0, .92fr); gap: 56px; align-items: center; padding-bottom: 96px; }
.ct-hero-badge { display: inline-flex; align-items: center; gap: 10px; padding: 8px 16px; border-radius: 999px; background: #fffdf9; border: 1px solid var(--rule);
  color: var(--p); font-size: 12.5px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; margin-bottom: 26px; box-shadow: 0 8px 20px -14px rgba(60,40,20,.4); }
.ct-hero h1 { font-family: var(--serif); font-size: clamp(2.6rem, 5.6cqi, 4.6rem); line-height: 1.04; font-weight: 800; margin: 0 0 24px; letter-spacing: -0.025em; color: var(--ink); text-wrap: balance; }
.ct-swash { position: relative; font-style: italic; color: var(--p); white-space: nowrap; }
.ct-swash svg { position: absolute; left: -2%; bottom: -.12em; width: 104%; height: .32em; overflow: visible; }
.ct-swash path { fill: none; stroke: var(--a); stroke-width: 5; stroke-linecap: round; stroke-dasharray: 220; stroke-dashoffset: 220; animation: ctDraw .9s var(--ease) .65s forwards; }
@keyframes ctDraw { to { stroke-dashoffset: 0; } }
.ct-hero p { font-size: clamp(1.04rem, 1.6cqi, 1.2rem); color: var(--ink-2); margin: 0 0 36px; white-space: pre-line; max-width: 560px; text-wrap: pretty; }
.ct-hero-ctas { display: flex; flex-wrap: wrap; gap: 14px; }
.ct-hero-trust { display: flex; align-items: center; gap: 14px; margin-top: 34px; padding-top: 26px; border-top: 1px solid var(--rule); max-width: 520px; }
.ct-faces { display: flex; }
.ct-faces img { width: 40px; height: 40px; border-radius: 50%; object-fit: cover; border: 3px solid var(--paper); margin-left: -10px; box-shadow: 0 4px 10px -4px rgba(0,0,0,.3); }
.ct-faces img:first-child { margin-left: 0; }
.ct-trust-stars { display: flex; align-items: center; gap: 2px; color: #f59e0b; font-size: 14px; }
.ct-trust-stars b { color: var(--ink); margin-left: 6px; }
.ct-hero-trust small { display: block; color: var(--ink-2); font-size: 13.5px; margin-top: 2px; }
.ct-hero-trust small b { color: var(--ink); }

.ct-hero-art { position: relative; justify-self: center; width: min(100%, 470px); aspect-ratio: 4 / 5; }
.ct-arch, .ct-arch-outline { position: absolute; border-radius: 999px 999px 28px 28px; }
.ct-arch { inset: 0 0 0 0; overflow: hidden; background: var(--paper-2); box-shadow: 0 40px 80px -36px rgba(40, 25, 10, .55); }
.ct-arch img { width: 100%; height: 100%; object-fit: cover; transform: scale(1.04); animation: ctSettle 1.6s var(--ease) both; }
@keyframes ctSettle { from { transform: scale(1.12); } }
.ct-arch-fill { width: 100%; height: 100%; display: grid; place-items: center; color: var(--p-on);
  background: radial-gradient(circle at 30% 20%, color-mix(in srgb, var(--a) 55%, transparent), transparent 60%), linear-gradient(160deg, var(--p), var(--p-deep)); }
.ct-arch-outline { inset: -18px 18px 18px -18px; border: 1.5px solid color-mix(in srgb, var(--p) 45%, transparent); }
.ct-float { position: absolute; background: #fffdf9; border: 1px solid var(--rule); border-radius: 18px; box-shadow: 0 24px 48px -20px rgba(40, 25, 10, .45); z-index: 2; }
.ct-float-a { left: -38px; bottom: 54px; padding: 16px 20px; text-align: center; animation: ctBob 6s ease-in-out infinite; }
.ct-float-a strong { display: block; font-family: var(--serif); font-size: 2.1rem; line-height: 1; color: var(--p); }
.ct-float-a span { display: block; font-size: 12px; font-weight: 700; color: var(--ink-2); margin-top: 4px; max-width: 110px; }
.ct-float-b { right: -26px; top: 64px; padding: 12px 16px 12px 12px; display: flex; align-items: center; gap: 12px; animation: ctBob 6s ease-in-out 3s infinite; }
.ct-float-ic { width: 40px; height: 40px; border-radius: 12px; display: grid; place-items: center; background: var(--a); color: var(--a-on); }
.ct-float-b strong { display: block; font-family: var(--serif); font-size: 1.3rem; line-height: 1.1; color: var(--ink); }
.ct-float-b small { display: block; font-size: 12px; color: var(--ink-3); font-weight: 600; }
@keyframes ctBob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
.ct-hero-sparkle { position: absolute; right: 8%; bottom: -26px; width: 34px; height: 34px; fill: var(--a); animation: ctSpin 14s linear infinite; }
@keyframes ctSpin { to { transform: rotate(360deg); } }

/* the first three "why us" points as a classic ruled strip under the hero */
.ct-highlights { position: relative; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); margin-bottom: -64px; z-index: 3;
  background: #fffdf9; border: 1px solid var(--rule); border-radius: 22px; box-shadow: 0 30px 60px -34px rgba(40, 25, 10, .5); }
.ct-highlight { display: flex; gap: 16px; align-items: flex-start; padding: 28px 26px; border-left: 1px solid var(--rule); }
.ct-highlight:first-child { border-left: 0; }
.ct-highlight-ic { width: 48px; height: 48px; border-radius: 50%; display: grid; place-items: center; background: var(--soft); color: var(--p); flex-shrink: 0;
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--p) 20%, transparent); }
.ct-highlight h3 { font-family: var(--serif); font-size: 1.18rem; margin: 2px 0 6px; color: var(--ink); }
.ct-highlight p { margin: 0; font-size: .94rem; color: var(--ink-2); }
.ct-hero.has-hl + .ct-stats, .ct-hero.has-hl + .ct-section { padding-top: 150px; }

/* Stats — big serif numerals between fine rules */
.ct-stats { padding: 72px 0 40px; }
.ct-stats-in { display: grid; grid-template-columns: repeat(var(--n), minmax(0, 1fr)); }
.ct-stat { text-align: center; padding: 10px 18px; position: relative; }
.ct-stat + .ct-stat::before { content: ""; position: absolute; left: 0; top: 18%; bottom: 18%; width: 4px; border-left: 1px solid var(--rule); border-right: 1px solid var(--rule); }
.ct-stat strong { display: block; font-family: var(--serif); font-size: clamp(2.4rem, 5.4cqi, 3.6rem); color: var(--p); line-height: 1.05; font-weight: 700; font-variant-numeric: lining-nums tabular-nums; }
.ct-stat > span { display: block; color: var(--ink-2); font-weight: 600; margin-top: 8px; font-size: 14px; letter-spacing: .02em; }

/* About */
.ct-about { display: grid; grid-template-columns: 1fr 1fr; gap: 80px; align-items: center; }
.ct-about.no-images { grid-template-columns: 1fr; max-width: 820px; }
.ct-about-media { position: relative; padding: 0 56px 60px 0; }
.ct-about-main { width: 100%; aspect-ratio: 4 / 4.6; object-fit: cover; border-radius: 999px 999px 24px 24px; box-shadow: 0 40px 70px -34px rgba(40, 25, 10, .55); }
.ct-about-second { position: absolute; right: 0; bottom: 0; width: 46%; aspect-ratio: 1; object-fit: cover; border-radius: 50%; border: 8px solid var(--paper); box-shadow: 0 24px 50px -24px rgba(40, 25, 10, .55); }
.ct-about-badge { position: absolute; left: -26px; top: 32px; width: 124px; height: 124px; border-radius: 50%; background: var(--a); color: var(--a-on);
  display: grid; place-items: center; box-shadow: 0 20px 40px -16px var(--a); }
.ct-seal-ring { position: absolute; inset: 0; width: 100%; height: 100%; animation: ctSpin 28s linear infinite; }
.ct-seal-ring text { fill: currentColor; font-size: 10.5px; font-weight: 800; letter-spacing: 2.2px; font-family: var(--font); }
.ct-about-badge strong { font-family: var(--serif); font-size: 2.2rem; line-height: 1; position: relative; }
.ct-about .ct-lead::first-letter { font-family: var(--serif); float: left; font-size: 3.6em; line-height: .82; margin: .06em .1em 0 0; color: var(--p); font-weight: 700; }
.ct-checks { list-style: none; padding: 0; margin: 0 0 32px; display: grid; grid-template-columns: 1fr 1fr; gap: 14px 22px; }
.ct-checks li { display: flex; align-items: flex-start; gap: 10px; font-weight: 600; color: var(--ink); }
.ct-checks li > span { width: 24px; height: 24px; border-radius: 50%; display: grid; place-items: center; background: var(--p); color: var(--p-on); flex-shrink: 0; margin-top: 1px; }

/* Programs — arch-topped photos, numbered like a prospectus */
.ct-program { display: flex; flex-direction: column; padding: 12px 12px 0; }
.ct-program-img { position: relative; aspect-ratio: 16 / 11; overflow: hidden; background: var(--paper-2); border-radius: 160px 160px 14px 14px; }
.ct-program-img img { width: 100%; height: 100%; object-fit: cover; transition: transform .7s var(--ease); }
.ct-program-ph { width: 100%; height: 100%; display: grid; place-items: center; color: var(--p); background: linear-gradient(135deg, var(--soft), color-mix(in srgb, var(--a) 18%, transparent)); }
.ct-chip { position: absolute; left: 50%; bottom: 12px; transform: translateX(-50%); background: #fffdf9; color: var(--p); font-size: 11.5px; font-weight: 800;
  padding: 5px 12px; border-radius: 999px; letter-spacing: .08em; text-transform: uppercase; white-space: nowrap; box-shadow: 0 6px 16px -8px rgba(0,0,0,.4); }
.ct-program-body { padding: 22px 14px 24px; display: flex; flex-direction: column; flex: 1; text-align: center; }
.ct-program-no { font-family: var(--serif); font-style: italic; font-size: 14px; color: var(--a); font-weight: 700; margin-bottom: 4px; }
.ct-program-body h3 { font-family: var(--serif); font-size: 1.4rem; margin: 0 0 10px; color: var(--ink); line-height: 1.2; }
.ct-program-body p { color: var(--ink-2); margin: 0 0 18px; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.ct-program-meta { display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 14px 4px; border-top: 1px dashed var(--rule); margin-top: auto; margin-bottom: 14px; color: var(--ink-3); font-size: 13.5px; font-weight: 600; }
.ct-program-meta span { display: inline-flex; align-items: center; gap: 6px; }
.ct-price { color: var(--p) !important; font-family: var(--serif); font-size: 1.08rem; font-weight: 700; }
.ct-program-body > .ct-link { margin: auto auto 0; }
.ct-program-meta + .ct-link { margin-top: 0; }

/* Why choose us — editorial numbered list */
.ct-features { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 64px; counter-reset: none; }
.ct-feature { display: grid; grid-template-columns: 92px minmax(0, 1fr); gap: 18px; align-items: start; padding: 30px 0; border-top: 1px solid var(--rule); }
.ct-feature-num { font-family: var(--serif); font-size: 64px; line-height: .9; font-weight: 800; color: transparent; -webkit-text-stroke: 1.5px var(--p); transition: color .3s ease; }
.ct-feature h3 { display: flex; align-items: center; gap: 10px; font-family: var(--serif); font-size: 1.35rem; margin: 6px 0 8px; color: var(--ink); }
.ct-feature-ic { width: 32px; height: 32px; border-radius: 50%; display: grid; place-items: center; background: var(--soft); color: var(--p); flex-shrink: 0; }
.ct-feature p { margin: 0; color: var(--ink-2); }

/* Teachers — arch portraits */
.ct-teacher { padding: 12px 12px 0; }
.ct-teacher-photo { aspect-ratio: 4 / 4.8; background: linear-gradient(160deg, var(--p), var(--p-deep)); overflow: hidden; display: grid; place-items: center; border-radius: 999px 999px 14px 14px; }
.ct-teacher-photo img { width: 100%; height: 100%; object-fit: cover; transition: transform .7s var(--ease); }
.ct-teacher-photo span { font-family: var(--serif); font-size: 64px; color: var(--p-on); font-weight: 800; }
.ct-teacher-body { padding: 18px 10px 24px; text-align: center; }
.ct-teacher-body h3 { font-family: var(--serif); font-size: 1.3rem; margin: 0 0 4px; color: var(--ink); }
.ct-teacher-role { display: block; color: var(--p); font-weight: 800; font-size: 11.5px; letter-spacing: .14em; text-transform: uppercase; margin-bottom: 10px; }
.ct-teacher-body p { margin: 0; color: var(--ink-2); font-size: 14px; }

/* Testimonials — the first one is a large serif pull-quote */
.ct-quotes { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 28px; }
.ct-quotes.has-feature { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.ct-quote { margin: 0; padding: 34px 32px 28px; position: relative; display: flex; flex-direction: column; }
.ct-quote-mark { position: absolute; right: 26px; top: -6px; font-family: var(--serif); font-size: 130px; line-height: 1; color: color-mix(in srgb, var(--a) 40%, transparent); }
.ct-stars { display: flex; gap: 3px; color: #f59e0b; margin-bottom: 16px; }
.ct-stars .off { color: var(--rule); }
.ct-quote blockquote { margin: 0 0 24px; font-family: var(--serif); font-size: 1.12rem; line-height: 1.55; color: var(--ink); font-style: italic; position: relative; flex: 1; }
.ct-quote.is-feature { grid-column: 1 / -1; padding: 52px 64px 40px; text-align: center; align-items: center; background: var(--p); color: var(--p-on); border-color: transparent;
  box-shadow: 0 40px 80px -40px color-mix(in srgb, var(--p) 80%, #000); }
.ct-quote.is-feature::after { content: ""; position: absolute; inset: 12px; border: 1px solid color-mix(in srgb, var(--p-on) 30%, transparent); border-radius: 12px; pointer-events: none; }
.ct-quote.is-feature .ct-quote-mark { position: static; display: block; height: 52px; font-size: 110px; color: var(--a); margin-bottom: 6px; }
.ct-quote.is-feature blockquote { color: inherit; font-size: clamp(1.3rem, 2.6cqi, 1.85rem); max-width: 820px; text-wrap: balance; }
.ct-quote.is-feature .ct-stars { justify-content: center; }
.ct-quote.is-feature figcaption { border-top-color: color-mix(in srgb, var(--p-on) 25%, transparent); justify-content: center; }
.ct-quote.is-feature figcaption strong { color: inherit; }
.ct-quote.is-feature figcaption small { color: inherit; opacity: .75; }
.ct-quote figcaption { display: flex; align-items: center; gap: 12px; padding-top: 18px; border-top: 1px solid var(--rule); }
.ct-quote figcaption img, .ct-quote-av { width: 50px; height: 50px; border-radius: 50%; object-fit: cover; flex-shrink: 0; }
.ct-quote-av { display: grid; place-items: center; background: var(--p); color: var(--p-on); font-weight: 800; font-size: 20px; }
.ct-quote figcaption strong { display: block; color: var(--ink); text-align: left; }
.ct-quote figcaption small { display: block; color: var(--ink-3); font-size: 13px; text-align: left; }

/* Gallery */
.ct-gallery { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); grid-auto-rows: 210px; gap: 14px; }
.ct-gallery-item { position: relative; border: 0; padding: 0; cursor: zoom-in; overflow: hidden; border-radius: 16px; background: var(--rule); }
.ct-gallery-item:first-child { grid-column: span 2; grid-row: span 2; border-radius: 999px 999px 16px 16px; }
.ct-gallery-item img { width: 100%; height: 100%; object-fit: cover; transition: transform .7s var(--ease); }
.ct-gallery-item span { position: absolute; left: 0; right: 0; bottom: 0; padding: 30px 16px 14px; color: #fff; font-weight: 600; font-size: 14px; text-align: left;
  background: linear-gradient(transparent, rgba(20,12,6,.7)); opacity: 0; transition: opacity .25s ease; }
.ct-gallery-item:focus-visible { outline: 3px solid var(--a); outline-offset: 3px; }
.ct-lightbox { position: fixed; inset: 0; z-index: 400; background: rgba(18,12,8,.92); display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px;
  animation: ctFade .2s ease both; }
@keyframes ctFade { from { opacity: 0; } }
.ct-lightbox img { max-width: min(1100px, 100%); max-height: 80vh; border-radius: 12px; object-fit: contain; animation: ctPop .25s var(--ease) both; }
.ct-lightbox p { color: #fff; margin: 16px 0 0; font-weight: 600; }
.ct-lightbox-close, .ct-lightbox-nav { position: absolute; background: rgba(255,255,255,.12); color: #fff; border: 0; width: 46px; height: 46px; border-radius: 50%; display: grid; place-items: center; cursor: pointer; }
.ct-lightbox-close { top: 20px; right: 20px; }
.ct-lightbox-nav { top: 50%; transform: translateY(-50%); }
.ct-lightbox-nav.prev { left: 20px; } .ct-lightbox-nav.prev svg { transform: rotate(90deg); }
.ct-lightbox-nav.next { right: 20px; } .ct-lightbox-nav.next svg { transform: rotate(-90deg); }

/* Enrolment banner — like a certificate: deep colour inside a fine double frame */
.ct-banner { position: relative; background: linear-gradient(120deg, var(--p-deep), var(--p)); background-size: cover; background-position: center; color: #fff; padding: 96px 0; }
.ct-banner::after { content: ""; position: absolute; inset: 18px; border: 1px solid rgba(255,255,255,.28); outline: 1px solid rgba(255,255,255,.14); outline-offset: 6px; border-radius: 16px; pointer-events: none; }
.ct-banner-shade { position: absolute; inset: 0; background: linear-gradient(90deg, color-mix(in srgb, var(--p-deep) 92%, transparent), color-mix(in srgb, var(--p) 70%, transparent)); }
.ct-banner:not(.has-image) .ct-banner-shade { background: radial-gradient(circle at 90% 50%, color-mix(in srgb, var(--a) 40%, transparent), transparent 55%); }
.ct-banner-in { position: relative; display: flex; align-items: center; justify-content: space-between; gap: 36px; }
.ct-banner-eyebrow { display: inline-flex; align-items: center; gap: 10px; font-size: 12px; font-weight: 800; letter-spacing: .2em; text-transform: uppercase; color: var(--a); margin-bottom: 14px; }
.ct-banner h2 { font-family: var(--serif); font-size: clamp(1.9rem, 4.2cqi, 2.8rem); margin: 0 0 10px; line-height: 1.12; max-width: 700px; text-wrap: balance; }
.ct-banner p { margin: 0; color: rgba(255,255,255,.86); font-size: 1.08rem; max-width: 640px; }

/* FAQ */
.ct-faq { display: grid; grid-template-columns: 5fr 7fr; gap: 72px; align-items: start; }
.ct-faq > :first-child { position: sticky; top: 110px; }
.ct-faq-list { display: flex; flex-direction: column; border-top: 1px solid var(--rule); }
.ct-faq-item { border-bottom: 1px solid var(--rule); }
.ct-faq-item summary { list-style: none; cursor: pointer; padding: 22px 4px; font-family: var(--serif); font-weight: 700; color: var(--ink); display: flex; justify-content: space-between; gap: 16px; align-items: center; font-size: 1.16rem; }
.ct-faq-item summary::-webkit-details-marker { display: none; }
.ct-faq-item summary:focus-visible { outline: 2px solid var(--a); outline-offset: 2px; border-radius: 6px; }
.ct-faq-plus { width: 30px; height: 30px; border-radius: 50%; border: 1px solid var(--rule); position: relative; flex-shrink: 0; transition: background-color .2s ease, border-color .2s ease; }
.ct-faq-plus::before, .ct-faq-plus::after { content: ''; position: absolute; left: 50%; top: 50%; width: 12px; height: 1.5px; background: var(--p); transform: translate(-50%, -50%); transition: transform .25s var(--ease), background-color .2s ease; }
.ct-faq-plus::after { transform: translate(-50%, -50%) rotate(90deg); }
.ct-faq-item[open] .ct-faq-plus { background: var(--p); border-color: var(--p); }
.ct-faq-item[open] .ct-faq-plus::before, .ct-faq-item[open] .ct-faq-plus::after { background: var(--p-on); }
.ct-faq-item[open] .ct-faq-plus::after { transform: translate(-50%, -50%) rotate(0deg); }
.ct-faq-item p { margin: 0; padding: 0 44px 24px 4px; color: var(--ink-2); white-space: pre-line; }
.ct-faq-item[open] p { animation: ctOpen .3s var(--ease) both; }
@keyframes ctOpen { from { opacity: 0; transform: translateY(-4px); } }

/* Contact */
.ct-contact { padding: 32px 24px; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 6px; }
.ct-contact-ic { width: 58px; height: 58px; border-radius: 50%; display: grid; place-items: center; background: var(--p); color: var(--p-on); margin-bottom: 10px;
  box-shadow: inset 0 0 0 3px #fffdf9, 0 0 0 1.5px var(--p); }
.ct-contact small { color: var(--ink-3); font-weight: 800; text-transform: uppercase; letter-spacing: .14em; font-size: 11.5px; }
.ct-contact strong { color: var(--ink); font-size: 1rem; word-break: break-word; }
.ct-contact em { font-style: normal; color: var(--p); font-weight: 700; font-size: 13px; display: inline-flex; align-items: center; gap: 4px; margin-top: 4px; }
.ct-socials-row { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; margin-top: 36px; }

/* Footer */
.ct-footer { background: var(--ink); color: rgba(255,255,255,.68); padding: 84px 0 0; position: relative; }
.ct-footer::before { content: "◆"; position: absolute; left: 50%; top: 0; transform: translate(-50%, -50%); width: 44px; height: 44px; border-radius: 50%; display: grid; place-items: center;
  background: var(--paper); color: var(--a); font-size: 14px; box-shadow: 0 0 0 1px var(--rule); }
.ct-footer-grid { display: grid; grid-template-columns: 1.6fr 1fr 1fr 1.3fr; gap: 44px; padding-bottom: 56px; }
.ct-footer h4 { color: #fff; font-family: var(--serif); font-size: 1.18rem; margin: 6px 0 18px; }
.ct-footer-grid > div > a, .ct-footer-grid > div > span { display: flex; align-items: flex-start; gap: 8px; padding: 5px 0; font-size: 14.5px; color: rgba(255,255,255,.68); transition: color .15s ease; }
.ct-footer-grid .lp-ic { margin-top: 4px; color: var(--a); }
.ct-brand-footer { margin-bottom: 18px; }
.ct-brand-footer .ct-brand-name { color: #fff; }
.ct-brand-footer .ct-mark { box-shadow: inset 0 0 0 3px var(--ink), 0 0 0 1.5px var(--p); }
.ct-brand-footer img { filter: brightness(0) invert(1); }
.ct-footer p { margin: 0 0 20px; font-size: 14.5px; max-width: 340px; }
.ct-footer-socials { display: flex; gap: 10px; }
.ct-footer-socials a { width: 38px; height: 38px; border-radius: 50%; display: grid; place-items: center; background: rgba(255,255,255,.08); color: #fff; transition: background-color .2s ease, color .2s ease; }
.ct-footer-bottom { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 10px; padding-top: 22px; padding-bottom: 26px; border-top: 1px solid rgba(255,255,255,.1); font-size: 13px; color: rgba(255,255,255,.48); }
.ct-footer-bottom em { font-style: italic; }

/* Hover — real pointers only (touch would leave it stuck) */
@media (hover: hover) and (pointer: fine) {
  .ct-btn:hover { transform: translateY(-2px); }
  .ct-btn:hover svg, .ct-link:hover svg { transform: translateX(3px); }
  .ct-btn-accent:hover { box-shadow: 0 18px 32px -12px var(--a), inset 0 -2px 0 rgba(0,0,0,.12); }
  .ct-btn-ghost:hover, .ct-btn-outline:hover { border-color: var(--p); color: var(--p); }
  .ct-btn-outline-light:hover { background: #fff; color: var(--ink); }
  .ct-link:hover { gap: 10px; }
  .ct-top a:hover { color: #fff; }
  .ct-nav a:hover { color: var(--ink); }
  .ct-nav a:hover::after { transform: translateX(-50%) rotate(45deg) scale(1); }
  .ct-login-menu a:hover { background: var(--soft); }
  .ct-card:hover { transform: translateY(-6px); border-color: color-mix(in srgb, var(--p) 30%, var(--rule)); box-shadow: 0 30px 60px -30px rgba(40, 25, 10, .45); }
  .ct-quote.is-feature:hover { transform: none; }
  .ct-program:hover .ct-program-img img, .ct-teacher:hover .ct-teacher-photo img, .ct-gallery-item:hover img { transform: scale(1.06); }
  .ct-gallery-item:hover span { opacity: 1; }
  .ct-feature:hover .ct-feature-num { color: var(--p); }
  .ct-footer-grid > div > a:hover { color: #fff; }
  .ct-footer-socials a:hover { background: var(--a); color: var(--a-on); }
}

/* Motion */
@keyframes ctRise { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: none; } }
.ct-rise { animation: ctRise .8s var(--ease) both; }
.ct-d1 { animation-delay: .06s; } .ct-d2 { animation-delay: .16s; } .ct-d3 { animation-delay: .26s; } .ct-d4 { animation-delay: .36s; }
.ct-anim .ct-reveal { opacity: 0; transform: translateY(24px); transition: opacity .8s var(--ease), transform .8s var(--ease); }
.ct-anim .ct-reveal.in { opacity: 1; transform: none; }
@media (prefers-reduced-motion: reduce) {
  .ct-rise, .ct-arch img, .ct-float-a, .ct-float-b, .ct-hero-sparkle, .ct-seal-ring, .ct-login-menu, .ct-lightbox, .ct-lightbox img, .ct-faq-item[open] p { animation: none; }
  .ct-swash path { animation: none; stroke-dashoffset: 0; }
  .ct-anim .ct-reveal { opacity: 1; transform: none; transition: none; }
}

/* Tablet */
@container (max-width: 1240px) {
  .ct-nav a { padding: 8px 10px; font-size: 14px; }
}
/* the menu moves into the burger a little early, so long school names never get cut */
@container (max-width: 1120px) {
  .ct-nav { display: none; }
  .ct-burger { display: inline-grid; place-items: center; }
  .ct-header-actions { margin-left: auto; }
}
@container (max-width: 1020px) {
  .ct-nav, .ct-hide-sm { display: none; }
  .ct-burger { display: inline-grid; place-items: center; }
  .ct-header-actions { margin-left: auto; }
  .ct-grid-4 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .ct-grid-3, .ct-quotes { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .ct-hero-in { gap: 40px; }
  .ct-about { gap: 52px; }
  .ct-features { gap: 0 40px; }
  .ct-footer-grid { grid-template-columns: 1fr 1fr; }
  .ct-gallery { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
/* Phone */
@container (max-width: 760px) {
  .ct-login { display: none; }   /* phone: the burger menu has all three logins — the name gets the room */
  .ct-brand-name { max-width: none; }
  .ct-wrap { padding: 0 20px; }
  .ct-section { padding: 72px 0; }
  .ct-section + .ct-section::before, .ct-stats + .ct-section::before { width: calc(100% - 40px); }
  .ct-header-in { height: 66px; gap: 12px; }
  .ct-brand img { height: 38px; }
  .ct-brand-name { font-size: 18px; }
  .ct-mark { width: 38px; height: 38px; font-size: 20px; }
  .ct-top-text { display: none; }
  .ct-top-in { justify-content: center; }
  .ct-hero { padding-top: 44px; }
  .ct-hero-in { grid-template-columns: 1fr; gap: 44px; padding-bottom: 72px; }
  .ct-hero h1 { font-size: clamp(2.2rem, 10cqi, 3rem); }
  .ct-swash { white-space: normal; }
  .ct-hero-art { width: min(82%, 340px); margin-top: 8px; }
  .ct-float-a { left: -22px; bottom: 30px; padding: 12px 14px; }
  .ct-float-a strong { font-size: 1.6rem; }
  .ct-float-b { right: -18px; top: 30px; }
  .ct-hero-monogram { font-size: 90cqi; bottom: -30cqi; }
  .ct-highlights { grid-template-columns: 1fr; margin-bottom: -40px; }
  .ct-highlight { border-left: 0; border-top: 1px solid var(--rule); padding: 22px 20px; }
  .ct-highlight:first-child { border-top: 0; }
  .ct-hero.has-hl + .ct-stats, .ct-hero.has-hl + .ct-section { padding-top: 100px; }
  .ct-stats-in { grid-template-columns: repeat(2, minmax(0, 1fr)); row-gap: 30px; }
  .ct-stat:nth-child(odd)::before { display: none; }
  .ct-grid-3, .ct-grid-4, .ct-quotes, .ct-quotes.has-feature { grid-template-columns: 1fr; }
  .ct-quote.is-feature { padding: 40px 26px 30px; }
  .ct-about { grid-template-columns: 1fr; }
  .ct-about-media { padding: 0 28px 44px 0; }
  .ct-about-badge { left: -6px; top: 18px; width: 100px; height: 100px; }
  .ct-about-badge strong { font-size: 1.8rem; }
  .ct-checks { grid-template-columns: 1fr; }
  .ct-features { grid-template-columns: 1fr; }
  .ct-feature { grid-template-columns: 64px minmax(0, 1fr); gap: 12px; padding: 24px 0; }
  .ct-feature-num { font-size: 46px; }
  .ct-gallery { grid-template-columns: repeat(2, minmax(0, 1fr)); grid-auto-rows: 150px; }
  .ct-banner { padding: 72px 0; }
  .ct-banner::after { inset: 10px; }
  .ct-banner-in { flex-direction: column; align-items: flex-start; }
  .ct-faq { grid-template-columns: 1fr; gap: 32px; }
  .ct-faq > :first-child { position: static; }
  .ct-footer-grid { grid-template-columns: 1fr; gap: 28px; }
  .ct-lightbox { padding: 16px; }
  .ct-login-menu { right: -60px; }
}
`;
