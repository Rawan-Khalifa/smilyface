"""Loads all Gemma models once at startup."""

_models = {}


def load_models():
    """Load Gemma 2B, PaliGemma 2, etc. into memory."""
    # TODO: Load Gemma 2B for language/jargon
    # TODO: Load PaliGemma 2 for emotion from video
    # Store in _models dict for agent access
    pass


def unload_models():
    """Free model memory at shutdown."""
    _models.clear()
