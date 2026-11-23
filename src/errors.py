class PipelineError(RuntimeError):
    """Raised when a build step fails in a way the caller should surface."""
