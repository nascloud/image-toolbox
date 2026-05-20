package shell

import (
	"os"
	"strings"
)

func ParseLaunchIntent(args []string) *LaunchIntent {
	if len(args) == 0 {
		return nil
	}

	page := ""
	var files []string

	for i := 0; i < len(args); i++ {
		arg := args[i]
		if strings.HasPrefix(arg, "--page=") {
			page = strings.TrimPrefix(arg, "--page=")
		} else if strings.HasPrefix(arg, "--page") && i+1 < len(args) {
			i++
			page = args[i]
		} else {
			path := strings.Trim(arg, "\"")
			if path != "" {
				files = append(files, path)
			}
		}
	}

	if page == "" {
		return nil
	}

	return &LaunchIntent{
		Page:  page,
		Files: files,
	}
}

func HasLaunchFlags() bool {
	for _, arg := range os.Args[1:] {
		if strings.HasPrefix(arg, "--page") {
			return true
		}
	}
	return false
}
