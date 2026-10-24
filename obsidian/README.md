# Soohyuk Blog Frontmatter

블로그용 Markdown 글에 기본 frontmatter를 추가하는 로컬 Obsidian 플러그인입니다. Obsidian 1.5.13 이상을 지원하며, 별도 웹 서버 없이 데스크톱·모바일의 Obsidian API를 사용합니다.

## 설치

**별도 글 저장소의 루트**를 Obsidian 보관함으로 엽니다. 루트의 `posts/` 아래에 글을 작성하는 [블로그 콘텐츠 형식](../examples/content-repo/README.md)에 맞춰져 있습니다.

프로젝트 루트에서 Node.js 24 이상과 npm으로 빌드합니다. 블로그 웹앱과 의존성 설치·빌드는 분리되어 있습니다.

```bash
cd blog/obsidian
npm ci
npm test
npm run build
```

생성된 **`dist/soohyuk-blog-frontmatter/` 폴더 전체**를 글 보관함의 `.obsidian/plugins/` 아래에 복사합니다. `main.js`, `manifest.json`, `LICENSE`, `THIRD_PARTY_NOTICES.md`, `THIRD_PARTY_NOTICES.json`, `licenses/`를 함께 보관하세요.

```text
글 저장소/
  .obsidian/plugins/soohyuk-blog-frontmatter/
    main.js
    manifest.json
    LICENSE
    THIRD_PARTY_NOTICES.md
    THIRD_PARTY_NOTICES.json
    licenses/
  posts/
```

Obsidian을 다시 열고 **설정 → 커뮤니티 플러그인**에서 제한 모드를 해제한 다음 **Soohyuk Blog Frontmatter**를 켭니다. 업데이트할 때도 빌드한 폴더 전체를 복사하고 플러그인을 다시 켭니다. 공개 글 저장소의 `.gitignore`에는 `.obsidian/`를 추가하세요.

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

글을 옮기거나 파일명을 바꿔도 제목과 slug를 자동 변경하지 않습니다. Obsidian 시작 시 기존 글을 일괄 수정하지 않습니다. 잘못된 YAML은 수정하지 않고 파일명과 오류를 알립니다. slug 중복을 확인할 때 다른 글의 YAML 오류가 발견되면 해당 오류를 먼저 고쳐야 합니다.

새 글은 기본으로 `draft: true`입니다. 공개할 준비가 되면 `false`로 바꾸세요. `updated`는 자동 생성하거나 갱신하지 않습니다. 글 저장소의 Git push와 Pages Deploy Hook은 [기존 블로그 배포 설정](../README.md#글-저장소에서-재빌드-요청)을 사용합니다.

## 설정

| 설정 | 기본값 | 동작 |
| --- | --- | --- |
| 글 폴더 | `posts` | 보관함 기준 경로. 하위 폴더를 포함하고 `posts-archive` 등은 제외합니다. |
| 기본 태그 | 비어 있음 | 쉼표로 구분합니다. 기존 `tags`가 없는 글에만 적용합니다. |
| 새 글에 자동 추가 | 켜짐 | 끄면 명령으로만 기본 속성을 추가합니다. |
| 기본 초안 상태 | 켜짐 | 새로 추가하는 `draft`의 값을 정합니다. |

태그는 한글·공백·`C#`·`C++`를 지원합니다. 빈 태그, `/`, `\`, `%`, 줄바꿈, `.` 및 `..`은 허용하지 않습니다. 잘못된 경로나 태그를 입력하면 오류를 표시하고 이전의 유효한 설정을 유지합니다.

## 개발과 검증

```bash
npm run typecheck
npm test
npm run build
npm run verify:licenses
```

`npm run dev`는 `src/` 변경을 감시하여 `dist/soohyuk-blog-frontmatter/main.js`를 갱신합니다. 보관함으로의 자동 복사는 하지 않습니다.

테스트는 기본값의 반복 적용, 기존 속성·본문 보존, Unicode와 중복 slug, 폴더 경계, 로컬 날짜, YAML 오류, Obsidian 시작·종료 이벤트, 자동 추가·명령·설정 동작을 검사합니다. Obsidian API는 테스트 대역을 사용하며 실제 Obsidian 앱에서의 시각·기기별 동작은 이 환경에서 확인하지 못했습니다. 설치 후 새 글과 기존 글 명령을 한 번 확인하세요.

런타임 외부 라이브러리·폰트·아이콘을 번들에 넣지 않습니다. Obsidian이 제공하는 API만 외부 참조합니다. 개발·간접·선택 의존성의 정확한 버전과 라이선스는 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)에, 필수 원문은 `licenses/`에 보존합니다. 의존성을 바꾼 뒤에는 실제 라이선스를 검토하고 `npm run licenses`로 갱신하세요. 빌드는 lockfile과 원문 고지의 일치, 배포 폴더의 고지 누락, 의도하지 않은 외부 코드 포함 여부를 검사합니다.

API 근거: [frontmatter API와 최소 버전](https://github.com/obsidianmd/obsidian-api/blob/master/obsidian.d.ts), [시작 시 create 이벤트 처리](https://docs.obsidian.md/plugins/guides/load-time), [플러그인 설치·빌드](https://docs.obsidian.md/Plugins/Getting%20started/Build%20a%20plugin), [manifest](https://docs.obsidian.md/Reference/Manifest).
