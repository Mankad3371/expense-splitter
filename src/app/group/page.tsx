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
  const [loading, setLoading] = useState(true);
  const [selectedReceipt, setSelectedReceipt] = useState("");

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

      /*
       * The selected group must come from activeGroup.
       *
       * We no longer automatically choose the first group.
       * This is important now that one account can belong
       * to multiple groups.
       */
      const storedGroup =
        localStorage.getItem("activeGroup");

      if (!storedGroup) {
        router.replace("/");
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
        router.replace("/");
        return;
      }

      if (!savedGroup) {
        localStorage.removeItem("activeGroup");
        router.replace("/");
        return;
      }

      /*
       * Verify that the current user actually belongs
       * to this selected group.
       */
      const { data: membership, error: membershipError } =
        await supabase
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
        router.replace("/");
        return;
      }

      if (!membership) {
        localStorage.removeItem("activeGroup");
        router.replace("/");
        return;
      }

      /*
       * Get the latest group information from Supabase.
       */
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
        router.replace("/");
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

  function getMemberName(userId: string) {
    const member = members.find(
      (item) => item.user_id === userId
    );

    return member?.name || "Unknown";
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

  async function logout() {
    await supabase.auth.signOut();

    localStorage.removeItem("activeGroup");

    router.replace("/auth");
  }

  function switchGroups() {
    localStorage.removeItem("activeGroup");
    router.push("/");
  }

  function calculateBalances() {
    const balances: Record<string, number> = {};

    members.forEach((member) => {
      balances[member.user_id] = 0;
    });

    expenses.forEach((expense) => {
      if (expense.closed) {
        return;
      }

      expense.payments.forEach((payment) => {
        if (payment.user_id === expense.paidBy) {
          return;
        }

        if (!payment.paid) {
          balances[expense.paidBy] =
            (balances[expense.paidBy] || 0) +
            payment.amount;

          balances[payment.user_id] =
            (balances[payment.user_id] || 0) -
            payment.amount;
        }
      });
    });

    return balances;
  }

  const balances = calculateBalances();

  const myBalance =
    balances[currentUserId] || 0;

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-100">
        <p className="text-gray-600">
          Loading...
        </p>
      </main>
    );
  }

  if (!group) {
    return null;
  }

  return (
    <>
      <main className="min-h-screen bg-gray-100 p-8">
        <div className="mx-auto max-w-4xl">

          {/* Header */}

          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {group.name}
              </h1>

              <p className="mt-2 text-gray-600">
                Shared expense group
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={switchGroups}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 font-medium text-gray-800 hover:bg-gray-50"
              >
                Switch Groups
              </button>

              <button
                type="button"
                onClick={logout}
                className="rounded-lg border border-red-300 px-4 py-2 font-medium text-red-600 hover:bg-red-50"
              >
                Logout
              </button>
            </div>
          </div>

          {/* Group code */}

          <div className="mt-4 rounded-lg bg-gray-100 p-4">
            <p className="text-sm text-gray-600">
              Group code
            </p>

            <p className="mt-1 text-xl font-bold tracking-wider text-black">
              {group.code}
            </p>
          </div>

          {/* Members */}

          <div className="mt-8 rounded-xl bg-white p-6 shadow">
            <h2 className="text-xl font-semibold text-gray-900">
              Members
            </h2>

            <div className="mt-4 space-y-2 text-black">
              {members.length === 0 ? (
                <p className="text-gray-500">
                  No members found.
                </p>
              ) : (
                members.map((member) => (
                  <p key={member.user_id}>
                    👤 {member.name}
                    {member.user_id === currentUserId
                      ? " (You)"
                      : ""}
                  </p>
                ))
              )}
            </div>
          </div>

          {/* Balances */}

          <div className="mt-8 grid gap-6 md:grid-cols-2">

            <div className="rounded-xl bg-white p-6 shadow">
              <h2 className="text-xl font-semibold text-gray-900">
                Your balance
              </h2>

              {myBalance > 0 ? (
                <>
                  <p className="mt-4 text-sm text-gray-600">
                    You should receive
                  </p>

                  <p className="mt-1 text-4xl font-bold text-green-600">
                    €{myBalance.toFixed(2)}
                  </p>
                </>
              ) : myBalance < 0 ? (
                <>
                  <p className="mt-4 text-sm text-gray-600">
                    You need to pay
                  </p>

                  <p className="mt-1 text-4xl font-bold text-red-600">
                    €{Math.abs(myBalance).toFixed(2)}
                  </p>
                </>
              ) : (
                <>
                  <p className="mt-4 text-sm text-gray-600">
                    You are settled
                  </p>

                  <p className="mt-1 text-4xl font-bold text-green-600">
                    €0.00
                  </p>
                </>
              )}
            </div>

            <div className="rounded-xl bg-white p-6 shadow">
              <h2 className="text-xl font-semibold text-gray-900">
                Group balances
              </h2>

              <div className="mt-4 space-y-4">
                {members.map((member) => {
                  const balance =
                    balances[member.user_id] || 0;

                  return (
                    <div
                      key={member.user_id}
                      className="flex justify-between"
                    >
                      <span className="font-medium text-gray-900">
                        {member.name}
                      </span>

                      <span
                        className={
                          balance > 0
                            ? "font-semibold text-green-600"
                            : balance < 0
                            ? "font-semibold text-red-600"
                            : "font-semibold text-gray-500"
                        }
                      >
                        {balance > 0 ? "+" : ""}
                        €{balance.toFixed(2)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Expenses */}

          <div className="mt-6 rounded-xl bg-white p-6 shadow">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">
                Expenses
              </h2>

              <button
                type="button"
                onClick={() =>
                  router.push("/group/add-expense")
                }
                className="rounded-lg bg-black px-4 py-2 font-medium text-white hover:bg-gray-800"
              >
                + Add Expense
              </button>
            </div>

            {expenses.length === 0 ? (
              <p className="mt-4 text-gray-500">
                No expenses added yet.
              </p>
            ) : (
              <div className="mt-5 space-y-4">
                {expenses.map((expense) => (
                  <div
                    key={expense.id}
                    className="rounded-xl border border-gray-200 p-5"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-gray-900">
                          {expense.name}
                        </h3>

                        <p className="mt-1 text-sm text-gray-500">
                          Paid by{" "}
                          {getMemberName(
                            expense.paidBy
                          )}
                        </p>
                      </div>

                      <p className="text-xl font-bold text-black">
                        €{expense.amount.toFixed(2)}
                      </p>
                    </div>

                    <p className="mt-3 text-sm text-gray-600">
                      Split between{" "}
                      {expense.participants
                        .map((userId) =>
                          getMemberName(userId)
                        )
                        .join(", ")}
                    </p>

                    <div className="mt-5">
                      <p className="text-sm font-semibold text-gray-700">
                        Payment status
                      </p>

                      <div className="mt-3 space-y-2">
                        {expense.payments.map(
                          (payment) => {
                            const memberName =
                              getMemberName(
                                payment.user_id
                              );

                            const canEditPayment =
                              expense.createdBy ===
                                currentUserId &&
                              !expense.closed;

                            return (
                              <div
                                key={payment.user_id}
                                className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2"
                              >
                                <span className="text-black">
                                  {memberName}
                                </span>

                                {canEditPayment ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      updatePayment(
                                        expense.id,
                                        payment.user_id
                                      )
                                    }
                                    className={
                                      payment.paid
                                        ? "font-semibold text-green-600"
                                        : "font-semibold text-red-600"
                                    }
                                  >
                                    {payment.paid
                                      ? "✓ Paid"
                                      : "✗ Unpaid"}
                                  </button>
                                ) : (
                                  <span
                                    className={
                                      payment.paid
                                        ? "font-semibold text-green-600"
                                        : "font-semibold text-red-600"
                                    }
                                  >
                                    {payment.paid
                                      ? "✓ Paid"
                                      : "✗ Unpaid"}
                                  </span>
                                )}
                              </div>
                            );
                          }
                        )}
                      </div>
                    </div>

                    {/* Receipt */}

                    {expense.receipt && (
                      <div className="mt-5">
                        <p className="text-sm font-semibold text-gray-700">
                          Receipt
                        </p>

                        <button
                          type="button"
                          onClick={() =>
                            setSelectedReceipt(
                              expense.receipt
                            )
                          }
                          className="mt-2 block cursor-pointer"
                        >
                          <img
                            src={expense.receipt}
                            alt="Receipt"
                            className="max-h-64 max-w-xs rounded-lg border border-gray-200 object-contain transition hover:opacity-80"
                          />
                        </button>
                      </div>
                    )}

                    {/* Close expense */}

                    {expense.createdBy ===
                      currentUserId &&
                      !expense.closed && (
                        <button
                          type="button"
                          onClick={() =>
                            closeExpense(
                              expense.id
                            )
                          }
                          className="mt-5 w-full rounded-lg bg-black px-4 py-3 font-medium text-white hover:bg-gray-800"
                        >
                          Close Expense
                        </button>
                      )}

                    {/* Closed expense */}

                    {expense.closed && (
                      <div className="mt-5">
                        <div className="rounded-lg bg-green-50 p-3 text-center font-semibold text-green-700">
                          ✓ Expense closed
                        </div>

                        {expense.createdBy ===
                          currentUserId && (
                          <button
                            type="button"
                            onClick={() =>
                              removeExpense(
                                expense.id
                              )
                            }
                            className="mt-3 w-full rounded-lg border border-red-300 px-4 py-3 font-medium text-red-600 hover:bg-red-50"
                          >
                            Remove Expense
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Receipt viewer */}

        {selectedReceipt && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
            onClick={() =>
              setSelectedReceipt("")
            }
          >
            <div
              className="relative flex max-h-[95vh] max-w-[95vw] items-center justify-center"
              onClick={(event) =>
                event.stopPropagation()
              }
            >
              <button
                type="button"
                onClick={() =>
                  setSelectedReceipt("")
                }
                className="absolute right-2 top-2 z-10 rounded-full bg-black/70 px-3 py-1 text-2xl font-bold text-white hover:bg-black"
              >
                ×
              </button>

              <img
                src={selectedReceipt}
                alt="Receipt enlarged"
                className="max-h-[95vh] max-w-[95vw] rounded-lg object-contain"
              />
            </div>
          </div>
        )}
      </main>

      <WelcomePopup />
    </>
  );
}