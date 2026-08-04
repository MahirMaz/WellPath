"use client";

// This is an isolated copy of the app UI. The original mobile/PWA project
// remains untouched and can still be run independently.
// @ts-expect-error The showcase reuses the existing JSX component tree.
import WellPathApp from "../wellpath-src/app.jsx";

export function WellPathWebApp() {
  return (
    <main className="wellpath-web-canvas">
      <WellPathApp />
    </main>
  );
}
