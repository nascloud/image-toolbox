package ai

import (
	"fmt"
	"strings"

	"image-toolbox/backend/model"
)

// DefaultBuyerShowNegativePrompt is sent through the provider's dedicated field.
const DefaultBuyerShowNegativePrompt = "text, watermark, logo, text overlays, extra people, fake CGI render, catalog studio lighting, mutated structural parts, generic stock photo vibes"

// BuildBuyerShowPrompt builds one deterministic fixed-slot prompt for a single basis image.
func BuildBuyerShowPrompt(globalPrompt, basisMode string, product model.BuyerShowProduct, slotIndex int, extraPrompt string) (string, error) {
	return BuildBuyerShowPromptWithReferences(globalPrompt, basisMode, product, slotIndex, 1, extraPrompt)
}

// BuildBuyerShowPromptWithReferences creates provider-agnostic instructions that keep one believable
// scene while assigning each fixed slot a materially different camera and usage state.
func BuildBuyerShowPromptWithReferences(globalPrompt, basisMode string, product model.BuyerShowProduct, slotIndex, referenceCount int, extraPrompt string) (string, error) {
	if slotIndex < 2 || slotIndex > 6 {
		return "", fmt.Errorf("buyer-show slot must be between 2 and 6")
	}
	if basisMode != model.BuyerShowBasisWhiteBackground && basisMode != model.BuyerShowBasisExistingScene {
		return "", fmt.Errorf("请选择基于白底图或已有场景")
	}

	basisInstruction := "以输入的白底商品图为商品事实依据。先为整套五图建立唯一、可信的真实使用场景；后续图必须像同一位买家在同一房间、同一时段连续拍摄，锁定已建立的墙地、背景物、光线和商品相对位置，不得每张重新设计场景。"
	if basisMode == model.BuyerShowBasisExistingScene {
		if referenceCount > 1 {
			basisInstruction = fmt.Sprintf("输入的 %d 张已有场景图记录同一真实空间。以第一张图为主要场景锚点，其余图片补足商品和环境细节；锁定可见的墙面、地板、窗帘或窗户、主要家具与道具、光线方向和色温、商品相对位置，不得换空间、替换背景物或臆造参考图未覆盖的房间区域。", referenceCount)
		} else {
			basisInstruction = "以输入的已有场景图为同一真实空间的主要依据。锁定可见的墙地、背景物、光线和商品相对位置，只能在参考图可见的空间方向内改变拍摄视角。"
		}
	}

	parts := []string{
		productIdentity(product),
		basisInstruction,
		"整套五图应有明显差异，但绝不通过换场景实现：每张至少改变相机高度、拍摄方向、景别、商品在画面中的占比、使用状态中的两项。",
		"禁止复用同一机位、构图、主体位置或仅轻微裁切同一画面；不要让商品在房间中不合理移动。",
		"生成真实手机随手拍风格，不要商业棚拍、广告海报或过度精修质感。",
		"严格保持商品主体、结构、材质、颜色、Logo、配件和关键细节，不增加不存在的部件。",
		"画面中不得生成评价文字、标题、水印、边框或拼图。",
		"本图拍摄脚本：" + buyerShowShotInstruction(slotIndex) + "。",
	}
	if value := strings.TrimSpace(globalPrompt); value != "" {
		parts = append(parts, "全局补充要求："+value)
	}
	if value := strings.TrimSpace(extraPrompt); value != "" {
		parts = append(parts, "本次重绘补充要求："+value)
	}
	return strings.Join(parts, "\n"), nil
}

func buyerShowShotInstruction(slotIndex int) string {
	switch slotIndex {
	case 2:
		return "同一空间内的 45 度平视全景，展示商品与周边环境关系，商品约占画面 45%-60%，作为空间建立图"
	case 3:
		return "同一空间内的低机位侧向中景，在参考图可见范围内改变拍摄方向，商品约占画面 25%-45%，保留墙地或主要背景锚点，不能复用全景构图"
	case 4:
		return "同一空间内的结构、材质或关键部件近景，同时保留一处可辨识的环境锚点，不能再次拍成完整全景"
	case 5:
		return "同一空间内的轻俯视或不同高度的 45 度中远景，展示与图 2 不同的一侧或合理的开合、收纳状态，商品占比和相机高度必须变化"
	case 6:
		return "同一空间内的真实使用状态中景，仅在合理时出现一只手或局部动作；从参考图可见方向取景，保留空间关系，不能复用已有构图"
	default:
		return ""
	}
}

func productIdentity(product model.BuyerShowProduct) string {
	parts := make([]string, 0, 4)
	if value := strings.TrimSpace(product.Name); value != "" {
		parts = append(parts, "产品："+value)
	}
	if value := strings.TrimSpace(product.Material); value != "" {
		parts = append(parts, "材质："+value)
	}
	if value := strings.TrimSpace(product.Color); value != "" {
		parts = append(parts, "颜色："+value)
	}
	if value := strings.TrimSpace(product.Spec); value != "" {
		parts = append(parts, "规格："+value)
	}
	if len(parts) == 0 {
		return "严格以输入图中的商品主体为准。"
	}
	return strings.Join(parts, "；") + "。"
}

// BuildBuyerShowReviewRewritePrompt returns prompts for a plain-text chat model.
func BuildBuyerShowReviewRewritePrompt(reviewText, tone string, maxChars int) (string, string, error) {
	reviewText = strings.TrimSpace(reviewText)
	if reviewText == "" {
		return "", "", fmt.Errorf("评价内容不能为空")
	}
	if maxChars <= 0 {
		maxChars = 120
	}
	if maxChars > 1000 {
		maxChars = 1000
	}
	if strings.TrimSpace(tone) == "" {
		tone = "自然、真实、简洁的买家口吻"
	}
	system := "你是电商评价编辑。只返回改写后的纯文本评价，不加标题、引号、Markdown 或解释；不得虚构原文没有的功能、材质、规格或效果。"
	user := fmt.Sprintf("请将下面评价改写成%s，保留原意和事实，控制在%d个中文字符以内：\n%s", tone, maxChars, reviewText)
	return system, user, nil
}
