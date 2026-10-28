"""Create a design-only bridge from verified upstream recipe IDs to our 10 packs."""
from __future__ import annotations

import copy
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE_COMMIT = "1aab133dd75f4db57c3f62e6da2fdd121c5d509b"
MAPPING = {
    "minimal-clean": (["bullet_time_white", "turntable_hero"], "白底、留白、少字；原图动效不承诺未拍背面/真转台。"),
    "warm-handmade": (["craft_hands", "cottage_craft"], "吸收暖光/慢节奏；无工艺证据时不生成假制作过程。"),
    "quiet-luxury": (["macro_texture", "luxury_hero"], "灰调/微距/克制字幕；商品颜色、材质、标识需保持。"),
    "fresh-daily": (["lifestyle_seed", "day_in_life"], "明亮生活情境；AI场景是单独验收的执行变体。"),
    "appetite-flash": (["food_crave", "pack_flatlay"], "近景/俯拍/快节奏；只有包装图时不创造切面与配料。"),
    "home-calm": (["ambiance_mood", "ai_room_preview"], "氛围与慢停留；房间预览变体才需额外房间图。"),
    "feature-cards": (["three_reasons", "slide_deck", "clean_label"], "一卡一点、标签有来源；卖点不足时不硬凑事实。"),
    "color-pop": (["pack_flatlay", "flash_sale"], "明亮拼贴与快节奏；无活动证据时采用中性CTA。"),
    "launch-story": (["new_drop", "ritual_unboxing"], "揭幕与细节顺序；无证据时不做旧款对比/虚构附件。"),
    "portrait-social": (["presenter_talk", "ai_ugc_actor"], "竖屏讲解与字幕；AI演员不是实际买家证言。"),
}


def main() -> None:
    baseline = json.loads((ROOT / "assets/presets/presets.v2.json").read_text(encoding="utf-8"))
    upstream = json.loads((ROOT / "assets/research/one-tap-ads/方案完整目录-1aab133.json").read_text(encoding="utf-8"))
    assert upstream["commit"] == SOURCE_COMMIT
    recipes = {t["id"]: t for t in upstream["recipes"]}
    official = {p["preset_id"]: p for p in baseline["presets"]}
    assert set(official) == set(MAPPING) and len(official) == 10
    mappings = []
    for pid, (ids, note) in MAPPING.items():
        assert all(rid in recipes for rid in ids), (pid, ids)
        p = official[pid]
        mappings.append({
            "official_preset_id": pid,
            "official_name": p["name"],
            "baseline_version": p["version"],
            "status": "DESIGN_ONLY_NOT_IMPLEMENTED",
            "sale_enabled": False,
            "source_recipe_ids": ids,
            "creative_transfer_note": note,
            "source_recipe_binding": "creative_reference_only_not_proven_demo_mapping",
            "input_contract": copy.deepcopy(p["input"]),
            "output_slots": copy.deepcopy(p["output_slots"]),
            "required_auxiliary_outputs": copy.deepcopy(p["required_auxiliary_outputs"]),
            "price_fen": None,
        })

    definitions = [
        ("photo-layout-pack", "快闪图文包", "color-pop", "PHOTO_LAYOUT", ["pack_flatlay", "slide_deck"],
         ["photo_layout", "deterministic_motion", "caption_timeline", "licensed_music_or_silent"],
         "licensed_music_or_silent", ["tissue-showcase"],
         "只借鉴四段展示/信息卡结构，不继承示例的纸巾性能、价格或无音轨状态。"),
        ("product-detail-ai", "商品微距展示包·生成变体", "quiet-luxury", "PER_SHOT_AI", ["macro_texture", "turntable_hero"],
         ["product_locked_keyframes", "image_to_video", "cross_frame_product_qc", "caption_timeline"],
         "licensed_music_or_silent", [],
         "以真实细节为锚点，不能生成未拍背面/新材质；模型、成本与通过率均待实测。"),
        ("ai-presenter-single", "AI单镜讲解包", "portrait-social", "PER_SHOT_AI", ["presenter_talk", "ai_ugc_actor"],
         ["approved_ai_presenter", "correct_product_holding", "native_speech", "speech_alignment", "product_identity_qc"],
         "native_speech_preserve_no_second_tts", ["coffee-single", "blender-single"],
         "一个人物原声片段加后期；需对商品持握、可懂度、字幕和包装形态实测。"),
        ("ai-presenter-multi", "AI连续多镜包", "portrait-social", "REFERENCE_FILM", ["ai_ugc_actor", "gift_story"],
         ["consistent_reference_frames", "multi_reference_video", "native_multi_shot", "native_speech", "cross_shot_product_character_qc"],
         "native_speech_preserve_no_second_tts", ["coffee-film"],
         "分镜参考/时间码一次整片加后期；咖啡演示的瓶装变杯装问题作为必须拦截的反例。"),
    ]
    examples = []
    for vid, name, pid, engine, source_ids, capabilities, audio, cases, note in definitions:
        assert all(rid in recipes for rid in source_ids)
        p = official[pid]
        video = next(s for s in p["output_slots"] if s["kind"] == "video")
        examples.append({
            "variant_id": vid, "display_name": name, "official_preset_id": pid,
            "baseline_version": p["version"], "engine": engine,
            "status": "DESIGN_REQUIRES_IMPLEMENTATION_AND_VALIDATION", "sale_enabled": False,
            "source_recipe_ids": source_ids, "source_demo_evidence_ids": cases,
            "source_demo_proves_exact_recipe_id": False,
            "required_capabilities": capabilities, "audio_policy": audio,
            "post_production_required": True,
            "post_production_stages": ["preserve_native_audio_if_present", "caption_if_selected", "approved_music_or_silent", "required_labels", "cover", "encode_to_contract", "whole_pack_qc"],
            "output_slots": copy.deepcopy(p["output_slots"]),
            "video_contract": {"width": video["width"], "height": video["height"],
                               "fps": video["fps"], "duration_seconds": video["duration_seconds"],
                               "target_frames": video["duration_seconds"] * video["fps"],
                               "codec": video["codec"], "pixel_format": video["pixel_format"],
                               "duration_tolerance_frames": 1},
            "provider_model_snapshot": None, "provider_rate_snapshot": None, "price_fen": None,
            "user_fills_product_form": False, "mandatory_multimodal_analysis": True,
            "requires_product_identity_lock": True, "unknown_fact_policy": "omit_or_neutral_copy",
            "silent_engine_fallback_allowed": False, "execution_note": note,
        })
    output = {
        "schema_version": "draft-1.0", "date": "2026-10-27", "status": "DESIGN_ONLY_NOT_IMPLEMENTED",
        "sale_enabled": False, "upstream_commit": SOURCE_COMMIT,
        "source_data": "../research/one-tap-ads/方案完整目录-1aab133.json",
        "official_baseline": "../presets/presets.v2.json",
        "copyright_boundary": "创意来源保留ClipForge/xixihhhh及AGPL-3.0-only信息；本草案不授予额外权利。",
        "official_mapping_count": len(mappings), "official_mappings": mappings,
        "execution_examples": examples,
        "release_gates": ["implementation_complete", "source_and_resource_rights_resolved", "model_capabilities_verified", "evidence_and_identity_quality_pass", "sound_and_delivery_contract_pass", "cost_time_distribution_measured", "mini_program_real_device_flow_pass"],
    }
    target = ROOT / "assets/blueprints/云端方案映射.v1.json"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"mapping_count": len(mappings), "execution_examples": len(examples), "sale_enabled": False, "path": str(target)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
