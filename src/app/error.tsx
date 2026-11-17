"use client";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main id="main-content" className="container">
    <div className="panel empty"><h1>Something went wrong</h1><p>The portal couldn’t load this view. Try again in a moment.</p>
      <button className="button" type="button" onClick={reset}>Try again</button></div>
  </main>;
}
