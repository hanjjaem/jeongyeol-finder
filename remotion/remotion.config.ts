import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("png");
Config.setEntryPoint("./src/index.ts");
// GIF 품질: 30fps에서 매 프레임 인코딩(everyNthFrame=1)
Config.setEveryNthFrame(1);
