"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import WelcomePopup from "@/components/WelcomePopup";

type Member = {
  user_id: string;
  name: string;
};

type Payment = {
  user_id: string;
  amount: number;
  paid: boolean;
  paid_at: string | null;
};

type Expense = {
  id: string;
  name: string;
  amount: number;
  createdBy: string;
  paidBy: string;
  participants: string[];
  payments: Payment[];
  closed: boolean;
  receipt: string;
  createdAt: string;
};

type Settlement = {
  id: string;
  from_user_id: string;
  to_user_id: string;
  amount: number;
  created_at: string;
};

type Group = {
  id: string;
  name: string;
  code: string;
  created_by?: string;
};

export default function GroupPage() {
  const router = useRouter();
  const supabase = createClient();

  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [currentUserId, setCurrentUserId] = useState("");
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReceipt, setSelectedReceipt] = useState("");
  const [leaving, setLeaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [actionMessage, setActionMessage] = useState("");
  const [settlementDebtorId, setSettlementDebtorId] = useState<string | null>(null);
  const [settlementAmount, setSettlementAmount] = useState("");
  const [settlementMessage, setSettlementMessage] = useState("");
  const [recordingSettlement, setRecordingSettlement] = useState(false);
  const [selectedSpendingMonth, setSelectedSpendingMonth] = useState("");

  useEffect(() => {
    initializePage();
  }, []);

  async function initializePage() {
    try {
      setLoading(true);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.replace("/auth");
        return;
      }

      setCurrentUserId(user.id);

      const storedGroup =
        localStorage.getItem("activeGroup");

      if (!storedGroup) {
        router.replace("/groups");
        return;
      }

      let savedGroup: Group | null = null;

      try {
        const parsed = JSON.parse(storedGroup);

        if (parsed?.id) {
          savedGroup = parsed;
        }
      } catch {
        localStorage.removeItem("activeGroup");
        router.replace("/groups");
        return;
      }

      if (!savedGroup) {
        localStorage.removeItem("activeGroup");
        router.replace("/groups");
        return;
      }

      const {
        data: membership,
        error: membershipError,
      } = await supabase
        .from("group_members")
        .select("group_id")
        .eq("group_id", savedGroup.id)
        .eq("user_id", user.id)
        .maybeSingle();

      if (membershipError) {
        console.error(
          "Error checking group membership:",
          membershipError
        );

        localStorage.removeItem("activeGroup");
        router.replace("/groups");
        return;
      }

      if (!membership) {
        localStorage.removeItem("activeGroup");
        router.replace("/groups");
        return;
      }

      const {
        data: foundGroup,
        error: groupError,
      } = await supabase
        .from("groups")
        .select("id, name, code, created_by")
        .eq("id", savedGroup.id)
        .single();

      if (groupError || !foundGroup) {
        console.error(
          "Error loading group:",
          groupError
        );

        localStorage.removeItem("activeGroup");
        router.replace("/groups");
        return;
      }

      localStorage.setItem(
        "activeGroup",
        JSON.stringify(foundGroup)
      );

      setGroup(foundGroup);

      await Promise.all([
        loadMembers(foundGroup.id),
        loadExpenses(foundGroup.id),
        loadSettlements(foundGroup.id),
      ]);
    } catch (error) {
      console.error(
        "Group initialization error:",
        error
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadMembers(groupId: string) {
    const { data, error } = await supabase
      .from("group_members")
      .select("user_id, name")
      .eq("group_id", groupId)
      .order("joined_at", {
        ascending: true,
      });

    if (error) {
      console.error(
        "Error loading members:",
        error
      );
      return;
    }

    setMembers(data || []);
  }

  async function loadExpenses(groupId: string) {
    const { data, error } = await supabase
      .from("expenses")
      .select(`
        id,
        name,
        amount,
        created_by,
        paid_by,
        closed,
        created_at,
        receipt_url,
        expense_payments (
          user_id,
          amount,
          paid,
          paid_at
        )
      `)
      .eq("group_id", groupId)
      .order("created_at", {
        ascending: false,
      });

    if (error) {
      console.error(
        "Error loading expenses:",
        error
      );
      return;
    }

    const loadedExpenses: Expense[] =
      (data || []).map((expense: any) => {
        const payments: Payment[] =
          (expense.expense_payments || []).map(
            (payment: any) => ({
              user_id: payment.user_id,
              amount: Number(payment.amount),
              paid: Boolean(payment.paid),
              paid_at: payment.paid_at,
            })
          );

        return {
          id: expense.id,
          name: expense.name,
          amount: Number(expense.amount),
          createdBy: expense.created_by,
          paidBy: expense.paid_by,
          participants: payments.map(
            (payment) => payment.user_id
          ),
          payments,
          closed: Boolean(expense.closed),
          receipt: expense.receipt_url || "",
          createdAt: expense.created_at,
        };
      });

    setExpenses(loadedExpenses);
  }

  async function loadSettlements(groupId: string) {
    const { data, error } = await supabase
      .from("settlements")
      .select("id, from_user_id, to_user_id, amount, created_at")
      .eq("group_id", groupId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading settlements:", error);
      return;
    }

    setSettlements(
      (data || []).map((settlement: any) => ({
        id: settlement.id,
        from_user_id: settlement.from_user_id,
        to_user_id: settlement.to_user_id,
        amount: Number(settlement.amount),
        created_at: settlement.created_at,
      }))
    );
  }

  function getMemberName(userId: string) {
    const member = members.find(
      (item) => item.user_id === userId
    );

    return member?.name || "Unknown";
  }

  function calculateOutstandingDebts() {
    const debts: Record<string, Record<string, number>> = {};

    function addDebt(
      debtorId: string,
      creditorId: string,
      amount: number
    ) {
      if (debtorId === creditorId) {
        return;
      }

      if (!debts[debtorId]) {
        debts[debtorId] = {};
      }

      debts[debtorId][creditorId] =
        (debts[debtorId][creditorId] || 0) + amount;
    }

    expenses.forEach((expense) => {
      if (expense.closed) {
        return;
      }

      expense.payments.forEach((payment) => {
        if (payment.user_id === expense.paidBy || payment.paid) {
          return;
        }

        addDebt(
          payment.user_id,
          expense.paidBy,
          payment.amount
        );
      });
    });

    settlements.forEach((settlement) => {
      if (!debts[settlement.from_user_id]) {
        debts[settlement.from_user_id] = {};
      }

      debts[settlement.from_user_id][settlement.to_user_id] =
        (debts[settlement.from_user_id][settlement.to_user_id] || 0) -
        settlement.amount;
    });

    Object.keys(debts).forEach((debtorId) => {
      Object.keys(debts[debtorId]).forEach((creditorId) => {
        const amount = debts[debtorId][creditorId];

        debts[debtorId][creditorId] =
          amount > 0.005
            ? Math.round(amount * 100) / 100
            : 0;
      });
    });

    return debts;
  }

  function getMyUnpaidDebt() {
    const debts = calculateOutstandingDebts();

    if (!currentUserId || !debts[currentUserId]) {
      return 0;
    }

    return Object.values(debts[currentUserId]).reduce(
      (total, amount) => total + Math.max(amount, 0),
      0
    );
  }

  function getDebtToMe(userId: string) {
    const debts = calculateOutstandingDebts();

    return Math.max(
      debts[userId]?.[currentUserId] || 0,
      0
    );
  }

  async function recordSettlement() {
    if (!group || !settlementDebtorId) {
      return;
    }

    setSettlementMessage("");

    const amount = Number(settlementAmount);

    if (!Number.isFinite(amount) || amount <= 0) {
      setSettlementMessage("Enter a valid payment amount.");
      return;
    }

    const outstanding = getDebtToMe(settlementDebtorId);

    if (outstanding <= 0) {
      setSettlementMessage(
        "This person currently has no outstanding debt to you."
      );
      return;
    }

    if (amount > outstanding + 0.001) {
      setSettlementMessage(
        `The payment cannot be more than €${outstanding.toFixed(2)}.`
      );
      return;
    }

    setRecordingSettlement(true);

    const { error } = await supabase.rpc("record_settlement", {
      target_group_id: group.id,
      debtor_id: settlementDebtorId,
      creditor_id: currentUserId,
      settlement_amount: Number(amount.toFixed(2)),
    });

    setRecordingSettlement(false);

    if (error) {
      setSettlementMessage(error.message);
      return;
    }

    setSettlementDebtorId(null);
    setSettlementAmount("");
    setSettlementMessage("");

    await loadSettlements(group.id);
  }

  async function updatePayment(
    expenseId: string,
    userId: string
  ) {
    const expense = expenses.find(
      (item) => item.id === expenseId
    );

    if (!expense) {
      return;
    }

    if (expense.closed) {
      return;
    }

    if (expense.createdBy !== currentUserId) {
      alert(
        "Only the expense creator can change payment status."
      );
      return;
    }

    const payment = expense.payments.find(
      (item) => item.user_id === userId
    );

    if (!payment) {
      return;
    }

    const newPaidStatus = !payment.paid;

    const paidAt = newPaidStatus
      ? new Date().toISOString()
      : null;

    const { error } = await supabase
      .from("expense_payments")
      .update({
        paid: newPaidStatus,
        paid_at: paidAt,
      })
      .eq("expense_id", expenseId)
      .eq("user_id", userId);

    if (error) {
      alert(error.message);
      return;
    }

    setExpenses((currentExpenses) =>
      currentExpenses.map((item) => {
        if (item.id !== expenseId) {
          return item;
        }

        return {
          ...item,
          payments: item.payments.map(
            (itemPayment) => {
              if (
                itemPayment.user_id !== userId
              ) {
                return itemPayment;
              }

              return {
                ...itemPayment,
                paid: newPaidStatus,
                paid_at: paidAt,
              };
            }
          ),
        };
      })
    );
  }

  async function closeExpense(
    expenseId: string
  ) {
    const expense = expenses.find(
      (item) => item.id === expenseId
    );

    if (!expense) {
      return;
    }

    if (expense.createdBy !== currentUserId) {
      alert(
        "Only the person who created this expense can close it."
      );
      return;
    }

    const { error } = await supabase
      .from("expenses")
      .update({
        closed: true,
      })
      .eq("id", expenseId)
      .eq("created_by", currentUserId);

    if (error) {
      alert(error.message);
      return;
    }

    setExpenses((currentExpenses) =>
      currentExpenses.map((item) =>
        item.id === expenseId
          ? {
              ...item,
              closed: true,
            }
          : item
      )
    );
  }

  async function removeExpense(
    expenseId: string
  ) {
    const expense = expenses.find(
      (item) => item.id === expenseId
    );

    if (!expense) {
      return;
    }

    if (expense.createdBy !== currentUserId) {
      alert(
        "Only the person who created this expense can remove it."
      );
      return;
    }

    if (!expense.closed) {
      return;
    }

    const { error } = await supabase
      .from("expenses")
      .delete()
      .eq("id", expenseId)
      .eq("created_by", currentUserId);

    if (error) {
      alert(error.message);
      return;
    }

    setExpenses((currentExpenses) =>
      currentExpenses.filter(
        (item) => item.id !== expenseId
      )
    );
  }

  async function leaveGroup() {
    if (!group) {
      return;
    }

    setActionMessage("");

    const debt = getMyUnpaidDebt();

    if (debt > 0) {
      setActionMessage(
        `You cannot leave this group because you still owe €${debt.toFixed(
          2
        )}. Please settle your unpaid expenses first.`
      );
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to leave "${group.name}"?`
    );

    if (!confirmed) {
      return;
    }

    setLeaving(true);

    const { error } = await supabase.rpc(
      "leave_group",
      {
        target_group_id: group.id,
      }
    );

    setLeaving(false);

    if (error) {
      setActionMessage(error.message);
      return;
    }

    localStorage.removeItem("activeGroup");

    router.replace("/groups");
  }

  async function logout() {
    setActionMessage("");

    const debt = getMyUnpaidDebt();

    if (debt > 0) {
      setActionMessage(
        `You cannot logout because you still owe €${debt.toFixed(
          2
        )} in this group. Please settle your unpaid expenses first.`
      );
      return;
    }

    const confirmed = window.confirm(
      "Are you sure you want to logout?"
    );

    if (!confirmed) {
      return;
    }

    setLoggingOut(true);

    const { error } =
      await supabase.auth.signOut();

    if (error) {
      setLoggingOut(false);

      setActionMessage(
        "Could not logout. Please try again."
      );

      return;
    }

    localStorage.removeItem("activeGroup");

    router.replace("/auth");
  }

  function switchGroups() {
    setActionMessage("");
    localStorage.removeItem("activeGroup");
    router.push("/groups");
  }

  function calculateBalances() {
    const balances: Record<string, number> = {};
    const debts = calculateOutstandingDebts();

    members.forEach((member) => {
      balances[member.user_id] = 0;
    });

    Object.entries(debts).forEach(([debtorId, creditors]) => {
      Object.entries(creditors).forEach(([creditorId, amount]) => {
        if (amount <= 0) {
          return;
        }

        balances[debtorId] =
          (balances[debtorId] || 0) - amount;

        balances[creditorId] =
          (balances[creditorId] || 0) + amount;
      });
    });

    return balances;
  }

  function getMonthlyExpenditure() {
    const now = new Date();
    const months: {
      key: string;
      label: string;
      fullLabel: string;
      total: number;
      memberTotals: Record<string, number>;
    }[] = [];

    // Show the current month and the previous five months.
    for (let offset = 5; offset >= 0; offset--) {
      const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

      months.push({
        key,
        label: date.toLocaleDateString(undefined, { month: "short" }),
        fullLabel: date.toLocaleDateString(undefined, {
          month: "long",
          year: "numeric",
        }),
        total: 0,
        memberTotals: {},
      });
    }

    // Count the full expense amount and each participant's share.
    // Closed expenses remain included; settlements are not expenditure.
    expenses.forEach((expense) => {
      const date = new Date(expense.createdAt);
      if (Number.isNaN(date.getTime())) return;

      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const month = months.find((item) => item.key === key);

      if (!month) return;

      month.total += expense.amount;

      expense.payments.forEach((payment) => {
        month.memberTotals[payment.user_id] =
          (month.memberTotals[payment.user_id] || 0) + payment.amount;
      });
    });

    return months.map((month) => ({
      ...month,
      total: Math.round(month.total * 100) / 100,
      memberTotals: Object.fromEntries(
        Object.entries(month.memberTotals).map(([userId, amount]) => [
          userId,
          Math.round(amount * 100) / 100,
        ])
      ),
    }));
  }

  const balances = calculateBalances();
  const monthlyExpenditure = getMonthlyExpenditure();
  const currentMonthKey = `${new Date().getFullYear()}-${String(
    new Date().getMonth() + 1
  ).padStart(2, "0")}`;
  const activeSpendingMonth =
    monthlyExpenditure.find((month) => month.key === selectedSpendingMonth) ||
    monthlyExpenditure.find((month) => month.key === currentMonthKey) ||
    monthlyExpenditure[monthlyExpenditure.length - 1];
  const highestMonthlyExpenditure = Math.max(
    ...monthlyExpenditure.map((month) => month.total),
    1
  );
  const sixMonthExpenditure = monthlyExpenditure.reduce(
    (total, month) => total + month.total,
    0
  );

  const myBalance =
    balances[currentUserId] || 0;

  const myOwed = members.reduce(
    (total, member) => total + (member.user_id === currentUserId ? 0 : getDebtToMe(member.user_id)),
    0
  );
  const myDebt = getMyUnpaidDebt();

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f6f8fb]">
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-500" />
            <span className="text-sm font-semibold text-slate-600">Preparing your group dashboard...</span>
          </div>
        </div>
      </main>
    );
  }

  if (!group) return null;

  const formatMoney = (amount: number) =>
    new Intl.NumberFormat(undefined, { style: "currency", currency: "EUR" }).format(amount);

  return (
    <>
      <main className="min-h-screen bg-[#f6f8fb] text-slate-900">
        <div className="mx-auto max-w-[1440px] px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
          {/* Top navigation */}
          <header className="mb-7 flex flex-col gap-5 rounded-3xl border border-slate-200 bg-white px-5 py-5 shadow-sm sm:px-7 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-xl text-emerald-700">⌂</div>
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-600">Expense Splitter / Workspace</p>
                <h1 className="mt-1 truncate text-2xl font-bold tracking-tight text-slate-950">{group.name}</h1>
                <p className="mt-1 text-xs text-slate-500">Shared expenses · {members.length} {members.length === 1 ? "member" : "members"}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="mr-1 rounded-xl bg-slate-50 px-4 py-2.5">
                <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-slate-400">Invite code</p>
                <p className="font-mono text-sm font-bold tracking-[0.2em] text-slate-800">{group.code}</p>
              </div>
              <button type="button" onClick={switchGroups} className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-600 transition hover:border-slate-400 hover:bg-slate-50">Switch group</button>
              <button type="button" onClick={leaveGroup} disabled={leaving} className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-bold text-rose-600 transition hover:bg-rose-100 disabled:opacity-50">{leaving ? "Leaving..." : "Leave group"}</button>
              <button type="button" onClick={logout} disabled={loggingOut} className="rounded-xl bg-emerald-600 px-3.5 py-2.5 text-xs font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50">{loggingOut ? "Logging out..." : "Log out"}</button>
            </div>
          </header>

          {actionMessage && (
            <div role="alert" className="mb-6 flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3.5 text-sm text-rose-700">
              <span className="font-bold">!</span><p>{actionMessage}</p>
            </div>
          )}

          {/* Welcome / quick action */}
          <section className="mb-7 grid gap-5 xl:grid-cols-[1fr_auto] xl:items-stretch">
            <div className="relative overflow-hidden rounded-[28px] border border-emerald-100 bg-white px-6 py-7 text-slate-900 shadow-sm sm:px-8">
              <div className="pointer-events-none absolute -right-12 -top-24 h-72 w-72 rounded-full border-[36px] border-emerald-500/[0.06]" />
              <div className="pointer-events-none absolute -bottom-32 right-44 h-64 w-64 rounded-full bg-emerald-400/10 blur-3xl" />
              <div className="relative">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">Group overview</p>
                <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">Your shared finances, at a glance.</h2>
                <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">See what everyone owes, track spending, and keep your group settled without the awkward maths.</p>
                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <button type="button" onClick={() => router.push("/group/add-expense")} className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-bold text-white transition hover:bg-emerald-700">＋ Add an expense <span>↗</span></button>
                  <span className="text-xs text-slate-500">Group code: <span className="font-mono font-bold tracking-widest text-slate-900">{group.code}</span></span>
                </div>
              </div>
            </div>
            <div className="grid min-w-0 grid-cols-2 gap-3 rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm xl:w-[300px] xl:grid-cols-1">
              <div className="rounded-2xl bg-emerald-50 p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-700">Members</p>
                <p className="mt-2 text-3xl font-bold tracking-tight text-slate-950">{members.length}</p>
                <p className="mt-1 text-xs text-slate-500">In this group</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Recorded expenses</p>
                <p className="mt-2 text-3xl font-bold tracking-tight text-slate-950">{expenses.length}</p>
                <p className="mt-1 text-xs text-slate-500">Including closed expenses</p>
              </div>
            </div>
          </section>

          {/* Financial summary */}
          <section className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <article className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between"><p className="text-sm font-semibold text-slate-500">Your net balance</p><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-lg">◈</span></div>
              <p className={`mt-4 text-3xl font-bold tracking-tight ${myBalance >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{formatMoney(Math.abs(myBalance))}</p>
              <p className="mt-1 text-xs font-medium text-slate-500">{myBalance > 0.005 ? "You are owed overall" : myBalance < -0.005 ? "You owe overall" : "You are all settled"}</p>
            </article>
            <article className="rounded-[24px] border border-rose-100 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between"><p className="text-sm font-semibold text-slate-500">You owe</p><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-50 text-lg text-rose-600">↗</span></div>
              <p className="mt-4 text-3xl font-bold tracking-tight text-rose-600">{formatMoney(myDebt)}</p>
              <p className="mt-1 text-xs font-medium text-slate-500">Outstanding payments from you</p>
            </article>
            <article className="rounded-[24px] border border-emerald-100 bg-white p-5 shadow-sm sm:col-span-2 xl:col-span-1">
              <div className="flex items-center justify-between"><p className="text-sm font-semibold text-slate-500">You are owed</p><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-lg text-emerald-600">↙</span></div>
              <p className="mt-4 text-3xl font-bold tracking-tight text-emerald-600">{formatMoney(myOwed)}</p>
              <p className="mt-1 text-xs font-medium text-slate-500">Outstanding payments to you</p>
            </article>
          </section>

          {/* Members and balances */}
          <section className="mb-7 grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
            <div className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="mb-5 flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Your people</p><h2 className="mt-1 text-lg font-bold text-slate-950">Group members</h2></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{members.length} total</span></div>
              <div className="space-y-3">
                {members.length === 0 ? <p className="text-sm text-slate-500">No members found.</p> : members.map((member, index) => {
                  const debtToMe = getDebtToMe(member.user_id);
                  const balance = balances[member.user_id] || 0;
                  return (
                    <div key={member.user_id} className="flex flex-col gap-3 rounded-2xl bg-slate-50 p-3.5 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-100 to-teal-100 text-sm font-bold text-emerald-800">{member.name.trim().charAt(0).toUpperCase() || "?"}</div>
                        <div className="min-w-0"><p className="truncate text-sm font-bold text-slate-800">{member.name}{member.user_id === currentUserId ? " (You)" : ""}</p><p className="mt-0.5 text-xs text-slate-500">{balance > 0.005 ? "Net creditor" : balance < -0.005 ? "Net debtor" : "Settled up"}</p></div>
                      </div>
                      <div className="flex items-center justify-between gap-3 sm:justify-end">
                        <span className={`text-sm font-bold ${balance > 0.005 ? "text-emerald-600" : balance < -0.005 ? "text-rose-600" : "text-slate-400"}`}>{balance > 0 ? "+" : ""}{formatMoney(balance)}</span>
                        {member.user_id !== currentUserId && debtToMe > 0.005 && <button type="button" onClick={() => { setSettlementDebtorId(member.user_id); setSettlementAmount(""); setSettlementMessage(""); }} className="rounded-lg bg-emerald-600 px-3 py-2 text-[11px] font-bold text-white transition hover:bg-emerald-700">Record payment</button>}
                      </div>
                    </div>
                  );
                })}
              </div>
              {settlementDebtorId && (
                <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4">
                  <div className="flex items-start justify-between gap-3"><div><p className="text-sm font-bold text-slate-900">Record a repayment</p><p className="mt-1 text-xs text-slate-600">{getMemberName(settlementDebtorId)} owes you {formatMoney(getDebtToMe(settlementDebtorId))}</p></div><button type="button" onClick={() => { setSettlementDebtorId(null); setSettlementAmount(""); setSettlementMessage(""); }} className="text-xs font-semibold text-slate-500 hover:text-slate-900">Cancel</button></div>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <div className="relative flex-1"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">€</span><input type="number" min="0.01" step="0.01" value={settlementAmount} onChange={(event) => setSettlementAmount(event.target.value)} placeholder="Amount received" className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-8 pr-3 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10" /></div>
                    <button type="button" onClick={recordSettlement} disabled={recordingSettlement} className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50">{recordingSettlement ? "Recording..." : "Confirm payment"}</button>
                  </div>
                  {settlementMessage && <p className="mt-2 text-xs font-medium text-rose-600">{settlementMessage}</p>}
                </div>
              )}
            </div>

            <div className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="mb-5"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">At a glance</p><h2 className="mt-1 text-lg font-bold text-slate-950">Group balances</h2><p className="mt-1 text-xs text-slate-500">Positive means this member should receive money.</p></div>
              <div className="space-y-4">
                {members.map((member) => {
                  const balance = balances[member.user_id] || 0;
                  const width = Math.min(Math.abs(balance) / Math.max(...members.map((item) => Math.abs(balances[item.user_id] || 0)), 1) * 100, 100);
                  return <div key={member.user_id}><div className="mb-2 flex items-center justify-between gap-3"><span className="text-sm font-semibold text-slate-700">{member.name}{member.user_id === currentUserId ? " (You)" : ""}</span><span className={`text-sm font-bold ${balance > 0.005 ? "text-emerald-600" : balance < -0.005 ? "text-rose-600" : "text-slate-400"}`}>{balance > 0 ? "+" : ""}{formatMoney(balance)}</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${balance >= 0 ? "bg-emerald-500" : "bg-rose-400"}`} style={{ width: `${width}%` }} /></div></div>;
                })}
              </div>
            </div>
          </section>

          {/* Analytics */}
          <section className="mb-7 grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
            <div className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Spending trends</p><h2 className="mt-1 text-lg font-bold text-slate-950">Monthly expenditure</h2><p className="mt-1 text-xs text-slate-500">Group expenses over the last six months</p></div><div className="rounded-2xl bg-emerald-50 px-4 py-3 text-right text-slate-900"><p className="text-[9px] font-bold uppercase tracking-wider text-emerald-700">Six-month total</p><p className="mt-1 text-lg font-bold">{formatMoney(sixMonthExpenditure)}</p></div></div>
              <div className="mt-7 flex h-56 items-end gap-2 border-b border-slate-100 px-1 sm:gap-4">
                {monthlyExpenditure.map((month) => {
                  const barHeight = month.total > 0 ? Math.max((month.total / highestMonthlyExpenditure) * 100, 4) : 0;
                  return <div key={month.key} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end"><span className="mb-2 min-h-4 text-center text-[10px] font-semibold text-slate-500">{month.total > 0 ? `€${month.total.toFixed(0)}` : ""}</span><div className="flex h-40 w-full items-end justify-center"><div title={`${month.label}: €${month.total.toFixed(2)}`} className="w-full max-w-12 rounded-t-xl bg-emerald-500 transition-all duration-500" style={{ height: `${barHeight}%` }} /></div><span className="mt-2 pb-2 text-xs font-semibold text-slate-500">{month.label}</span></div>;
                })}
              </div>
              <p className="mt-3 text-[11px] leading-5 text-slate-400">Based on the date each expense was added. Closed expenses are included; recorded repayments are not counted as new expenditure.</p>
            </div>

            <div className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Member breakdown</p><h2 className="mt-1 text-lg font-bold text-slate-950">Monthly spending</h2><p className="mt-1 text-xs text-slate-500">Each member's share of expenses</p></div><select value={activeSpendingMonth?.key || ""} onChange={(event) => setSelectedSpendingMonth(event.target.value)} className="max-w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-emerald-500">{monthlyExpenditure.map((month) => <option key={month.key} value={month.key}>{month.fullLabel}</option>)}</select></div>
              <div className="mt-6 space-y-5">
                {members.map((member) => {
                  const amount = activeSpendingMonth?.memberTotals[member.user_id] || 0;
                  const total = activeSpendingMonth?.total || 0;
                  const width = total > 0 ? Math.min((amount / total) * 100, 100) : 0;
                  return <div key={member.user_id}><div className="mb-2 flex items-center justify-between gap-3"><span className="text-sm font-semibold text-slate-700">{member.name}{member.user_id === currentUserId ? " (You)" : ""}</span><span className="text-sm font-bold text-slate-900">{formatMoney(amount)}</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${width}%` }} /></div></div>;
                })}
              </div>
              <p className="mt-5 border-t border-slate-100 pt-3 text-[11px] leading-5 text-slate-400">Calculated from each person's expense share, not the amount they paid upfront. Closed expenses are included; repayments are excluded.</p>
            </div>
          </section>

          {/* Expense feed */}
          <section className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Activity</p><h2 className="mt-1 text-xl font-bold tracking-tight text-slate-950">Expenses</h2><p className="mt-1 text-sm text-slate-500">{expenses.length} {expenses.length === 1 ? "expense" : "expenses"} recorded in this group</p></div><button type="button" onClick={() => router.push("/group/add-expense")} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-sm shadow-emerald-600/20 transition hover:bg-emerald-700">＋ Add expense</button></div>

            {expenses.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-12 text-center"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-2xl shadow-sm">🧾</div><h3 className="mt-4 font-bold text-slate-800">No expenses yet</h3><p className="mt-1 text-sm text-slate-500">Add your first shared expense to get started.</p></div> : (
              <div className="grid gap-4 2xl:grid-cols-2">
                {expenses.map((expense) => {
                  const paidCount = expense.payments.filter((payment) => payment.paid).length;
                  const allPaid = expense.payments.length > 0 && paidCount === expense.payments.length;
                  const canEditPayment = expense.createdBy === currentUserId && !expense.closed;
                  return <article key={expense.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:border-slate-300 hover:shadow-md">
                    <div className="p-5 sm:p-6">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex min-w-0 items-start gap-3"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-xl">🧾</div><div className="min-w-0"><h3 className="break-words font-bold text-slate-950">{expense.name}</h3><p className="mt-1 text-xs text-slate-500">Paid by <span className="font-semibold text-slate-700">{getMemberName(expense.paidBy)}</span></p><p className="mt-1 text-[11px] text-slate-400">Added {new Date(expense.createdAt).toLocaleDateString()}</p></div></div>
                        <div className="text-right"><p className="text-xl font-bold tracking-tight text-slate-950">{formatMoney(expense.amount)}</p><span className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold ${expense.closed ? "bg-slate-100 text-slate-500" : allPaid ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{expense.closed ? "Closed" : allPaid ? "All paid" : "Open"}</span></div>
                      </div>
                      <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-y border-slate-100 py-3"><p className="text-xs text-slate-500">Split between <span className="font-semibold text-slate-700">{expense.participants.map((userId) => getMemberName(userId)).join(", ")}</span></p><span className="text-[10px] font-semibold text-slate-400">{paidCount}/{expense.payments.length} paid</span></div>
                      <div className="mt-4"><div className="mb-2 flex items-center justify-between"><p className="text-xs font-bold uppercase tracking-wider text-slate-500">Payment status</p><p className="text-[10px] text-slate-400">{canEditPayment ? "Tap a status to update" : "View only"}</p></div><div className="space-y-2">
                        {expense.payments.map((payment) => <div key={payment.user_id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3.5 py-3"><span className="text-xs font-semibold text-slate-700">{getMemberName(payment.user_id)}</span>{canEditPayment ? <button type="button" onClick={() => updatePayment(expense.id, payment.user_id)} className={`rounded-full px-3 py-1.5 text-[10px] font-bold transition ${payment.paid ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200" : "bg-rose-100 text-rose-700 hover:bg-rose-200"}`}>{payment.paid ? "✓ Paid" : "× Unpaid"}</button> : <span className={`rounded-full px-3 py-1.5 text-[10px] font-bold ${payment.paid ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>{payment.paid ? "✓ Paid" : "× Unpaid"}</span>}</div>)}
                      </div></div>
                      {expense.receipt && <div className="mt-5"><p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Receipt</p><button type="button" onClick={() => setSelectedReceipt(expense.receipt)} className="group relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50"><img src={expense.receipt} alt="Receipt" className="h-28 w-24 object-cover transition duration-200 group-hover:scale-105" /><span className="absolute inset-x-0 bottom-0 bg-slate-950/70 py-1 text-[9px] font-bold text-white">View receipt</span></button></div>}
                      {expense.closed && <div className="mt-5 rounded-xl bg-slate-100 px-4 py-3 text-center text-xs font-bold text-slate-600">✓ This expense has been closed</div>}
                      <div className="mt-5 flex flex-wrap gap-2">
                        {expense.createdBy === currentUserId && !expense.closed && <button type="button" onClick={() => closeExpense(expense.id)} className="flex-1 rounded-xl bg-emerald-600 px-4 py-3 text-xs font-bold text-white transition hover:bg-emerald-700">Close expense</button>}
                        {expense.closed && expense.createdBy === currentUserId && <button type="button" onClick={() => removeExpense(expense.id)} className="flex-1 rounded-xl border border-rose-200 bg-white px-4 py-3 text-xs font-bold text-rose-600 transition hover:bg-rose-50">Remove expense</button>}
                      </div>
                    </div>
                  </article>;
                })}
              </div>
            )}
          </section>

          <footer className="mt-7 flex flex-col gap-2 border-t border-slate-200 pt-5 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between"><p>Expense Splitter <span className="px-1">·</span> {group.name}</p><p>Shared expenses, made simple.</p></footer>
        </div>

        {/* Receipt lightbox */}
        {selectedReceipt && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-4 backdrop-blur-sm" onClick={() => setSelectedReceipt("")}><div className="relative flex max-h-[95vh] max-w-[95vw] items-center justify-center" onClick={(event) => event.stopPropagation()}><button type="button" onClick={() => setSelectedReceipt("")} className="absolute -right-3 -top-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white text-xl font-bold text-slate-900 shadow-lg hover:bg-slate-100">×</button><img src={selectedReceipt} alt="Receipt enlarged" className="max-h-[95vh] max-w-[95vw] rounded-2xl object-contain shadow-2xl" /></div></div>}
      </main>
      <WelcomePopup />
    </>
  );
}