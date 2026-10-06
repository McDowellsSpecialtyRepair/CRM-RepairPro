import { Link } from "wouter";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
      <h1 className="text-6xl font-bold text-muted-foreground" style={{ fontFamily: "'Satoshi', sans-serif" }}>
        404
      </h1>
      <p className="text-sm text-muted-foreground">Page not found</p>
      <Link href="/" className="text-sm text-primary hover:underline">
        ← Back to Dashboard
      </Link>
    </div>
  );
}
