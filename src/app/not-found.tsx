import Link from "next/link";

export default function NotFound() {
  return <div className="container"><div className="panel empty"><h1>Page not found</h1><p>This page is unavailable for your account.</p>
    <Link className="button" href="/">Return to your dashboard</Link></div></div>;
}
