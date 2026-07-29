package file

import (
	"bytes"
	"fmt"
	"hash/fnv"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"unicode/utf8"

	"golang.org/x/text/encoding/simplifiedchinese"
	"golang.org/x/text/transform"

	backendImage "image-toolbox/backend/image"
	"image-toolbox/backend/model"
)

const maxBuyerShowReviewBytes = 1 << 20

var reviewNames = []string{"评价.txt", "好评.txt", "review.txt", "评价文案.txt"}

// ScanBuyerShowSets imports folders and performs only local filesystem/image work.
func ScanBuyerShowSets(req model.BuyerShowScanRequest) (model.BuyerShowScanResult, error) {
	root := strings.TrimSpace(req.RootPath)
	if root == "" {
		return model.BuyerShowScanResult{}, fmt.Errorf("请选择文件夹")
	}
	absoluteRoot, err := filepath.Abs(root)
	if err != nil {
		return model.BuyerShowScanResult{}, fmt.Errorf("resolve folder: %w", err)
	}
	info, err := os.Stat(absoluteRoot)
	if err != nil {
		return model.BuyerShowScanResult{}, fmt.Errorf("读取文件夹失败：%w", err)
	}
	if !info.IsDir() {
		return model.BuyerShowScanResult{}, fmt.Errorf("所选路径不是文件夹")
	}

	var setDirs []string
	result := model.BuyerShowScanResult{
		Sets:     make([]model.BuyerShowSet, 0),
		Warnings: make([]string, 0),
	}
	switch req.Mode {
	case model.BuyerShowImportSingle:
		setDirs = []string{absoluteRoot}
	case model.BuyerShowImportParent:
		entries, readErr := os.ReadDir(absoluteRoot)
		if readErr != nil {
			return result, fmt.Errorf("读取大文件夹失败：%w", readErr)
		}
		for _, entry := range entries {
			if entry.IsDir() {
				setDirs = append(setDirs, filepath.Join(absoluteRoot, entry.Name()))
			} else if IsImageFile(filepath.Ext(entry.Name())) {
				result.Warnings = append(result.Warnings, fmt.Sprintf("已忽略根目录散落图片：%s", entry.Name()))
			}
		}
	default:
		return result, fmt.Errorf("不支持的导入模式：%s", req.Mode)
	}

	sort.Slice(setDirs, func(i, j int) bool { return naturalLess(filepath.Base(setDirs[i]), filepath.Base(setDirs[j])) })
	for _, dir := range setDirs {
		set, scanErr := scanBuyerShowSet(dir)
		if scanErr != nil {
			result.Warnings = append(result.Warnings, fmt.Sprintf("%s：%v", filepath.Base(dir), scanErr))
			continue
		}
		result.Sets = append(result.Sets, set)
	}
	if len(result.Sets) == 0 && req.Mode == model.BuyerShowImportSingle {
		return result, fmt.Errorf("该文件夹中没有可用图片")
	}
	return result, nil
}

func scanBuyerShowSet(dir string) (model.BuyerShowSet, error) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return model.BuyerShowSet{}, fmt.Errorf("读取套装失败：%w", err)
	}

	imagePaths := make([]string, 0)
	textPaths := make([]string, 0)
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		path := filepath.Join(dir, entry.Name())
		if IsImageFile(filepath.Ext(entry.Name())) {
			imagePaths = append(imagePaths, path)
		} else if strings.EqualFold(filepath.Ext(entry.Name()), ".txt") {
			textPaths = append(textPaths, path)
		}
	}
	if len(imagePaths) == 0 {
		return model.BuyerShowSet{}, fmt.Errorf("没有可用图片")
	}
	sort.Slice(imagePaths, func(i, j int) bool { return naturalLess(filepath.Base(imagePaths[i]), filepath.Base(imagePaths[j])) })
	sort.Slice(textPaths, func(i, j int) bool { return naturalLess(filepath.Base(textPaths[i]), filepath.Base(textPaths[j])) })

	set := model.BuyerShowSet{
		ID:               stableBuyerShowID(dir),
		Name:             filepath.Base(filepath.Clean(dir)),
		FolderPath:       dir,
		ImageCount:       len(imagePaths),
		Slots:            emptyBuyerShowSlots(),
		UnassignedImages: make([]model.BuyerShowImageCandidate, 0),
		BasisMode:        "",
		Warnings:         make([]string, 0),
	}

	reviewPath, reviewText, reviewWarnings := readBuyerShowReview(textPaths)
	set.ReviewPath = reviewPath
	set.ReviewText = reviewText
	set.Warnings = append(set.Warnings, reviewWarnings...)

	candidates := make([]model.BuyerShowImageCandidate, 0, len(imagePaths))
	for _, imagePath := range imagePaths {
		analysis, analyzeErr := backendImage.AnalyzeWhiteBackground(imagePath, backendImage.DefaultWhiteBackgroundOptions())
		if analyzeErr != nil {
			set.Warnings = append(set.Warnings, fmt.Sprintf("%s：白底识别失败", filepath.Base(imagePath)))
		}
		candidates = append(candidates, model.BuyerShowImageCandidate{
			Path:            imagePath,
			FileName:        filepath.Base(imagePath),
			WhiteBackground: analysis,
		})
	}

	whiteIndex := -1
	bestScore := -1.0
	for index, candidate := range candidates {
		if candidate.WhiteBackground.IsWhiteBackground && candidate.WhiteBackground.Score > bestScore {
			whiteIndex = index
			bestScore = candidate.WhiteBackground.Score
		}
	}
	if whiteIndex >= 0 {
		set.Slots[0].SourcePath = candidates[whiteIndex].Path
		set.Slots[0].Status = "local"
	}

	buyerSlot := 1
	for index, candidate := range candidates {
		if index == whiteIndex || candidate.WhiteBackground.IsWhiteBackground {
			if index != whiteIndex {
				set.UnassignedImages = append(set.UnassignedImages, candidate)
			}
			continue
		}
		if buyerSlot < len(set.Slots) {
			set.Slots[buyerSlot].SourcePath = candidate.Path
			set.Slots[buyerSlot].Status = "local"
			buyerSlot++
		} else {
			set.UnassignedImages = append(set.UnassignedImages, candidate)
		}
	}
	return set, nil
}

func emptyBuyerShowSlots() []model.BuyerShowSlot {
	slots := make([]model.BuyerShowSlot, 6)
	for index := range slots {
		role := model.BuyerShowSlotBuyer
		if index == 0 {
			role = model.BuyerShowSlotWhite
		}
		slots[index] = model.BuyerShowSlot{Index: index + 1, Role: role, Status: "empty"}
	}
	return slots
}

func readBuyerShowReview(paths []string) (string, string, []string) {
	if len(paths) == 0 {
		return "", "", nil
	}
	warnings := make([]string, 0)
	if len(paths) > 1 {
		warnings = append(warnings, fmt.Sprintf("检测到 %d 个评价文本，已按固定优先级读取一个", len(paths)))
	}
	path := preferredReviewPath(paths)
	data, err := os.ReadFile(path)
	if err != nil {
		return "", "", append(warnings, fmt.Sprintf("读取评价失败：%v", err))
	}
	if len(data) > maxBuyerShowReviewBytes {
		return path, "", append(warnings, "评价文本超过 1 MiB，已跳过")
	}
	data = bytes.TrimPrefix(data, []byte{0xEF, 0xBB, 0xBF})
	var text string
	if utf8.Valid(data) {
		text = string(data)
	} else {
		decoded, _, decodeErr := transform.Bytes(simplifiedchinese.GB18030.NewDecoder(), data)
		if decodeErr != nil {
			return path, "", append(warnings, "评价文本编码无法识别")
		}
		text = string(decoded)
	}
	text = strings.ReplaceAll(text, "\r\n", "\n")
	text = strings.ReplaceAll(text, "\r", "\n")
	return path, strings.TrimSpace(text), warnings
}

func preferredReviewPath(paths []string) string {
	for _, preferred := range reviewNames {
		for _, path := range paths {
			if strings.EqualFold(filepath.Base(path), preferred) {
				return path
			}
		}
	}
	return paths[0]
}

func stableBuyerShowID(path string) string {
	normalized := strings.ToLower(filepath.Clean(path))
	hasher := fnv.New64a()
	_, _ = hasher.Write([]byte(normalized))
	return fmt.Sprintf("set-%016x", hasher.Sum64())
}

func naturalLess(a, b string) bool {
	aRunes, bRunes := []rune(strings.ToLower(a)), []rune(strings.ToLower(b))
	for ai, bi := 0, 0; ai < len(aRunes) && bi < len(bRunes); {
		if isDigit(aRunes[ai]) && isDigit(bRunes[bi]) {
			aStart, bStart := ai, bi
			for ai < len(aRunes) && isDigit(aRunes[ai]) {
				ai++
			}
			for bi < len(bRunes) && isDigit(bRunes[bi]) {
				bi++
			}
			aNumber := strings.TrimLeft(string(aRunes[aStart:ai]), "0")
			bNumber := strings.TrimLeft(string(bRunes[bStart:bi]), "0")
			if aNumber == "" {
				aNumber = "0"
			}
			if bNumber == "" {
				bNumber = "0"
			}
			if len(aNumber) != len(bNumber) {
				return len(aNumber) < len(bNumber)
			}
			if aNumber != bNumber {
				return aNumber < bNumber
			}
			continue
		}
		if aRunes[ai] != bRunes[bi] {
			return aRunes[ai] < bRunes[bi]
		}
		ai++
		bi++
	}
	return len(aRunes) < len(bRunes)
}

func isDigit(value rune) bool { return value >= '0' && value <= '9' }
