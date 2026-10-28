# Soohyuk blog

React · TypeScript · React Router SSG · CSS Modules로 만든 Markdown 개발 블로그입니다. Cloudflare Pages에서 빌드하고 `https://blog.soohyuk.dev`로 서비스하도록 구성했습니다. 런타임 SSR 서버나 GitHub API를 호출하는 클라이언트 코드 없이 글별 완성된 HTML을 배포합니다.

## 로컬 실행

Node.js 24와 npm을 사용합니다.

```bash
npm ci
npm run dev
```

기본 주소는 `http://localhost:5173`입니다. 콘텐츠 저장소를 설정하지 않으면 `tests/fixtures/content-repo/`의 **개발·테스트용 샘플 글**을 사용하고 화면에 샘플 표시가 나타납니다.

```bash
npm test
npm run typecheck
npm run build
npm run preview
```

`preview`는 `http://localhost:4173`에서 Cloudflare Pages의 정적 경로·404 응답을 확인합니다. `typecheck`도 필요한 콘텐츠를 먼저 생성합니다.

빌드 결과와 실제 브라우저 검증은 다음과 같이 실행합니다.

```bash
npm run verify:build
npx playwright install chromium
npm run test:e2e
```

브라우저 테스트는 `npm run build:test`로 테스트 데이터를 빌드한 뒤 실행합니다. `.env`의 실제 글 저장소 대신 샘플 콘텐츠와 주입한 링크 미리보기 응답을 사용하므로 외부 네트워크에 의존하지 않습니다. 데스크톱·모바일, JavaScript 비활성화, 검색 오류 복구, 테마 저장, 링크 미리보기와 이미지 실패 복구, 실제 404와 axe 접근성 검사를 포함합니다. 실제 콘텐츠를 복원하려면 `npm run build`를 실행하세요.

## 별도 글 저장소 만들기

1. 공개 GitHub 저장소를 생성합니다. 기본 브랜치는 `main`을 사용합니다.
2. `examples/content-repo/`의 내용 전체를 새 저장소 루트로 복사합니다. `.github/`도 포함합니다.
3. 샘플 글을 실제 글로 교체하고 일반 글은 `posts/`, 짧은 글은 저장소 루트의 `shorts/` 아래에서 관리합니다. 작성 규칙은 [콘텐츠 템플릿 안내](examples/content-repo/README.md)를 참고하세요.
4. `.env.example`을 `.env`로 복사하고 `CONTENT_REPOSITORY=owner/repository`를 설정합니다.

```dotenv
CONTENT_REPOSITORY=your-account/blog-content
CONTENT_BRANCH=main
```

공개 GitHub URL도 사용할 수 있습니다. `CONTENT_LOCAL_DIR=/absolute/path/to/content-repository`를 설정하면 로컬에서는 해당 디렉토리를 사용합니다. 로컬 글을 수정한 뒤 `npm run sync:content`를 실행하면 앱의 생성 데이터가 갱신됩니다. 생성된 데이터와 내려받은 저장소는 Git에서 제외합니다.

### Obsidian에서 글 작성

[Obsidian 플러그인](obsidian/README.md)을 설치하면 `posts/` 아래 새 Markdown 글에 블로그용 frontmatter를 자동으로 추가합니다. 기본 태그와 초안 여부는 플러그인 설정에서 지정하며, 기존 frontmatter 값은 유지합니다. 플러그인은 로컬 글 작성을 돕고, GitHub에 올린 뒤의 빌드·배포는 아래 Deploy Hook 구성이 담당합니다.

Obsidian 이미지 임베드 `![[그림.png]]`와 `![[images/그림.png]]`를 지원합니다. 이미지는 `posts/` 내부 또는 저장소 루트 `images/`에 보관하며, 게시된 글이 참조한 파일만 배포합니다. 파일명만 쓰면 현재 글의 폴더를 먼저 찾고, 후보가 여러 개이거나 파일이 없으면 빌드 오류로 알립니다. 공백·한글 파일명, 대체 텍스트와 크기 지정은 [이미지 작성 안내](examples/content-repo/README.md#이미지와-링크)를 참고하세요.

### 짧은 글과 링크 남기기

콘텐츠 저장소 루트의 `shorts/*.md`는 **짧은 글**(`/shorts`) 화면에서 최신순 세로 피드로 표시합니다. 각 항목의 본문과 링크를 같은 화면에서 읽으며 별도 글 페이지를 만들지 않습니다. 일반 글의 검색·폴더·태그·최근 글 수에 포함하지 않습니다.

```markdown
---
date: "2026-10-28"
---

오늘 배운 점을 짧게 남깁니다.
```

필수 항목은 `date`이며, 선택 항목은 HTTP/HTTPS 주소 `link`, 링크 제목 `linkTitle`, 비공개 초안 `draft: true`입니다. 게시하는 글에는 본문 또는 링크 중 하나가 있어야 하며, 작성 중인 빈 초안은 허용합니다. 날짜와 시간은 `2026-10-28T17:30:00+09:00`처럼 시간대를 포함해 작성할 수 있고 KST로 표시합니다. Markdown/GFM의 안전한 텍스트·링크를 지원합니다. `shorts/`가 없는 기존 콘텐츠 저장소는 그대로 빌드되고 빈 피드를 표시합니다. 자세한 지원 범위와 예제는 [짧은 글 작성 안내](examples/content-repo/README.md#짧은-글)를 참고하세요.

`link`를 지정하면 빌드할 때 공개 웹 페이지의 Open Graph·Twitter 메타데이터와 제목·설명을 읽어 링크 미리보기를 만듭니다. 표시 제목은 직접 작성한 `linkTitle`, 가져온 제목, 원래 주소 순으로 선택합니다. 이미지는 검증 후 크기를 줄여 로컬 WebP 정적 파일로 배포하며 브라우저에서 원격 이미지를 직접 요청하지 않습니다. 이미지가 없으면 제목·설명을 표시하고, 메타데이터 요청이 실패하거나 사이트가 자동 요청을 차단하면 일반 링크로 표시합니다. 미리보기 실패로 블로그 빌드를 중단하지 않습니다. 같은 주소는 빌드당 한 번만 요청하고 다음 빌드에서 새로 갱신하며 삭제된 미리보기 파일은 함께 정리합니다.

## Cloudflare Pages 연결

**Workers & Pages → Create application → Pages → Import an existing Git repository**에서 이 **코드 저장소**를 연결합니다. 이 앱 폴더 자체를 코드 저장소 루트로 사용하는 구성을 기준으로 합니다.

| 항목 | 값 |
| --- | --- |
| 프레임워크 preset | None |
| 운영 브랜치 | `main` |
| Root directory | 저장소 루트 (앱이 하위 폴더라면 해당 경로) |
| Build command | `npm run build` |
| Build output directory | `build/client` |
| `NODE_VERSION` | `24` |
| `CONTENT_REPOSITORY` | 공개 글 저장소의 `owner/repository` |
| `CONTENT_BRANCH` | `main` |

운영과 미리보기 환경 모두 콘텐츠 환경변수를 설정하세요. Cloudflare Pages에서는 `CONTENT_REPOSITORY`가 없으면 빌드를 실패시켜 샘플이 실수로 게시되는 것을 방지합니다. `CONTENT_LOCAL_DIR`은 Pages에서 사용하지 않습니다.

빌드는 매번 지정한 콘텐츠 브랜치를 새로 내려받고 커밋 SHA를 로그에 남깁니다. 콘텐츠 다운로드, frontmatter, 중복 slug, 상대 링크, 수식 검증에 실패하면 배포하지 않습니다. Git 연동은 코드 변경을 자동 빌드하고, 다음 Deploy Hook 설정은 별도 글 저장소의 변경을 연결합니다.

### 글 저장소에서 재빌드 요청

1. Pages 프로젝트의 **Settings → Builds → Add deploy hook**에서 `main`용 Hook을 만듭니다.
2. 글 저장소의 **Settings → Secrets and variables → Actions → New repository secret**을 엽니다.
3. 이름을 `CLOUDFLARE_PAGES_DEPLOY_HOOK`으로 지정하고 Hook URL을 값으로 저장합니다. URL은 코드나 Markdown에 커밋하지 않습니다.
4. 글 저장소에서 `main`의 `posts/**`, `images/**`, `shorts/**` 변경을 커밋합니다. 기존 workflow의 `paths`에 `images/**`와 `shorts/**`가 없다면 추가해야 이미지나 짧은 글 변경만으로도 재빌드됩니다.
5. 글 저장소 Actions에서 요청 성공을, Pages에서 실제 빌드·배포 성공을 확인합니다.

```text
글 저장소 main 변경 → GitHub Actions → Pages Deploy Hook
→ 코드와 최신 콘텐츠 다운로드 → Markdown 처리 → React Router SSG
→ sitemap·404 생성 → Pages 배포
```

### blog.soohyuk.dev 연결

Pages 프로젝트의 **Custom domains → Set up a custom domain**에서 `blog.soohyuk.dev`를 먼저 등록합니다. 같은 Cloudflare 계정에서 DNS를 관리한다면 안내에 따라 레코드를 생성합니다. 외부 DNS를 사용한다면 Pages가 안내하는 프로젝트의 `*.pages.dev` 주소로 `blog` CNAME을 연결합니다. 기존 `blog` DNS 레코드가 있다면 충돌을 확인하세요.

도메인이 Active가 된 뒤 글 본문, canonical, sitemap과 직접 접속/새로고침을 확인합니다. 별도 서버나 Cloudflare API 토큰은 이 구성에 필요하지 않습니다.

## 구성과 동작

- `app/`: React 화면, 폴더 트리, 목록, 글, 목차, 태그, 검색, 테마. CSS Modules로 스타일링합니다.
- `scripts/prepare.mjs`: 생성 정적 폴더를 초기화하고 콘텐츠·라이선스를 차례로 생성합니다. `dev`, `build`, `typecheck`, `sync:content`가 공통으로 사용합니다.
- `public/`: favicon 등 직접 관리하는 정적 원본만 보관합니다. 원본과 생성된 검색 인덱스·이미지·라이선스 고지는 `.cache/public/`에 모이며, Vite가 개발 서버와 배포 빌드에 사용합니다.
- `scripts/content.mjs`: 콘텐츠 동기화, YAML 검증, Markdown/GFM·KaTeX·Shiki 렌더링, 링크·이미지 변환, 검색 인덱스 생성. 개발 서버에서도 사용할 sitemap·OG 이미지를 함께 생성합니다.
- `scripts/shorts.mjs`: 별도 `shorts/` 컬렉션의 날짜·링크 검증, 안전한 Markdown 렌더링과 최신순 정렬. `app/generated/shorts.json`으로 생성하고 `/shorts`의 초기 HTML에 모두 포함합니다.
- `scripts/short-previews.mjs`: 빌드 시 공개 HTTP/HTTPS 링크의 메타데이터를 parse5로 읽고 이미지 서명·크기를 검증해 `/short-previews/`의 로컬 WebP로 저장합니다. DNS 주소와 리다이렉트를 검사하고 요청 시간·응답 크기를 제한합니다. 브라우저용 미리보기 API는 없습니다.
- `app/components/ArticleContent.tsx`: Mermaid 코드 블록이 있는 글에서만 렌더러를 불러와 다이어그램을 표시합니다. 테마 변경에 맞춰 다시 그리며, 소스와 오류 시 다시 시도를 제공합니다. JavaScript가 꺼진 경우에도 소스 코드는 초기 HTML에 남습니다.
- `scripts/licenses.mjs`: 직접·간접 의존성의 실제 버전과 라이선스를 확인하고 배포할 원문 고지를 생성합니다. [라이선스 목록](docs/THIRD_PARTY_NOTICES.md)을 갱신하며 빌드 검증에서 `/third-party-notices.txt` 누락을 검사합니다.
- `react-router.config.ts`: 공개 글·폴더·태그 및 `/shorts` URL을 열거해 `ssr: false`로 사전 렌더링.
- `scripts/finalize.mjs`: 한글 파일명과 Pages의 확장자 없는 URL에 맞춘 HTML 출력, 실제 404와 미리보기 인덱싱 헤더 처리.
- `tests/fixtures/content-repo/`: 콘텐츠 저장소 미설정 시 개발 서버와 로컬 빌드에서 사용하는 테스트 데이터. 콘텐츠 테스트에서도 같은 데이터를 검증합니다.
- `examples/content-repo/`: 별도 공개 저장소에 복사하는 템플릿. 최소 작성 예제 한 편과 Deploy Hook workflow 포함.
- `docs/`: [제품 명세](docs/PRODUCT.md)와 의존성 라이선스 목록.

글은 `/posts/{slug}`, 폴더는 `/folders/{경로}`, 태그는 `/tags/{태그}`, 짧은 글은 `/shorts`입니다. 일반 글은 폴더를 옮겨도 slug가 같으면 주소가 유지됩니다. 짧은 글의 개별 참조는 파일명에서 생성한 `/shorts#...` 앵커를 사용하므로 파일을 옮기거나 이름을 바꾸면 달라집니다. 검색은 `/search?q=...`에서 일반 글의 제목·태그·설명·본문의 모든 검색어를 찾고 제목 일치를 우선 표시합니다. 테마는 시스템/라이트/다크 순서로 전환하고 선택을 로컬에 저장합니다.

메타데이터, canonical, OG, BlogPosting 구조화 데이터와 글·코드·수식은 초기 HTML에 포함됩니다. 검색과 404는 `noindex`, 코드 저장소의 비운영 브랜치 빌드는 `X-Robots-Tag: noindex, nofollow`로 표시합니다. CSS·JS·KaTeX·IBM Plex Sans·Noto Sans KR 폰트와 참조 이미지는 로컬 정적 파일로 제공합니다.

## 배포 확인

- 글 추가·수정·삭제 후 Pages 배포 결과와 도메인에서의 반영을 확인합니다.
- 파일을 다른 폴더로 옮기고 상대 링크를 고친 뒤, 기존 `/posts/{slug}` URL이 유지되는지 확인합니다.
- 잘못된 글과 중복 slug는 빌드를 실패시켜야 합니다.
- 없는 주소는 홈 화면으로 대체하지 않고 HTTP 404로 응답해야 합니다.
- JavaScript를 비활성화해도 본문·수식·코드·폴더 링크를 읽을 수 있어야 합니다.

참고: [React Router pre-rendering](https://reactrouter.com/how-to/pre-rendering), [Pages Git integration](https://developers.cloudflare.com/pages/configuration/git-integration/), [Deploy Hooks](https://developers.cloudflare.com/pages/configuration/deploy-hooks/), [Custom domains](https://developers.cloudflare.com/pages/configuration/custom-domains/).
