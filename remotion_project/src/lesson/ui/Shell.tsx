import React from "react";
import { useCurrentFrame } from "remotion";
import { C, L, STAGE_H, STAGE_W } from "../theme";

const SUBJECT_COLOR: Record<string, string> = {
  physics: C.blue, chemistry: C.green, maths: C.orange, general: C.violet,
};
export const subjectColor = (s?: string) => SUBJECT_COLOR[(s || "").toLowerCase()] || C.violet;

/**
 * The diagram's stage. Titles and subtitles live on the lesson's fixed layers;
 * the stage travels with the camera and pushes in very slowly so no frame is frozen.
 */
export const Stage: React.FC<{ dur: number; children: React.ReactNode }> = ({ dur, children }) => {
  const frame = useCurrentFrame();
  const drift = 1 + 0.018 * Math.min(1, frame / Math.max(1, dur));
  return (
    <div style={{ position: "absolute", left: L.padX, top: L.stageTop, width: STAGE_W, height: STAGE_H }}>
      <div style={{ position: "relative", width: STAGE_W, height: STAGE_H, transform: `scale(${drift})`, transformOrigin: "50% 50%" }}>
        {children}
      </div>
    </div>
  );
};
