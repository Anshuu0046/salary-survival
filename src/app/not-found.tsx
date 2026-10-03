import Link from "next/link";

export default function NotFound() {
  return (
    <div className="py-16">
      <h1 className="text-[2rem] font-semibold">This page doesn&apos;t exist.</h1>
      <p className="mt-2 text-ink-600">The link may be old, or the address mistyped.</p>
      <Link href="/" className="btn btn-primary mt-6">
        Go to your overview
      </Link>
    </div>
  );
}
