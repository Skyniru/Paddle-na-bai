"use client";
import { useEffect, useState } from "react";
export default function ReservationSetup() {
  const [count, setCount] = useState("4");
  useEffect(() => {
    let frame: number | undefined;
    try {
      const saved = Number(localStorage.getItem("paddle-court-count"));
      if (Number.isInteger(saved) && saved >= 1 && saved <= 12)
        frame = requestAnimationFrame(() => setCount(String(saved)));
    } catch {
      /* Court setup works without preference storage. */
    }
    return () => {
      if (frame !== undefined) cancelAnimationFrame(frame);
    };
  }, []);
  return (
    <fieldset>
      <legend>Court Setup</legend>
      <p>How many courts are available for today&apos;s open play?</p>
      <label>
        Available Courts
        <input
          name="courts"
          type="number"
          min="1"
          max="12"
          step="1"
          required
          value={count}
          onChange={(event) => setCount(event.target.value)}
        />
      </label>
      <p className="muted">
        Courts are numbered automatically, starting at Court 1.
      </p>
    </fieldset>
  );
}
