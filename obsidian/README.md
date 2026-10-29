# Soohyuk Blog Frontmatter

블로그 글과 `shorts/`의 짧은 글을 만들고 각 형식에 맞는 frontmatter를 추가하는 로컬 Obsidian 플러그인입니다. 버전 1.1.0은 Obsidian 1.5.13 이상을 지원하며, 별도 웹 서버 없이 데스크톱·모바일의 Obsidian API를 사용합니다.

## 설치

이 플러그인은 커뮤니티 플러그인 목록에서 검색해 설치하는 방식이 아니라, 직접 빌드한 파일을 보관함에 복사해 설치합니다. **Obsidian 1.5.13 이상**과 빌드할 컴퓨터의 **Node.js 24 이상 및 npm**이 필요합니다. 모바일에서도 사용할 수 있지만, 빌드는 컴퓨터에서 한 뒤 결과물을 모바일 보관함으로 옮겨야 합니다.

### 1. 글 보관함 준비

**별도 글 저장소의 루트**를 Obsidian 보관함으로 엽니다. 이 플러그인은 보관함 루트의 `posts/`에 블로그 글을, `shorts/`에 짧은 글을 작성하는 [블로그 콘텐츠 형식](../examples/content-repo/README.md)에 맞춰져 있습니다. 없는 폴더는 글을 만들 때 생성됩니다.

### 2. 플러그인 빌드

터미널에서 이 프로젝트의 루트로 이동한 다음 실행합니다. 블로그 웹앱과 의존성 설치·빌드는 분리되어 있습니다.

```bash
cd blog/obsidian
npm ci
npm test
npm run build
```

### 3. 보관함에 복사

생성된 **`blog/obsidian/dist/soohyuk-blog-frontmatter/` 폴더 전체**를 글 보관함의 `.obsidian/plugins/` 아래에 복사합니다. `plugins/`가 없으면 만듭니다. `main.js`, `manifest.json`, `styles.css`, `LICENSE`, `THIRD_PARTY_NOTICES.md`, `THIRD_PARTY_NOTICES.json`, `licenses/`를 함께 보관하세요.

```text
글 저장소/
  .obsidian/plugins/soohyuk-blog-frontmatter/
    main.js
    manifest.json
    styles.css
    LICENSE
    THIRD_PARTY_NOTICES.md
    THIRD_PARTY_NOTICES.json
    licenses/
  posts/
  shorts/
  images/
```

`.obsidian`은 숨김 폴더이므로 파일 관리자에서 숨김 파일 표시를 켜야 할 수 있습니다. Obsidian에서 설정 폴더 이름을 변경했다면 `.obsidian` 대신 그 폴더를 사용합니다. 모바일에서는 파일 앱이나 동기화 수단을 통해 같은 경로에 복사합니다.

### 4. 활성화 및 확인

1. Obsidian을 다시 열고 **설정 → 커뮤니티 플러그인**으로 이동합니다.
2. 제한 모드가 켜져 있다면 **커뮤니티 플러그인 켜기**를 선택합니다.
3. 설치된 플러그인 목록에서 **Soohyuk Blog Frontmatter**를 켭니다.
4. 명령 팔레트에서 **새 블로그 글** 또는 **새 짧은 글**을 실행해 파일이 생성되는지 확인합니다.

목록에 나타나지 않으면 올바른 보관함에 복사했는지, `plugins/soohyuk-blog-frontmatter/` 바로 아래에 `main.js`와 `manifest.json`이 있는지 확인한 후 Obsidian을 다시 시작합니다.

### 업데이트

새 버전을 위와 같이 빌드하고 플러그인을 비활성화한 뒤, 빌드된 폴더의 내용을 기존 `soohyuk-blog-frontmatter/` 폴더에 덮어씁니다. 기존 폴더를 통째로 삭제하지 마세요. 플러그인 설정이 저장된 `data.json`을 유지해야 합니다. 복사 후 플러그인을 다시 활성화합니다.

공개 글 저장소의 `.gitignore`에는 `.obsidian/`를 추가하세요. 이미 Git이 추적하는 파일은 `.gitignore`를 추가해도 자동으로 추적이 해제되지 않습니다.

## 사용

명령 팔레트에서 **새 블로그 글**을 실행하고 제목을 입력하면 `posts/`에 글을 만듭니다. 폴더가 없으면 생성합니다. 제목의 파일명 금지 문자는 `-`로 바꾸지만 `title`에는 입력한 제목을 그대로 사용합니다. 같은 파일명이 있으면 덮어쓰지 않고 오류를 표시합니다.

```yaml
---
title: 새 글의 제목
slug: 새-글의-제목
date: "2026-10-16"
description: ""
tags: []
draft: true
---
```

날짜는 글을 만드는 기기의 **로컬 날짜**입니다. YAML의 따옴표·목록 표시는 Obsidian이 정하며 블로그에서 같은 값으로 읽힙니다. `slug`는 제목에서 소문자 영문·한글 등 문자와 숫자, 하이픈으로 만들고, 설정한 글 폴더의 다른 글과 겹치면 `-2`, `-3`을 붙입니다. 동시 생성도 순서대로 처리합니다.

일반 Obsidian 명령으로 새 `.md` 파일을 만들 때도 지정 폴더와 그 하위 폴더에 자동으로 속성을 추가합니다. 이 경우 **처음 생성한 파일명**을 제목과 slug의 기준으로 사용합니다. 처음부터 원하는 제목을 쓰려면 **새 블로그 글** 명령을 사용하세요.

기존 글은 **현재 글 frontmatter 추가** 명령으로 누락된 기본 속성만 채울 수 있습니다. 기존 `title`, `slug`, `date`, `tags`, `draft` 및 사용자 정의 속성은 보존합니다. 이미 있는 빈 값이나 잘못된 값도 덮어쓰지 않으므로 필요한 수정은 직접 하세요. 본문과 코드 블록은 Obsidian의 `processFrontMatter` API로 보존하며 기존 YAML의 표기·서식은 바뀔 수 있습니다.

### 짧은 글

**새 짧은 글** 명령에서 본문 또는 링크를 입력하면 보관함 루트의 `shorts/`에 파일을 만들고 엽니다. 링크만 입력해도 저장할 수 있습니다. 제목·slug·설명·태그를 요구하지 않으며 파일에는 기본으로 `date`와 `draft`만 추가합니다. 선택한 링크와 링크 제목은 빈 값을 제외하고 앞뒤 공백을 정리해 저장합니다.

```markdown
---
date: "2026-10-28T03:04:05.006Z"
draft: true
link: https://example.com/article
linkTitle: 다시 읽어볼 글
---

짧게 남기는 메모입니다. 본문과 링크 중 하나만 있어도 됩니다.
```

`link`는 사용자 이름·비밀번호가 없는 `http://` 또는 `https://` 전체 주소여야 합니다. `linkTitle`은 링크가 있을 때만 사용할 수 있고 비워 두어도 됩니다. 링크 미리보기의 제목·설명·이미지는 **블로그 빌드가 자동으로 가져옵니다.** 이 플러그인은 링크 메타데이터를 요청하거나 글을 배포하지 않습니다.

날짜는 시간대를 명시한 ISO UTC 시각(`Z`)으로 저장합니다. 파일명은 `2026-10-28T03-04-05-006Z.md`처럼 만들며 같은 시각의 파일이 있으면 `-2`, `-3`을 붙여 기존 파일을 보존합니다. `shorts/`는 고정 경로이며 별도의 폴더 설정은 없습니다.

일반 Obsidian 명령으로 `shorts/`와 그 하위 폴더에 새 Markdown 파일을 만들 때도 자동 추가 설정이 켜져 있으면 빠진 `date`·`draft`만 추가합니다. **현재 글 frontmatter 추가**는 파일 위치에 따라 블로그 글과 짧은 글을 구분합니다. 기존 날짜·초안 상태·링크·사용자 속성과 본문을 덮어쓰지 않습니다. 자동 추가를 꺼도 두 새 글 명령은 완성된 기본 속성을 작성합니다.

### 블로그 글의 이미지

전체 블로그 글은 보관함 루트 `images/`의 이미지를 `![[filename.png]]` 같은 Obsidian 임베드로 사용할 수 있습니다. 이미지를 옮기거나 Obsidian의 전역 첨부 파일 설정을 변경할 필요가 없습니다. 기존 Markdown 이미지 참조도 블로그 콘텐츠 형식에 따라 계속 사용할 수 있습니다.

글을 옮기거나 파일명을 바꿔도 제목과 slug를 자동 변경하지 않습니다. Obsidian 시작 시 기존 글을 일괄 수정하지 않습니다. 잘못된 YAML은 수정하지 않고 파일명과 오류를 알립니다. slug 중복을 확인할 때 다른 글의 YAML 오류가 발견되면 해당 오류를 먼저 고쳐야 합니다.

새 글은 기본으로 `draft: true`입니다. 공개할 준비가 되면 `false`로 바꾸세요. `updated`는 자동 생성하거나 갱신하지 않습니다. 글 저장소의 Git push와 Pages Deploy Hook은 [기존 블로그 배포 설정](../README.md#글-저장소에서-재빌드-요청)을 사용합니다.

## 설정

| 설정 | 기본값 | 동작 |
| --- | --- | --- |
| 글 폴더 | `posts` | 블로그 글의 보관함 기준 경로. 하위 폴더를 포함하고 `posts-archive` 등은 제외합니다. `shorts/`와 겹칠 수 없습니다. |
| 짧은 글 폴더 | `shorts` | 보관함 루트의 고정 경로입니다. |
| 기본 태그 | 비어 있음 | 쉼표로 구분합니다. 기존 `tags`가 없는 블로그 글에만 적용합니다. |
| 새 글에 자동 추가 | 켜짐 | 블로그 글과 짧은 글에 각 형식의 기본 속성을 추가합니다. 끄면 명령으로만 추가합니다. |
| 기본 초안 상태 | 켜짐 | 두 형식에 새로 추가하는 `draft`의 값을 정합니다. |

태그는 한글·공백·`C#`·`C++`를 지원합니다. 빈 태그, `/`, `\`, `%`, 줄바꿈, `.` 및 `..`은 허용하지 않습니다. 잘못된 경로나 태그를 입력하면 오류를 표시하고 이전의 유효한 설정을 유지합니다.

글 폴더를 `shorts` 또는 그 하위 경로로 지정하면 오류를 표시합니다. 이전 설정에 겹치는 경로가 저장되어 있으면 시작 시 알림을 표시하고 메모리에서 `posts`를 사용합니다. 기존 파일이나 저장된 설정은 자동으로 변경하지 않으므로 설정에서 올바른 글 폴더를 지정하세요.

## 개발과 검증

```bash
npm run typecheck
npm test
npm run build
npm run verify:licenses
```

`npm run dev`는 `src/` 변경을 감시하여 `dist/soohyuk-blog-frontmatter/main.js`를 갱신합니다. 보관함으로의 자동 복사는 하지 않습니다.

테스트는 기본값의 반복 적용, 기존 속성·본문 보존, Unicode와 중복 slug, 폴더 경계, 로컬 날짜, YAML 오류, Obsidian 시작·종료 이벤트, 자동 추가·명령·설정 동작을 검사합니다. 짧은 글의 HTTP(S) 주소 검증, 시간대·파일명 충돌, 고정 폴더 구분, 모달 오류 복구·중복 제출 방지·IME 단축키도 검사합니다. Obsidian API는 테스트 대역을 사용하며 실제 Obsidian 앱에서의 시각·기기별 동작은 이 환경에서 확인하지 못했습니다. 설치 후 새 글·새 짧은 글·기존 글 명령을 한 번 확인하세요.

블로그 웹앱의 의존성도 설치된 저장소에서는 `npm run test:blog-compat`로 플러그인이 작성한 파일을 실제 블로그 파서에 전달하는 추가 통합 검사를 실행할 수 있습니다. 본문·링크 전용 글과 작성 중인 빈 초안의 비공개 처리를 확인하며 블로그의 생성 데이터나 빌드 결과는 변경하지 않습니다.

런타임 외부 라이브러리·폰트·아이콘을 번들에 넣지 않습니다. Obsidian이 제공하는 API만 외부 참조합니다. 개발·간접·선택 의존성의 정확한 버전과 라이선스는 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)에, 필수 원문은 `licenses/`에 보존합니다. 의존성을 바꾼 뒤에는 실제 라이선스를 검토하고 `npm run licenses`로 갱신하세요. 빌드는 lockfile과 원문 고지의 일치, 배포 폴더의 고지 누락, 의도하지 않은 외부 코드 포함 여부를 검사합니다.

API 근거: [frontmatter API와 최소 버전](https://github.com/obsidianmd/obsidian-api/blob/master/obsidian.d.ts), [시작 시 create 이벤트 처리](https://docs.obsidian.md/plugins/guides/load-time), [플러그인 설치·빌드](https://docs.obsidian.md/Plugins/Getting%20started/Build%20a%20plugin), [manifest](https://docs.obsidian.md/Reference/Manifest).
