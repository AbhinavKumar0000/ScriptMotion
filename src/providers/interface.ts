import { VideoSpec } from "../video_spec";
import { TopicClassification, TopicType } from "../topic_classifier";

export interface ProviderConfig {
  apiKey: string;
  model: string;
  temperature: number;
  maxTokens: number;
  timeout: number;
}

export interface PlanRequest {
  topic: string;
  instructions?: string;
  classification: TopicClassification;
  template: string;
  maxDurationSeconds: number;
  targetAudience: string;
  learningObjectives: string[];
}

export interface PlanResponse {
  spec: VideoSpec;
  reasoning: string;
  confidence: number;
  warnings: string[];
}

export interface NarrateRequest {
  spec: VideoSpec;
  sceneId: string;
  beatId: string;
  style: "educational" | "conversational" | "technical" | "storytelling";
  voice?: string;
}

export interface NarrateResponse {
  narration: string;
  durationSeconds: number;
  timestamps: Array<{ text: string; start: number; end: number }>;
}

export interface CritiqueRequest {
  spec: VideoSpec;
  renderedFrames?: string[];
  criteria: ("visual" | "educational" | "technical" | "accessibility")[];
}

export interface CritiqueResponse {
  score: number;
  issues: Array<{
    severity: "critical" | "major" | "minor" | "suggestion";
    category: "visual" | "educational" | "technical" | "accessibility";
    message: string;
    location?: string;
    suggestion: string;
  }>;
  strengths: string[];
  suggestions: string[];
}

export interface Provider {
  name: string;
  initialize(config: ProviderConfig): Promise<void>;
  plan(request: PlanRequest): Promise<PlanResponse>;
  narrate(request: NarrateRequest): Promise<NarrateResponse>;
  critique(request: CritiqueRequest): Promise<CritiqueResponse>;
  validateSpec(spec: VideoSpec): Promise<{ valid: boolean; errors: string[] }>;
  getSupportedTemplates(): string[];
  getSupportedTopicTypes(): TopicType[];
}

export abstract class BaseProvider implements Provider {
  abstract name: string;
  protected config!: ProviderConfig;

  async initialize(config: ProviderConfig): Promise<void> {
    this.config = config;
  }

  abstract plan(request: PlanRequest): Promise<PlanResponse>;
  abstract narrate(request: NarrateRequest): Promise<NarrateResponse>;
  abstract critique(request: CritiqueRequest): Promise<CritiqueResponse>;

  async validateSpec(spec: VideoSpec): Promise<{ valid: boolean; errors: string[] }> {
    try {
      VideoSpec.parse(spec);
      return { valid: true, errors: [] };
    } catch (error) {
      return { valid: false, errors: [error instanceof Error ? error.message : String(error)] };
    }
  }

  abstract getSupportedTemplates(): string[];
  abstract getSupportedTopicTypes(): TopicType[];
}

export class ProviderRegistry {
  private providers: Map<string, Provider> = new Map();
  private defaultProvider: string | null = null;

  register(provider: Provider): void {
    this.providers.set(provider.name, provider);
    if (!this.defaultProvider) {
      this.defaultProvider = provider.name;
    }
  }

  get(name: string): Provider | undefined {
    return this.providers.get(name);
  }

  getDefault(): Provider | undefined {
    return this.defaultProvider ? this.providers.get(this.defaultProvider) : undefined;
  }

  list(): Provider[] {
    return Array.from(this.providers.values());
  }

  getByTopicType(topicType: TopicType): Provider[] {
    return this.list().filter((p) => p.getSupportedTopicTypes().includes(topicType));
  }

  getByTemplate(template: string): Provider[] {
    return this.list().filter((p) => p.getSupportedTemplates().includes(template));
  }

  setDefault(name: string): void {
    if (this.providers.has(name)) {
      this.defaultProvider = name;
    }
  }
}

export const providerRegistry = new ProviderRegistry();