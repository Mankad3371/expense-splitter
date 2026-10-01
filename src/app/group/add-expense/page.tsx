"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

type Member = {
  user_id: string;
  name: string;
};

export default function AddExpensePage() {
  const router = useRouter();
  const supabase = createClient();

  const [members, setMembers] = useState<Member[]>([]);
  const [currentUserId, setCurrentUserId] = useState("");

  const [expenseName, setExpenseName] = useState("");
  const [amount, setAmount] = useState("");

  const [receiptFile, setReceiptFile] =
    useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] =
    useState("");

  const [paidBy, setPaidBy] = useState("");
  const [selectedMembers, setSelectedMembers] =
    useState<string[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadGroupMembers();
  }, []);

  async function loadGroupMembers() {
    const savedGroup = JSON.parse(
      localStorage.getItem("activeGroup") || "null"
    );

    if (!savedGroup?.id) {
      router.push("/");
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/auth");
      return;
    }

    setCurrentUserId(user.id);

    const { data, error } = await supabase
      .from("group_members")
      .select("user_id, name")
      .eq("group_id", savedGroup.id)
      .order("joined_at", {
        ascending: true,
      });

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    const loadedMembers = data || [];

    setMembers(loadedMembers);

    // Select everyone by default.
    setSelectedMembers(
      loadedMembers.map(
        (member) => member.user_id
      )
    );

    // Default payer = current user.
    setPaidBy(user.id);

    setLoading(false);
  }

  function toggleMember(userId: string) {
    setSelectedMembers((current) => {
      if (current.includes(userId)) {
        return current.filter(
          (id) => id !== userId
        );
      }

      return [...current, userId];
    });
  }

  function handleReceiptChange(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];

    if (!file) {
      setReceiptFile(null);
      setReceiptPreview("");
      return;
    }

    // Only allow images.
    if (!file.type.startsWith("image/")) {
      alert("Please select an image file.");
      event.target.value = "";
      return;
    }

    // 10 MB maximum.
    if (file.size > 10 * 1024 * 1024) {
      alert(
        "Receipt image must be smaller than 10 MB."
      );
      event.target.value = "";
      return;
    }

    setReceiptFile(file);

    const previewUrl =
      URL.createObjectURL(file);

    setReceiptPreview(previewUrl);
  }

  async function sendExpenseNotifications(
    expenseId: string
  ) {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        console.error(
          "No active session for notifications."
        );
        return;
      }

      console.log(
        "Sending expense notifications for:",
        expenseId
      );

      const response = await fetch(
        "/api/send-expense-notifications",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            expenseId,
          }),
        }
      );

      const result =
        await response.json();

      if (!response.ok) {
        console.error(
          "Notification API error:",
          result
        );
        return;
      }

      console.log(
        "Expense notifications:",
        result
      );
    } catch (error) {
      /*
       * Notification failure must NOT
       * break expense creation.
       */
      console.error(
        "Could not send expense notifications:",
        error
      );
    }
  }

  async function addExpense() {
    if (!expenseName.trim()) {
      alert("Please enter an expense name.");
      return;
    }

    if (!amount || Number(amount) <= 0) {
      alert("Please enter a valid amount.");
      return;
    }

    if (selectedMembers.length === 0) {
      alert(
        "Please select at least one person."
      );
      return;
    }

    if (!paidBy) {
      alert("Please select who paid.");
      return;
    }

    const savedGroup = JSON.parse(
      localStorage.getItem("activeGroup") || "null"
    );

    if (!savedGroup?.id) {
      alert("No active group found.");
      return;
    }

    setSaving(true);

    // Work in cents to avoid floating-point
    // money errors.
    const totalCents = Math.round(
      Number(amount) * 100
    );

    const baseShare = Math.floor(
      totalCents /
        selectedMembers.length
    );

    const remainingCents =
      totalCents %
      selectedMembers.length;

    // --------------------------------------------------
    // 1. Create the expense
    // --------------------------------------------------

    const {
      data: expense,
      error: expenseError,
    } = await supabase
      .from("expenses")
      .insert({
        group_id: savedGroup.id,
        name: expenseName.trim(),
        amount: Number(amount),
        paid_by: paidBy,
        created_by: currentUserId,
        receipt_url: null,
        closed: false,
      })
      .select()
      .single();

    if (expenseError) {
      setSaving(false);
      alert(expenseError.message);
      return;
    }

    // --------------------------------------------------
    // 2. Create payment/share rows
    // --------------------------------------------------

    const paymentRows =
      selectedMembers.map(
        (userId, index) => {
          let shareCents = baseShare;

          if (index < remainingCents) {
            shareCents += 1;
          }

          return {
            expense_id: expense.id,
            user_id: userId,
            amount: Number(
              (
                shareCents / 100
              ).toFixed(2)
            ),
            paid:
              userId === paidBy,
            paid_at:
              userId === paidBy
                ? new Date().toISOString()
                : null,
          };
        }
      );

    const {
      error: paymentError,
    } = await supabase
      .from("expense_payments")
      .insert(paymentRows);

    if (paymentError) {
      setSaving(false);

      // Remove the expense if payment rows failed.
      await supabase
        .from("expenses")
        .delete()
        .eq("id", expense.id);

      alert(paymentError.message);
      return;
    }

    // --------------------------------------------------
    // 3. Upload receipt if one was selected
    // --------------------------------------------------

    if (receiptFile) {
      const fileExtension =
        receiptFile.name
          .split(".")
          .pop()
          ?.toLowerCase() ||
        "jpg";

      const filePath =
        `${savedGroup.id}/${expense.id}.${fileExtension}`;

      const {
        error: uploadError,
      } = await supabase.storage
        .from("receipts")
        .upload(
          filePath,
          receiptFile,
          {
            cacheControl: "3600",
            upsert: true,
            contentType:
              receiptFile.type,
          }
        );

      if (uploadError) {
        setSaving(false);

        // Remove the expense and its payment rows
        // because the receipt could not be uploaded.
        await supabase
          .from("expenses")
          .delete()
          .eq("id", expense.id);

        alert(
          `Receipt upload failed: ${uploadError.message}`
        );

        return;
      }

      // --------------------------------------------------
      // 4. Get the public receipt URL
      // --------------------------------------------------

      const {
        data: publicUrlData,
      } = supabase.storage
        .from("receipts")
        .getPublicUrl(filePath);

      const receiptUrl =
        publicUrlData.publicUrl;

      // --------------------------------------------------
      // 5. Save receipt URL to the expense
      // --------------------------------------------------

      const {
        error: receiptUpdateError,
      } = await supabase
        .from("expenses")
        .update({
          receipt_url:
            receiptUrl,
        })
        .eq("id", expense.id);

      if (receiptUpdateError) {
        setSaving(false);

        alert(
          `Expense was created, but the receipt URL could not be saved: ${receiptUpdateError.message}`
        );

        return;
      }
    }

    // --------------------------------------------------
    // 6. Send push notifications
    // --------------------------------------------------

    /*
     * The expense and payment rows now exist.
     *
     * The server will:
     * - find unpaid participants
     * - check who enabled notifications
     * - find their push subscriptions
     * - send the notification
     *
     * Notification failure will NOT delete
     * or invalidate the expense.
     */
    await sendExpenseNotifications(
      expense.id
    );

    // --------------------------------------------------
    // 7. Everything finished
    // --------------------------------------------------

    setSaving(false);

    router.push("/group");
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-100 p-8">
        <div className="mx-auto max-w-4xl">
          <p className="text-gray-600">
            Loading group members...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-100 p-8">
      <div className="mx-auto max-w-4xl">

        <h1 className="text-3xl font-bold text-gray-900">
          Add Expense
        </h1>

        <p className="mt-2 text-gray-600">
          Add a shared expense to your group.
        </p>

        <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">

          {/* Expense name */}

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Expense name
            </label>

            <input
              type="text"
              value={expenseName}
              onChange={(e) =>
                setExpenseName(
                  e.target.value
                )
              }
              placeholder="e.g. Groceries"
              className="mt-1 w-full rounded-lg border border-gray-300 p-3 text-black"
            />
          </div>

          {/* Amount */}

          <div className="mt-5">
            <label className="block text-sm font-medium text-gray-700">
              Amount (€)
            </label>

            <input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) =>
                setAmount(
                  e.target.value
                )
              }
              placeholder="e.g. 63.42"
              className="mt-1 w-full rounded-lg border border-gray-300 p-3 text-black"
            />
          </div>

          {/* Paid by */}

          <div className="mt-5">
            <label className="block text-sm font-medium text-gray-700">
              Paid by
            </label>

            <select
              value={paidBy}
              onChange={(e) =>
                setPaidBy(
                  e.target.value
                )
              }
              className="mt-1 w-full rounded-lg border border-gray-300 p-3 text-black"
            >
              {members.map(
                (member) => (
                  <option
                    key={
                      member.user_id
                    }
                    value={
                      member.user_id
                    }
                  >
                    {member.name}
                    {member.user_id ===
                    currentUserId
                      ? " (You)"
                      : ""}
                  </option>
                )
              )}
            </select>
          </div>

          {/* Receipt */}

          <div className="mt-5">
            <label className="block text-sm font-medium text-gray-700">
              Receipt
            </label>

            <input
              type="file"
              accept="image/*"
              onChange={
                handleReceiptChange
              }
              className="mt-1 w-full rounded-lg border border-gray-300 p-3 text-black"
            />

            <p className="mt-2 text-xs text-gray-500">
              Image only, maximum 10 MB.
            </p>

            {receiptPreview && (
              <div className="mt-6">
                <p className="text-sm font-medium text-gray-700">
                  Receipt preview
                </p>

                <div className="mt-3 overflow-hidden rounded-xl border border-gray-200 bg-gray-50 p-3">
                  <img
                    src={
                      receiptPreview
                    }
                    alt="Receipt preview"
                    className="max-h-80 w-full rounded-lg object-contain"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Split between */}

          <div className="mt-6">
            <p className="text-sm font-medium text-gray-700">
              Split between
            </p>

            <div className="mt-3 space-y-3">

              {members.map(
                (member) => (
                  <label
                    key={
                      member.user_id
                    }
                    className="flex items-center gap-3 text-black"
                  >
                    <input
                      type="checkbox"
                      checked={selectedMembers.includes(
                        member.user_id
                      )}
                      onChange={() =>
                        toggleMember(
                          member.user_id
                        )
                      }
                    />

                    {member.name}

                    {member.user_id ===
                    currentUserId
                      ? " (You)"
                      : ""}
                  </label>
                )
              )}

            </div>
          </div>

          {/* Share */}

          <div className="mt-6 rounded-lg bg-gray-100 p-4">
            <p className="text-sm text-gray-600">
              Each person pays
            </p>

            <p className="mt-1 text-2xl font-bold text-black">
              €

              {selectedMembers.length >
              0
                ? (
                    Number(
                      amount || 0
                    ) /
                    selectedMembers.length
                  ).toFixed(2)
                : "0.00"}
            </p>
          </div>

          {/* Add expense */}

          <button
            type="button"
            onClick={addExpense}
            disabled={saving}
            className="mt-6 w-full rounded-xl bg-black px-5 py-3 font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving
              ? "Adding Expense..."
              : "Add Expense"}
          </button>

        </div>
      </div>
    </main>
  );
}