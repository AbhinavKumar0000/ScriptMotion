import { TopicClassification, TopicType, classifyTopic, getTemplateForTopic, getPipelineForTopic } from "../topic_classifier";
import { VideoSpec, SceneType, Scene, SceneBeat, GraphData, NodeData, EdgeData, CodeBlock, DEFAULT_DESIGN_TOKENS } from "../video_spec";
import { CurriculumTopic } from "../curriculum";

export interface PipelineContext {
  topic: string;
  instructions?: string;
  classification: TopicClassification;
  curriculumTopic?: CurriculumTopic;
  targetDurationSeconds: number;
  targetAudience: string;
  language: string;
}

export interface PipelineStep {
  name: string;
  description: string;
  execute: (context: PipelineContext, spec: Partial<VideoSpec>) => Promise<Partial<VideoSpec>>;
}

export interface AdaptivePipeline {
  name: string;
  topicTypes: TopicType[];
  template: SceneType;
  steps: PipelineStep[];
  defaultDurationSeconds: number;
  maxScenes: number;
  beatsPerScene: number;
}

function createBaseMetadata(context: PipelineContext): VideoSpec["metadata"] {
  return {
    topic: context.topic,
    topicType: context.classification.topicType,
    targetAudience: context.targetAudience,
    estimatedDurationSeconds: context.targetDurationSeconds,
    language: context.language,
    gradeLevel: context.classification.gradeLevel,
    curriculum: context.curriculumTopic ? "NCERT" : undefined,
    learningObjectives: context.curriculumTopic?.learningObjectives || [
      `Understand the concept of ${context.topic}`,
      `Explain the key principles and mechanisms`,
      `Apply knowledge to solve related problems`,
    ],
    prerequisites: context.curriculumTopic?.prerequisites || [],
    tags: [context.classification.topicType, context.classification.subcategory || "general"],
  };
}

function createDefaultScene(
  context: PipelineContext,
  template: SceneType,
  sceneIndex: number,
  totalScenes: number
): Scene {
  const durationPerScene = Math.floor((context.targetDurationSeconds * 30) / totalScenes);
  const beatsPerScene = 5;
  const beats: SceneBeat[] = [];

  for (let i = 0; i < beatsPerScene; i++) {
    const startFrame = sceneIndex * durationPerScene + i * Math.floor(durationPerScene / beatsPerScene);
    const endFrame = startFrame + Math.floor(durationPerScene / beatsPerScene);
    beats.push({
      id: `beat-${sceneIndex}-${i}`,
      name: `Beat ${i + 1}`,
      description: `Visual beat ${i + 1} for scene ${sceneIndex + 1}`,
      startFrame,
      endFrame,
      elements: [],
      transitionIn: "fade",
      transitionOut: "fade",
    });
  }

  return {
    id: `scene-${sceneIndex}`,
    type: template,
    title: `${context.topic} - Part ${sceneIndex + 1}`,
    durationFrames: durationPerScene,
    beats,
    layoutConfig: {},
    background: "background",
    transitionIn: "fade",
    transitionOut: "fade",
  };
}

const schoolSciencePipeline: AdaptivePipeline = {
  name: "school_science_pipeline",
  topicTypes: ["school_science"],
  template: "concept-map",
  defaultDurationSeconds: 60,
  maxScenes: 3,
  beatsPerScene: 5,
  steps: [
    {
      name: "extract_concepts",
      description: "Extract key concepts and relationships from the topic",
      execute: async (context, spec) => {
        const concepts = extractScienceConcepts(context.topic, context.curriculumTopic);
        const graph = createConceptGraph(concepts);
        if (spec.scenes && spec.scenes[0]) {
          spec.scenes[0].graph = graph;
        }
        return spec;
      },
    },
    {
      name: "add_worked_example",
      description: "Add a concrete worked example",
      execute: async (context, spec) => {
        if (spec.scenes && spec.scenes[0]) {
          spec.scenes[0].beats[3] = {
            ...spec.scenes[0].beats[3],
            name: "Worked Example",
            description: "Show a concrete example with animated flow",
            elements: ["example-input", "example-process", "example-output"],
          };
        }
        return spec;
      },
    },
    {
      name: "add_recap",
      description: "Add a recap scene with quiz",
      execute: async (context, spec) => {
        const recapScene = createRecapScene(context, spec.scenes?.length || 0);
        spec.scenes = [...(spec.scenes || []), recapScene];
        return spec;
      },
    },
  ],
};

const schoolMathPipeline: AdaptivePipeline = {
  name: "school_math_pipeline",
  topicTypes: ["school_math"],
  template: "math-derivation",
  defaultDurationSeconds: 90,
  maxScenes: 2,
  beatsPerScene: 6,
  steps: [
    {
      name: "parse_problem",
      description: "Parse the mathematical problem and identify steps",
      execute: async (context, spec) => {
        const steps = extractMathSteps(context.topic, context.curriculumTopic);
        if (spec.scenes && spec.scenes[0]) {
          spec.scenes[0].layoutConfig = { steps };
        }
        return spec;
      },
    },
    {
      name: "add_derivation",
      description: "Create step-by-step derivation",
      execute: async (context, spec) => {
        if (spec.scenes && spec.scenes[0]) {
          spec.scenes[0].beats = createMathBeats(context.topic, spec.scenes[0].durationFrames);
        }
        return spec;
      },
    },
  ],
};

const physicsPipeline: AdaptivePipeline = {
  name: "physics_pipeline",
  topicTypes: ["physics"],
  template: "physics-simulation",
  defaultDurationSeconds: 120,
  maxScenes: 3,
  beatsPerScene: 5,
  steps: [
    {
      name: "identify_parameters",
      description: "Identify physical parameters and equations",
      execute: async (context, spec) => {
        const params = extractPhysicsParameters(context.topic);
        const equations = extractPhysicsEquations(context.topic);
        if (spec.scenes && spec.scenes[0]) {
          spec.scenes[0].layoutConfig = { parameters: params, equations };
        }
        return spec;
      },
    },
    {
      name: "add_simulation",
      description: "Add physics simulation visualization",
      execute: async (context, spec) => {
        if (spec.scenes && spec.scenes[0]) {
          spec.scenes[0].charts = createPhysicsCharts(context.topic);
        }
        return spec;
      },
    },
  ],
};

const chemistryPipeline: AdaptivePipeline = {
  name: "chemistry_pipeline",
  topicTypes: ["chemistry"],
  template: "chemistry-reaction",
  defaultDurationSeconds: 90,
  maxScenes: 2,
  beatsPerScene: 5,
  steps: [
    {
      name: "parse_reaction",
      description: "Parse chemical reaction with reactants and products",
      execute: async (context, spec) => {
        const reaction = extractChemistryReaction(context.topic);
        if (spec.scenes && spec.scenes[0]) {
          spec.scenes[0].layoutConfig = { reaction };
        }
        return spec;
      },
    },
    {
      name: "add_mechanism",
      description: "Add reaction mechanism if applicable",
      execute: async (context, spec) => {
        const mechanism = extractMechanism(context.topic);
        if (mechanism && spec.scenes && spec.scenes[1]) {
          spec.scenes[1].layoutConfig = { mechanism };
        }
        return spec;
      },
    },
  ],
};

const biologyPipeline: AdaptivePipeline = {
  name: "biology_pipeline",
  topicTypes: ["biology"],
  template: "biology-diagram",
  defaultDurationSeconds: 90,
  maxScenes: 3,
  beatsPerScene: 5,
  steps: [
    {
      name: "identify_structures",
      description: "Identify biological structures and processes",
      execute: async (context, spec) => {
        const structures = extractBiologyStructures(context.topic);
        const processes = extractBiologyProcesses(context.topic);
        if (spec.scenes && spec.scenes[0]) {
          spec.scenes[0].layoutConfig = { structures, processes };
        }
        return spec;
      },
    },
  ],
};

const csPipeline: AdaptivePipeline = {
  name: "cs_pipeline",
  topicTypes: ["computer_science", "algorithms", "data_structures"],
  template: "code-walkthrough",
  defaultDurationSeconds: 120,
  maxScenes: 3,
  beatsPerScene: 6,
  steps: [
    {
      name: "parse_code",
      description: "Parse code and create execution trace",
      execute: async (context, spec) => {
        const codeFiles = extractCodeFiles(context.topic);
        const trace = generateExecutionTrace(context.topic);
        if (spec.scenes && spec.scenes[0]) {
          spec.scenes[0].codeBlocks = codeFiles;
          spec.scenes[0].layoutConfig = { trace };
        }
        return spec;
      },
    },
    {
      name: "add_memory_diagram",
      description: "Add memory diagram for data structures",
      execute: async (context, spec) => {
        if (context.classification.topicType === "data_structures") {
          const memory = createMemoryDiagram(context.topic);
          if (spec.scenes && spec.scenes[1]) {
            spec.scenes[1].layoutConfig = { memory };
          }
        }
        return spec;
      },
    },
  ],
};

const mlPipeline: AdaptivePipeline = {
  name: "ml_pipeline",
  topicTypes: ["machine_learning"],
  template: "network-flow",
  defaultDurationSeconds: 120,
  maxScenes: 3,
  beatsPerScene: 5,
  steps: [
    {
      name: "extract_architecture",
      description: "Extract ML model architecture",
      execute: async (context, spec) => {
        const architecture = extractMLArchitecture(context.topic);
        if (spec.scenes && spec.scenes[0]) {
          spec.scenes[0].graph = architecture;
        }
        return spec;
      },
    },
    {
      name: "add_training_visualization",
      description: "Add training process visualization",
      execute: async (context, spec) => {
        if (spec.scenes && spec.scenes[1]) {
          spec.scenes[1].charts = createMLCharts();
        }
        return spec;
      },
    },
  ],
};

const neuralNetworkPipeline: AdaptivePipeline = {
  name: "neural_network_pipeline",
  topicTypes: ["neural_networks"],
  template: "network-flow",
  defaultDurationSeconds: 120,
  maxScenes: 3,
  beatsPerScene: 5,
  steps: [
    {
      name: "extract_network_structure",
      description: "Extract neural network layers and connections",
      execute: async (context, spec) => {
        const network = extractNNStructure(context.topic);
        if (spec.scenes && spec.scenes[0]) {
          spec.scenes[0].graph = network;
        }
        return spec;
      },
    },
    {
      name: "add_backprop_visualization",
      description: "Add backpropagation visualization",
      execute: async (context, spec) => {
        if (spec.scenes && spec.scenes[1]) {
          spec.scenes[1].type = "concept-map";
          spec.scenes[1].layoutConfig = { topic: "backpropagation" };
        }
        return spec;
      },
    },
  ],
};

const systemDesignPipeline: AdaptivePipeline = {
  name: "system_design_pipeline",
  topicTypes: ["system_design"],
  template: "system-design",
  defaultDurationSeconds: 180,
  maxScenes: 4,
  beatsPerScene: 5,
  steps: [
    {
      name: "extract_requirements",
      description: "Extract system requirements and constraints",
      execute: async (context, spec) => {
        const requirements = extractSystemRequirements(context.topic);
        if (spec.scenes && spec.scenes[0]) {
          spec.scenes[0].layoutConfig = { requirements };
        }
        return spec;
      },
    },
    {
      name: "create_architecture",
      description: "Create system architecture diagram",
      execute: async (context, spec) => {
        const architecture = extractSystemArchitecture(context.topic);
        if (spec.scenes && spec.scenes[1]) {
          spec.scenes[1].layoutConfig = { architecture };
        }
        return spec;
      },
    },
    {
      name: "add_data_flow",
      description: "Add data flow and API specifications",
      execute: async (context, spec) => {
        if (spec.scenes && spec.scenes[2]) {
          spec.scenes[2].type = "network-flow";
          spec.scenes[2].layoutConfig = { dataFlow: extractDataFlow(context.topic) };
        }
        return spec;
      },
    },
  ],
};

const generalPipeline: AdaptivePipeline = {
  name: "general_pipeline",
  topicTypes: ["general"],
  template: "concept-map",
  defaultDurationSeconds: 60,
  maxScenes: 2,
  beatsPerScene: 5,
  steps: [],
};

const PIPELINES: AdaptivePipeline[] = [
  schoolSciencePipeline,
  schoolMathPipeline,
  physicsPipeline,
  chemistryPipeline,
  biologyPipeline,
  csPipeline,
  mlPipeline,
  neuralNetworkPipeline,
  systemDesignPipeline,
  generalPipeline,
];

export function getPipelineForClassification(classification: TopicClassification): AdaptivePipeline {
  for (const pipeline of PIPELINES) {
    if (pipeline.topicTypes.includes(classification.topicType)) {
      return pipeline;
    }
  }
  return generalPipeline;
}

export async function runPipeline(
  context: PipelineContext,
  provider: { plan: (request: any) => Promise<any> }
): Promise<VideoSpec> {
  const pipeline = getPipelineForClassification(context.classification);
  const template = getTemplateForTopic(context.classification);

  const baseSpec: Partial<VideoSpec> = {
    version: "1.0",
    metadata: createBaseMetadata(context),
    designTokens: DEFAULT_DESIGN_TOKENS,
    scenes: [],
    globalAnimations: {},
  };

  const numScenes = Math.min(pipeline.maxScenes, Math.max(1, Math.ceil(context.targetDurationSeconds / pipeline.defaultDurationSeconds * pipeline.maxScenes)));

  for (let i = 0; i < numScenes; i++) {
    baseSpec.scenes!.push(createDefaultScene(context, template, i, numScenes));
  }

  let currentSpec = baseSpec;
  for (const step of pipeline.steps) {
    currentSpec = await step.execute(context, currentSpec);
  }

  const request = {
    topic: context.topic,
    instructions: context.instructions,
    classification: context.classification,
    template,
    maxDurationSeconds: context.targetDurationSeconds,
    targetAudience: context.targetAudience,
    learningObjectives: currentSpec.metadata?.learningObjectives || [],
  };

  const response = await provider.plan(request);
  return response.spec;
}

function extractScienceConcepts(topic: string, curriculum?: CurriculumTopic): string[] {
  const concepts = topic.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  return [...new Set([...concepts, ...(curriculum?.subtopics || [])])];
}

function createConceptGraph(concepts: string[]): GraphData {
  const nodes: NodeData[] = concepts.slice(0, 8).map((c, i) => ({
    id: `concept-${i}`,
    label: c,
    position: { x: 300 + (i % 3) * 400, y: 300 + Math.floor(i / 3) * 200 },
    color: "nodeDefault",
    shape: "circle" as const,
    metadata: {},
  }));

  const edges: EdgeData[] = [];
  for (let i = 1; i < nodes.length; i++) {
    edges.push({
      id: `edge-${i}`,
      source: nodes[Math.floor((i - 1) / 2)].id,
      target: nodes[i].id,
      color: "edgeDefault",
      style: "solid",
      animated: true,
      metadata: {},
    });
  }

  return { nodes, edges, layout: "hierarchical", direction: "LR" };
}

function extractMathSteps(topic: string, curriculum?: CurriculumTopic): Array<{ expression: string; explanation: string }> {
  return [
    { expression: "Given problem", explanation: "Identify what is given and what needs to be found" },
    { expression: "Apply relevant formula/theorem", explanation: "State the mathematical principle being used" },
    { expression: "Substitute values", explanation: "Replace variables with given values" },
    { expression: "Simplify step by step", explanation: "Show each algebraic manipulation" },
    { expression: "Final answer", explanation: "State the result with appropriate units" },
  ];
}

function createMathBeats(topic: string, durationFrames: number): SceneBeat[] {
  const beats: SceneBeat[] = [];
  const steps = 5;
  const framesPerStep = Math.floor(durationFrames / steps);

  for (let i = 0; i < steps; i++) {
    beats.push({
      id: `math-beat-${i}`,
      name: `Step ${i + 1}`,
      description: `Mathematical step ${i + 1}`,
      startFrame: i * framesPerStep,
      endFrame: (i + 1) * framesPerStep,
      elements: [`step-${i}`],
      transitionIn: "fade",
      transitionOut: "fade",
    });
  }
  return beats;
}

function extractPhysicsParameters(topic: string): Record<string, number> {
  return { mass: 1, velocity: 10, angle: 45, gravity: 9.81, time: 0 };
}

function extractPhysicsEquations(topic: string): Array<{ latex: string; description: string }> {
  return [
    { latex: "v = u + at", description: "First equation of motion" },
    { latex: "s = ut + \\frac{1}{2}at^2", description: "Second equation of motion" },
    { latex: "v^2 = u^2 + 2as", description: "Third equation of motion" },
  ];
}

function createPhysicsCharts(): Array<{ id: string; type: "line"; title: string; series: any[] }> {
  return [
    {
      id: "position-time",
      type: "line",
      title: "Position vs Time",
      series: [{ label: "Position", data: [] }],
    },
    {
      id: "velocity-time",
      type: "line",
      title: "Velocity vs Time",
      series: [{ label: "Velocity", data: [] }],
    },
  ];
}

function extractChemistryReaction(topic: string): any {
  return {
    reactants: [{ formula: "H₂", name: "Hydrogen", coefficient: 2, state: "gas" }, { formula: "O₂", name: "Oxygen", coefficient: 1, state: "gas" }],
    products: [{ formula: "H₂O", name: "Water", coefficient: 2, state: "liquid" }],
    conditions: { temperature: "25°C", catalyst: "Pt" },
  };
}

function extractMechanism(topic: string): any {
  return [
    { step: "Initiation", description: "Bond breaking to form radicals" },
    { step: "Propagation", description: "Radical reactions continuing the chain" },
    { step: "Termination", description: "Radicals combining to end the chain" },
  ];
}

function extractBiologyStructures(topic: string): any[] {
  return [
    { id: "nucleus", label: "Nucleus", description: "Contains genetic material", x: 400, y: 300, size: 60 },
    { id: "mitochondria", label: "Mitochondria", description: "Powerhouse of the cell", x: 600, y: 400, size: 40 },
    { id: "ribosome", label: "Ribosome", description: "Protein synthesis", x: 500, y: 200, size: 20 },
  ];
}

function extractBiologyProcesses(topic: string): any[] {
  return [
    { name: "Protein Synthesis", steps: [{ label: "Transcription", description: "DNA to mRNA" }, { label: "Translation", description: "mRNA to Protein" }] },
  ];
}

function extractCodeFiles(topic: string): CodeBlock[] {
  return [
    {
      id: "main",
      language: "python",
      code: "def example():\n    pass",
      highlightedLines: [],
      focusRanges: [],
      lineNumbers: true,
      theme: "github-light",
      annotations: {},
    },
  ];
}

function generateExecutionTrace(topic: string): any[] {
  return [
    { step: 1, file: "main.py", line: 1, function: "example", variables: {}, callStack: [] },
  ];
}

function createMemoryDiagram(topic: string): any {
  return [
    { address: "0x1000", size: 8, label: "head", type: "stack", variables: {} },
    { address: "0x2000", size: 16, label: "Node(1)", type: "heap", variables: { value: 1, next: "0x2010" } },
  ];
}

function extractMLArchitecture(topic: string): GraphData {
  const nodes: NodeData[] = [
    { id: "input", label: "Input Layer", position: { x: 200, y: 300 }, color: "nodeDefault" },
    { id: "hidden1", label: "Hidden Layer 1", position: { x: 600, y: 200 }, color: "nodeDefault" },
    { id: "hidden2", label: "Hidden Layer 2", position: { x: 600, y: 400 }, color: "nodeDefault" },
    { id: "output", label: "Output Layer", position: { x: 1000, y: 300 }, color: "nodeHighlight" },
  ];
  const edges: EdgeData[] = [
    { id: "e1", source: "input", target: "hidden1", animated: true },
    { id: "e2", source: "input", target: "hidden2", animated: true },
    { id: "e3", source: "hidden1", target: "output", animated: true },
    { id: "e4", source: "hidden2", target: "output", animated: true },
  ];
  return { nodes, edges, layout: "hierarchical", direction: "LR" };
}

function createMLCharts(): any[] {
  return [
    { id: "loss-curve", type: "line", title: "Training Loss", series: [{ label: "Loss", data: [] }] },
    { id: "accuracy-curve", type: "line", title: "Validation Accuracy", series: [{ label: "Accuracy", data: [] }] },
  ];
}

function extractNNStructure(topic: string): GraphData {
  return extractMLArchitecture(topic);
}

function extractSystemRequirements(topic: string): any[] {
  return [
    { category: "scalability", description: "Handle 1M requests/day", priority: "high" },
    { category: "availability", description: "99.99% uptime", priority: "high" },
    { category: "latency", description: "p99 < 200ms", priority: "medium" },
  ];
}

function extractSystemArchitecture(topic: string): any {
  return {
    components: [
      { id: "lb", name: "Load Balancer", type: "load-balancer", x: 400, y: 100 },
      { id: "api", name: "API Gateway", type: "gateway", x: 400, y: 250 },
      { id: "svc1", name: "Service A", type: "service", x: 200, y: 400 },
      { id: "svc2", name: "Service B", type: "service", x: 600, y: 400 },
      { id: "db", name: "Database", type: "database", x: 400, y: 550 },
    ],
    connections: [
      { source: "lb", target: "api" },
      { source: "api", target: "svc1" },
      { source: "api", target: "svc2" },
      { source: "svc1", target: "db" },
      { source: "svc2", target: "db" },
    ],
  };
}

function extractDataFlow(topic: string): any {
  return { components: [], connections: [] };
}

function createRecapScene(context: PipelineContext, sceneIndex: number): Scene {
  return {
    id: `scene-${sceneIndex}`,
    type: "recap",
    title: "Key Takeaways",
    durationFrames: Math.floor(context.targetDurationSeconds * 30 * 0.15),
    beats: [
      {
        id: "recap-1",
        name: "Summary",
        description: "Summarize key concepts",
        startFrame: 0,
        endFrame: Math.floor(context.targetDurationSeconds * 30 * 0.15),
        elements: ["summary"],
        transitionIn: "fade",
        transitionOut: "fade",
      },
    ],
    quizQuestions: [
      {
        id: "quiz-1",
        question: `What is the main concept of ${context.topic}?`,
        type: "multiple_choice",
        options: ["Option A", "Option B", "Option C", "Option D"],
        correctAnswer: 0,
        explanation: "This tests understanding of the core concept.",
        points: 1,
      },
    ],
    layoutConfig: {},
    background: "background",
    transitionIn: "fade",
    transitionOut: "fade",
  };
}