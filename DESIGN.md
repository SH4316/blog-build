# Design

## Authority
The approved implementation plan pins a reading surface with a visible folder hierarchy, a left navigation tree, central prose, a right article outline, and mobile menus. Preserve that composition. It takes precedence over unrelated visual directions.

## Visual system
A quiet developer's reading desk using a blue palette: white reading surfaces, a pale blue sidebar, navy text, saturated blue links, and light blue selected states, with fine structural rules and ample space between article rows. Dark mode uses deep navy surfaces and light blue links. IBM Plex Sans is self-hosted for the identity and Latin UI; Korean prose uses self-hosted, Unicode-subset Noto Sans KR. Monospace is reserved for code and paths. Article text measures approximately 70 characters.

The brand uses Soohyuk's GitHub profile image beside the existing wordmark, with a blue period. The 128px PNG in public/github-avatar.png was retrieved from https://github.com/SH4316.png?size=128 on 2026-10-27 at the owner's request and is served locally. Render the avatar at 34px with its original circular appearance in the desktop sidebar, mobile header, and mobile drawer. The favicon and social preview use the same blue accent.

Type has a 12px floor: no visible text, including metadata, tags, keyboard hints, footers, and labels, renders below 12px at any width. Metadata, dates, reading time, and tags use 12–13px; the article outline and sidebar article links use 13px; adjacent-article titles use 15px. Code blocks use 13px on desktop and 12px below 560px. Metadata recedes through muted color and weight, not through smaller size.

The ten primitive colors in app/styles/global.css form a fixed blue ramp from #1d4ed8 to #f3f8ff. Semantic tokens map those colors to surfaces, text, links, selection, and focus, with separate light and dark values for readable contrast. Primitive CSS variable names retain the existing fixed identifiers (--c-v7m2, etc.). Colors never resample during rendering or builds.

## Composition
Use an approximately 260px persistent left sidebar at desktop widths, a flexible main column, and a 200px article outline on wide screens. The main index is a chronological list, not a grid of cards. Article metadata recedes behind the title and prose. Folder lists and tag lists inherit the same rows. The home list is grouped by publication year with a quiet year subheading; it stays a single chronological list. Below 900px, navigation becomes a native dialog opened from the header; the outline becomes a disclosure above the article body.
The home page starts directly with the latest articles. Navigation and page headings use concise labels without taglines or introductory paragraphs.
Article rows lead with the title and description, followed by folder and tags. Dates sit at the right edge; on narrow screens they follow the content and remain aligned right.
On article pages the breadcrumb shows only the home and folder path; the article title appears once, as the h1. The sidebar footer contains the GitHub profile link and theme control; the main footer contains the copyright notice. Adjacent-article links close the article with a generous hit area.

## Interaction
Use native disclosure elements for folders, a modal dialog for the mobile navigation drawer, real anchor links for all destinations, visible focus rings, and an explicit theme cycle. Motion is limited to a short drawer entrance and respects reduced motion. Search reports loading, errors with retry, empty results, and result counts. Sample mode is clearly labeled in the local header.

Code blocks carry a header row with the language label on the left and a copy button on the right; copying shows a brief "복사됨" state announced through a live region. Article headings h2–h4 expose a "#" anchor link that appears on hover and keyboard focus and is always reachable by keyboard. Both are progressive enhancements: published HTML remains complete without JavaScript.
The article outline highlights the last heading scrolled past (not merely the last one entering the viewport), including while scrolling upward, and marks it with a 2px blue bar at its leading edge. Heading scroll offset matches the actual sticky chrome: about 24px on desktop and the sticky header height plus spacing below 900px.
Search results show a short excerpt around the first match in the body, with matched terms wrapped in <mark>. The search shortcut hint reads "⌘ K" on Apple platforms and "Ctrl K" elsewhere, decided after hydration.
