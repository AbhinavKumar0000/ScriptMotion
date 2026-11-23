import { Provider, BaseProvider, ProviderConfig, PlanRequest, PlanResponse, NarrateRequest, NarrateResponse, CritiqueRequest, CritiqueResponse, TopicType } from "./interface";
import { VideoSpec, VideoMetadata, Scene, SceneType, SceneBeat, DesignTokens, DEFAULT_DESIGN_TOKENS } from "../video_spec";
import { TopicClassification } from "../topic_classifier";

const PLAN_SYSTEM_PROMPT = `You are an expert educational video director. Your job is to create a detailed VideoSpec (typed storyboard) for a Remotion animation.

The VideoSpec must be valid JSON matching this TypeScript interface:
\`\`\`typescript
interface VideoSpec {
  version: "1.0";
  metadata: {
    topic: string;
    topicType: string;
    targetAudience: string;
    estimatedDurationSeconds: number;
    language: string;
    gradeLevel?: string;
    curriculum?: string;
    learningObjectives: string[];
    prerequisites: string[];
    tags: string[];
  };
  designTokens: {
    colors: Record<string, string>;
    fontSizes: Record<string, string>;
    fontWeights: Record<string, string>;
    spacing: Record<string, string>;
    borderRadius: Record<string, string>;
    shadows: Record<string, string>;
    zIndices: Record<string, number>;
    strokeWidths: Record<string, string>;
    transitionDuration: string;
    safeAreaPadding: string;
  };
  scenes: Array<{
    id: string;
    type: "concept-map" | "network-flow" | "timeline" | "comparison" | "code-walkthrough" | "terminal" | "diff" | "call-stack" | "memory-diagram" | "file-tree" | "chart" | "quiz" | "recap" | "chemistry-reaction" | "math-derivation" | "physics-simulation" | "biology-diagram" | "system-design";
    title?: string;
    durationFrames: number;
    beats: Array<{
      id: string;
      name: string;
      description: string;
      startFrame: number;
      endFrame: number;
      elements: string[];
      narration?: string;
      transitionIn: "fade" | "slide" | "zoom" | "none";
      transitionOut: "fade" | "slide" | "zoom" | "none";
    }>;
    graph?: {
      nodes: Array<{
        id: string;
        label: string;
        position: { x: number; y: number };
        size?: { width: number; height: number };
        color?: string;
        shape: "circle" | "rect" | "diamond" | "hexagon" | "rounded";
        metadata: Record<string, any>;
      }>;
      edges: Array<{
        id: string;
        source: string;
        target: string;
        label?: string;
        color?: string;
        style: "solid" | "dashed" | "dotted";
        animated: boolean;
        animationConfig?: { duration: number; delay: number; speed?: number };
        markerEnd?: "arrow" | "circle" | "diamond" | "none";
        metadata: Record<string, any>;
      }>;
      layout: "hierarchical" | "force" | "radial" | "grid" | "manual";
      direction: "TB" | "BT" | "LR" | "RL";
    };
    codeBlocks?: Array<{
      id: string;
      language: string;
      code: string;
      highlightedLines: number[];
      focusRanges: Array<{ start: number; end: number }>;
      lineNumbers: boolean;
      theme: "light" | "dark" | "github-light" | "github-dark";
      annotations: Record<number, string>;
    }>;
    terminalFrames?: Array<{
      id: string;
      command: string;
      output: string;
      prompt: string;
      workingDir: string;
      timestamp: number;
    }>;
    callStack?: Array<{
      id: string;
      function: string;
      file: string;
      line: number;
      variables: Record<string, any>;
      isCurrent: boolean;
    }>;
    memoryBlocks?: Array<{
      id: string;
      address: string;
      size: number;
      label: string;
      type: "stack" | "heap" | "static" | "code";
      variables: Record<string, any>;
      color?: string;
    }>;
    comparisonItems?: Array<{
      id: string;
      label: string;
      values: Record<string, any>;
      highlighted: boolean;
    }>;
    charts?: Array<{
      id: string;
      type: "line" | "bar" | "pie" | "scatter" | "area" | "heatmap";
      title: string;
      xAxis?: string;
      yAxis?: string;
      series: Array<Record<string, any>>;
      animated: boolean;
      animationConfig?: { duration: number; delay: number; easing: string };
    }>;
    quizQuestions?: Array<{
      id: string;
      question: string;
      type: "multiple_choice" | "true_false" | "fill_blank" | "code_output";
      options: string[];
      correctAnswer: string | number | number[];
      explanation?: string;
      points: number;
    }>;
    layoutConfig: Record<string, any>;
    background?: string;
    transitionIn: "fade" | "slide" | "zoom" | "none";
    transitionOut: "fade" | "slide" | "zoom" | "none";
  }>;
  globalAnimations: Record<string, {
    keyframes: Array<{ frame: number; value: number | string | object }>;
    interpolation: "linear" | "spring" | "bezier";
  }>;
  audio?: Record<string, any>;
}
\`\`\`

DESIGN PRINCIPLES:
1. Use the deterministic design system - NO custom CSS, NO absolute coordinates from LLM
2. Each scene uses a template type - the renderer handles layout
3. Beats define visual choreography, not narration
4. Graph layouts are computed (hierarchical, force, radial, grid)
5. Safe area: 96px padding on all sides
6. Color roles from design tokens only
7. Animations use spring/easing from tokens
8. Every element must teach - no decoration

TEMPLATE TYPES & WHEN TO USE:
- concept-map: General concept explanation, relationships between ideas
- network-flow: Neural networks, data flow, system architecture
- timeline: Historical events, algorithm steps, process flow
- comparison: Comparing algorithms, languages, approaches
- code-walkthrough: Explaining code line by line with execution trace
- terminal: Command-line demonstrations
- diff: Before/after code changes
- call-stack: Function call visualization
- memory-diagram: Memory layout, pointers, data structures
- file-tree: Project structure, module dependencies
- chart: Data visualization, metrics, benchmarks
- quiz: Interactive knowledge checks
- recap: Summary, key takeaways
- chemistry-reaction: Chemical equations, mechanisms
- math-derivation: Step-by-step mathematical proofs
- physics-simulation: Physical phenomena with parameters
- biology-diagram: Anatomical structures, cellular processes
- system-design: Distributed system architecture

RESPONSE FORMAT: Return ONLY the JSON VideoSpec object. No markdown, no explanation.`;


export class GeminiProvider extends BaseProvider {
  name = "gemini";
  private client: any = null;

  async initialize(config: ProviderConfig): Promise<void> {
    await super.initialize(config);
    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    this.client = new GoogleGenerativeAI(config.apiKey);
  }

  async plan(request: PlanRequest): Promise<PlanResponse> {
    const model = this.client.getGenerativeModel({
      model: this.config.model,
      generationConfig: {
        temperature: this.config.temperature,
        maxOutputTokens: this.config.maxTokens,
      },
    });

    const prompt = this.buildPlanPrompt(request);
    const result = await model.generateContent(prompt);
    const text = result.response.text();

    try {
      const spec = JSON.parse(text) as VideoSpec;
      return {
        spec,
        reasoning: "Generated from topic analysis and template selection",
        confidence: 0.9,
        warnings: [],
      };
    } catch (error) {
      throw new Error(`Failed to parse Gemini response as VideoSpec: ${error}`);
    }
  }

  async narrate(request: NarrateRequest): Promise<NarrateResponse> {
    const model = this.client.getGenerativeModel({
      model: this.config.model,
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 2048,
      },
    });

    const prompt = `Write educational narration for this scene beat:
Scene: ${request.sceneId}
Beat: ${request.beatId}
Style: ${request.style}
Spec context: ${JSON.stringify(request.spec.metadata)}

Return JSON: { "narration": "...", "durationSeconds": 5, "timestamps": [{ "text": "...", "start": 0, "end": 5 }] }`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    return JSON.parse(text);
  }

  async critique(request: CritiqueRequest): Promise<CritiqueResponse> {
    const model = this.client.getGenerativeModel({
      model: this.config.model,
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 4096,
      },
    });

    const prompt = `Critique this VideoSpec for educational video quality:
${JSON.stringify(request.spec, null, 2)}

Criteria: ${request.criteria.join(", ")}

Return JSON with score (0-100), issues array, strengths array, suggestions array.`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    return JSON.parse(text);
  }

  getSupportedTemplates(): string[] {
    return [
      "concept-map",
      "network-flow",
      "timeline",
      "comparison",
      "code-walkthrough",
      "terminal",
      "diff",
      "call-stack",
      "memory-diagram",
      "file-tree",
      "chart",
      "quiz",
      "recap",
      "chemistry-reaction",
      "math-derivation",
      "physics-simulation",
      "biology-diagram",
      "system-design",
    ];
  }

  getSupportedTopicTypes(): TopicType[] {
    return [
      "school_science",
      "school_math",
      "physics",
      "chemistry",
      "biology",
      "computer_science",
      "machine_learning",
      "neural_networks",
      "system_design",
      "algorithms",
      "data_structures",
      "code_walkthrough",
      "general",
    ];
  }

  private buildPlanPrompt(request: PlanRequest): string {
    return `${PLAN_SYSTEM_PROMPT}

TOPIC: "${request.topic}"
INSTRUCTIONS: ${request.instructions || "None"}
TOPIC TYPE: ${request.classification.topicType}
SUBCATEGORY: ${request.classification.subcategory || "N/A"}
GRADE LEVEL: ${request.classification.gradeLevel || "N/A"}
TEMPLATE: ${request.template}
MAX DURATION: ${request.maxDurationSeconds}s
AUDIENCE: ${request.targetAudience}
OBJECTIVES: ${request.learningObjectives.join(", ")}

Create a complete VideoSpec with:
- Metadata matching the topic
- Design tokens (use defaults)
- Scenes with beats covering the topic
- Graph data for concept-map/network-flow/timeline
- Code blocks for code-walkthrough
- Quiz questions for recap

Target ~${Math.floor(request.maxDurationSeconds / 10)} beats per scene.
Total frames = duration * 30fps.`;
  }
}