export type SceneData = {
  type: string;
  title: string;
  caption: string;
  notes?: string[];
  duration: number; // frames
  [key: string]: any;
};

export type LessonProps = {
  meta: {
    title: string;
    subject: string;
    chapter?: string;
    level?: string;
  };
  scenes: SceneData[];
};

export type Box = { w: number; h: number };

/** Every scene component receives its data, duration and the pixel box it may draw in. */
export type SceneProps<T = any> = { s: SceneData & T; dur: number; box: Box };
