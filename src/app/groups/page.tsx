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

function Icon({ name, className = "h-5 w-5" }: { name: "home" | "plus" | "arrow" | "users" | "key" | "logout" | "spark" | "check"; className?: string }) {
  const common = { className, fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, viewBox: "0 0 24 24" };
  switch (name) {
    case "home": return <svg {...common}><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" /></svg>;
    case "plus": return <svg {...common}><path d="M12 5v14M5 12h14" /></svg>;
    case "arrow": return <svg {...common}><path d="M5 12h14m-6-6 6 6-6 6" /></svg>;
    case "users": return <svg {...common}><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM20 8v6m3-3h-6" /></svg>;
    case "key": return <svg {...common}><circle cx="8" cy="15" r="5" /><path d="m11.5 11.5 8-8L22 6l-3 3 2 2-3 3-2-2-3 3" /></svg>;
    case "logout": return <svg {...common}><path d="M10 17l5-5-5-5m5 5H3M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6" /></svg>;
    case "spark": return <svg {...common}><path d="m12 3 1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7L12 3ZM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16Z" /></svg>;
    case "check": return <svg {...common}><path d="m5 12 4 4L19 6" /></svg>;
  }
}

export default function Home() {
  const router = useRouter();
  const supabase = createClient();

  const [groups, setGroups] = useState<Group[]>([]);
  const [groupName, setGroupName] = useState("");
  const [groupCode, setGroupCode] = useState("");
  const [memberName, setMemberName] = useState("Manthan");
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
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      router.replace("/auth");
      return;
    }

    const { data: memberships, error: membershipError } = await supabase
      .from("group_members")
      .select("group_id, name")
      .eq("user_id", user.id);

    if (membershipError) {
      console.error("Error loading memberships:", membershipError);
      setMessage("Could not load your groups.");
      setLoading(false);
      return;
    }

    if (!memberships || memberships.length === 0) {
      setGroups([]);
      setLoading(false);
      return;
    }

    if (memberships[0]?.name) setMemberName(memberships[0].name);

    const groupIds = memberships.map((membership) => membership.group_id);
    const { data: loadedGroups, error: groupsError } = await supabase
      .from("groups")
      .select("id, name, code, created_by")
      .in("id", groupIds)
      .order("created_at", { ascending: true });

    if (groupsError) {
      console.error("Error loading groups:", groupsError);
      setMessage("Could not load your groups.");
      setLoading(false);
      return;
    }

    setGroups(loadedGroups || []);
    setLoading(false);
  }

  function openGroup(group: Group) {
    localStorage.setItem("activeGroup", JSON.stringify(group));
    router.push("/group");
  }

  async function createGroup() {
    setMessage("");
    if (!groupName.trim()) {
      setMessage("Please enter a group name.");
      return;
    }
    if (!memberName.trim()) {
      setMessage("Please enter your name.");
      return;
    }

    setCreating(true);
    const { data, error } = await supabase.rpc("create_group", {
      group_name: groupName.trim(),
      member_name: memberName.trim(),
    });
    setCreating(false);

    if (error) {
      setMessage(error.message);
      return;
    }
    if (!data) {
      setMessage("Group could not be created.");
      return;
    }

    setGroupName("");
    await loadGroups();
    openGroup(data);
  }

  async function joinGroup() {
    setMessage("");
    if (!groupCode.trim()) {
      setMessage("Please enter a group code.");
      return;
    }
    if (!memberName.trim()) {
      setMessage("Please enter your name.");
      return;
    }

    setJoining(true);
    const { data, error } = await supabase.rpc("join_group", {
      group_code: groupCode.trim(),
      member_name: memberName.trim(),
    });
    setJoining(false);

    if (error) {
      setMessage(error.message);
      return;
    }
    if (!data) {
      setMessage("Could not join the group.");
      return;
    }

    setGroupCode("");
    await loadGroups();
    openGroup(data);
  }

  async function getTotalUnpaidDebt() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return 0;

    const { data: memberships, error: membershipError } = await supabase
      .from("group_members")
      .select("group_id")
      .eq("user_id", user.id);

    if (membershipError) {
      console.error("Error checking group memberships:", membershipError);
      throw new Error("Could not check your balances.");
    }
    if (!memberships || memberships.length === 0) return 0;

    const groupIds = memberships.map((membership) => membership.group_id);
    const { data: expenses, error: expenseError } = await supabase
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
      console.error("Error checking expenses:", expenseError);
      throw new Error("Could not check your balances.");
    }

    let totalDebt = 0;
    (expenses || []).forEach((expense: any) => {
      if (expense.closed) return;
      (expense.expense_payments || []).forEach((payment: any) => {
        if (payment.user_id === user.id && payment.user_id !== expense.paid_by && !payment.paid) {
          totalDebt += Number(payment.amount);
        }
      });
    });
    return totalDebt;
  }

  async function logout() {
    setMessage("");
    try {
      setLoggingOut(true);
      const totalDebt = await getTotalUnpaidDebt();

      if (totalDebt > 0) {
        setLoggingOut(false);
        setMessage(`You cannot logout because you still owe €${totalDebt.toFixed(2)}. Please settle your unpaid expenses first.`);
        return;
      }

      const confirmed = window.confirm("Are you sure you want to logout?");
      if (!confirmed) {
        setLoggingOut(false);
        return;
      }

      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error("Logout error:", error);
        setMessage("Could not logout. Please try again.");
        setLoggingOut(false);
        return;
      }

      localStorage.removeItem("activeGroup");
      router.replace("/auth");
    } catch (error) {
      console.error("Logout check error:", error);
      setMessage(error instanceof Error ? error.message : "Could not check your balances.");
      setLoggingOut(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f6f8fb]">
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-6 py-4 shadow-sm">
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-500" />
          <p className="text-sm font-medium text-slate-600">Loading your groups...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f6f8fb] text-slate-900">
      <div className="mx-auto max-w-6xl px-5 py-7 sm:px-8 lg:py-10">
        <header className="flex flex-col gap-5 border-b border-slate-200/80 pb-7 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-lg shadow-slate-900/10">
              <Icon name="home" className="h-5 w-5" />
            </div>
            <div>
              <p className="text-lg font-bold tracking-tight text-slate-950">Expense Splitter</p>
              <p className="text-xs font-medium text-slate-500">Your shared money, organised.</p>
            </div>
          </div>
          <button type="button" onClick={logout} disabled={loggingOut} className="inline-flex items-center justify-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50 sm:self-auto">
            <Icon name="logout" className="h-4 w-4" />
            {loggingOut ? "Checking..." : "Log out"}
          </button>
        </header>

        <section className="grid gap-8 py-9 lg:grid-cols-[1fr_300px] lg:items-end">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
              <Icon name="spark" className="h-3.5 w-3.5" />
              YOUR PERSONAL WORKSPACE
            </div>
            <h1 className="max-w-2xl text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">Good to see you again<span className="text-emerald-500">.</span></h1>
            <p className="mt-3 max-w-xl text-base leading-7 text-slate-500">Manage your groups, keep track of shared expenses, and make settling up simple.</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <label htmlFor="memberName" className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">Your display name</label>
            <input id="memberName" type="text" value={memberName} onChange={(e) => setMemberName(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm font-medium text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10" placeholder="Enter your name" />
          </div>
        </section>

        <section className="mb-8">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">OVERVIEW</p>
              <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-950">My groups</h2>
              <p className="mt-1 text-sm text-slate-500">Select a group to view its shared expenses.</p>
            </div>
            <div className="rounded-xl bg-white px-3.5 py-2 text-sm font-semibold text-slate-600 ring-1 ring-slate-200">
              <span className="text-slate-950">{groups.length}</span> {groups.length === 1 ? "group" : "groups"}
            </div>
          </div>

          {groups.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600"><Icon name="users" className="h-7 w-7" /></div>
              <h3 className="mt-4 text-lg font-bold text-slate-900">Your groups will appear here</h3>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">You haven't joined a group yet. Create a new one or use an invite code to join your friends.</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {groups.map((group, index) => (
                <article key={group.id} className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-1 hover:border-emerald-200 hover:shadow-lg hover:shadow-slate-900/5">
                  <div className="flex items-start justify-between">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><Icon name="home" className="h-5 w-5" /></div>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-500">GROUP {String(index + 1).padStart(2, "0")}</span>
                  </div>
                  <h3 className="mt-5 truncate text-lg font-bold text-slate-950">{group.name}</h3>
                  <div className="mt-3 rounded-xl bg-slate-50 px-3.5 py-3">
                    <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">INVITE CODE</p>
                    <p className="mt-1 font-mono text-sm font-bold tracking-[0.18em] text-slate-700">{group.code}</p>
                  </div>
                  <button type="button" onClick={() => openGroup(group)} className="mt-4 flex w-full items-center justify-between rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-600">
                    Open group <Icon name="arrow" className="h-4 w-4 transition group-hover:translate-x-1" />
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="grid gap-5 lg:grid-cols-2">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700"><Icon name="plus" className="h-5 w-5" /></div>
              <div><h2 className="text-lg font-bold text-slate-950">Create a group</h2><p className="mt-1 text-sm leading-6 text-slate-500">Start a shared space and invite your flatmates or friends.</p></div>
            </div>
            <form className="mt-6" onSubmit={(e) => { e.preventDefault(); createGroup(); }}>
              <label htmlFor="groupName" className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">Group name</label>
              <input id="groupName" type="text" value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="e.g. Imperia Flat" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10" />
              <button type="submit" disabled={creating} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3.5 text-sm font-bold text-white shadow-sm shadow-emerald-600/20 transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50">
                {creating ? "Creating group..." : "Create group"} <Icon name="arrow" className="h-4 w-4" />
              </button>
            </form>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sky-100 text-sky-700"><Icon name="key" className="h-5 w-5" /></div>
              <div><h2 className="text-lg font-bold text-slate-950">Join a group</h2><p className="mt-1 text-sm leading-6 text-slate-500">Already have an invite code? Enter it below to join.</p></div>
            </div>
            <form className="mt-6" onSubmit={(e) => { e.preventDefault(); joinGroup(); }}>
              <label htmlFor="groupCode" className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">Group invite code</label>
              <input id="groupCode" type="text" value={groupCode} onChange={(e) => setGroupCode(e.target.value.toUpperCase())} placeholder="ENTER CODE" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 font-mono text-sm font-semibold tracking-[0.15em] text-slate-900 outline-none transition placeholder:font-sans placeholder:font-normal placeholder:tracking-normal placeholder:text-slate-400 focus:border-sky-500 focus:bg-white focus:ring-4 focus:ring-sky-500/10" />
              <button type="submit" disabled={joining} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-sm font-bold text-slate-800 transition hover:border-sky-300 hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-50">
                {joining ? "Joining group..." : "Join group"} <Icon name="arrow" className="h-4 w-4" />
              </button>
            </form>
          </div>
        </section>

        {message && (
          <div role="alert" className="mt-6 flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3.5 text-sm text-rose-700">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-100"><span className="text-xs font-bold">!</span></span>
            <p>{message}</p>
          </div>
        )}

        <footer className="mt-10 flex flex-col gap-2 border-t border-slate-200 pt-5 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <p>Expense Splitter <span className="px-1">·</span> Shared expenses, made simple.</p>
          <p className="inline-flex items-center gap-1.5"><Icon name="check" className="h-3.5 w-3.5 text-emerald-600" /> Your groups are synced securely.</p>
        </footer>
      </div>
    </main>
  );
}
