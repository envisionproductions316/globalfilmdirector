"use client";

import { useEffect, useState } from "react";
import { SequencePlayer } from "@/components/timeline/SequencePlayer";
import { useStudio } from "@/lib/studio";
import { formatTimecode, timelineDuration } from "@/lib/timeline";

export function TimelinePreview({ caption }: { caption: string }) {
  const studio = useStudio();
  const [playhead, setPlayhead] = useState(studio.playheadMs);
  const [playing, setPlaying] = useState(false);
  const [seekRevision, setSeekRevision] = useState(0);
  const duration = timelineDuration(studio.clips);

  useEffect(() => {
    setPlaying(false);
    setPlayhead(0);
    setSeekRevision((current) => current + 1);
  }, [studio.activeProjectId]);

  function toggle() {
    if (playing) {
      setPlaying(false);
      studio.setPlayhead(playhead);
      return;
    }
    if (playhead >= duration - 40) {
      setPlayhead(0);
      setSeekRevision((current) => current + 1);
    }
    setPlaying(true);
  }

  if (studio.clips.length === 0) {
    return <p className="mt-3 text-sm text-muted">The shared timeline has no clips.</p>;
  }

  return (
    <div className="mt-4">
      <SequencePlayer clips={studio.clips} mix={studio.mix} playheadMs={playhead} playing={playing} seekRevision={seekRevision} onPlayhead={setPlayhead} onPlaying={setPlaying} />
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="button" className="h-9 rounded-[7px] bg-accent px-3 text-[13px] font-bold text-on-accent" onClick={toggle}>{playing ? "Pause" : "Play timeline"}</button>
        <p className="m-0 text-sm">{formatTimecode(playhead)} / {formatTimecode(duration)}</p>
      </div>
      <p className="mt-2 text-sm text-muted">{caption}</p>
    </div>
  );
}
