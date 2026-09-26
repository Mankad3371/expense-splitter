"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

export default function Home() {
  const router = useRouter();
  const supabase = createClient();

  const [groupName, setGroupName] = useState("");
  const [groupCode, setGroupCode] = useState("");
  const [memberName, setMemberName] = useState("Manthan");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    checkUser();
  }, []);

  async function checkUser() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Not logged in → authentication page
    if (!user) {
      router.replace("/auth");
      return;
    }

    // Logged in and already has a group → group page
    const savedGroup = localStorage.getItem("activeGroup");

    if (savedGroup) {
      try {
        const group = JSON.parse(savedGroup);

        if (group?.id) {
          router.replace("/group");
          return;
        }
      } catch {
        localStorage.removeItem("activeGroup");
      }
    }

    // Logged in but no group → show create/join page
    setLoading(false);
  }

  async function createGroup() {
    setMessage("");

    if (!groupName.trim()) {
      setMessage("Please enter a group name.");
      return;
    }

    setCreating(true);

    const { data, error } = await supabase.rpc(
      "create_group",
      {
        group_name: groupName.trim(),
        member_name:
          memberName.trim() || "Member",
      }
    );

    setCreating(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    if (!data) {
      setMessage("Group could not be created.");
      return;
    }

    localStorage.setItem(
      "activeGroup",
      JSON.stringify(data)
    );

    router.replace("/group");
  }

  async function joinGroup() {
    setMessage("");

    if (!groupCode.trim()) {
      setMessage("Please enter a group code.");
      return;
    }

    setJoining(true);

    const { data, error } = await supabase.rpc(
      "join_group",
      {
        group_code: groupCode.trim(),
        member_name:
          memberName.trim() || "Member",
      }
    );

    setJoining(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    if (!data) {
      setMessage("Could not join the group.");
      return;
    }

    localStorage.setItem(
      "activeGroup",
      JSON.stringify(data)
    );

    router.replace("/group");
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-100">
        <p className="text-gray-600">
          Loading...
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-100 p-8">

      <div className="mx-auto max-w-2xl">

        <h1 className="text-3xl font-bold text-gray-900">
          Expense Splitter
        </h1>

        <p className="mt-2 text-gray-600">
          Share expenses with your friends easily.
        </p>

        {/* Your name */}

        <div className="mt-8 rounded-xl bg-white p-6 shadow">

          <label className="block text-sm font-medium text-gray-700">
            Your name
          </label>

          <input
            type="text"
            value={memberName}
            onChange={(e) =>
              setMemberName(e.target.value)
            }
            className="mt-2 w-full rounded-lg border border-gray-300 p-3 text-black"
          />

        </div>

        <div className="mt-6 grid gap-6 md:grid-cols-2">

          {/* Create group */}

          <div className="rounded-xl bg-white p-6 shadow">

            <h2 className="text-xl font-semibold text-gray-900">
              Create a Group
            </h2>

            <p className="mt-2 text-sm text-gray-600">
              Create a group and invite your friends.
            </p>

            <input
              type="text"
              value={groupName}
              onChange={(e) =>
                setGroupName(e.target.value)
              }
              placeholder="e.g. Imperia Flat"
              className="mt-4 w-full rounded-lg border border-gray-300 p-3 text-black"
            />

            <button
              type="button"
              onClick={createGroup}
              disabled={creating}
              className="mt-4 w-full rounded-lg bg-black px-4 py-3 font-medium text-white hover:bg-gray-800 disabled:opacity-50"
            >
              {creating
                ? "Creating..."
                : "Create Group"}
            </button>

          </div>

          {/* Join group */}

          <div className="rounded-xl bg-white p-6 shadow">

            <h2 className="text-xl font-semibold text-gray-900">
              Join a Group
            </h2>

            <p className="mt-2 text-sm text-gray-600">
              Enter a group code shared by your friend.
            </p>

            <input
              type="text"
              value={groupCode}
              onChange={(e) =>
                setGroupCode(
                  e.target.value.toUpperCase()
                )
              }
              placeholder="Enter group code"
              className="mt-4 w-full rounded-lg border border-gray-300 p-3 text-black"
            />

            <button
              type="button"
              onClick={joinGroup}
              disabled={joining}
              className="mt-4 w-full rounded-lg border border-gray-300 bg-white px-4 py-3 font-medium text-black hover:bg-gray-50 disabled:opacity-50"
            >
              {joining
                ? "Joining..."
                : "Join Group"}
            </button>

          </div>

        </div>

        {message && (
          <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">
            {message}
          </p>
        )}

      </div>

    </main>
  );
}