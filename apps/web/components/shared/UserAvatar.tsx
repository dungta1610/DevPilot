import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { initials } from "@/lib/format";
import type { User } from "@/lib/types";

export function UserAvatar({
  user,
  className,
  withTooltip = true,
}: {
  user: Pick<User, "name" | "avatarUrl">;
  className?: string;
  withTooltip?: boolean;
}) {
  const avatar = (
    <Avatar className={cn("size-6", className)}>
      {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.name} />}
      <AvatarFallback className="text-[10px]">
        {initials(user.name)}
      </AvatarFallback>
    </Avatar>
  );

  if (!withTooltip) return avatar;

  return (
    <Tooltip>
      <TooltipTrigger render={<span className="inline-flex" />}>
        {avatar}
      </TooltipTrigger>
      <TooltipContent>{user.name}</TooltipContent>
    </Tooltip>
  );
}
