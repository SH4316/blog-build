---
title: "Git worktree로 작업 공간 나누기"
slug: "git-worktree"
date: "2026-10-08"
description: "현재 작업을 그대로 두고 다른 브랜치를 열고 싶을 때. 저장소를 공유하는 별도의 작업 디렉토리를 만들어봅니다."
tags: [Git, tools]
---

기능을 구현하던 중 다른 브랜치를 확인해야 할 때가 있습니다. `git worktree`를 사용하면 같은 저장소의 다른 브랜치를 별도 디렉토리에서 열 수 있습니다.

이 글은 셸 명령어와 목록을 보여주는 샘플입니다.

## 새 작업 공간 만들기

새 브랜치와 작업 디렉토리를 함께 만듭니다.

```bash
git worktree add -b feature/search ../project-search
cd ../project-search
```

저장소의 객체는 공유하지만, 작업 파일과 체크아웃된 브랜치는 분리됩니다. 같은 브랜치를 여러 worktree에서 동시에 체크아웃하는 것은 기본적으로 허용되지 않습니다.

## 현재 목록 확인하기

```bash
git worktree list
```

작업 공간별로 개발 서버를 실행한다면 포트도 다르게 설정해야 합니다. 의존성 설치 폴더처럼 작업 디렉토리 안에 있는 파일도 각 공간에서 관리합니다.

## 작업을 끝냈을 때

변경 사항을 정리한 뒤 기본 작업 디렉토리에서 제거합니다.

```bash
git worktree remove ../project-search
```

> worktree를 제거하는 것과 브랜치를 삭제하는 것은 별개의 작업입니다.

작은 도구의 사용법도 [연결된 기록](../notes/기록.md)으로 남겨두면 다시 찾아보기 편합니다.

### [[작은 기록들을 연결하는 방법|제목으로 연결한 기록]]

참고 자료: [캐시](/posts/http-cache)[수식](/posts/gradient-descent)
