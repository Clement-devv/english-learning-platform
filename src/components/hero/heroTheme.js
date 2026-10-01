// src/pages/homework-link/heroTheme.js
// "Hero mission" theme for the kids' homework link page AND the graded-homework
// PDF, so both look like the same world: bright sky, comic-book ink outlines,
// sunny yellow and hero red. Deliberately not the center brand colour — this is
// a kids' theme and should look the same for every center.

export const HERO = {
  skyTop:    "#5EC8F8",
  skyBottom: "#C9EEFF",
  skyPale:   "#EAF7FF",   // PDF page background
  ink:       "#1F2A55",   // outlines + text (navy, not black: softer for kids)
  inkSoft:   "#56618A",
  paper:     "#FFFFFF",
  sun:       "#FFD23F",
  sunDeep:   "#F5A300",
  red:       "#FF5A5F",
  redDeep:   "#D93A40",
  blue:      "#2F7BF5",
  green:     "#2FC98A",
  greenPale: "#E3F9EF",
  cloud:     "#FFFFFF",
};

// Fonts: Mali (playful, rounded) for headings, Be Vietnam Pro for body.
// Both fully support Vietnamese.
export const HERO_FONTS = {
  heading: "'Mali', 'Baloo 2', 'Comic Sans MS', system-ui, sans-serif",
  body:    "'Be Vietnam Pro', 'Nunito', system-ui, sans-serif",
  cssHref: "https://fonts.googleapis.com/css2?family=Mali:wght@600;700&family=Be+Vietnam+Pro:wght@400;500;600;700&display=swap&subset=vietnamese",
  // Raw TTFs for jsPDF (Google Fonts repo via jsDelivr — complete, not subsetted)
  ttf: {
    headingBold: "https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/mali/Mali-Bold.ttf",
    body:        "https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/bevietnampro/BeVietnamPro-Regular.ttf",
    bodyBold:    "https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/bevietnampro/BeVietnamPro-Bold.ttf",
  },
};

/** Friendly stamp for a score — shown on the success screen and the PDF. */
export function scoreStamp(score) {
  if (score == null) return "";
  if (score >= 90) return "Super Hero!";
  if (score >= 75) return "Great Job!";
  if (score >= 50) return "Good Effort!";
  return "Keep Going!";
}
