export function PendingWorkspace({ title, frame }: { title: string; frame: string }) {
  return (
    <section>
      <h1 className="m-0 text-[26px] font-bold">{frame}</h1>
      <p className="mt-2 text-[15px] text-muted">{title} is linked in the rail. Its Figma frame is not part of this build.</p>
    </section>
  );
}
