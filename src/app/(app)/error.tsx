"use client";

import { useEffect } from "react";
import Link from "next/link";
import { CloudOffIcon } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { t } from "@/lib/i18n";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center py-16 text-center">
      <span className="mb-5 grid size-14 place-items-center rounded-2xl bg-muted text-muted-foreground">
        <CloudOffIcon className="size-7" aria-hidden />
      </span>
      <h1 className="text-2xl font-semibold">{t("error.title")}</h1>
      <p className="mt-2 text-muted-foreground">{t("error.body")}</p>
      {error.digest ? <p className="mt-2 font-mono text-xs text-muted-foreground">{error.digest}</p> : null}
      <div className="mt-6 flex gap-2">
        <Button onClick={reset}>{t("common.retry")}</Button>
        <Link href="/dashboard" className={buttonVariants({ variant: "outline" })}>
          {t("error.home")}
        </Link>
      </div>
    </div>
  );
}
