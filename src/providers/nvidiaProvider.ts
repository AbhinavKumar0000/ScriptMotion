import { Provider, BaseProvider, ProviderConfig, PlanRequest, PlanResponse, NarrateRequest, NarrateResponse, CritiqueRequest, CritiqueResponse, TopicType } from "./interface";
import { VideoSpec } from "../video_spec";
import { TopicClassification } from "../topic_classifier";

const PLAN_SYSTEM_PROMPT = `You are an expert educational video director. Your job is to create a detailed VideoSpec (typed storyboard) for a Remotion animation.

The VideoSpec must be valid JSON matching the TypeScript interface provided in the system prompt.

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


export class NVIDIAProvider extends BaseProvider {
  name = "nvidia";
  private client: any = null;

  async initialize(config: ProviderConfig): Promise<void> {
    await super.initialize(config);
    const OpenAI = (await import("openai")).default;
    this.client = new OpenAI({
      baseURL: "https://integrate.api.nvidia.com/v1",
      apiKey: config.apiKey,
      defaultHeaders: { "NVCF-POLL-SECONDS": "1800" },
    });
  }

  async plan(request: PlanRequest): Promise<PlanResponse> {
    const prompt = this.buildPlanPrompt(request);

    const response = await this.client.chat.completions.create({
      model: this.config.model,
      messages: [
        { role: "system", content: PLAN_SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
      maxTokens: this.config.maxTokens,
      temperature: this.config.temperature,
      topP: 0.95,
      extraBody: {
        chatTemplateKwargs: { enableThinking: true },
        reasoningBudget: 8192,
      },
    });

    const text = response.choices[0]?.message?.content || "";

    try {
      const spec = JSON.parse(text) as VideoSpec;
      return {
        spec,
        reasoning: "Generated from topic analysis and template selection",
        confidence: 0.9,
        warnings: [],
      };
    } catch (error) {
      throw new Error(`Failed to parse NVIDIA response as VideoSpec: ${error}`);
    }
  }

  async narrate(request: NarrateRequest): Promise<NarrateResponse> {
    const prompt = `Write educational narration for this scene beat:
Scene: ${request.sceneId}
Beat: ${request.beatId}
Style: ${request.style}
Spec context: ${JSON.stringify(request.spec.metadata)}

Return JSON: { "narration": "...", "durationSeconds": 5, "timestamps": [{ "text": "...", "start": 0, "end": 5 }] }`;

    const response = await this.client.chat.completions.create({
      model: this.config.model,
      messages: [{ role: "user", content: prompt }],
      maxTokens: 2048,
      temperature: 0.3,
    });

    const text = response.choices[0]?.message?.content || "";
    return JSON.parse(text);
  }

  async critique(request: CritiqueRequest): Promise<CritiqueResponse> {
    const prompt = `Critique this VideoSpec for educational video quality:
${JSON.stringify(request.spec, null, 2)}

Criteria: ${request.criteria.join(", ")}

Return JSON with score (0-100), issues array, strengths array, suggestions array.`;

    const response = await this.client.chat.completions.create({
      model: this.config.model,
      messages: [{ role: "user", content: prompt }],
      maxTokens: 4096,
      temperature: 0.2,
    });

    const text = response.choices[0]?.message?.content || "";
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
    return `TOPIC: "${request.topic}"
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