import React from "react";
import { Composition } from "remotion";
import { Lesson, calculateLessonMetadata } from "./lesson/Lesson";
import { LessonProps } from "./lesson/types";
import sample from "./lesson/sample.json";

export const RemotionRoot: React.FC = () => (
  <Composition
    id="Lesson"
    component={Lesson}
    durationInFrames={300}
    fps={30}
    width={1920}
    height={1080}
    defaultProps={sample as unknown as LessonProps}
    calculateMetadata={calculateLessonMetadata}
  />
);
