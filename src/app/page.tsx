"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

type Group = {
  id: string;
  name: string;
  code: string;
  created_by: string;
};

export default function Home() {
  const router = useRouter();
  const supabase = createClient();

  const [groups, setGroups] = useState<Group[]>([]);

  const [groupName, setGroupName] = useState("");
  const [groupCode, setGroupCode] = useState("");
  const [memberName, setMemberName] =
    useState("Manthan");

  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadGroups();
  }, []);

  async function loadGroups() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.replace("/auth");
      return;
    }

    const {
      data: memberships,
      error: membershipError,
    } = await supabase
      .from("group_members")
      .select("group_id, name")
      .eq("user_id", user.id);

    if (membershipError) {
      console.error(
        "Error loading memberships:",
        membershipError
      );

      setMessage(
        "Could not load your groups."
      );

      setLoading(false);
      return;
    }

    if (
      !memberships ||
      memberships.length === 0
    ) {
      setGroups([]);
      setLoading(false);
      return;
    }

    /*
     * Use the user's name from their existing
     * membership if available.
     */
    if (memberships[0]?.name) {
      setMemberName(memberships[0].name);
    }

    const groupIds = memberships.map(
      (membership) =>
        membership.group_id
    );

    const {
      data: loadedGroups,
      error: groupsError,
    } = await supabase
      .from("groups")
      .select(
        "id, name, code, created_by"
      )
      .in("id", groupIds)
      .order("created_at", {
        ascending: true,
      });

    if (groupsError) {
      console.error(
        "Error loading groups:",
        groupsError
      );

      setMessage(
        "Could not load your groups."
      );

      setLoading(false);
      return;
    }

    setGroups(loadedGroups || []);
    setLoading(false);
  }

  function openGroup(group: Group) {
    localStorage.setItem(
      "activeGroup",
      JSON.stringify(group)
    );

    router.push("/group");
  }

  async function createGroup() {
    setMessage("");

    if (!groupName.trim()) {
      setMessage(
        "Please enter a group name."
      );
      return;
    }

    if (!memberName.trim()) {
      setMessage(
        "Please enter your name."
      );
      return;
    }

    setCreating(true);

    const {
      data,
      error,
    } = await supabase.rpc(
      "create_group",
      {
        group_name:
          groupName.trim(),
        member_name:
          memberName.trim(),
      }
    );

    setCreating(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    if (!data) {
      setMessage(
        "Group could not be created."
      );
      return;
    }

    setGroupName("");

    await loadGroups();

    openGroup(data);
  }

  async function joinGroup() {
    setMessage("");

    if (!groupCode.trim()) {
      setMessage(
        "Please enter a group code."
      );
      return;
    }

    if (!memberName.trim()) {
      setMessage(
        "Please enter your name."
      );
      return;
    }

    setJoining(true);

    const {
      data,
      error,
    } = await supabase.rpc(
      "join_group",
      {
        group_code:
          groupCode.trim(),
        member_name:
          memberName.trim(),
      }
    );

    setJoining(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    if (!data) {
      setMessage(
        "Could not join the group."
      );
      return;
    }

    setGroupCode("");

    await loadGroups();

    openGroup(data);
  }

  /*
   * Check unpaid debt across ALL groups
   * before allowing logout.
   */
  async function getTotalUnpaidDebt() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return 0;
    }

    const {
      data: memberships,
      error: membershipError,
    } = await supabase
      .from("group_members")
      .select("group_id")
      .eq("user_id", user.id);

    if (membershipError) {
      console.error(
        "Error checking group memberships:",
        membershipError
      );

      throw new Error(
        "Could not check your balances."
      );
    }

    if (
      !memberships ||
      memberships.length === 0
    ) {
      return 0;
    }

    const groupIds = memberships.map(
      (membership) =>
        membership.group_id
    );

    const {
      data: expenses,
      error: expenseError,
    } = await supabase
      .from("expenses")
      .select(`
        id,
        group_id,
        paid_by,
        closed,
        expense_payments (
          user_id,
          amount,
          paid
        )
      `)
      .in("group_id", groupIds);

    if (expenseError) {
      console.error(
        "Error checking expenses:",
        expenseError
      );

      throw new Error(
        "Could not check your balances."
      );
    }

    let totalDebt = 0;

    (expenses || []).forEach(
      (expense: any) => {
        /*
         * Closed expenses don't count.
         */
        if (expense.closed) {
          return;
        }

        /*
         * Find this user's unpaid payment.
         */
        (expense.expense_payments || []).forEach(
          (payment: any) => {
            if (
              payment.user_id === user.id &&
              payment.user_id !==
                expense.paid_by &&
              !payment.paid
            ) {
              totalDebt += Number(
                payment.amount
              );
            }
          }
        );
      }
    );

    return totalDebt;
  }

  async function logout() {
    setMessage("");

    try {
      setLoggingOut(true);

      const totalDebt =
        await getTotalUnpaidDebt();

      if (totalDebt > 0) {
        setLoggingOut(false);

        setMessage(
          `You cannot logout because you still owe €${totalDebt.toFixed(
            2
          )}. Please settle your unpaid expenses first.`
        );

        return;
      }

      const confirmed = window.confirm(
        "Are you sure you want to logout?"
      );

      if (!confirmed) {
        setLoggingOut(false);
        return;
      }

      const { error } =
        await supabase.auth.signOut();

      if (error) {
        console.error(
          "Logout error:",
          error
        );

        setMessage(
          "Could not logout. Please try again."
        );

        setLoggingOut(false);
        return;
      }

      localStorage.removeItem(
        "activeGroup"
      );

      router.replace("/auth");
    } catch (error) {
      console.error(
        "Logout check error:",
        error
      );

      setMessage(
        error instanceof Error
          ? error.message
          : "Could not check your balances."
      );

      setLoggingOut(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-100">
        <p className="text-gray-600">
          Loading your groups...
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-100 p-8">
      <div className="mx-auto max-w-4xl">

        {/* Header */}

        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Expense Splitter
            </h1>

            <p className="mt-2 text-gray-600">
              Manage your shared expenses.
            </p>
          </div>

          <button
            type="button"
            onClick={logout}
            disabled={loggingOut}
            className="rounded-lg border border-red-300 px-4 py-2 font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            {loggingOut
              ? "Checking..."
              : "Logout"}
          </button>
        </div>

        {/* Your name */}

        <div className="mt-8 rounded-xl bg-white p-6 shadow">
          <label className="block text-sm font-medium text-gray-700">
            Your name
          </label>

          <input
            type="text"
            value={memberName}
            onChange={(e) =>
              setMemberName(
                e.target.value
              )
            }
            className="mt-2 w-full rounded-lg border border-gray-300 p-3 text-black"
          />
        </div>

        {/* My Groups */}

        <div className="mt-8 rounded-xl bg-white p-6 shadow">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                My Groups
              </h2>

              <p className="mt-1 text-sm text-gray-600">
                Choose a group to open.
              </p>
            </div>

            <span className="rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-700">
              {groups.length}
              {groups.length === 1
                ? " group"
                : " groups"}
            </span>
          </div>

          {groups.length === 0 ? (
            <div className="mt-6 rounded-lg border border-dashed border-gray-300 p-6 text-center">
              <p className="font-medium text-gray-900">
                You are not in any groups yet.
              </p>

              <p className="mt-1 text-sm text-gray-500">
                Create a group or join one
                using a group code below.
              </p>
            </div>
          ) : (
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {groups.map((group) => (
                <div
                  key={group.id}
                  className="rounded-xl border border-gray-200 p-5"
                >
                  <h3 className="text-lg font-semibold text-gray-900">
                    🏠 {group.name}
                  </h3>

                  <p className="mt-2 text-sm text-gray-500">
                    Group code
                  </p>

                  <p className="mt-1 font-bold tracking-wider text-gray-900">
                    {group.code}
                  </p>

                  <button
                    type="button"
                    onClick={() =>
                      openGroup(group)
                    }
                    className="mt-4 w-full rounded-lg bg-black px-4 py-3 font-medium text-white hover:bg-gray-800"
                  >
                    Open Group
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Create + Join */}

        <div className="mt-6 grid gap-6 md:grid-cols-2">

          {/* Create Group */}

          <div className="rounded-xl bg-white p-6 shadow">
            <h2 className="text-xl font-semibold text-gray-900">
              Create a Group
            </h2>

            <p className="mt-2 text-sm text-gray-600">
              Create another group and
              invite your friends.
            </p>

            <input
              type="text"
              value={groupName}
              onChange={(e) =>
                setGroupName(
                  e.target.value
                )
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

          {/* Join Group */}

          <div className="rounded-xl bg-white p-6 shadow">
            <h2 className="text-xl font-semibold text-gray-900">
              Join a Group
            </h2>

            <p className="mt-2 text-sm text-gray-600">
              Enter a group code shared
              by your friend.
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

        {/* Message */}

        {message && (
          <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">
            {message}
          </p>
        )}
      </div>
    </main>
  );
}