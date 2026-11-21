"use client";

import { useState } from "react";

// Books a fitting appointment for one item. The API rejects a fitting
// that overlaps another scheduled fitting for the same item (HTTP 409).
export default function FittingForm({
  itemId,
  itemName,
}: {
  itemId: string;
  itemName: string;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    const res = await fetch("/api/fittings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        itemId,
        customerName: name,
        customerEmail: email,
        scheduledAt,
        notes: notes || undefined,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setMessage(
        `Fitting booked for ${itemName} — ${new Date(
          data.fitting.scheduledAt
        ).toLocaleString()}.`
      );
    } else {
      setMessage(data.error ?? "Fitting booking failed.");
    }
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="mt-4 space-y-3 rounded border bg-white p-4">
      <h2 className="font-semibold">Book a fitting</h2>
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
          Date &amp; time
          <input
            required
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            className="mt-1 block w-full rounded border px-2 py-1 text-sm font-normal"
          />
        </label>
        <label className="text-xs font-semibold">
          Notes
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. bring heels"
            className="mt-1 block w-full rounded border px-2 py-1 text-sm font-normal"
          />
        </label>
      </div>
      <button
        type="submit"
        disabled={busy}
        className="rounded bg-rose-700 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-800 disabled:opacity-50"
      >
        {busy ? "Booking…" : "Book fitting"}
      </button>
      {message && <p className="text-sm text-stone-700">{message}</p>}
    </form>
  );
}
