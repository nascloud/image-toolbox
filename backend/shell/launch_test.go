package shell

import (
	"reflect"
	"testing"
)

func TestParseLaunchIntent_NoArgs(t *testing.T) {
	intent := ParseLaunchIntent(nil)
	if intent != nil {
		t.Errorf("expected nil, got %+v", intent)
	}
}

func TestParseLaunchIntent_NoArgsEmpty(t *testing.T) {
	intent := ParseLaunchIntent([]string{})
	if intent != nil {
		t.Errorf("expected nil, got %+v", intent)
	}
}

func TestParseLaunchIntent_PageOnly(t *testing.T) {
	intent := ParseLaunchIntent([]string{"--page=convert"})
	if intent == nil {
		t.Fatal("expected non-nil intent")
	}
	if intent.Page != "convert" {
		t.Errorf("page = %q, want convert", intent.Page)
	}
	if len(intent.Files) != 0 {
		t.Errorf("files = %v, want empty", intent.Files)
	}
}

func TestParseLaunchIntent_PageSeparateArg(t *testing.T) {
	intent := ParseLaunchIntent([]string{"--page", "slice"})
	if intent == nil {
		t.Fatal("expected non-nil intent")
	}
	if intent.Page != "slice" {
		t.Errorf("page = %q, want slice", intent.Page)
	}
}

func TestParseLaunchIntent_PageAndFiles(t *testing.T) {
	intent := ParseLaunchIntent([]string{
		"--page=slice",
		`C:\Users\test\image1.jpg`,
		`C:\Users\test\image2.png`,
	})
	if intent == nil {
		t.Fatal("expected non-nil intent")
	}
	if intent.Page != "slice" {
		t.Errorf("page = %q, want slice", intent.Page)
	}
	expected := []string{`C:\Users\test\image1.jpg`, `C:\Users\test\image2.png`}
	if !reflect.DeepEqual(intent.Files, expected) {
		t.Errorf("files = %v, want %v", intent.Files, expected)
	}
}

func TestParseLaunchIntent_NoPageFlag(t *testing.T) {
	intent := ParseLaunchIntent([]string{`C:\file.jpg`})
	if intent != nil {
		t.Errorf("expected nil without --page, got %+v", intent)
	}
}

func TestParseLaunchIntent_QuotedPaths(t *testing.T) {
	intent := ParseLaunchIntent([]string{
		"--page=watermark",
		`"C:\path with spaces\file.jpg"`,
	})
	if intent == nil {
		t.Fatal("expected non-nil intent")
	}
	if len(intent.Files) != 1 || intent.Files[0] != `C:\path with spaces\file.jpg` {
		t.Errorf("unquoted file = %v", intent.Files)
	}
}
