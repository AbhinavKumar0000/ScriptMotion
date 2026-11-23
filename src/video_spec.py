from enum import Enum
from typing import Optional, Literal, Union, Any
from pydantic import BaseModel, Field, field_validator
from typing_extensions import Annotated


class SceneType(str, Enum):
    CONCEPT_MAP = "concept-map"
    NETWORK_FLOW = "network-flow"
    TIMELINE = "timeline"
    COMPARISON = "comparison"
    CODE_WALKTHROUGH = "code-walkthrough"
    TERMINAL = "terminal"
    DIFF = "diff"
    CALL_STACK = "call-stack"
    MEMORY_DIAGRAM = "memory-diagram"
    FILE_TREE = "file-tree"
    CHART = "chart"
    QUIZ = "quiz"
    RECAP = "recap"
    CHEMISTRY_REACTION = "chemistry-reaction"
    MATH_DERIVATION = "math-derivation"
    PHYSICS_SIMULATION = "physics-simulation"
    BIOLOGY_DIAGRAM = "biology-diagram"
    SYSTEM_DESIGN = "system-design"


class TransitionType(str, Enum):
    FADE = "fade"
    SLIDE = "slide"
    ZOOM = "zoom"
    NONE = "none"


class EasingType(str, Enum):
    LINEAR = "linear"
    EASE_IN = "ease-in"
    EASE_OUT = "ease-out"
    EASE_IN_OUT = "ease-in-out"
    SPRING = "spring"


class ColorRole(str, Enum):
    PRIMARY = "primary"
    SECONDARY = "secondary"
    ACCENT = "accent"
    BACKGROUND = "background"
    SURFACE = "surface"
    TEXT_PRIMARY = "textPrimary"
    TEXT_SECONDARY = "textSecondary"
    TEXT_MUTED = "textMuted"
    BORDER = "border"
    SUCCESS = "success"
    WARNING = "warning"
    ERROR = "error"
    INFO = "info"
    NODE_DEFAULT = "nodeDefault"
    NODE_HIGHLIGHT = "nodeHighlight"
    EDGE_DEFAULT = "edgeDefault"
    EDGE_HIGHLIGHT = "edgeHighlight"
    CODE_BACKGROUND = "codeBackground"
    CODE_TEXT = "codeText"
    CODE_COMMENT = "codeComment"
    CODE_KEYWORD = "codeKeyword"
    CODE_STRING = "codeString"
    CODE_NUMBER = "codeNumber"
    CODE_FUNCTION = "codeFunction"
    CODE_TYPE = "codeType"


class FontSize(str, Enum):
    XS = "xs"
    SM = "sm"
    MD = "md"
    LG = "lg"
    XL = "xl"
    TITLE = "title"
    DISPLAY = "display"


class FontWeight(str, Enum):
    NORMAL = "normal"
    MEDIUM = "medium"
    SEMIBOLD = "semibold"
    BOLD = "bold"


class TextAlign(str, Enum):
    LEFT = "left"
    CENTER = "center"
    RIGHT = "right"


class ZIndex(int, Enum):
    BACKGROUND = 0
    GRID = 10
    CONTENT = 100
    NODES = 200
    EDGES = 150
    LABELS = 250
    OVERLAYS = 300
    TOOLTIPS = 400
    MODAL = 500


class StrokeWidth(str, Enum):
    THIN = "thin"
    MEDIUM = "medium"
    THICK = "thick"


class BorderRadius(str, Enum):
    NONE = "none"
    SM = "sm"
    MD = "md"
    LG = "lg"
    FULL = "full"


class Spacing(str, Enum):
    NONE = "0"
    XS = "xs"
    SM = "sm"
    MD = "md"
    LG = "lg"
    XL = "xl"
    TWO_XL = "2xl"


class Shadow(str, Enum):
    NONE = "none"
    SM = "sm"
    MD = "md"
    LG = "lg"


class DesignTokens(BaseModel):
    colors: dict[ColorRole, str] = Field(default_factory=dict)
    font_sizes: dict[FontSize, str] = Field(default_factory=dict)
    font_weights: dict[FontWeight, str] = Field(default_factory=dict)
    spacing: dict[Spacing, str] = Field(default_factory=dict)
    border_radius: dict[BorderRadius, str] = Field(default_factory=dict)
    shadows: dict[Shadow, str] = Field(default_factory=dict)
    z_indices: dict[str, int] = Field(default_factory=dict)
    stroke_widths: dict[StrokeWidth, str] = Field(default_factory=dict)
    transition_duration: str = "300ms"
    safe_area_padding: str = "96px"


class Position(BaseModel):
    x: float
    y: float


class Size(BaseModel):
    width: float
    height: float


class Rect(BaseModel):
    x: float
    y: float
    width: float
    height: float


class AnimationConfig(BaseModel):
    duration: float = 1.0
    delay: float = 0.0
    easing: EasingType = EasingType.EASE_IN_OUT
    loop: bool = False


class KeyframeValue(BaseModel):
    frame: int
    value: Union[float, str, dict]


class AnimatedValue(BaseModel):
    keyframes: list[KeyframeValue]
    interpolation: Literal["linear", "spring", "bezier"] = "linear"


class NodeData(BaseModel):
    id: str
    label: str
    position: Position
    size: Optional[Size] = None
    color: Optional[ColorRole] = ColorRole.NODE_DEFAULT
    shape: Literal["circle", "rect", "diamond", "hexagon", "rounded"] = "circle"
    metadata: dict[str, Any] = Field(default_factory=dict)


class EdgeData(BaseModel):
    id: str
    source: str
    target: str
    label: Optional[str] = None
    color: Optional[ColorRole] = ColorRole.EDGE_DEFAULT
    style: Literal["solid", "dashed", "dotted"] = "solid"
    animated: bool = False
    animation_config: Optional[AnimationConfig] = None
    marker_end: Optional[Literal["arrow", "circle", "diamond", "none"]] = "arrow"
    metadata: dict[str, Any] = Field(default_factory=dict)


class GraphData(BaseModel):
    nodes: list[NodeData]
    edges: list[EdgeData]
    layout: Literal["hierarchical", "force", "radial", "grid", "manual"] = "hierarchical"
    direction: Literal["TB", "BT", "LR", "RL"] = "LR"


class CodeBlock(BaseModel):
    id: str
    language: str
    code: str
    highlighted_lines: list[int] = Field(default_factory=list)
    focus_ranges: list[tuple[int, int]] = Field(default_factory=list)
    line_numbers: bool = True
    theme: Literal["light", "dark", "github-light", "github-dark"] = "light"
    annotations: dict[int, str] = Field(default_factory=dict)


class TerminalFrame(BaseModel):
    id: str
    command: str
    output: str
    prompt: str = "$ "
    working_dir: str = "~"
    timestamp: float = 0.0


class CallStackFrame(BaseModel):
    id: str
    function: str
    file: str
    line: int
    variables: dict[str, Any] = Field(default_factory=dict)
    is_current: bool = False


class MemoryBlock(BaseModel):
    id: str
    address: str
    size: int
    label: str
    type: Literal["stack", "heap", "static", "code"] = "heap"
    variables: dict[str, Any] = Field(default_factory=dict)
    color: Optional[ColorRole] = None


class ComparisonItem(BaseModel):
    id: str
    label: str
    values: dict[str, Any]
    highlighted: bool = False


class ChartData(BaseModel):
    id: str
    type: Literal["line", "bar", "pie", "scatter", "area", "heatmap"]
    title: str
    x_axis: Optional[str] = None
    y_axis: Optional[str] = None
    series: list[dict[str, Any]]
    animated: bool = True
    animation_config: Optional[AnimationConfig] = None


class QuizQuestion(BaseModel):
    id: str
    question: str
    type: Literal["multiple_choice", "true_false", "fill_blank", "code_output"]
    options: list[str] = Field(default_factory=list)
    correct_answer: Union[str, int, list[int]]
    explanation: Optional[str] = None
    points: int = 1


class SceneBeat(BaseModel):
    id: str
    name: str
    description: str
    start_frame: int
    end_frame: int
    elements: list[str] = Field(default_factory=list)
    narration: Optional[str] = None
    transition_in: TransitionType = TransitionType.FADE
    transition_out: TransitionType = TransitionType.FADE


class Scene(BaseModel):
    id: str
    type: SceneType
    title: Optional[str] = None
    duration_frames: int
    beats: list[SceneBeat] = Field(default_factory=list)
    graph: Optional[GraphData] = None
    code_blocks: list[CodeBlock] = Field(default_factory=list)
    terminal_frames: list[TerminalFrame] = Field(default_factory=list)
    call_stack: list[CallStackFrame] = Field(default_factory=list)
    memory_blocks: list[MemoryBlock] = Field(default_factory=list)
    comparison_items: list[ComparisonItem] = Field(default_factory=list)
    charts: list[ChartData] = Field(default_factory=list)
    quiz_questions: list[QuizQuestion] = Field(default_factory=list)
    layout_config: dict[str, Any] = Field(default_factory=dict)
    background: Optional[ColorRole] = ColorRole.BACKGROUND
    transition_in: TransitionType = TransitionType.FADE
    transition_out: TransitionType = TransitionType.FADE


class VideoMetadata(BaseModel):
    topic: str
    topic_type: str
    target_audience: str = "general"
    estimated_duration_seconds: float
    language: str = "en"
    grade_level: Optional[str] = None
    curriculum: Optional[str] = None
    learning_objectives: list[str] = Field(default_factory=list)
    prerequisites: list[str] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)


class VideoSpec(BaseModel):
    version: str = "1.0"
    metadata: VideoMetadata
    design_tokens: DesignTokens = Field(default_factory=DesignTokens)
    scenes: list[Scene]
    global_animations: dict[str, AnimatedValue] = Field(default_factory=dict)
    audio: Optional[dict[str, Any]] = None
    
    @field_validator("scenes")
    @classmethod
    def validate_scenes(cls, v):
        if not v:
            raise ValueError("At least one scene is required")
        return v
    
    @field_validator("metadata")
    @classmethod
    def validate_metadata(cls, v):
        if v.estimated_duration_seconds <= 0:
            raise ValueError("Duration must be positive")
        return v


DEFAULT_DESIGN_TOKENS = DesignTokens(
    colors={
        ColorRole.PRIMARY: "#1971C2",
        ColorRole.SECONDARY: "#404040",
        ColorRole.ACCENT: "#E64980",
        ColorRole.BACKGROUND: "#FAFAFA",
        ColorRole.SURFACE: "#FFFFFF",
        ColorRole.TEXT_PRIMARY: "#212529",
        ColorRole.TEXT_SECONDARY: "#495057",
        ColorRole.TEXT_MUTED: "#868E96",
        ColorRole.BORDER: "#DEE2E6",
        ColorRole.SUCCESS: "#37B24D",
        ColorRole.WARNING: "#F08C00",
        ColorRole.ERROR: "#FA5252",
        ColorRole.INFO: "#228BE6",
        ColorRole.NODE_DEFAULT: "#1971C2",
        ColorRole.NODE_HIGHLIGHT: "#E64980",
        ColorRole.EDGE_DEFAULT: "#495057",
        ColorRole.EDGE_HIGHLIGHT: "#E64980",
        ColorRole.CODE_BACKGROUND: "#F8F9FA",
        ColorRole.CODE_TEXT: "#212529",
        ColorRole.CODE_COMMENT: "#868E96",
        ColorRole.CODE_KEYWORD: "#E64980",
        ColorRole.CODE_STRING: "#37B24D",
        ColorRole.CODE_NUMBER: "#F08C00",
        ColorRole.CODE_FUNCTION: "#1971C2",
        ColorRole.CODE_TYPE: "#7048E8",
    },
    font_sizes={
        FontSize.XS: "0.75rem",
        FontSize.SM: "0.875rem",
        FontSize.MD: "1rem",
        FontSize.LG: "1.125rem",
        FontSize.XL: "1.25rem",
        FontSize.TITLE: "1.5rem",
        FontSize.DISPLAY: "2.5rem",
    },
    font_weights={
        FontWeight.NORMAL: "400",
        FontWeight.MEDIUM: "500",
        FontWeight.SEMIBOLD: "600",
        FontWeight.BOLD: "700",
    },
    spacing={
        Spacing.NONE: "0",
        Spacing.XS: "4px",
        Spacing.SM: "8px",
        Spacing.MD: "16px",
        Spacing.LG: "24px",
        Spacing.XL: "32px",
        Spacing.TWO_XL: "48px",
    },
    border_radius={
        BorderRadius.NONE: "0",
        BorderRadius.SM: "4px",
        BorderRadius.MD: "8px",
        BorderRadius.LG: "12px",
        BorderRadius.FULL: "9999px",
    },
    shadows={
        Shadow.NONE: "none",
        Shadow.SM: "0 1px 2px rgba(0,0,0,0.05)",
        Shadow.MD: "0 4px 6px rgba(0,0,0,0.07)",
        Shadow.LG: "0 10px 15px rgba(0,0,0,0.1)",
    },
    z_indices={
        "background": 0,
        "grid": 10,
        "content": 100,
        "nodes": 200,
        "edges": 150,
        "labels": 250,
        "overlays": 300,
        "tooltips": 400,
        "modal": 500,
    },
    stroke_widths={
        StrokeWidth.THIN: "1px",
        StrokeWidth.MEDIUM: "2px",
        StrokeWidth.THICK: "3px",
    },
    transition_duration="300ms",
    safe_area_padding="96px",
)