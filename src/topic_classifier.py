from enum import Enum
from dataclasses import dataclass
from typing import Optional
import re


class TopicType(Enum):
    SCHOOL_SCIENCE = "school_science"
    SCHOOL_MATH = "school_math"
    PHYSICS = "physics"
    CHEMISTRY = "chemistry"
    BIOLOGY = "biology"
    COMPUTER_SCIENCE = "computer_science"
    MACHINE_LEARNING = "machine_learning"
    NEURAL_NETWORKS = "neural_networks"
    SYSTEM_DESIGN = "system_design"
    ALGORITHMS = "algorithms"
    DATA_STRUCTURES = "data_structures"
    CODE_WALKTHROUGH = "code_walkthrough"
    GENERAL = "general"


@dataclass
class TopicClassification:
    topic_type: TopicType
    confidence: float
    subcategory: Optional[str] = None
    grade_level: Optional[str] = None
    keywords_matched: list[str] = None


SCHOOL_SCIENCE_KEYWORDS = [
    "light", "reflection", "refraction", "mirror", "lens", "prism", "spectrum",
    "electricity", "circuit", "current", "voltage", "resistance", "ohm",
    "magnetism", "magnetic", "electromagnet", "compass", "field",
    "force", "motion", "newton", "gravity", "friction", "inertia",
    "energy", "work", "power", "kinetic", "potential",
    "sound", "wave", "frequency", "amplitude", "pitch",
    "heat", "temperature", "thermodynamics", "conduction", "convection", "radiation",
    "matter", "atom", "molecule", "element", "compound", "mixture",
    "chemical", "reaction", "acid", "base", "salt", "ph", "indicator",
    "cell", "tissue", "organ", "organism", "photosynthesis", "respiration",
    "reproduction", "genetics", "dna", "evolution", "ecosystem",
    "nutrition", "digestion", "circulation", "excretion", "nervous",
]

SCHOOL_MATH_KEYWORDS = [
    "algebra", "equation", "polynomial", "quadratic", "linear",
    "geometry", "triangle", "circle", "quadrilateral", "polygon",
    "coordinate", "geometry", "distance", "section", "midpoint",
    "trigonometry", "sine", "cosine", "tangent", "angle",
    "mensuration", "area", "volume", "surface", "perimeter",
    "statistics", "mean", "median", "mode", "probability",
    "number", "system", "rational", "irrational", "real",
    "exponent", "power", "root", "surds", "logarithm",
    "set", "relation", "function", "domain", "range",
    "sequence", "series", "arithmetic", "geometric",
    "permutation", "combination", "binomial",
    "matrix", "determinant", "inverse",
    "calculus", "limit", "derivative", "integral",
    "vector", "3d", "plane", "line",
    "probability", "bayes", "distribution",
]

PHYSICS_KEYWORDS = [
    "mechanics", "kinematics", "dynamics", "thermodynamics",
    "electromagnetism", "optics", "waves", "quantum", "relativity",
    "particle", "nuclear", "atomic", "solid", "fluid",
    "semiconductor", "superconductor", "laser", "fiber",
]

CHEMISTRY_KEYWORDS = [
    "organic", "inorganic", "physical", "analytical", "biochemistry",
    "reaction", "mechanism", "synthesis", "catalysis", "equilibrium",
    "kinetics", "thermo", "electro", "photo", "stereo",
    "periodic", "bond", "orbital", "hybridization", "resonance",
    "aromatic", "aliphatic", "functional", "group", "isomer",
    "spectroscopy", "chromatography", "titration", "ph",
]

BIOLOGY_KEYWORDS = [
    "cell", "molecular", "genetics", "genomics", "proteomics",
    "evolution", "ecology", "physiology", "anatomy", "neuroscience",
    "immunology", "microbiology", "virology", "botany", "zoology",
    "photosynthesis", "respiration", "metabolism", "signaling",
    "development", "stem", "cancer", "disease", "therapy",
]

CS_KEYWORDS = [
    "algorithm", "data structure", "complexity", "big-o", "sorting",
    "searching", "graph", "tree", "hash", "heap", "stack", "queue",
    "dynamic programming", "greedy", "divide conquer", "backtracking",
    "operating system", "process", "thread", "memory", "scheduler",
    "network", "protocol", "tcp", "ip", "http", "dns", "ssl",
    "database", "sql", "nosql", "transaction", "index", "sharding",
    "compiler", "interpreter", "parser", "lexer", "ast", "bytecode",
    "distributed", "consensus", "raft", "paxos", "cap", "theorem",
    "cryptography", "encryption", "hash", "signature", "certificate",
]

ML_KEYWORDS = [
    "machine learning", "supervised", "unsupervised", "reinforcement",
    "regression", "classification", "clustering", "dimensionality",
    "feature", "engineering", "selection", "extraction",
    "model", "training", "validation", "test", "overfitting",
    "regularization", "gradient", "descent", "backpropagation",
    "loss", "function", "optimizer", "learning rate", "batch",
    "ensemble", "boosting", "bagging", "random forest", "svm",
    "knn", "naive bayes", "decision tree", "logistic",
]

NEURAL_NETWORK_KEYWORDS = [
    "neural network", "deep learning", "perceptron", "mlp", "cnn",
    "rnn", "lstm", "gru", "transformer", "attention", "bert", "gpt",
    "convolution", "pooling", "activation", "relu", "sigmoid", "tanh",
    "batch norm", "dropout", "weight", "bias", "gradient",
    "backprop", "autoencoder", "gan", "vae", "diffusion",
    "fine-tuning", "transfer", "learning", "prompt", "embedding",
]

SYSTEM_DESIGN_KEYWORDS = [
    "system design", "architecture", "microservice", "monolith",
    "scalability", "availability", "reliability", "latency",
    "throughput", "load balancer", "cache", "redis", "memcached",
    "database", "sharding", "replication", "partitioning",
    "message queue", "kafka", "rabbitmq", "pubsub",
    "api gateway", "rate limiting", "circuit breaker", "retry",
    "consistency", "eventual", "strong", "acid", "base",
    "cap theorem", "paxos", "raft", "consensus",
    "observability", "monitoring", "logging", "tracing",
    "deployment", "kubernetes", "docker", "ci/cd",
]

INDIAN_CURRICULUM_PATTERNS = [
    r"class\s*[8-9]\b",
    r"class\s*1[0-2]\b",
    r"grade\s*[8-9]\b",
    r"grade\s*1[0-2]\b",
    r"ncert\b",
    r"cbse\b",
    r"icse\b",
    r"indian\s+curriculum",
    r"std\s*[8-9]\b",
    r"std\s*1[0-2]\b",
]


def detect_indian_curriculum(text: str) -> tuple[bool, Optional[str]]:
    text_lower = text.lower()
    for pattern in INDIAN_CURRICULUM_PATTERNS:
        match = re.search(pattern, text_lower)
        if match:
            grade_match = re.search(r"(?:class|grade|std)\s*([8-9]|1[0-2])", text_lower)
            grade = grade_match.group(1) if grade_match else None
            return True, grade
    return False, None


def count_keyword_matches(text: str, keywords: list[str]) -> tuple[int, list[str]]:
    text_lower = text.lower()
    matched = []
    for kw in keywords:
        if kw.lower() in text_lower:
            matched.append(kw)
    return len(matched), matched


def classify_topic(topic: str, instructions: str = "") -> TopicClassification:
    combined = f"{topic} {instructions}".lower()
    
    is_indian, grade = detect_indian_curriculum(combined)
    
    scores = {}
    all_matched = {}
    
    counts = {
        TopicType.SCHOOL_SCIENCE: count_keyword_matches(combined, SCHOOL_SCIENCE_KEYWORDS),
        TopicType.SCHOOL_MATH: count_keyword_matches(combined, SCHOOL_MATH_KEYWORDS),
        TopicType.PHYSICS: count_keyword_matches(combined, PHYSICS_KEYWORDS),
        TopicType.CHEMISTRY: count_keyword_matches(combined, CHEMISTRY_KEYWORDS),
        TopicType.BIOLOGY: count_keyword_matches(combined, BIOLOGY_KEYWORDS),
        TopicType.COMPUTER_SCIENCE: count_keyword_matches(combined, CS_KEYWORDS),
        TopicType.MACHINE_LEARNING: count_keyword_matches(combined, ML_KEYWORDS),
        TopicType.NEURAL_NETWORKS: count_keyword_matches(combined, NEURAL_NETWORK_KEYWORDS),
        TopicType.SYSTEM_DESIGN: count_keyword_matches(combined, SYSTEM_DESIGN_KEYWORDS),
    }
    
    for ttype, (count, matched) in counts.items():
        scores[ttype] = count
        all_matched[ttype] = matched
    
    if is_indian:
        if any(kw in combined for kw in SCHOOL_MATH_KEYWORDS):
            scores[TopicType.SCHOOL_MATH] += 3
        if any(kw in combined for kw in SCHOOL_SCIENCE_KEYWORDS):
            scores[TopicType.SCHOOL_SCIENCE] += 3
    
    if scores[TopicType.NEURAL_NETWORKS] > scores[TopicType.MACHINE_LEARNING]:
        scores[TopicType.MACHINE_LEARNING] = 0
    
    best_type = max(scores, key=scores.get)
    best_score = scores[best_type]
    
    total_score = sum(scores.values())
    confidence = best_score / total_score if total_score > 0 else 0.5
    
    subcategory = None
    if best_type == TopicType.SCHOOL_SCIENCE:
        for kw in all_matched[best_type]:
            if kw in ["light", "reflection", "refraction", "mirror", "lens"]:
                subcategory = "optics"
                break
            elif kw in ["electricity", "circuit", "current", "magnetism", "electromagnet"]:
                subcategory = "electricity_magnetism"
                break
            elif kw in ["force", "motion", "newton", "gravity"]:
                subcategory = "mechanics"
                break
            elif kw in ["chemical", "reaction", "acid", "base"]:
                subcategory = "chemistry"
                break
            elif kw in ["cell", "photosynthesis", "genetics", "dna"]:
                subcategory = "biology"
                break
    elif best_type == TopicType.SCHOOL_MATH:
        for kw in all_matched[best_type]:
            if kw in ["algebra", "equation", "polynomial", "quadratic"]:
                subcategory = "algebra"
                break
            elif kw in ["geometry", "triangle", "circle", "coordinate"]:
                subcategory = "geometry"
                break
            elif kw in ["trigonometry", "sine", "cosine", "tangent"]:
                subcategory = "trigonometry"
                break
            elif kw in ["calculus", "limit", "derivative", "integral"]:
                subcategory = "calculus"
                break
            elif kw in ["statistics", "probability", "mean", "median"]:
                subcategory = "statistics"
                break
    
    return TopicClassification(
        topic_type=best_type,
        confidence=confidence,
        subcategory=subcategory,
        grade_level=grade,
        keywords_matched=all_matched.get(best_type, [])
    )


def get_pipeline_for_topic(classification: TopicClassification) -> str:
    pipeline_map = {
        TopicType.SCHOOL_SCIENCE: "school_science_pipeline",
        TopicType.SCHOOL_MATH: "school_math_pipeline",
        TopicType.PHYSICS: "physics_pipeline",
        TopicType.CHEMISTRY: "chemistry_pipeline",
        TopicType.BIOLOGY: "biology_pipeline",
        TopicType.COMPUTER_SCIENCE: "cs_pipeline",
        TopicType.MACHINE_LEARNING: "ml_pipeline",
        TopicType.NEURAL_NETWORKS: "neural_network_pipeline",
        TopicType.SYSTEM_DESIGN: "system_design_pipeline",
        TopicType.ALGORITHMS: "algorithm_pipeline",
        TopicType.DATA_STRUCTURES: "data_structure_pipeline",
        TopicType.CODE_WALKTHROUGH: "code_walkthrough_pipeline",
        TopicType.GENERAL: "general_pipeline",
    }
    return pipeline_map.get(classification.topic_type, "general_pipeline")


def get_template_for_topic(classification: TopicClassification) -> str:
    template_map = {
        TopicType.SCHOOL_SCIENCE: "concept-map",
        TopicType.SCHOOL_MATH: "math-derivation",
        TopicType.PHYSICS: "physics-simulation",
        TopicType.CHEMISTRY: "chemistry-reaction",
        TopicType.BIOLOGY: "biology-diagram",
        TopicType.COMPUTER_SCIENCE: "code-walkthrough",
        TopicType.MACHINE_LEARNING: "network-flow",
        TopicType.NEURAL_NETWORKS: "network-flow",
        TopicType.SYSTEM_DESIGN: "system-design",
        TopicType.ALGORITHMS: "timeline",
        TopicType.DATA_STRUCTURES: "memory-diagram",
        TopicType.CODE_WALKTHROUGH: "code-walkthrough",
        TopicType.GENERAL: "concept-map",
    }
    return template_map.get(classification.topic_type, "concept-map")