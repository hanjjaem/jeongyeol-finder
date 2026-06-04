import { Composition } from "remotion";
import { Demo, FPS, DURATION } from "./Demo";

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="Demo"
      component={Demo}
      durationInFrames={DURATION}
      fps={FPS}
      width={1080}
      height={1350}
    />
  );
};
