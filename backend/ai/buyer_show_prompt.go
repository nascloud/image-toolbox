package ai

import (
	"fmt"
	"strings"

	"image-toolbox/backend/model"
)

// DefaultBuyerShowNegativePrompt is sent through the provider's dedicated field.
const DefaultBuyerShowNegativePrompt = "text, watermark, logo, text overlays, extra people, fake CGI render, catalog studio lighting, mutated structural parts, generic stock photo vibes"

// BuildBuyerShowPrompt builds one deterministic fixed-slot prompt for a single basis image.
func BuildBuyerShowPrompt(globalPrompt, reviewText, basisMode string, product model.BuyerShowProduct, slotIndex int, extraPrompt string) (string, error) {
	return BuildBuyerShowPromptWithReferences(globalPrompt, reviewText, basisMode, product, slotIndex, 1, extraPrompt)
}

// BuildBuyerShowPromptWithReferences adds reference-count-aware scene consistency instructions.
func BuildBuyerShowPromptWithReferences(globalPrompt, reviewText, basisMode string, product model.BuyerShowProduct, slotIndex, referenceCount int, extraPrompt string) (string, error) {
	if slotIndex < 2 || slotIndex > 6 {
		return "", fmt.Errorf("buyer-show slot must be between 2 and 6")
	}
	if basisMode != model.BuyerShowBasisWhiteBackground && basisMode != model.BuyerShowBasisExistingScene {
		return "", fmt.Errorf("请选择基于白底图或已有场景")
	}

	scenes := map[int]string{
		2: "自然手持或第一视角，像买家刚收到商品后随手拍摄",
		3: "真实居家或日常使用场景，构图自然且有轻微生活痕迹",
		4: "突出材质、做工与关键结构的近距离细节图",
		5: "从另一侧角度展示商品，保持合理透视和真实比例",
		6: "自然生活方式场景，呈现商品实际使用状态",
	}
	basisInstruction := "以输入的白底商品图为唯一商品依据，为商品创建真实、合理的使用环境。"
	if basisMode == model.BuyerShowBasisExistingScene {
		if referenceCount > 1 {
			basisInstruction = fmt.Sprintf("输入的 %d 张已有场景图属于同一套商品参考。以第一张图为主要场景锚点，综合其余图片中的商品结构、空间细节和拍摄风格；保持同一房间、墙地材质、主要背景物、光线方向与色温，只改变当前图位要求的观察角度、景别或使用动作。", referenceCount)
		} else {
			basisInstruction = "以输入的已有场景图为依据，保留主要空间关系、透视、光线与商品特征。"
		}
	}

	parts := []string{
		productIdentity(product),
		basisInstruction,
		"生成真实买家随手拍风格，不要商业棚拍、广告海报或过度精修质感。",
		"严格保持商品主体、结构、材质、颜色、Logo、配件和关键细节，不增加不存在的部件。",
		"画面中不得生成评价文字、标题、水印、边框或拼图。",
		"本图要求：" + scenes[slotIndex] + "。",
	}
	if value := strings.TrimSpace(reviewText); value != "" {
		parts = append(parts, "评价仅作为使用感受与场景语义参考，不要把文字画进图片："+value)
	}
	if value := strings.TrimSpace(globalPrompt); value != "" {
		parts = append(parts, "全局补充要求："+value)
	}
	if value := strings.TrimSpace(extraPrompt); value != "" {
		parts = append(parts, "本次重绘补充要求："+value)
	}
	return strings.Join(parts, "\n"), nil
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
