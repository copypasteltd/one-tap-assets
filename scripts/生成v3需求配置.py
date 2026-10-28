"""Generate design-only v3 presets and execution variants from the preserved v2 packs.

This does not publish recipes, configure provider accounts, or generate media.
"""
from __future__ import annotations

import copy
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
COMMIT = "1aab133dd75f4db57c3f62e6da2fdd121c5d509b"
SOURCES = {
    "minimal-clean": ["bullet_time_white", "turntable_hero"],
    "warm-handmade": ["craft_hands", "cottage_craft"],
    "quiet-luxury": ["macro_texture", "luxury_hero"],
    "fresh-daily": ["lifestyle_seed", "day_in_life"],
    "appetite-flash": ["food_crave", "pack_flatlay"],
    "home-calm": ["ambiance_mood"],
    "feature-cards": ["three_reasons", "slide_deck", "clean_label"],
    "color-pop": ["pack_flatlay", "flash_sale"],
    "launch-story": ["new_drop", "ritual_unboxing"],
    "portrait-social": ["presenter_talk", "ai_ugc_actor"],
}
GATES = ["approved_source_and_resource_rights", "implementation_complete", "verified_model_capabilities_if_required", "product_identity_and_fact_qc_pass", "speech_and_subtitle_qc_if_required", "whole_pack_contract_pass", "at_least_30_full_pack_runs_with_failures_included", "cost_latency_capacity_measured", "mini_program_device_flow_pass"]
VARIANT_EXTRA = [
    ("quiet-luxury", "ai-detail", "AI质感展示", "PER_SHOT_AI", "product_showcase", "none", ["product_locked_keyframes", "image_to_video", "cross_frame_product_qc"], ["macro_texture", "turntable_hero"], []),
    ("fresh-daily", "ai-scene", "AI生活场景", "PER_SHOT_AI", "scenario", "none", ["product_locked_scene_generation", "image_to_video", "cross_frame_product_qc"], ["lifestyle_seed", "scene_grow"], []),
    ("portrait-social", "ai-presenter-single", "AI单镜讲解", "PER_SHOT_AI", "talking_head", "native_speech", ["approved_ai_presenter", "correct_product_holding", "native_speech_zh", "speech_alignment", "product_identity_qc"], ["presenter_talk", "ai_ugc_actor"], ["coffee-single", "blender-single"]),
    ("portrait-social", "ai-presenter-multi", "AI连续多镜", "REFERENCE_FILM", "talking_head", "native_speech", ["consistent_reference_frames", "multi_reference_video", "native_multi_shot", "native_speech_zh", "cross_shot_product_character_qc"], ["ai_ugc_actor", "gift_story"], ["coffee-film"]),
]


def main() -> None:
    baseline = json.loads((ROOT / "assets/presets/presets.v2.json").read_text(encoding="utf-8"))
    research = json.loads((ROOT / "assets/research/one-tap-ads/方案完整目录-1aab133.json").read_text(encoding="utf-8"))
    assert research["commit"] == COMMIT
    source_ids = {r["id"] for r in research["recipes"]}
    source_recipes = {r["id"]: r for r in research["recipes"]}
    original = {p["preset_id"]: p for p in baseline["presets"]}
    assert set(original) == set(SOURCES) and len(original) == 10
    result = copy.deepcopy(baseline)
    result.update({
        "schema_version": "3.0", "requirements_version": "3.0", "date": "2026-10-27",
        "status": "DESIGN_ONLY_NOT_IMPLEMENTED", "sale_enabled": False,
        "scope": "双小程序、免填表视觉档案/商品锁、三条云端产线、官方10套/至少14变体、社区扩展与全包相册交付",
        "official_execution_variant_minimum_launch_count": 14,
        "generation_variants_required_in_p0": 4,
        "upstream_reference": {"repository": "copypasteltd/one-tap-ads", "commit": COMMIT, "license": "AGPL-3.0-only", "attribution": "ClipForge / xixihhhh", "purpose": "research_and_creative_reference_not_automatic_commercial_admission"},
        "engine_policies": {
            "PHOTO_LAYOUT": {"p95_target_seconds": 120, "hard_deadline_seconds": 600},
            "PER_SHOT_AI": {"p95_target_seconds": 900, "hard_deadline_seconds": 1800},
            "REFERENCE_FILM": {"p95_target_seconds": 1800, "hard_deadline_seconds": 3600},
        },
        "latency_policy_status": "INITIAL_DESIGN_TARGETS_REQUIRE_BENCHMARK_BEFORE_PUBLICATION",
        "identity_lock_required": True, "source_recipe_count_is_not_published_service_count": True,
        "timeline_precedence": "execution_variant.timeline_policy; preset.rhythm.segments is the base photo-layout design only",
    })
    result["community_policy"].update({"allowed_execution": "declarative-approved-capabilities-only", "generation_variants_require_individual_validation": True, "source_component_does_not_grant_execution_or_asset_rights": True})

    def variant(p: dict, suffix: str, label: str, engine: str, narrative: str, speech: str, capabilities: list[str], refs: list[str], cases: list[str]) -> dict:
        assert set(refs) <= source_ids, refs
        v = next(s for s in p["output_slots"] if s["kind"] == "video")
        is_photo = engine == "PHOTO_LAYOUT"
        creative = source_recipes[refs[0]]
        source_compose = creative["compose"]
        return {
            "variant_id": f"{p['preset_id']}.{suffix}", "version": "3.0.0", "name": f"{p['name']}·{label}",
            "priority": "P0", "required_for_v3_launch": True,
            "status": "DESIGN", "sale_enabled": False, "price_fen": None, "currency": "CNY",
            "engine": engine, "narrative_strategy": narrative,
            "video_mode": "graphic_montage" if is_photo else "live_presenter" if speech != "none" else "scene_demo" if suffix == "ai-scene" else "product_closeup",
            "creative_components": {"look_id": creative["look"], "source_camera_plan": copy.deepcopy(creative["cameraPlan"]),
                                    "camera_execution_policy": "deterministic_photo_motion_only" if is_photo else "planner_must_validate_source_intent_against_identity_lock",
                                    "source_script_hint": creative["scriptHint"]["zh"],
                                    "source_hint_usage": "creative_intent_only_rewrite_against_evidence_no_unseen_product_claims",
                                    "caption_preset": "standard" if is_photo and source_compose.get("captionPreset") == "karaoke" else source_compose.get("captionPreset", "standard"),
                                    "music_mood": source_compose.get("bgm", "none"),
                                    "music_asset_version": None, "font_asset_version": None,
                                    "bgm_volume": source_compose.get("bgmVolume", 0.15),
                                    "bgm_duck": speech != "none", "quality": source_compose.get("quality", "standard"),
                                    "aspect_ratio": "9:16", "product_card": source_compose.get("productCard", False),
                                    "cta_policy": "evidence_backed_or_neutral_no_invented_offer",
                                    "component_review_status": "NOT_VALIDATED"},
            "source_recipe_ids": refs, "source_demo_evidence_ids": cases,
            "demo_proves_exact_recipe_id": False, "source_style_resolution": "EXPLICIT_CANONICAL_NARRATIVE_REQUIRED",
            "input": copy.deepcopy(p["input"]), "required_capabilities": capabilities,
            "provider_model_snapshot": None, "provider_rate_snapshot": None, "approved_character_version": None,
            "product_identity_lock_required": True, "unknown_product_surface_policy": "do_not_invent_request_photo_or_omit_view_before_quote",
            "audio_policy": {"speech": speech, "language": "zh-CN" if speech != "none" else None,
                             "preserve_native_speech": speech == "native_speech", "second_tts_over_native_speech_allowed": False,
                             "music": "approved_licensed_or_contract_silent", "action_sound_required": False,
                             "caption_alignment": "actual_audio" if speech != "none" else "planned_text_timeline"},
            "ai_disclosure_required": not is_photo,
            "output_slots": copy.deepcopy(p["output_slots"]),
            "required_auxiliary_outputs": copy.deepcopy(p["required_auxiliary_outputs"]),
            "timeline_policy": {"target_frames": v["duration_seconds"] * v["fps"], "fps": v["fps"],
                                "tolerance_frames": 1, "base_segments": copy.deepcopy(p["rhythm"]["segments"]) if is_photo else None,
                                "planning": "fixed_base_timeline" if is_photo else "evidence_script_exact_frame_plan_before_quote"},
            "native_generation_spec": None if not is_photo else {"source": "original_photos"},
            "delivery_spec_not_claimed_as_native_model_resolution": True,
            "mandatory_post_production": ["image_pack", "audio_policy", "caption_style", "required_labels", "music_policy", "product_card_if_selected", "cover", "contract_encode", "whole_pack_qc"],
            "slo_policy": copy.deepcopy(result["engine_policies"][engine]),
            "retry_policy": {"max_repair_rounds": 1, "max_extra_attempts_per_affected_node": 1,
                             "additional_paid_cost_ceiling_fen": None, "unknown_provider_state": "query_or_reconcile_never_blind_resubmit",
                             "retry_extends_deadline": False},
            "silent_engine_or_model_fallback_allowed": False,
            "release_gates": GATES[:], "sample_validation_status": "NOT_RUN",
        }

    for p in result["presets"]:
        p["version"] = "3.0.0"
        p["status"] = "DESIGN"; p["sale_enabled"] = False
        p["recognition"]["profile_schema_version"] = "1.1"
        p["source_recipe_ids"] = SOURCES[p["preset_id"]]
        p["execution_variants"] = [variant(p, "photo-layout", "图文展示", "PHOTO_LAYOUT", "feature_cards" if p["preset_id"] in {"feature-cards", "color-pop"} else "product_showcase", "none", ["photo_layout", "deterministic_motion", "caption_timeline"], SOURCES[p["preset_id"]], [])]
        for pid, suffix, label, engine, narrative, speech, caps, refs, cases in VARIANT_EXTRA:
            if pid == p["preset_id"]:
                p["execution_variants"].append(variant(p, suffix, label, engine, narrative, speech, caps, refs, cases))
        assert p["output_slots"] == original[p["preset_id"]]["output_slots"]
        assert p["name"] == original[p["preset_id"]]["name"]
    all_variants = [v for p in result["presets"] for v in p["execution_variants"]]
    assert len(all_variants) == len({v["variant_id"] for v in all_variants}) == 14
    assert {v["engine"] for v in all_variants} == set(result["engine_policies"])
    target = ROOT / "assets/presets/presets.v3.json"
    target.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    blueprint = {
        "schema_version": "3.0", "requirements_version": "3.0", "status": "DESIGN_ONLY_NOT_IMPLEMENTED", "sale_enabled": False,
        "upstream_commit": COMMIT, "official_baseline": "../presets/presets.v3.json",
        "official_mapping_count": 10, "execution_variant_count": 14,
        "official_mappings": [{"official_preset_id": p["preset_id"], "official_name": p["name"], "source_recipe_ids": p["source_recipe_ids"], "variant_ids": [v["variant_id"] for v in p["execution_variants"]]} for p in result["presets"]],
        "execution_variants": all_variants, "release_gates": GATES,
    }
    blueprint_path = ROOT / "assets/blueprints/云端方案映射.v3.json"
    blueprint_path.parent.mkdir(parents=True, exist_ok=True)
    blueprint_path.write_text(json.dumps(blueprint, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"presets": 10, "variants": 14, "ai_variants": 4, "sale_enabled": False, "targets": [str(target), str(blueprint_path)]}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
