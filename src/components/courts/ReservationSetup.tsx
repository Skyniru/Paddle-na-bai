"use client";
import { useState } from "react";
export default function ReservationSetup() {
  const [count, setCount] = useState(4);
  const [date, setDate] = useState(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date()),
  );
  const [start, setStart] = useState("18:00");
  const [end, setEnd] = useState("20:00");
  return (
    <fieldset>
      <legend>Court reservations ? Asia/Manila</legend>
      <div className="form-row">
        <label>
          Courts
          <input
            name="courts"
            type="number"
            min="1"
            max="12"
            value={count}
            onChange={(e) =>
              setCount(Math.min(12, Math.max(1, Number(e.target.value))))
            }
          />
        </label>
        <label>
          Reservation date
          <input
            name="reservationDate"
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
      </div>
      <div className="form-row">
        <label>
          Default start
          <input
            type="time"
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </label>
        <label>
          Default end
          <input
            type="time"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
          />
        </label>
      </div>
      {Array.from({ length: count }, (_, i) => (
        <div className="form-row" key={i + start + end}>
          <label>
            Court number
            <input
              name={"courtNumber" + i}
              type="number"
              min="1"
              required
              defaultValue={i + 1}
            />
          </label>
          <label>
            Start
            <input
              name={"courtStart" + i}
              type="time"
              required
              defaultValue={start}
            />
          </label>
          <label>
            End
            <input
              name={"courtEnd" + i}
              type="time"
              required
              defaultValue={end}
            />
          </label>
        </div>
      ))}
      <p className="muted">
        An end before the start means the following day. Reserved duration:{" "}
        {((Number(end.slice(0, 2)) * 60 +
          Number(end.slice(3)) -
          Number(start.slice(0, 2)) * 60 -
          Number(start.slice(3)) +
          1440) %
          1440) /
          60}{" "}
        hours.
      </p>
    </fieldset>
  );
}
