"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";
import { GitHubIcon } from "@/components/shared/icons";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { useMe } from "@/lib/queries";
import { USE_MOCKS } from "@/lib/api";

export function TopNav() {
  const { data: user } = useMe();

  return (
    <header className="bg-background/80 sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b px-4 backdrop-blur md:px-6">
      <div className="flex items-center gap-2 md:hidden">
        <span className="text-sm font-semibold">DevPilot</span>
      </div>

      <div className="ml-auto flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="GitHub"
          render={
            <a
              href="https://github.com"
              target="_blank"
              rel="noreferrer noopener"
            />
          }
        >
          <GitHubIcon className="size-4" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button className="flex items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring" />
            }
          >
            {user ? (
              <UserAvatar user={user} withTooltip={false} />
            ) : (
              <span className="bg-muted size-6 rounded-full" />
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {user && (
              <>
                <DropdownMenuLabel>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{user.name}</span>
                    <span className="text-muted-foreground text-xs font-normal">
                      {user.email}
                    </span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
              </>
            )}
            {USE_MOCKS ? (
              <DropdownMenuItem render={<Link href="/login" />}>
                <LogOut className="size-4" />
                Exit demo
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/login" })}>
                <LogOut className="size-4" />
                Sign out
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
