import { ProjectHeader } from "@/components/layout/ProjectHeader";
import { ProjectNav } from "@/components/layout/ProjectNav";

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  return (
    <div className="flex h-full flex-col">
      <div className="bg-background border-b">
        <ProjectHeader projectId={projectId} />
        <ProjectNav projectId={projectId} />
      </div>
      <div className="flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}
