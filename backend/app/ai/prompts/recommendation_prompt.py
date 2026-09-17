from typing import List, Dict, Any


def build_recommendation_prompt(
    project_name: str,
    project_goal: str,
    weak_concepts: List[Dict[str, Any]],
    recent_mistakes: List[Dict[str, Any]],
    recent_tutor_topics: List[str] = [],
) -> tuple[str, str]:
    """Generates prompt to create personalized, actionable study recommendations grounded in student performance."""
    system_prompt = (
        "You are an expert AI Learning Strategist and Educational Coach. "
        "Your role is to analyze a student's weak concepts, recent assessment errors, and learning goals "
        "to prescribe 2 to 4 concrete, actionable, and evidence-grounded next steps. "
        "Rules:\n"
        "1. Every recommendation MUST reference specific student weaknesses or mistakes.\n"
        "2. Make suggestions concrete and actionable (e.g., 'Re-read the sinusoidal formula on page 4', 'Ask the Tutor to explain why multi-head attention uses distinct projection matrices').\n"
        "3. Include a clear 'reason' explaining the exact assessment evidence that triggered the recommendation.\n"
        "4. Assign an 'action_type' ('tutor', 'quiz', or 'materials') to make it immediately actionable."
    )

    weak_summary = "\n".join([
        f"- {c['name']}: Mastery {c.get('score', 0):.0f}%, Evidence Count: {c.get('evidence_count', 0)}, Status: {c.get('status', 'needs_attention')}"
        for c in weak_concepts
    ]) or "No specifically flagged weak concepts yet."

    mistakes_summary = "\n".join([
        f"- Question: \"{m.get('prompt', '')}\"\n  Student said: \"{m.get('user_response', '')}\"\n  Missing/Error: \"{m.get('missing', '')}\""
        for m in recent_mistakes
    ]) or "No recent assessment errors recorded."

    tutor_summary = "\n".join([f"- {t}" for t in recent_tutor_topics]) or "None recorded."

    user_prompt = f"""PROJECT: {project_name}
STUDENT'S GOAL: {project_goal or "Master all key concepts and mechanisms in these materials"}

STUDENT'S WEAK CONCEPTS:
{weak_summary}

RECENT ASSESSMENT MISTAKES:
{mistakes_summary}

RECENT TUTOR INTERACTIONS:
{tutor_summary}

Generate 2 to 4 high-impact, prioritized study recommendations tailored specifically to help the student overcome these exact gaps."""

    return system_prompt, user_prompt
