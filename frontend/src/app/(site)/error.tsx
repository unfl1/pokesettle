"use client";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return <section className="notice" role="alert">
    <p>화면을 불러오지 못했어요. 다시 시도해 주세요.</p>
    <button onClick={reset}>다시 시도</button>
  </section>;
}
