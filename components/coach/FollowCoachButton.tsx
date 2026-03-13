"use client";

import { useEffect, useState } from "react";

type Props = {
  coachUserId: number;
};

export default function FollowCoachButton({ coachUserId }: Props) {
  const [loading, setLoading] = useState(false);
  const [following, setFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const res = await fetch(`/api/coaches/${coachUserId}/follow-status`, {
          cache: "no-store",
        });
        const data = await res.json();
        if (!active) return;

        if (data?.ok) {
          setFollowing(!!data.following);
          setFollowerCount(Number(data.followerCount ?? 0));
        }
      } catch (err) {
        console.error("Failed to load coach follow status", err);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [coachUserId]);

  async function handleClick() {
    try {
      setLoading(true);

      const res = await fetch(`/api/coaches/${coachUserId}/follow`, {
        method: following ? "DELETE" : "POST",
      });

      const data = await res.json();

      if (data?.ok) {
        setFollowing(!!data.following);
        setFollowerCount(Number(data.followerCount ?? 0));
      } else {
        alert(data?.message ?? "Something went wrong");
      }
    } catch (err) {
      console.error("Failed to toggle follow", err);
      alert("Failed to update follow");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={handleClick}
        disabled={loading}
        className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
          following
            ? "bg-slate-700 text-white hover:bg-slate-600"
            : "bg-blue-600 text-white hover:bg-blue-500"
        } disabled:opacity-60`}
      >
        {loading ? "Saving..." : following ? "Following Coach" : "Follow Coach"}
      </button>

      <span className="text-sm text-slate-400">
        {followerCount} follower{followerCount === 1 ? "" : "s"}
      </span>
    </div>
  );
}