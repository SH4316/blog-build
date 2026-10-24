---
title: "경사하강법을 수식과 코드로 따라가기"
slug: "gradient-descent"
date: "2026-10-11"
description: "미분값이 알려주는 방향으로 한 걸음씩. 간단한 이차함수에서 업데이트 규칙과 학습률을 살펴봅니다."
tags: [math, machine-learning, Python]
---

경사하강법은 함수의 값을 줄이는 방향으로 파라미터를 조금씩 갱신하는 방법입니다. 복잡한 모델을 다루기 전에 $f(x) = x^2$부터 시작해 봅시다.

이 글은 인라인 수식, 블록 수식, 행렬과 코드가 함께 있는 샘플입니다.

## 기울기의 반대 방향으로 움직이기

현재 위치의 미분값을 알면 함수가 증가하는 방향을 알 수 있습니다. 미분값의 반대 방향으로 이동하는 업데이트는 다음과 같습니다.

$$
x_{t+1} = x_t - \eta f'(x_t)
$$

여기서 $\eta > 0$는 한 번에 얼마나 이동할지 결정하는 학습률입니다. $f'(x) = 2x$이므로 이 예제의 업데이트는 $x_{t+1} = (1 - 2\eta)x_t$가 됩니다.

## 코드로 확인하기

```python
def gradient_descent(x, learning_rate=0.1, steps=20):
    history = [x]
    for _ in range(steps):
        gradient = 2 * x
        x = x - learning_rate * gradient
        history.append(x)
    return history

positions = gradient_descent(x=4.0)
print(positions[-1])
```

이 함수에서는 $0 < \eta < 1$일 때 반복이 원점으로 수렴합니다. 학습률의 적절한 범위는 함수에 따라 달라집니다.

### 여러 변수로 확장하기

여러 변수가 있다면 편미분을 모은 그래디언트를 사용합니다.

$$
\nabla f(\mathbf{x}) =
\begin{bmatrix}
\frac{\partial f}{\partial x_1} \\
\frac{\partial f}{\partial x_2} \\
\vdots \\
\frac{\partial f}{\partial x_n}
\end{bmatrix}
\qquad
\mathbf{x}_{t+1} = \mathbf{x}_t - \eta\nabla f(\mathbf{x}_t)
$$

## 수식을 읽는 작은 기준

- 변수의 의미와 차원을 먼저 확인합니다.
- 업데이트 전후의 값을 작은 예제로 계산합니다.
- 학습률을 바꿨을 때의 동작을 비교합니다.

문장 속의 `$x$`는 인라인 코드이므로 수식으로 렌더링하지 않습니다. 금액 같은 리터럴 달러 기호는 \$10처럼 이스케이프해서 작성할 수 있습니다.

$$f(0) = 0$$
