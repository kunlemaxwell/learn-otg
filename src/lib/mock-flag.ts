"use client";
/**
 * Demo mode (no model calls): open any page with ?mock=1; it stays on for this tab.
 * In demo mode, ?mockfail=429|500|stall makes the first try of every course page fail
 * (rate limit, error mid-stream, or a stream that goes quiet) to show the retries; ?mockfail=0 stops it.
 */
export function mockFlag(): boolean {
  try {
    const q = new URLSearchParams(window.location.search);
    if (q.get("mock") === "1") window.sessionStorage.setItem("learn-otg:mock", "1");
    if (q.get("mock") === "0") window.sessionStorage.removeItem("learn-otg:mock");
    const fail = q.get("mockfail");
    if (fail === "0") window.sessionStorage.removeItem("learn-otg:mockfail");
    else if (fail) window.sessionStorage.setItem("learn-otg:mockfail", fail);
    return window.sessionStorage.getItem("learn-otg:mock") === "1";
  } catch {
    return false;
  }
}
