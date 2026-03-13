// components/athlete/AthleteRecruitingCard.tsx
type AthleteRecruitingCardProps = {
  firstName: string;
  lastName: string;
  ageGroup?: string | null;
  weightClass?: string | null;
  city?: string | null;
  state?: string | null;
  eventName?: string | null;
  notes?: string | null;
};

export default function AthleteRecruitingCard({
  firstName,
  lastName,
  ageGroup,
  weightClass,
  city,
  state,
  eventName,
  notes,
}: AthleteRecruitingCardProps) {
  const fullName = `${firstName} ${lastName}`.trim();

  return (
    <div className="rounded-2xl border border-slate-700 bg-gradient-to-br from-slate-900 to-slate-800 p-6 shadow-xl">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-red-400">
            Ready Roster
          </p>
          <h2 className="mt-2 text-2xl font-bold text-white">{fullName}</h2>
          <p className="mt-1 text-slate-300">
            {ageGroup || "Age Group TBD"} • {weightClass || "Weight TBD"}
          </p>
          <p className="mt-1 text-slate-400">
            {[city, state].filter(Boolean).join(", ") || "Location not listed"}
          </p>
        </div>

        <div className="rounded-xl bg-slate-950/60 px-4 py-3 text-sm text-slate-300">
          <div>
            <span className="text-slate-500">Event:</span>{" "}
            {eventName || "Open to opportunities"}
          </div>
        </div>
      </div>

      {notes ? (
        <div className="mt-5 rounded-xl border border-slate-700 bg-slate-950/40 p-4">
          <p className="text-sm font-medium text-slate-300">Notes</p>
          <p className="mt-2 text-sm text-slate-400">{notes}</p>
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-2">
        <span className="rounded-full bg-red-600/20 px-3 py-1 text-xs font-medium text-red-300">
          Athlete Profile
        </span>
        <span className="rounded-full bg-emerald-600/20 px-3 py-1 text-xs font-medium text-emerald-300">
          Shareable
        </span>
        <span className="rounded-full bg-blue-600/20 px-3 py-1 text-xs font-medium text-blue-300">
          Recruiting Ready
        </span>
      </div>
    </div>
  );
}