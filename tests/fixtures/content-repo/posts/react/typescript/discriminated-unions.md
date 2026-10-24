---
title: "불가능한 상태를 줄이는 TypeScript 타입"
slug: "typescript-discriminated-unions"
date: "2026-10-14"
description: "여러 boolean 대신 판별 유니온을 사용해 로딩, 성공, 실패 상태를 명확하게 표현하는 방법."
tags: [TypeScript, React]
---

화면에 데이터를 표시할 때 `isLoading`, `hasError`, `data`를 따로 관리하면 서로 모순되는 조합이 생길 수 있습니다. 타입이 가능한 상태의 범위를 설명하도록 만들어 봅시다.

이 글은 중첩 폴더와 TypeScript 코드 표현을 보여주는 샘플입니다.

## 상태를 하나의 값으로 표현하기

상태마다 필요한 정보가 다르므로, 모든 정보를 하나의 객체에 선택적으로 넣기보다 상태별 객체를 정의합니다.

```typescript
type RemoteData<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; message: string };

type Article = {
  title: string;
  slug: string;
};

const state: RemoteData<Article> = {
  status: 'success',
  data: { title: '타입으로 표현하는 상태', slug: 'typed-state' },
};
```

`status`를 확인하면 TypeScript는 같은 분기의 다른 속성도 함께 좁힙니다.

## 화면에서 빠짐없이 처리하기

```tsx
function ArticleView({ state }: { state: RemoteData<Article> }) {
  switch (state.status) {
    case 'idle':
      return <p>글을 선택해주세요.</p>;
    case 'loading':
      return <p role="status">불러오는 중입니다.</p>;
    case 'success':
      return <h1>{state.data.title}</h1>;
    case 'error':
      return <p role="alert">{state.message}</p>;
  }
}
```

### 상태 전이를 읽기 쉽게 만들기

상태를 바꾸는 코드도 결과를 직접 드러냅니다. 성공 상태에서는 반드시 데이터가 존재하고, 실패 상태에서는 메시지가 존재합니다.

```typescript
setState({ status: 'loading' });

try {
  const data = await loadArticle();
  setState({ status: 'success', data });
} catch {
  setState({ status: 'error', message: '글을 불러오지 못했습니다.' });
}
```

## 타입이 도와주는 범위

타입은 런타임 응답을 자동으로 검증하지 않습니다. 외부 데이터를 받아들이는 경계에서는 응답 형식도 검증해야 합니다.

> 상태의 이름보다, 그 상태에서 반드시 존재해야 하는 데이터를 먼저 생각해보면 좋습니다.

[HTTP 캐시](../../web/http-cache.md)처럼 상태에 따라 가능한 동작이 달라지는 로직에서도 같은 접근을 사용할 수 있습니다.
