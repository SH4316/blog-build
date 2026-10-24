# Product

<!-- impeccable:product-schema 1 -->

## Platform
web

## Stack
React, TypeScript, React Router static pre-rendering, CSS Modules. Markdown uses remark/rehype, KaTeX, and Shiki. Cloudflare Pages builds and hosts the site.

## Users
Soohyuk writes development articles. Readers browse Korean technical writing, code, and mathematics on desktop and mobile.

## Product Purpose
A readable development blog at https://blog.soohyuk.dev that updates automatically when Markdown changes on GitHub.

## Operating Context
Application code and public Markdown content live in separate GitHub repositories. Content directories are visible categories; each Markdown file is an article. Frontmatter contains a permanent slug independent of its directory. GitHub Actions calls a Pages deploy hook; Pages fetches content and builds static HTML.

## Capabilities and Constraints
Include nested folder navigation, latest articles, tags, browser-side full-text search, article table of contents, syntax highlighting, inline and display math, Mermaid diagrams, light/dark themes, RSS, and SEO. The desktop layout has a left folder tree, a central reading column, and a right table of contents. Mobile navigation opens as a menu. The content repository has not been created yet; provide a copyable template and local sample content. Production must require an explicitly configured content repository.

## Brand Commitments
Use Soohyuk as the site identity and blog.soohyuk.dev as the canonical domain. Prioritize the agreed reading and folder navigation layout.
Keep interface copy brief and factual. Omit introductory slogans and decorative explanations.
Place links to formatter.soohyuk.dev and base64.soohyuk.dev above sidebar search, and github.com/sh4316 below the navigation. Mirror these links in the mobile menu.

## Evidence on Hand
No existing application or published articles were supplied. Example articles must be identified as samples in the repository documentation and local development UI.

## Product Principles
- Publish complete article HTML without a runtime application server.
- Preserve article addresses when categories change.
- Make repository structure visible and navigable.
- Keep authoring in ordinary Markdown.
- Fail builds on invalid content instead of silently dropping articles.
