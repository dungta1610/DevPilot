"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { Bot } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { GitHubIcon } from "@/components/shared/icons";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { USE_MOCKS } from "@/lib/api";
import { cn } from "@/lib/utils";

export default function LoginPage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4">
      <div className="mb-8 flex items-center gap-2">
        <div className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-md">
          <Bot className="size-5" />
        </div>
        <span className="text-lg font-semibold tracking-tight">DevPilot</span>
      </div>

      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Sign in to DevPilot</CardTitle>
          <CardDescription>
            Durable AI PR reviews with human-in-the-loop approval.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Button
            className="w-full"
            onClick={() => signIn("github", { callbackUrl: "/projects" })}
          >
            <GitHubIcon className="size-4" />
            Continue with GitHub
          </Button>

          {USE_MOCKS && (
            <>
              <div className="relative my-1">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-card text-muted-foreground px-2 text-xs">
                    or
                  </span>
                </div>
              </div>
              <Link
                href="/projects"
                className={cn(
                  buttonVariants({ variant: "outline" }),
                  "w-full",
                )}
              >
                Continue in demo mode
              </Link>
              <p className="text-muted-foreground text-center text-xs">
                Mocks are enabled — no backend or GitHub app required.
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
