# Design

## Authority
The approved implementation plan pins a reading surface with a visible folder hierarchy, a left navigation tree, central prose, a right article outline, and mobile menus. Preserve that composition. It takes precedence over unrelated visual directions.

## Visual system
A quiet developer's reading desk using the supplied teal-to-yellow palette: white surfaces, deep green text, teal links, lime selected states and brand marks, fine structural rules, and ample space between article rows. Dark mode uses deep green surfaces and lemon-lime links. IBM Plex Sans is self-hosted for the identity and Latin UI; Korean prose uses self-hosted, Unicode-subset Noto Sans KR. Monospace is reserved for code and paths. Article text measures approximately 70 characters.

Type has a 12px floor: no visible text, including metadata, tags, keyboard hints, footers, and labels, renders below 12px at any width. Metadata, dates, reading time, and tags use 12–13px; the article outline and sidebar article links use 13px; adjacent-article titles use 15px. Code blocks use 13px on desktop and 12px below 560px. Metadata recedes through muted color and weight, not through smaller size.

The ten primitive colors in app/styles/global.css are fixed samples from the supplied palette. Each 8-bit RGB channel receives an independent N(0, 5) sample (variance 5, standard deviation sqrt(5)), then is rounded and clamped to 0–255; alpha stays ff. Reproduce with Python random.Random(20261016), three successive gauss(0, sqrt(5)) calls per supplied color in its original order. Light and dark surface/text tokens use readable tints and shades derived from these samples and neutrals. Colors never resample during rendering or builds. Primitive CSS variable names use arbitrary fixed identifiers (--c-v7m2, etc.), as requested; their order matches the supplied palette.

## Composition
Use an approximately 260px persistent left sidebar at desktop widths, a flexible main column, and a 200px article outline on wide screens. The main index is a chronological list, not a grid of cards. Article metadata recedes behind the title and prose. Folder lists and tag lists inherit the same rows. The home list is grouped by publication year with a quiet year subheading; it stays a single chronological list. Below 900px, navigation becomes a native dialog opened from the header; the outline becomes a disclosure above the article body.
The home page starts directly with the latest articles. Navigation and page headings use concise labels without taglines or introductory paragraphs.
Article rows lead with the title and description, followed by folder and tags. Dates sit at the right edge; on narrow screens they follow the content and remain aligned right.
On article pages the breadcrumb shows only the home and folder path; the article title appears once, as the h1. Each destination link appears once per region: RSS lives in the sidebar footer and the main footer, not in the home list header. Adjacent-article links close the article with a generous hit area.

## Interaction
Use native disclosure elements for folders, a modal dialog for the mobile navigation drawer, real anchor links for all destinations, visible focus rings, and an explicit theme cycle. Motion is limited to a short drawer entrance and respects reduced motion. Search reports loading, errors with retry, empty results, and result counts. Sample mode is clearly labeled in the local header.

Code blocks carry a header row with the language label on the left and a copy button on the right; copying shows a brief "복사됨" state announced through a live region. Article headings h2–h4 expose a "#" anchor link that appears on hover and keyboard focus and is always reachable by keyboard. Both are progressive enhancements: published HTML remains complete without JavaScript.
The article outline highlights the last heading scrolled past (not merely the last one entering the viewport), including while scrolling upward, and marks it with a 2px lime bar at its leading edge. Heading scroll offset matches the actual sticky chrome: about 24px on desktop and the sticky header height plus spacing below 900px.
Search results show a short excerpt around the first match in the body, with matched terms wrapped in <mark>. The search shortcut hint reads "⌘ K" on Apple platforms and "Ctrl K" elsewhere, decided after hydration.
