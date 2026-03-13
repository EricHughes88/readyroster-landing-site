"use client";

import { useEffect, useState } from "react";

type Props = {
  athleteId: number;
};

export default function FollowAthleteButton({ athleteId }: Props) {
  const [loading, setLoading] = useState(false);
  const [following, setFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);

  useEffect(() => {
    let active = true;

    async function loadStatus() {
      try {
        const res = await fetch(`/api/athletes/${athleteId}/follow-status`, {
          cache: "no-store",
        });

        const data = await res.json();

        if (!active) return;

        if (data?.ok) {
          setFollowing(!!data.following);
          setFollowerCount(Number(data.followerCount ?? 0));
        }
      } catch (error) {
        console.error("Failed to load athlete follow status:", error);
      }
    }

    if (athleteId > 0) {
      loadStatus();
    }

    return () => {
      active = false;
    };
  }, [athleteId]);

  async function handleToggleFollow() {
    try {
      setLoading(true);

      const res = await fetch(`/api/athletes/${athleteId}/follow`, {
        method: following ? "DELETE" : "POST",
      });

      const data = await res.json();

      if (!data?.ok) {
        alert(data?.message ?? "Failed to update follow");
        return;
      }

      setFollowing(!!data.following);
      setFollowerCount(Number(data.followerCount ?? 0));
    } catch (error) {
      console.error("Failed to toggle athlete follow:", error);
      alert("Failed to update follow");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={handleToggleFollow}
        disabled={loading}
        className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
          following
            ? "bg-slate-700 text-white hover:bg-slate-600"
            : "bg-blue-600 text-white hover:bg-blue-500"
        } disabled:opacity-60`}
      >
        {loading ? "Saving..." : following ? "Following Athlete" : "Follow Athlete"}
      </button>

      <span className="text-sm text-slate-400">
        {followerCount} follower{followerCount === 1 ? "" : "s"}
      </span>
    </div>
  );
}