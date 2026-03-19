// app/admin/alerts/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type AlertsApiResponse = {
  ok: boolean;
  q?: string;
  range?: string;
  stats: {
    recruiting_alerts: {
      sent_last_24h: number;
      sent_last_7d: number;
      total_sent: number;
      latest_sent_at: string | null;
    };
    match_notifications: {
      parent_sent_last_24h: number;
      coach_sent_last_24h: number;
      parent_sent_last_7d: number;
      coach_sent_last_7d: number;
      total_parent_sent: number;
      total_coach_sent: number;
      total_match_emails_sent: number;
      latest_created_at: string | null;
    };
  };
  charts: {
    recruiting_alerts_over_time: Array<{
      label: string;
      count: number;
    }>;
    match_emails_over_time: Array<{
      label: string;
      count: number;
    }>;
    top_events: Array<{
      label: string;
      count: number;
    }>;
  };
  top_events: Array<{
    event_name: string;
    total_sent: number;
  }>;
  recent_activity: Array<{
    type: "recruiting_alert" | "match_notification";
    created_at: string | null;
    event_name: string | null;
    sent_to_email: string | null;
    weight_class: string | null;
    age_group: string | null;
    wave: string | null;
    audience: string | null;
    wrestler_interest_id: number | null;
    coach_need_id: number | null;
  }>;
};

type DateRangeValue = "24h" | "7d" | "30d" | "all";

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function safeStr(value: unknown, fallback = "—") {
  const s = String(value ?? "").trim();
  return s || fallback;
}

function Badge({
  children,
  color,
}: {
  children: React.ReactNode;
  color: "green" | "blue" | "purple" | "yellow" | "red";
}) {
  const styles = {
    green: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    blue: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    purple: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    yellow: "bg-yellow-500/10 text-yellow-300 border-yellow-500/20",
    red: "bg-red-500/10 text-red-400 border-red-500/20",
  };

  return (
    <span
      className={`inline-flex items-center rounded-lg border px-2 py-1 text-xs font-medium ${styles[color]}`}
    >
      {children}
    </span>
  );
}

function StatCard({
  title,
  value,
  subtext,
}: {
  title: string;
  value: string | number;
  subtext?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5 shadow-sm">
      <div className="text-sm text-slate-400">{title}</div>
      <div className="mt-2 text-3xl font-semibold text-white">{value}</div>
      {subtext ? (
        <div className="mt-2 text-xs text-slate-500">{subtext}</div>
      ) : null}
    </div>
  );
}

function MiniBarChart({
  title,
  subtitle,
  data,
  colorClass = "bg-blue-400",
  onBarClick,
}: {
  title: string;
  subtitle?: string;
  data: Array<{ label: string; count: number }>;
  colorClass?: string;
  onBarClick?: (item: { label: string; count: number }) => void;
}) {
  const max = Math.max(...data.map((d) => d.count), 1);

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5">
      <h2 className="text-lg font-semibold">{title}</h2>
      {subtitle ? <p className="mt-1 text-sm text-slate-400">{subtitle}</p> : null}

      <div className="mt-4 space-y-3">
        {data.length === 0 ? (
          <div className="text-sm text-slate-500">No data for this range.</div>
        ) : (
          data.map((item, idx) => {
            const clickable = typeof onBarClick === "function";
            return (
              <button
                key={`${item.label}-${idx}`}
                type="button"
                onClick={() => onBarClick?.(item)}
                disabled={!clickable}
                className={`block w-full text-left ${
                  clickable ? "cursor-pointer" : "cursor-default"
                }`}
                title={clickable ? `Filter by ${item.label}` : undefined}
              >
                <div className="mb-1 flex items-center justify-between gap-3 text-xs">
                  <span
                    className={`truncate ${
                      clickable ? "text-white hover:underline" : "text-slate-300"
                    }`}
                  >
                    {item.label}
                  </span>
                  <span className="font-semibold text-white">{item.count}</span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-800">
                  <div
                    className={`h-2 rounded-full ${colorClass}`}
                    style={{
                      width: `${Math.max(
                        (item.count / max) * 100,
                        item.count > 0 ? 8 : 0
                      )}%`,
                    }}
                  />
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

export default function AdminAlertsPage() {
  const [data, setData] = useState<AlertsApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");

  const [range, setRange] = useState<DateRangeValue>("30d");

  const [eventFilter, setEventFilter] = useState("");
  const [audienceFilter, setAudienceFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [onlyUnemailed, setOnlyUnemailed] = useState(false);
  const [timeBucketFilter, setTimeBucketFilter] = useState("");

  async function loadAlerts(nextSearch?: string, nextRange?: DateRangeValue) {
    try {
      setLoading(true);
      setErr(null);

      const qs = new URLSearchParams();
      const qValue =
        typeof nextSearch === "string" ? nextSearch.trim() : search.trim();
      const rangeValue = nextRange ?? range;

      if (qValue) qs.set("q", qValue);
      if (rangeValue) qs.set("range", rangeValue);

      const res = await fetch(`/api/admin/alerts?${qs.toString()}`, {
        cache: "no-store",
      });

      const json = (await res.json().catch(
        () => null
      )) as AlertsApiResponse | null;

      if (!res.ok || !json?.ok) {
        setErr((json as any)?.message || "Failed to load alerts dashboard.");
        setData(null);
        return;
      }

      setData(json);
      setSearch(qValue);
      setSearchInput(qValue);
      setRange(rangeValue);
    } catch (e: any) {
      setErr(e?.message || "Failed to load alerts dashboard.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAlerts("", "30d");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      loadAlerts();
    }, 15000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const recruitingStats = data?.stats.recruiting_alerts;
  const matchStats = data?.stats.match_notifications;

  const totalEmailsAll = useMemo(() => {
    const recruiting = recruitingStats?.total_sent ?? 0;
    const matchEmails = matchStats?.total_match_emails_sent ?? 0;
    return recruiting + matchEmails;
  }, [recruitingStats, matchStats]);

  const eventOptions = useMemo(() => {
    const items = data?.recent_activity ?? [];
    return Array.from(
      new Set(items.map((item) => safeStr(item.event_name, "")).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b));
  }, [data]);

  const filteredActivity = useMemo(() => {
    let items = (data?.recent_activity ?? []).slice();

    if (eventFilter) {
      items = items.filter(
        (item) => safeStr(item.event_name, "") === eventFilter
      );
    }

    if (audienceFilter) {
      items = items.filter(
        (item) => safeStr(item.audience, "") === audienceFilter
      );
    }

    if (typeFilter) {
      items = items.filter((item) => item.type === typeFilter);
    }

    if (onlyUnemailed) {
      items = items.filter((item) => !safeStr(item.sent_to_email, ""));
    }

    if (timeBucketFilter) {
      items = items.filter((item) =>
        safeStr(item.created_at)
          ? formatDateTime(item.created_at).includes(timeBucketFilter) ||
            safeStr(item.created_at).includes(timeBucketFilter)
          : false
      );

      if (range === "24h") {
        items = items.filter((item) => {
          if (!item.created_at) return false;
          const d = new Date(item.created_at);
          if (Number.isNaN(d.getTime())) return false;
          const label = d.toLocaleString("en-US", {
            month: "short",
            day: "2-digit",
            hour: "2-digit",
            hour12: false,
          });
          return label.includes(timeBucketFilter.replace(":00", ""));
        });
      } else if (range === "7d" || range === "30d") {
        items = items.filter((item) => {
          if (!item.created_at) return false;
          const d = new Date(item.created_at);
          if (Number.isNaN(d.getTime())) return false;
          const label = d.toLocaleString("en-US", {
            month: "short",
            day: "2-digit",
          });
          return label === timeBucketFilter;
        });
      } else {
        items = items.filter((item) => {
          if (!item.created_at) return false;
          const d = new Date(item.created_at);
          if (Number.isNaN(d.getTime())) return false;
          const label = d.toLocaleString("en-US", {
            month: "short",
            year: "numeric",
          });
          return label === timeBucketFilter;
        });
      }
    }

    return items;
  }, [
    data,
    eventFilter,
    audienceFilter,
    typeFilter,
    onlyUnemailed,
    timeBucketFilter,
    range,
  ]);

  function handleSearchSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    loadAlerts(searchInput);
  }

  function clearSearch() {
    setSearch("");
    setSearchInput("");
    loadAlerts("");
  }

  function handleRangeChange(nextRange: DateRangeValue) {
    setTimeBucketFilter("");
    loadAlerts(undefined, nextRange);
  }

  function clearFilters() {
    setEventFilter("");
    setAudienceFilter("");
    setTypeFilter("");
    setOnlyUnemailed(false);
    setTimeBucketFilter("");
  }

  const rangeLabel =
    range === "24h"
      ? "Last 24 Hours"
      : range === "7d"
      ? "Last 7 Days"
      : range === "30d"
      ? "Last 30 Days"
      : "All Time";

  const hasActiveLocalFilters =
    Boolean(eventFilter) ||
    Boolean(audienceFilter) ||
    Boolean(typeFilter) ||
    onlyUnemailed ||
    Boolean(timeBucketFilter);

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="mb-2">
              <Link
                href="/admin"
                className="text-sm text-slate-400 underline hover:text-white"
              >
                ← Back to Admin
              </Link>
            </div>

            <h1 className="text-3xl font-bold tracking-tight">
              Alerts Dashboard
            </h1>
            <p className="mt-2 text-sm text-slate-400">
              Monitor recruiting alerts, match notification emails, recent alert
              activity, and trend charts.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-xs text-emerald-400">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
              Live
            </span>

            <button
              onClick={() => loadAlerts()}
              className="inline-flex items-center justify-center rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
              disabled={loading}
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>

        {err ? (
          <div className="mb-6 rounded-2xl border border-red-900 bg-red-950/40 p-4 text-sm text-red-200">
            {err}
          </div>
        ) : null}

        <section className="mb-6 flex flex-wrap items-center gap-3">
          <span className="text-sm text-slate-400">Range:</span>

          <button
            type="button"
            onClick={() => handleRangeChange("24h")}
            className={`rounded-xl border px-3 py-2 text-sm ${
              range === "24h"
                ? "border-white bg-white text-slate-950"
                : "border-slate-700 bg-slate-900 text-white hover:bg-slate-800"
            }`}
            disabled={loading}
          >
            24h
          </button>

          <button
            type="button"
            onClick={() => handleRangeChange("7d")}
            className={`rounded-xl border px-3 py-2 text-sm ${
              range === "7d"
                ? "border-white bg-white text-slate-950"
                : "border-slate-700 bg-slate-900 text-white hover:bg-slate-800"
            }`}
            disabled={loading}
          >
            7d
          </button>

          <button
            type="button"
            onClick={() => handleRangeChange("30d")}
            className={`rounded-xl border px-3 py-2 text-sm ${
              range === "30d"
                ? "border-white bg-white text-slate-950"
                : "border-slate-700 bg-slate-900 text-white hover:bg-slate-800"
            }`}
            disabled={loading}
          >
            30d
          </button>

          <button
            type="button"
            onClick={() => handleRangeChange("all")}
            className={`rounded-xl border px-3 py-2 text-sm ${
              range === "all"
                ? "border-white bg-white text-slate-950"
                : "border-slate-700 bg-slate-900 text-white hover:bg-slate-800"
            }`}
            disabled={loading}
          >
            All
          </button>

          <span className="text-xs text-slate-500">{rangeLabel}</span>
        </section>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Total Emails Sent"
            value={loading ? "…" : totalEmailsAll}
            subtext={`Recruiting alerts + match notification emails • ${rangeLabel}`}
          />
          <StatCard
            title="Recruiting Alerts (24h)"
            value={loading ? "…" : recruitingStats?.sent_last_24h ?? 0}
            subtext={
              recruitingStats?.latest_sent_at
                ? `Latest: ${formatDateTime(recruitingStats.latest_sent_at)}`
                : "No recruiting alerts sent yet"
            }
          />
          <StatCard
            title="Match Emails (24h)"
            value={
              loading
                ? "…"
                : (matchStats?.parent_sent_last_24h ?? 0) +
                  (matchStats?.coach_sent_last_24h ?? 0)
            }
            subtext={
              matchStats?.latest_created_at
                ? `Latest: ${formatDateTime(matchStats.latest_created_at)}`
                : "No match emails sent yet"
            }
          />
          <StatCard
            title={
              range === "24h"
                ? "Recruiting Alerts (24h)"
                : range === "7d"
                ? "Recruiting Alerts (7d)"
                : range === "30d"
                ? "Recruiting Alerts (30d)"
                : "Recruiting Alerts (All)"
            }
            value={
              loading
                ? "…"
                : range === "24h"
                ? recruitingStats?.sent_last_24h ?? 0
                : range === "7d"
                ? recruitingStats?.sent_last_7d ?? 0
                : recruitingStats?.total_sent ?? 0
            }
            subtext={rangeLabel}
          />
        </section>

        <section className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
          <MiniBarChart
            title="Recruiting Alerts Over Time"
            subtitle={rangeLabel}
            data={data?.charts?.recruiting_alerts_over_time ?? []}
            colorClass="bg-emerald-400"
            onBarClick={(item) => {
              setTimeBucketFilter(item.label);
              setTypeFilter("recruiting_alert");
            }}
          />

          <MiniBarChart
            title="Match Emails Over Time"
            subtitle={rangeLabel}
            data={data?.charts?.match_emails_over_time ?? []}
            colorClass="bg-blue-400"
            onBarClick={(item) => {
              setTimeBucketFilter(item.label);
              setTypeFilter("match_notification");
            }}
          />

          <MiniBarChart
            title="Top Recruiting Events"
            subtitle={rangeLabel}
            data={data?.charts?.top_events ?? []}
            colorClass="bg-violet-400"
            onBarClick={(item) => {
              setEventFilter(item.label);
            }}
          />
        </section>

        <section className="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="xl:col-span-2 rounded-2xl border border-slate-800 bg-slate-950 p-5">
            <div className="mb-4 flex flex-col gap-4">
              <div>
                <h2 className="text-lg font-semibold">Recent Activity</h2>
                <p className="text-sm text-slate-400">
                  Latest recruiting alerts and match notification sends
                </p>
              </div>

              <form
                onSubmit={handleSearchSubmit}
                className="flex flex-wrap gap-3"
              >
                <input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Search event, email, audience, weight..."
                  className="min-w-[260px] flex-1 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-500"
                />

                <button
                  type="submit"
                  className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
                  disabled={loading}
                >
                  Search
                </button>

                <button
                  type="button"
                  onClick={clearSearch}
                  className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
                  disabled={loading && !search}
                >
                  Clear
                </button>
              </form>

              <div className="flex flex-wrap gap-3">
                <select
                  value={eventFilter}
                  onChange={(e) => setEventFilter(e.target.value)}
                  className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
                >
                  <option value="">All Events</option>
                  {eventOptions.map((eventName) => (
                    <option key={eventName} value={eventName}>
                      {eventName}
                    </option>
                  ))}
                </select>

                <select
                  value={audienceFilter}
                  onChange={(e) => setAudienceFilter(e.target.value)}
                  className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
                >
                  <option value="">All Audiences</option>
                  <option value="parent">Parent</option>
                  <option value="coach">Coach</option>
                </select>

                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
                >
                  <option value="">All Types</option>
                  <option value="recruiting_alert">Recruiting Alert</option>
                  <option value="match_notification">Match Notification</option>
                </select>

                <label className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white">
                  <input
                    type="checkbox"
                    checked={onlyUnemailed}
                    onChange={(e) => setOnlyUnemailed(e.target.checked)}
                  />
                  Only missing email
                </label>
              </div>

              {hasActiveLocalFilters ? (
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                  <span>Active Filters:</span>

                  {eventFilter ? (
                    <button
                      type="button"
                      onClick={() => setEventFilter("")}
                      className="cursor-pointer"
                      title="Clear event filter"
                    >
                      <Badge color="blue">{eventFilter}</Badge>
                    </button>
                  ) : null}

                  {audienceFilter ? (
                    <button
                      type="button"
                      onClick={() => setAudienceFilter("")}
                      className="cursor-pointer"
                      title="Clear audience filter"
                    >
                      <Badge color="purple">
                        {audienceFilter === "parent" ? "Parent" : "Coach"}
                      </Badge>
                    </button>
                  ) : null}

                  {typeFilter ? (
                    <button
                      type="button"
                      onClick={() => setTypeFilter("")}
                      className="cursor-pointer"
                      title="Clear type filter"
                    >
                      <Badge color="green">
                        {typeFilter === "recruiting_alert"
                          ? "Recruiting Alert"
                          : "Match Notification"}
                      </Badge>
                    </button>
                  ) : null}

                  {onlyUnemailed ? (
                    <button
                      type="button"
                      onClick={() => setOnlyUnemailed(false)}
                      className="cursor-pointer"
                      title="Clear missing email filter"
                    >
                      <Badge color="red">Missing Email</Badge>
                    </button>
                  ) : null}

                  {timeBucketFilter ? (
                    <button
                      type="button"
                      onClick={() => setTimeBucketFilter("")}
                      className="cursor-pointer"
                      title="Clear time bucket filter"
                    >
                      <Badge color="yellow">{timeBucketFilter}</Badge>
                    </button>
                  ) : null}

                  <button
                    type="button"
                    onClick={clearFilters}
                    className="ml-1 rounded-lg border border-slate-700 px-2 py-1 text-xs text-white hover:bg-slate-800"
                  >
                    Clear Filters
                  </button>
                </div>
              ) : null}

              <div className="text-xs text-slate-500">
                Showing {filteredActivity.length} of{" "}
                {data?.recent_activity?.length ?? 0} activity rows
                {search ? ` • Search: "${search}"` : ""}
                {` • Range: ${rangeLabel}`}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-left text-slate-400">
                    <th className="px-3 py-3 font-medium">Type</th>
                    <th className="px-3 py-3 font-medium">Event</th>
                    <th className="px-3 py-3 font-medium">Details</th>
                    <th className="px-3 py-3 font-medium">Audience</th>
                    <th className="px-3 py-3 font-medium">Sent To</th>
                    <th className="px-3 py-3 font-medium">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-3 py-8 text-center text-slate-500"
                      >
                        Loading activity…
                      </td>
                    </tr>
                  ) : filteredActivity.length ? (
                    filteredActivity.map((item, idx) => {
                      const isMatchRow =
                        item.type === "match_notification" &&
                        !!item.wrestler_interest_id &&
                        !!item.coach_need_id;

                      const href = isMatchRow
                        ? `/admin/match-radar?wrestler_interest_id=${item.wrestler_interest_id}&coach_need_id=${item.coach_need_id}`
                        : null;

                      const rowClasses =
                        item.type === "recruiting_alert"
                          ? "border-b border-slate-900 align-top hover:bg-emerald-500/5"
                          : "border-b border-slate-900 align-top hover:bg-blue-500/5 cursor-pointer";

                      const rowContent = (
                        <>
                          <td className="px-3 py-3">
                            {item.type === "recruiting_alert" ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setTypeFilter("recruiting_alert");
                                }}
                                className="cursor-pointer"
                                title="Filter by recruiting alerts"
                              >
                                <Badge color="green">Recruiting Alert</Badge>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setTypeFilter("match_notification");
                                }}
                                className="cursor-pointer"
                                title="Filter by match notifications"
                              >
                                <Badge color="blue">Match Notification</Badge>
                              </button>
                            )}
                          </td>

                          <td className="px-3 py-3 text-slate-200">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEventFilter(safeStr(item.event_name, ""));
                              }}
                              className="text-left hover:text-blue-400 hover:underline"
                              title="Filter by event"
                            >
                              {safeStr(item.event_name)}
                            </button>
                          </td>

                          <td className="px-3 py-3 text-slate-400">
                            {item.type === "recruiting_alert" ? (
                              <>
                                <div>Weight: {safeStr(item.weight_class)}</div>
                                <div>Age: {safeStr(item.age_group)}</div>
                                <div>Wave: {safeStr(item.wave)}</div>
                              </>
                            ) : (
                              <div>Match email sent</div>
                            )}
                          </td>

                          <td className="px-3 py-3">
                            {item.audience === "parent" ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setAudienceFilter("parent");
                                }}
                                className="cursor-pointer"
                                title="Filter by parent audience"
                              >
                                <Badge color="purple">Parent</Badge>
                              </button>
                            ) : item.audience === "coach" ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setAudienceFilter("coach");
                                }}
                                className="cursor-pointer"
                                title="Filter by coach audience"
                              >
                                <Badge color="yellow">Coach</Badge>
                              </button>
                            ) : (
                              <span className="text-slate-400">
                                {safeStr(item.audience)}
                              </span>
                            )}
                          </td>

                          <td className="break-all px-3 py-3">
                            {item.sent_to_email ? (
                              <span className="text-slate-400">
                                {item.sent_to_email}
                              </span>
                            ) : (
                              <Badge color="red">Missing Email</Badge>
                            )}
                          </td>

                          <td className="px-3 py-3 text-slate-400">
                            {formatDateTime(item.created_at)}
                          </td>
                        </>
                      );

                      if (href) {
                        return (
                          <tr
                            key={`${item.type}-${item.created_at ?? "na"}-${idx}`}
                            className={rowClasses}
                            onClick={() => {
                              window.location.href = href;
                            }}
                          >
                            {rowContent}
                          </tr>
                        );
                      }

                      return (
                        <tr
                          key={`${item.type}-${item.created_at ?? "na"}-${idx}`}
                          className={rowClasses}
                        >
                          {rowContent}
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-3 py-8 text-center text-slate-500"
                      >
                        No alert activity matches the current filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {filteredActivity.some(
              (item) =>
                item.type === "match_notification" &&
                !!item.wrestler_interest_id &&
                !!item.coach_need_id
            ) ? (
              <div className="mt-3 text-xs text-slate-500">
                Tip: click a match-notification row to jump into Match Radar for
                that pair.
              </div>
            ) : null}
          </div>

          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5">
              <h2 className="text-lg font-semibold">Top Recruiting Events</h2>
              <p className="mt-1 text-sm text-slate-400">
                Events generating the most recruiting alerts
              </p>

              <div className="mt-4 space-y-3">
                {loading ? (
                  <div className="text-sm text-slate-500">Loading events…</div>
                ) : data?.top_events?.length ? (
                  data.top_events.map((event, idx) => (
                    <button
                      key={`${event.event_name}-${idx}`}
                      type="button"
                      onClick={() => setEventFilter(event.event_name)}
                      className="flex w-full items-center justify-between rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-left hover:bg-slate-800"
                      title="Filter Recent Activity by this event"
                    >
                      <div className="pr-4 text-sm text-slate-200">
                        {safeStr(event.event_name)}
                      </div>
                      <div className="text-sm font-semibold text-white">
                        {event.total_sent}
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="text-sm text-slate-500">
                    No recruiting event data yet.
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5">
              <h2 className="text-lg font-semibold">Match Email Breakdown</h2>
              <p className="mt-1 text-sm text-slate-400">
                Coach and parent notification totals
              </p>

              <div className="mt-4 space-y-3 text-sm">
                <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900 px-4 py-3">
                  <span className="text-slate-300">Parent Emails (7d)</span>
                  <span className="font-semibold text-white">
                    {loading ? "…" : matchStats?.parent_sent_last_7d ?? 0}
                  </span>
                </div>

                <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900 px-4 py-3">
                  <span className="text-slate-300">Coach Emails (7d)</span>
                  <span className="font-semibold text-white">
                    {loading ? "…" : matchStats?.coach_sent_last_7d ?? 0}
                  </span>
                </div>

                <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900 px-4 py-3">
                  <span className="text-slate-300">Total Parent Emails</span>
                  <span className="font-semibold text-white">
                    {loading ? "…" : matchStats?.total_parent_sent ?? 0}
                  </span>
                </div>

                <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900 px-4 py-3">
                  <span className="text-slate-300">Total Coach Emails</span>
                  <span className="font-semibold text-white">
                    {loading ? "…" : matchStats?.total_coach_sent ?? 0}
                  </span>
                </div>

                <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900 px-4 py-3">
                  <span className="text-slate-300">All Match Emails</span>
                  <span className="font-semibold text-white">
                    {loading ? "…" : matchStats?.total_match_emails_sent ?? 0}
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5">
              <h2 className="text-lg font-semibold">Recruiting Snapshot</h2>
              <p className="mt-1 text-sm text-slate-400">
                Quick view of recruiting alert volume
              </p>

              <div className="mt-4 space-y-3 text-sm">
                <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900 px-4 py-3">
                  <span className="text-slate-300">Last 24 Hours</span>
                  <span className="font-semibold text-white">
                    {loading ? "…" : recruitingStats?.sent_last_24h ?? 0}
                  </span>
                </div>

                <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900 px-4 py-3">
                  <span className="text-slate-300">Last 7 Days</span>
                  <span className="font-semibold text-white">
                    {loading ? "…" : recruitingStats?.sent_last_7d ?? 0}
                  </span>
                </div>

                <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900 px-4 py-3">
                  <span className="text-slate-300">All Time</span>
                  <span className="font-semibold text-white">
                    {loading ? "…" : recruitingStats?.total_sent ?? 0}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}