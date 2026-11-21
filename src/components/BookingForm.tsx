"use client";

import { useState } from "react";

// Books a rental for one item. Dates are half-open [start, end): an item
// returned on the end date can go out again that same day. The API
// rejects overlapping bookings for the same item with HTTP 409.
export default function BookingForm({
  itemId,
  rentalCents,
  depositCents,
}: {
  itemId: string;
  rentalCents: number;
  depositCents: number;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    const res = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        itemId,
        customerName: name,
        customerEmail: email,
        startDate,
        endDate,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setMessage(
        `Booked! Booking ${data.booking.id} — rental $${(
          rentalCents / 100
        ).toFixed(2)} + $${(depositCents / 100).toFixed(
          2
        )} deposit held in escrow.`
      );
    } else {
      setMessage(data.error ?? "Booking failed.");
    }
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="mt-4 space-y-3 rounded border bg-white p-4">
      <h2 className="font-semibold">Book this item</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-semibold">
          Your name
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 block w-full rounded border px-2 py-1 text-sm font-normal"
          />
        </label>
        <label className="text-xs font-semibold">
          Email
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 block w-full rounded border px-2 py-1 text-sm font-normal"
          />
        </label>
        <label className="text-xs font-semibold">
          Rental start
          <input
            required
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="mt-1 block w-full rounded border px-2 py-1 text-sm font-normal"
          />
        </label>
        <label className="text-xs font-semibold">
          Rental end
          <input
            required
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="mt-1 block w-full rounded border px-2 py-1 text-sm font-normal"
          />
        </label>
      </div>
      <button
        type="submit"
        disabled={busy}
        className="rounded bg-rose-700 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-800 disabled:opacity-50"
      >
        {busy ? "Booking…" : "Book rental"}
      </button>
      {message && <p className="text-sm text-stone-700">{message}</p>}
    </form>
  );
}
