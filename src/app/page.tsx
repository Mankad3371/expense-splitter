"use client";

import Link from "next/link";

const features = [
  {
    number: "01",
    title: "Split expenses fairly",
    description:
      "Add a shared expense, choose who participated, and see each person's share automatically.",
  },
  {
    number: "02",
    title: "Keep track of repayments",
    description:
      "Record full or partial repayments and keep outstanding balances up to date.",
  },
  {
    number: "03",
    title: "Keep every receipt together",
    description:
      "Attach receipts to expenses so your group can refer back to the original purchase.",
  },
  {
    number: "04",
    title: "Understand monthly spending",
    description:
      "Review group expenditure over time and see how much each member's share adds up to.",
  },
];

const steps = [
  ["Create a group", "Start a group for your flat, trip, or shared activity."],
  ["Add expenses", "Record what was paid, who paid, and who should share it."],
  ["Settle up", "Check balances and record repayments as they happen."],
];

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-white text-slate-900">
      <header className="border-b border-slate-200">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <Link href="/" className="text-xl font-bold tracking-tight">
            Expense<span className="text-emerald-600">Splitter</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/auth"
              className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              Log in
            </Link>
            <Link
              href="/auth"
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
            >
              Get started
            </Link>
          </div>
        </nav>
      </header>

      <section className="relative bg-slate-50">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-20 md:grid-cols-2 md:py-28">
          <div>
            <p className="mb-5 inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-800">
              Shared expenses, made simpler
            </p>
            <h1 className="max-w-xl text-5xl font-bold leading-tight tracking-tight sm:text-6xl">
              Split expenses.
              <span className="block text-emerald-600">Stay friends.</span>
            </h1>
            <p className="mt-6 max-w-lg text-lg leading-8 text-slate-600">
              Keep shared costs organised, understand who owes what, and make
              settling up easier for everyone in your group.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link
                href="/auth"
                className="rounded-xl bg-emerald-600 px-6 py-3.5 font-semibold text-white shadow-sm hover:bg-emerald-700"
              >
                Create your free account
              </Link>
              <Link
                href="/auth"
                className="rounded-xl border border-slate-300 bg-white px-6 py-3.5 font-semibold text-slate-800 hover:bg-slate-100"
              >
                I already have an account
              </Link>
            </div>
            <p className="mt-4 text-sm text-slate-500">
              Organise shared expenses with your group in one place.
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xl shadow-slate-200/70 sm:p-7">
            <div className="flex items-center justify-between border-b border-slate-100 pb-5">
              <div>
                <p className="text-sm text-slate-500">Group overview</p>
                <h2 className="mt-1 text-xl font-bold">Your shared costs</h2>
              </div>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                Example
              </span>
            </div>
            <div className="mt-6 rounded-2xl bg-slate-50 p-5">
              <p className="text-sm text-slate-500">Total group expenses</p>
              <p className="mt-2 text-4xl font-bold">€428.50</p>
              <div className="mt-5 flex h-3 overflow-hidden rounded-full bg-slate-200">
                <div className="w-[42%] bg-emerald-500" />
                <div className="w-[33%] bg-slate-800" />
                <div className="w-[25%] bg-amber-400" />
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-xs text-slate-500">
                <span>Member 1 · 42%</span>
                <span>Member 2 · 33%</span>
                <span>Member 3 · 25%</span>
              </div>
            </div>
            <div className="mt-5 space-y-3">
              <div className="flex items-center justify-between rounded-xl border border-slate-100 p-4">
                <div>
                  <p className="font-semibold">Groceries</p>
                  <p className="mt-1 text-sm text-slate-500">Shared expense</p>
                </div>
                <p className="font-bold">€86.40</p>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-slate-100 p-4">
                <div>
                  <p className="font-semibold">Household supplies</p>
                  <p className="mt-1 text-sm text-slate-500">Shared expense</p>
                </div>
                <p className="font-bold">€32.10</p>
              </div>
            </div>
            <p className="mt-4 text-center text-xs text-slate-400">
              Illustrative preview — not real account data
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="max-w-2xl">
          <p className="text-sm font-bold uppercase tracking-widest text-emerald-700">
            Everything in one place
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            Shared spending without the spreadsheet headache.
          </h2>
          <p className="mt-4 leading-7 text-slate-600">
            Expense Splitter helps groups record shared purchases, track
            contributions, and understand outstanding balances.
          </p>
        </div>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => (
            <article
              key={feature.number}
              className="rounded-2xl border border-slate-200 p-6 transition hover:-translate-y-1 hover:shadow-lg"
            >
              <p className="text-sm font-bold text-emerald-600">
                {feature.number}
              </p>
              <h3 className="mt-5 text-lg font-bold">{feature.title}</h3>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                {feature.description}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="bg-slate-950 text-white">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="max-w-2xl">
            <p className="text-sm font-bold uppercase tracking-widest text-emerald-400">
              How it works
            </p>
            <h2 className="mt-3 text-3xl font-bold sm:text-4xl">
              Get your group organised in three steps.
            </h2>
          </div>
          <div className="mt-10 grid gap-8 md:grid-cols-3">
            {steps.map(([title, description], index) => (
              <div key={title} className="border-t border-slate-700 pt-6">
                <p className="text-sm font-bold text-emerald-400">
                  STEP 0{index + 1}
                </p>
                <h3 className="mt-4 text-xl font-bold">{title}</h3>
                <p className="mt-3 leading-7 text-slate-300">{description}</p>
              </div>
            ))}
          </div>
          <Link
            href="/auth"
            className="mt-10 inline-flex rounded-xl bg-emerald-500 px-6 py-3.5 font-semibold text-slate-950 hover:bg-emerald-400"
          >
            Get started
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 py-20">
        <h2 className="text-center text-3xl font-bold tracking-tight">
          Frequently asked questions
        </h2>
        <div className="mt-9 space-y-6">
          <article>
            <h3 className="font-bold">What is Expense Splitter?</h3>
            <p className="mt-2 leading-7 text-slate-600">
              Expense Splitter is a group expense tool for recording shared
              purchases, dividing costs between members, and tracking
              repayments.
            </p>
          </article>
          <article>
            <h3 className="font-bold">Can I track partial repayments?</h3>
            <p className="mt-2 leading-7 text-slate-600">
              Yes. A group can record a repayment amount and keep track of the
              remaining outstanding balance.
            </p>
          </article>
          <article>
            <h3 className="font-bold">Can I see monthly spending?</h3>
            <p className="mt-2 leading-7 text-slate-600">
              The group dashboard includes monthly expenditure information and
              a breakdown of each member's expense share.
            </p>
          </article>
          <article>
            <h3 className="font-bold">Do I need an account?</h3>
            <p className="mt-2 leading-7 text-slate-600">
              You need to create an account or log in to create and join private
              expense groups.
            </p>
          </article>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-slate-50">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-6 py-8 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Expense Splitter</p>
          <p>Make shared expenses easier to manage.</p>
        </div>
      </footer>
    </main>
  );
}
