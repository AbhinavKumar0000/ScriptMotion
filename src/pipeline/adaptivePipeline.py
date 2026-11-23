from typing import Any, Dict, List, TypedDict
from enum import Enum
from src.video_spec import VideoSpec, SceneType


class PipelineContext(TypedDict, total=False):
    topic: str
    instructions: str | None
    classification: Dict[str, Any]
    targetDurationSeconds: int
    targetAudience: str
    language: str


TOPIC_TO_SCENE_TYPE: Dict[str, SceneType] = {
    "school_science": SceneType.CONCEPT_MAP,
    "school_math": SceneType.MATH_DERIVATION,
    "physics": SceneType.PHYSICS_SIMULATION,
    "chemistry": SceneType.CHEMISTRY_REACTION,
    "biology": SceneType.BIOLOGY_DIAGRAM,
    "computer_science": SceneType.CODE_WALKTHROUGH,
    "machine_learning": SceneType.CODE_WALKTHROUGH,
    "neural_networks": SceneType.NETWORK_FLOW,
    "system_design": SceneType.SYSTEM_DESIGN,
    "algorithms": SceneType.TIMELINE,
    "data_structures": SceneType.MEMORY_DIAGRAM,
    "general": SceneType.CONCEPT_MAP,
}


def _jsonify(obj: Any) -> Any:
    if isinstance(obj, Enum):
        return obj.value
    if isinstance(obj, dict):
        return {k: _jsonify(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_jsonify(v) for v in obj]
    return obj


def getPipelineForClassification(classification: Dict[str, Any]) -> List[Dict[str, Any]]:
    topic_type = classification.get("topic_type", "general")
    scene_type = TOPIC_TO_SCENE_TYPE.get(topic_type, SceneType.CONCEPT_MAP)
    grade_level = classification.get("grade_level", None)
    subcategory = classification.get("subcategory", None)

    steps: List[Dict[str, Any]] = [
        {"step": "classify", "topic_type": topic_type, "scene_type": scene_type.value},
    ]

    if grade_level:
        steps.append({"step": "curriculum", "grade_level": grade_level})

    if subcategory:
        steps.append({"step": "subcategory", "subcategory": subcategory})

    steps.append({"step": "generate_spec", "scene_type": scene_type.value})

    return steps


async def runPipeline(context: PipelineContext, provider: Any) -> VideoSpec:
    safe_context = _jsonify(context)
    spec_dict = await provider.generate_spec(safe_context)

    if isinstance(spec_dict, VideoSpec):
        return spec_dict

    return VideoSpec.model_validate(spec_dict)
