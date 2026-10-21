"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { supabase } from "@/lib/supabase";

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(
      window.location.hash.replace(/^#/, "")
    );

    const linkError =
      params.get("error_description") ||
      hash.get("error_description");

    if (linkError) {
      router.replace(`/?error=${encodeURIComponent(linkError)}`);
      return;
    }

    const next = params.get("next");
    const destination =
      next && next.startsWith("/") && !next.startsWith("//")
        ? next
        : "/dashboard";

    // The Supabase client exchanges the ?code= value itself during
    // initialisation; getSession() resolves once that has finished.
    supabase.auth.getSession().then(({ data, error }) => {
      if (error || !data.session) {
        router.replace(
          `/?error=${encodeURIComponent(
            error?.message ??
              "This link is invalid or has expired. Sign in, or request a new link."
          )}`
        );
        return;
      }

      router.replace(destination);
    });
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#07090d] text-white">
      <div className="flex items-center gap-3 text-gray-400">
        <Loader2 size={22} className="animate-spin" />
        Signing you in...
      </div>
    </main>
  );
}
