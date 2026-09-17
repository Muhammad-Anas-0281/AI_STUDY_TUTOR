"""
Evaluation judges module.
Combines deterministic rubric validation with LLM-as-judge criteria.
"""

from typing import Dict, Any, List


def judge_tutor_response(
    response: str,
    context: str,
    is_in_scope: bool,
    expected_keywords: List[str] = None
) -> Dict[str, Any]:
    """
    Judge tutor response quality, groundedness, citations, and honest refusal.
    """
    score = 100
    deductions = []

    if not is_in_scope:
        refusal_phrases = [
            "cannot find",
            "not found",
            "not mentioned",
            "not covered",
            "outside the scope",
            "no information",
            "do not contain",
            "cannot provide",
            "not present",
            "security notice",
            "unable to find",
            "no direct evidence",
            "unsubstantiated",
            "does not contain",
            "no mention",
            "not related",
            "cannot answer",
            "not available",
            "absent from",
            "no evidence"
        ]
        has_refusal = any(p in response.lower() for p in refusal_phrases)
        if not has_refusal:
            score -= 80
            deductions.append("Failed to issue honest refusal on out-of-scope query")
        return {
            "passed": score >= 70,
            "score": max(score, 0),
            "deductions": deductions,
            "has_refusal": has_refusal,
            "has_citations": False
        }

    # In-scope checks
    # 1. Citation check
    has_citations = any(c in response for c in ["Source:", "Document:", "Page", "📚 Sources & Citations", "Excerpt"])
    if not has_citations:
        score -= 25
        deductions.append("Missing explicit document/page citation")

    # 2. Active recall hook check
    has_active_recall = any(h in response for h in ["Concept Check", "💡", "Reflection", "Question:"])
    if not has_active_recall:
        score -= 15
        deductions.append("Missing active recall concept check hook")

    # 3. Expected keywords check
    if expected_keywords:
        missing_kw = [kw for kw in expected_keywords if kw.lower() not in response.lower()]
        if len(missing_kw) > len(expected_keywords) // 2:
            score -= 30
            deductions.append(f"Missing core keywords: {missing_kw}")

    return {
        "passed": score >= 70,
        "score": max(score, 0),
        "deductions": deductions,
        "has_citations": has_citations,
        "has_active_recall": has_active_recall
    }


def judge_grading_accuracy(
    actual_score: float,
    expected_score_min: float = None,
    expected_score_max: float = None,
    is_correct: bool = None,
    expected_is_correct: bool = None
) -> Dict[str, Any]:
    """
    Judge open-ended / MCQ grading precision against ground truth boundaries.
    """
    passed = True
    reasons = []

    if expected_score_min is not None and actual_score < expected_score_min:
        passed = False
        reasons.append(f"Score {actual_score} below minimum expected {expected_score_min}")

    if expected_score_max is not None and actual_score > expected_score_max:
        passed = False
        reasons.append(f"Score {actual_score} above maximum expected {expected_score_max}")

    if expected_is_correct is not None and is_correct != expected_is_correct:
        passed = False
        reasons.append(f"is_correct mismatch: got {is_correct}, expected {expected_is_correct}")

    return {
        "passed": passed,
        "actual_score": actual_score,
        "reasons": reasons
    }


def judge_recommendation_relevance(
    recommendation_text: str,
    weak_concepts: List[str],
    expected_themes: List[str]
) -> Dict[str, Any]:
    """
    Judge whether the AI recommendation specifically addresses learner weaknesses.
    """
    matched_themes = [t for t in expected_themes if t.lower() in recommendation_text.lower()]
    relevance_pct = int((len(matched_themes) / max(len(expected_themes), 1)) * 100)
    passed = relevance_pct >= 40

    return {
        "passed": passed,
        "relevance_pct": relevance_pct,
        "matched_themes": matched_themes,
        "missing_themes": [t for t in expected_themes if t not in matched_themes]
    }
