package batch

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"unicode/utf8"

	backendAI "image-toolbox/backend/ai"
	"image-toolbox/backend/config"
	"image-toolbox/backend/model"
)

const maxBuyerShowConcurrency = 10

var (
	unsafeBuyerShowPathChars = regexp.MustCompile(`[<>:"/\\|?*\x00-\x1f]+`)
	buyerShowOutputLocks     sync.Map
)

type buyerShowSetJob struct {
	set        model.BuyerShowGenerateSet
	basisPaths []string
	validation error
}

// RunBuyerShowBatch processes at most Concurrent sets in parallel. Slots 2-6 in each set run serially,
// and every successful output becomes an additional reference for the remaining slots in that set.
func RunBuyerShowBatch(ctx context.Context, req model.BuyerShowBatchRequest, configPath string, progressCh chan<- model.BuyerShowProgressUpdate) model.BuyerShowBatchResult {
	if len(req.Sets) == 0 {
		return model.BuyerShowBatchResult{Error: "请至少添加一套买家秀"}
	}
	provider, options, err := loadBuyerShowProvider(req.Options, configPath)
	if err != nil {
		return model.BuyerShowBatchResult{Error: err.Error()}
	}

	jobs := make([]buyerShowSetJob, len(req.Sets))
	for index, set := range req.Sets {
		basisPaths, validation := resolveBuyerShowBasisPaths(set)
		jobs[index] = buyerShowSetJob{set: set, basisPaths: basisPaths, validation: validation}
	}

	total := len(jobs) * 5
	result := model.BuyerShowBatchResult{Total: total, Results: make([]model.BuyerShowSlotResult, total)}
	concurrency := options.Concurrent
	if concurrency <= 0 {
		concurrency = 3
	}
	if concurrency > maxBuyerShowConcurrency {
		concurrency = maxBuyerShowConcurrency
	}
	if concurrency > len(jobs) {
		concurrency = len(jobs)
	}

	sem := make(chan struct{}, concurrency)
	var wg sync.WaitGroup
	var progressMu sync.Mutex
	completed := 0
	recordResult := func(resultIndex int, slotResult model.BuyerShowSlotResult) {
		result.Results[resultIndex] = slotResult
		progressMu.Lock()
		completed++
		currentCompleted := completed
		progressMu.Unlock()
		sendBuyerShowProgress(ctx, progressCh, model.BuyerShowProgressUpdate{
			BatchID: req.BatchID, SetID: slotResult.SetID, SlotIndex: slotResult.SlotIndex,
			Completed: currentCompleted, Total: total, Result: &slotResult, Error: slotResult.Error,
		})
	}

	for setIndex, job := range jobs {
		wg.Add(1)
		go func(currentSetIndex int, current buyerShowSetJob) {
			defer wg.Done()
			resultOffset := currentSetIndex * 5
			if current.validation != nil {
				for slot := 2; slot <= 6; slot++ {
					recordResult(resultOffset+slot-2, failedBuyerShowSlotResult(current.set, slot, current.validation.Error()))
				}
				return
			}

			select {
			case sem <- struct{}{}:
				defer func() { <-sem }()
			case <-ctx.Done():
				for slot := 2; slot <= 6; slot++ {
					recordResult(resultOffset+slot-2, failedBuyerShowSlotResult(current.set, slot, "已取消"))
				}
				return
			}

			relayPaths := append([]string(nil), current.basisPaths...)
			for slot := 2; slot <= 6; slot++ {
				resultIndex := resultOffset + slot - 2
				if ctx.Err() != nil {
					recordResult(resultIndex, failedBuyerShowSlotResult(current.set, slot, "已取消"))
					continue
				}
				slotResult := generateBuyerShowSlot(ctx, provider, options, current.set, slot, relayPaths, "")
				recordResult(resultIndex, slotResult)
				if slotResult.Success && slotResult.OutputPath != "" {
					relayPaths = appendUniqueBuyerShowPath(relayPaths, slotResult.OutputPath)
				}
			}
		}(setIndex, job)
	}
	wg.Wait()

	for _, item := range result.Results {
		if item.Success {
			result.Success++
		} else {
			result.Failed++
		}
	}
	sendBuyerShowProgress(ctx, progressCh, model.BuyerShowProgressUpdate{BatchID: req.BatchID, Completed: result.Total, Total: result.Total, Done: true})
	return result
}

// RedrawBuyerShowSlot regenerates one target slot without changing any other slot.
func RedrawBuyerShowSlot(ctx context.Context, req model.BuyerShowRedrawRequest, configPath string) (model.BuyerShowSlotResult, error) {
	provider, options, err := loadBuyerShowProvider(req.Options, configPath)
	if err != nil {
		return model.BuyerShowSlotResult{}, err
	}
	if req.TargetSlotIndex < 2 || req.TargetSlotIndex > 6 {
		return model.BuyerShowSlotResult{}, fmt.Errorf("只能重绘第 2-6 图位")
	}
	basisPaths, err := resolveBuyerShowBasisPaths(req.Set)
	if err != nil {
		return model.BuyerShowSlotResult{}, err
	}
	result := generateBuyerShowSlot(ctx, provider, options, req.Set, req.TargetSlotIndex, basisPaths, req.ExtraPrompt)
	if !result.Success {
		return result, fmt.Errorf("%s", result.Error)
	}
	return result, nil
}

func loadBuyerShowProvider(options model.BuyerShowGenerationOptions, configPath string) (backendAI.Provider, model.BuyerShowGenerationOptions, error) {
	providerName := strings.TrimSpace(options.Provider)
	if providerName == "" {
		providerName = backendAI.ProviderSeedream
	}
	apiKey, baseURL, err := config.LoadProviderConfig(configPath, providerName)
	if err != nil {
		return nil, options, fmt.Errorf("读取 %s 配置失败：%w", providerName, err)
	}
	if apiKey == "" {
		return nil, options, fmt.Errorf("尚未配置 %s API Key，请先前往设置", providerName)
	}
	provider, err := backendAI.NewProvider(providerName, apiKey, baseURL)
	if err != nil {
		return nil, options, err
	}
	if strings.TrimSpace(options.Model) == "" {
		if providerName == backendAI.ProviderChatGPT2API {
			options.Model = "gpt-image-2"
		} else {
			options.Model = "doubao-seedream-5-0-260128"
		}
	}
	if strings.TrimSpace(options.Size) == "" {
		if providerName == backendAI.ProviderChatGPT2API {
			options.Size = "auto"
		} else {
			options.Size = "2K"
		}
	}
	if strings.TrimSpace(options.OutputFormat) == "" {
		options.OutputFormat = "png"
	}
	return provider, options, nil
}

func resolveBuyerShowBasisPaths(set model.BuyerShowGenerateSet) ([]string, error) {
	if strings.TrimSpace(set.SetID) == "" {
		return nil, fmt.Errorf("套装缺少 ID")
	}
	if len(set.Slots) != 6 {
		return nil, fmt.Errorf("%s 必须包含 6 个图位", set.SetName)
	}
	for index, slot := range set.Slots {
		expectedIndex := index + 1
		expectedRole := model.BuyerShowSlotBuyer
		if expectedIndex == 1 {
			expectedRole = model.BuyerShowSlotWhite
		}
		if slot.Index != expectedIndex || slot.Role != expectedRole {
			return nil, fmt.Errorf("%s 的图位结构无效，请重新导入", set.SetName)
		}
	}
	if set.BasisMode != model.BuyerShowBasisWhiteBackground && set.BasisMode != model.BuyerShowBasisExistingScene {
		return nil, fmt.Errorf("%s 尚未选择生成依据", set.SetName)
	}

	indices := append([]int(nil), set.BasisSlotIndices...)
	if len(indices) == 0 && set.BasisSlotIndex > 0 {
		indices = []int{set.BasisSlotIndex}
	}
	if set.BasisMode == model.BuyerShowBasisWhiteBackground {
		if len(indices) != 1 || indices[0] != 1 {
			return nil, fmt.Errorf("%s 的白底图依据必须选择图位 1", set.SetName)
		}
	} else if len(indices) == 0 {
		return nil, fmt.Errorf("%s 请至少选择第 2-6 图位中的一张已有场景", set.SetName)
	}

	seen := make(map[int]struct{}, len(indices))
	paths := make([]string, 0, len(indices))
	for _, index := range indices {
		if set.BasisMode == model.BuyerShowBasisExistingScene && (index < 2 || index > 6) {
			return nil, fmt.Errorf("%s 的已有场景依据只能选择第 2-6 图位", set.SetName)
		}
		if _, duplicate := seen[index]; duplicate {
			continue
		}
		seen[index] = struct{}{}
		basis := set.Slots[index-1]
		basisPath := basis.OutputPath
		if basisPath == "" {
			basisPath = basis.SourcePath
		}
		if basisPath == "" {
			return nil, fmt.Errorf("%s 的生成依据图位 %d 为空", set.SetName, index)
		}
		if _, err := os.Stat(basisPath); err != nil {
			return nil, fmt.Errorf("%s 的生成依据图位 %d 不存在：%w", set.SetName, index, err)
		}
		paths = append(paths, basisPath)
	}
	return paths, nil
}

// validateBuyerShowSet keeps the legacy single-path helper for callers and tests.
func validateBuyerShowSet(set model.BuyerShowGenerateSet) (string, error) {
	paths, err := resolveBuyerShowBasisPaths(set)
	if err != nil {
		return "", err
	}
	return paths[0], nil
}

func generateBuyerShowSlot(ctx context.Context, provider backendAI.Provider, options model.BuyerShowGenerationOptions, set model.BuyerShowGenerateSet, slotIndex int, basisPaths []string, extraPrompt string) model.BuyerShowSlotResult {
	basisPath := basisPaths[0]
	result := model.BuyerShowSlotResult{SetID: set.SetID, SlotIndex: slotIndex, SourcePath: basisPath}
	prompt, err := backendAI.BuildBuyerShowPromptWithReferences(options.GlobalPrompt, set.ReviewText, set.BasisMode, set.Product, slotIndex, len(basisPaths), extraPrompt)
	if err != nil {
		result.Error = err.Error()
		return result
	}

	lockKey := buyerShowOutputKey(options.OutputDir, set, slotIndex)
	lockValue, _ := buyerShowOutputLocks.LoadOrStore(lockKey, &sync.Mutex{})
	outputLock := lockValue.(*sync.Mutex)
	outputLock.Lock()
	defer outputLock.Unlock()

	revision := nextBuyerShowRevision(options.OutputDir, set, slotIndex)
	if len(set.Slots) >= slotIndex && set.Slots[slotIndex-1].Revision >= revision {
		revision = set.Slots[slotIndex-1].Revision + 1
	}
	outputPath := buyerShowOutputPath(options.OutputDir, set, slotIndex, revision, options.OutputFormat)
	request := model.AIBatchRequest{
		Provider: options.Provider, N: 1, Prompt: prompt, NegativePrompt: options.NegativePrompt,
		Model: options.Model, Size: options.Size, Quality: options.Quality, Seed: options.Seed,
		OutputFormat: options.OutputFormat, Watermark: options.Watermark, ResponseFormat: "url",
		SequentialImageGeneration: "disabled", MaxImages: 1, Concurrent: 1,
		ReferenceImages: append([]string(nil), basisPaths[1:]...),
	}
	paths, err := backendAI.ProcessSingleImagesWithContext(ctx, provider, basisPath, filepath.Dir(outputPath), request, outputPath)
	if err != nil || len(paths) == 0 {
		if err == nil {
			err = fmt.Errorf("未返回图片")
		}
		result.Error = fmt.Sprintf("%s 第 %d 图位生成失败：%v", set.SetName, slotIndex, err)
		return result
	}
	result.OutputPath = paths[0]
	result.Revision = revision
	result.Success = true
	return result
}

func buyerShowOutputKey(root string, set model.BuyerShowGenerateSet, slotIndex int) string {
	return strings.ToLower(filepath.Clean(fmt.Sprintf("%s|%02d", buyerShowOutputDir(root, set), slotIndex)))
}

func buyerShowOutputPath(root string, set model.BuyerShowGenerateSet, slotIndex, revision int, format string) string {
	return filepath.Join(buyerShowOutputDir(root, set), fmt.Sprintf("%02d_buyer_show_v%03d%s", slotIndex, revision, buyerShowOutputExt(format)))
}

func nextBuyerShowRevision(root string, set model.BuyerShowGenerateSet, slotIndex int) int {
	dir := buyerShowOutputDir(root, set)
	entries, err := os.ReadDir(dir)
	if err != nil {
		return 1
	}
	maximum := 0
	prefix := fmt.Sprintf("%02d_buyer_show_v", slotIndex)
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasPrefix(entry.Name(), prefix) {
			continue
		}
		extension := strings.ToLower(filepath.Ext(entry.Name()))
		if extension != ".png" && extension != ".jpg" && extension != ".jpeg" && extension != ".webp" {
			continue
		}
		value := strings.TrimSuffix(strings.TrimPrefix(entry.Name(), prefix), filepath.Ext(entry.Name()))
		var revision int
		if _, scanErr := fmt.Sscanf(value, "%d", &revision); scanErr == nil && revision > maximum {
			maximum = revision
		}
	}
	return maximum + 1
}

func buyerShowOutputDir(root string, set model.BuyerShowGenerateSet) string {
	if strings.TrimSpace(root) == "" {
		root = filepath.Join(set.FolderPath, "buyer-show-output")
	}
	name := sanitizeBuyerShowPath(set.SetName)
	if name == "" {
		name = "buyer-show"
	}
	id := strings.TrimPrefix(set.SetID, "set-")
	return filepath.Join(root, name+"_"+id)
}

func buyerShowOutputExt(format string) string {
	if strings.EqualFold(format, "jpg") || strings.EqualFold(format, "jpeg") {
		return ".jpg"
	}
	return ".png"
}

func sanitizeBuyerShowPath(value string) string {
	value = unsafeBuyerShowPathChars.ReplaceAllString(strings.TrimSpace(value), "_")
	return strings.Trim(value, ". ")
}

func appendUniqueBuyerShowPath(paths []string, path string) []string {
	cleanPath := filepath.Clean(path)
	for _, existing := range paths {
		if strings.EqualFold(filepath.Clean(existing), cleanPath) {
			return paths
		}
	}
	return append(paths, path)
}

func failedBuyerShowSlotResult(set model.BuyerShowGenerateSet, slotIndex int, message string) model.BuyerShowSlotResult {
	return model.BuyerShowSlotResult{SetID: set.SetID, SlotIndex: slotIndex, Success: false, Error: message}
}

func sendBuyerShowProgress(ctx context.Context, ch chan<- model.BuyerShowProgressUpdate, update model.BuyerShowProgressUpdate) {
	if ch == nil {
		return
	}
	select {
	case ch <- update:
	case <-ctx.Done():
	}
}

// RewriteBuyerShowReview calls only an explicitly configured plain-text endpoint.
func RewriteBuyerShowReview(ctx context.Context, req model.BuyerShowReviewRewriteRequest, configPath string) (model.BuyerShowReviewRewriteResult, error) {
	providerName := strings.TrimSpace(req.Provider)
	if providerName == "" {
		providerName = backendAI.ProviderSeedream
	}
	apiKey, modelID, endpoint, err := config.LoadProviderReviewConfig(configPath, providerName)
	if err != nil {
		return model.BuyerShowReviewRewriteResult{}, err
	}
	if apiKey == "" {
		return model.BuyerShowReviewRewriteResult{}, fmt.Errorf("尚未配置 %s API Key", providerName)
	}
	if modelID == "" || endpoint == "" {
		return model.BuyerShowReviewRewriteResult{}, fmt.Errorf("%s 尚未配置评价重写模型和 Endpoint", providerName)
	}
	systemPrompt, userPrompt, err := backendAI.BuildBuyerShowReviewRewritePrompt(req.ReviewText, req.Tone, req.MaxChars)
	if err != nil {
		return model.BuyerShowReviewRewriteResult{}, err
	}
	client := backendAI.NewOpenAICompatibleTextProvider(apiKey, endpoint)
	rewritten, err := client.Rewrite(ctx, modelID, systemPrompt, userPrompt)
	if err != nil {
		return model.BuyerShowReviewRewriteResult{}, err
	}
	if req.MaxChars > 0 && utf8.RuneCountInString(rewritten) > req.MaxChars {
		runes := []rune(rewritten)
		rewritten = strings.TrimSpace(string(runes[:req.MaxChars]))
	}
	return model.BuyerShowReviewRewriteResult{Original: req.ReviewText, Rewritten: rewritten}, nil
}
