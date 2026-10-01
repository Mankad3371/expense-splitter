import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import * as webpush from "web-push";

export const runtime = "nodejs";

type Payment = {
  user_id: string;
  amount: number;
  paid: boolean;
};

type Subscription = {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

function base64ToUint8Array(base64: string) {
  const padding =
    "=".repeat((4 - (base64.length % 4)) % 4);

  const normalized = (
    base64
      .replace(/-/g, "+")
      .replace(/_/g, "/") + padding
  );

  const binary = Buffer.from(
    normalized,
    "base64"
  );

  return new Uint8Array(binary);
}

export async function POST(request: NextRequest) {
  try {
    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL;

    const supabasePublishableKey =
      process.env
        .NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    const serviceRoleKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY;

    const vapidPublicKey =
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

    const vapidPrivateKey =
      process.env.VAPID_PRIVATE_KEY;

    if (
      !supabaseUrl ||
      !supabasePublishableKey ||
      !serviceRoleKey ||
      !vapidPublicKey ||
      !vapidPrivateKey
    ) {
      return NextResponse.json(
        {
          error:
            "Server notification configuration is incomplete.",
        },
        { status: 500 }
      );
    }

    webpush.setVapidDetails(
      "mailto:expense-splitter@example.com",
      vapidPublicKey,
      vapidPrivateKey
    );

    const authorization =
      request.headers.get("authorization");

    if (!authorization?.startsWith("Bearer ")) {
      return NextResponse.json(
        {
          error: "Not authenticated.",
        },
        { status: 401 }
      );
    }

    const accessToken =
      authorization.substring("Bearer ".length);

    const supabaseAuth = createClient(
      supabaseUrl,
      supabasePublishableKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const {
      data: { user },
      error: userError,
    } = await supabaseAuth.auth.getUser(
      accessToken
    );

    if (userError || !user) {
      return NextResponse.json(
        {
          error: "Invalid authentication.",
        },
        { status: 401 }
      );
    }

    const body = await request.json();

    const expenseId = body?.expenseId;

    if (!expenseId) {
      return NextResponse.json(
        {
          error: "expenseId is required.",
        },
        { status: 400 }
      );
    }

    const supabaseAdmin = createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const {
      data: expense,
      error: expenseError,
    } =
      await supabaseAdmin
        .from("expenses")
        .select(
          `
          id,
          group_id,
          name,
          amount,
          paid_by,
          created_by
        `
        )
        .eq("id", expenseId)
        .single();

    if (expenseError || !expense) {
      return NextResponse.json(
        {
          error: "Expense not found.",
        },
        { status: 404 }
      );
    }

    /*
     * Only the person who created the expense
     * is allowed to trigger its notifications.
     */
    if (expense.created_by !== user.id) {
      return NextResponse.json(
        {
          error:
            "You are not allowed to send notifications for this expense.",
        },
        { status: 403 }
      );
    }

    const {
      data: payments,
      error: paymentsError,
    } =
      await supabaseAdmin
        .from("expense_payments")
        .select(
          `
          user_id,
          amount,
          paid
        `
        )
        .eq("expense_id", expenseId);

    if (paymentsError) {
      return NextResponse.json(
        {
          error: paymentsError.message,
        },
        { status: 500 }
      );
    }

    const unpaidPayments: Payment[] =
      (payments || [])
        .filter(
          (payment) =>
            payment.user_id !==
              expense.paid_by &&
            !payment.paid
        )
        .map((payment) => ({
          user_id: payment.user_id,
          amount: Number(payment.amount),
          paid: Boolean(payment.paid),
        }));

    if (unpaidPayments.length === 0) {
      return NextResponse.json({
        success: true,
        sent: 0,
        message:
          "No unpaid members need a notification.",
      });
    }

    const userIds = unpaidPayments.map(
      (payment) => payment.user_id
    );

    const {
      data: preferences,
      error: preferencesError,
    } =
      await supabaseAdmin
        .from("user_preferences")
        .select(
          `
          user_id,
          notifications_enabled
        `
        )
        .in("user_id", userIds);

    if (preferencesError) {
      return NextResponse.json(
        {
          error: preferencesError.message,
        },
        { status: 500 }
      );
    }

    const notificationsAllowed = new Set(
      (preferences || [])
        .filter(
          (preference) =>
            preference.notifications_enabled === true
        )
        .map(
          (preference) =>
            preference.user_id
        )
    );

    const allowedUserIds =
      userIds.filter((userId) =>
        notificationsAllowed.has(userId)
      );

    if (allowedUserIds.length === 0) {
      return NextResponse.json({
        success: true,
        sent: 0,
        message:
          "No unpaid members have notifications enabled.",
      });
    }

    const {
      data: subscriptions,
      error: subscriptionsError,
    } =
      await supabaseAdmin
        .from("push_subscriptions")
        .select(
          `
          id,
          user_id,
          endpoint,
          p256dh,
          auth
        `
        )
        .in(
          "user_id",
          allowedUserIds
        );

    if (subscriptionsError) {
      return NextResponse.json(
        {
          error:
            subscriptionsError.message,
        },
        { status: 500 }
      );
    }

    const subscriptionRows =
      (subscriptions || []) as Subscription[];

    const paymentByUser = new Map<
      string,
      Payment
    >();

    unpaidPayments.forEach((payment) => {
      paymentByUser.set(
        payment.user_id,
        payment
      );
    });

    let sent = 0;
    let failed = 0;

    for (const subscription of subscriptionRows) {
      const payment =
        paymentByUser.get(
          subscription.user_id
        );

      if (!payment) {
        continue;
      }

      const payload = JSON.stringify({
        title: "💰 Payment due",
        body: `You owe €${payment.amount.toFixed(
          2
        )} for "${expense.name}".`,
        url: "/group",
      });

      try {
        await webpush.sendNotification(
          {
            endpoint:
              subscription.endpoint,
            keys: {
              p256dh:
                subscription.p256dh,
              auth: subscription.auth,
            },
          },
          payload
        );

        sent++;
      } catch (error: any) {
        failed++;

        /*
         * If the browser subscription is no longer
         * valid, remove it from the database.
         */
        if (
          error?.statusCode === 404 ||
          error?.statusCode === 410
        ) {
          await supabaseAdmin
            .from("push_subscriptions")
            .delete()
            .eq(
              "id",
              subscription.id
            );
        }

        console.error(
          "Push notification failed:",
          error
        );
      }
    }

    return NextResponse.json({
      success: true,
      sent,
      failed,
    });
  } catch (error) {
    console.error(
      "Expense notification error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unknown notification error.",
      },
      { status: 500 }
    );
  }
}