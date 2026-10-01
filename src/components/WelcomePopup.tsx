"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";

function uint8ArrayToBase64(array: Uint8Array) {
  let binary = "";

  array.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary);
}

export default function WelcomePopup() {
  const supabase = createClient();

  console.log(
    "VAPID public key loaded:",
    Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY)
  );

  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    checkPreferences();
  }, []);

  async function checkPreferences() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return;
    }

    const { data, error } = await supabase
      .from("user_preferences")
      .select("terms_accepted")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      console.error(
        "Error checking user preferences:",
        error
      );
      return;
    }

    if (!data || !data.terms_accepted) {
      setShow(true);
    }
  }

  async function setupPushNotifications() {
    if (
      !("serviceWorker" in navigator) ||
      !("PushManager" in window)
    ) {
      throw new Error(
        "Push notifications are not supported by this browser."
      );
    }

    const registration =
      await navigator.serviceWorker.register("/sw.js");

    await navigator.serviceWorker.ready;

    let subscription =
      await registration.pushManager.getSubscription();

    if (!subscription) {
      const publicKey =
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

      if (!publicKey) {
        throw new Error(
          "VAPID public key is missing."
        );
      }

      const padding =
        "=".repeat(
          (4 - (publicKey.length % 4)) % 4
        );

      const base64 = (
        publicKey
          .replace(/-/g, "+")
          .replace(/_/g, "/") +
        padding
      );

      const applicationServerKey =
        Uint8Array.from(
          atob(base64),
          (character) =>
            character.charCodeAt(0)
        );

      subscription =
        await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey,
        });
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error(
        "You must be logged in."
      );
    }

    const p256dh = subscription.getKey("p256dh");
    const auth = subscription.getKey("auth");

    if (!p256dh || !auth) {
      throw new Error(
        "Could not read the push subscription."
      );
    }

    const { error } = await supabase
      .from("push_subscriptions")
      .upsert(
        {
          user_id: user.id,
          endpoint: subscription.endpoint,
          p256dh: uint8ArrayToBase64(
            new Uint8Array(p256dh)
          ),
          auth: uint8ArrayToBase64(
            new Uint8Array(auth)
          ),
        },
        {
          onConflict: "endpoint",
        }
      );

    if (error) {
      throw error;
    }
  }

  async function enableNotifications() {
    setSaving(true);

    try {
      /*
       * Request permission FIRST.
       * This keeps the request directly connected
       * to the user's button click.
       */
      const permission =
        await Notification.requestPermission();

      if (permission !== "granted") {
        throw new Error(
          "Notification permission was not granted."
        );
      }

      /*
       * Permission is granted, so now we can
       * register the service worker and create
       * the push subscription.
       */
      await setupPushNotifications();

      await savePreference(true);

      const registration =
        await navigator.serviceWorker.ready;

      await registration.showNotification(
        "Expense Splitter",
        {
          body: "Notifications are now enabled! 🔔",
          data: {
            url: "/group",
          },
        }
      );
    } catch (error) {
      console.error(
        "Notification setup error:",
        error
      );

      alert(
        error instanceof Error
          ? error.message
          : "Could not enable notifications."
      );

      setSaving(false);
    }
  }

  async function continueWithoutNotifications() {
    setSaving(true);

    await savePreference(false);
  }

  async function savePreference(
    enableNotifications: boolean
  ) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setSaving(false);
      return;
    }

    const { error } = await supabase
      .from("user_preferences")
      .upsert({
        user_id: user.id,
        terms_accepted: true,
        notifications_enabled:
          enableNotifications,
        updated_at: new Date().toISOString(),
      });

    if (error) {
      console.error(
        "Error saving preferences:",
        error
      );

      alert(
        "Could not save your preferences. Please try again."
      );

      setSaving(false);
      return;
    }

    setShow(false);
    setSaving(false);
  }

  if (!show) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
        <h2 className="text-2xl font-bold text-gray-900">
          Welcome to Expense Splitter 👋
        </h2>

        <p className="mt-3 text-gray-600">
          Expense Splitter helps your group keep track
          of shared expenses and payments.
        </p>

        <div className="mt-5 rounded-xl bg-blue-50 p-4">
          <p className="font-semibold text-blue-900">
            🔔 Notifications are recommended
          </p>

          <p className="mt-2 text-sm text-blue-800">
            Notifications can let you know when someone
            adds an expense and you have money to pay.
          </p>

          <p className="mt-2 text-sm font-medium text-blue-800">
            Notifications are completely optional.
          </p>
        </div>

        <div className="mt-5 rounded-xl bg-gray-50 p-4 text-sm text-gray-600">
          <p className="font-semibold text-gray-800">
            Terms & Conditions
          </p>

          <p className="mt-2">
            By continuing to use Expense Splitter, you
            agree to use the service responsibly and
            understand that expense amounts and payment
            information are entered by group members.
          </p>
        </div>

        <div className="mt-6 space-y-3">
          <button
            type="button"
            onClick={enableNotifications}
            disabled={saving}
            className="w-full rounded-lg bg-black px-4 py-3 font-medium text-white hover:bg-gray-800 disabled:opacity-50"
          >
            {saving
              ? "Setting up..."
              : "✓ Accept & Enable Notifications"}
          </button>

          <button
            type="button"
            onClick={
              continueWithoutNotifications
            }
            disabled={saving}
            className="w-full rounded-lg border border-gray-300 px-4 py-3 font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Continue Without Notifications
          </button>
        </div>

        <p className="mt-4 text-center text-xs text-gray-500">
          You can change your notification preference
          later.
        </p>
      </div>
    </div>
  );
}