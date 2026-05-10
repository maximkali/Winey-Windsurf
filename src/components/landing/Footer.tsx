import Link from 'next/link';

export function Footer() {
  return (
    <footer className="border-t border-[color:var(--winey-border)] bg-white py-12">
      <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
        <p className="text-[color:var(--winey-muted)] text-sm">
          &copy; {new Date().getFullYear()} Winey. All rights reserved. Drink responsibly.
        </p>
        <div className="mt-4 flex justify-center gap-6 text-sm font-semibold text-[color:var(--winey-muted-2)]">
          <Link href="/host/setup" className="hover:text-[color:var(--winey-title)] transition-colors">Host</Link>
          <Link href="/player/join" className="hover:text-[color:var(--winey-title)] transition-colors">Join</Link>
        </div>
      </div>
    </footer>
  );
}

